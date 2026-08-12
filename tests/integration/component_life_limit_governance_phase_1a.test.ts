import { randomUUID } from 'node:crypto';
import { QueryTypes, Transaction } from 'sequelize';
import { afterAll, describe, expect, it } from 'vitest';
import sequelize from '../../src/config/database.js';
import { LibraryService } from '../../src/modules/library/library.service.js';
import { ComponentLifeLimitGovernanceService } from '../../src/modules/library/component-life-limit-governance.service.js';

type Fixture = { model_id: string; user_a: string; user_b: string; user_c: string };

async function withRollback(work: (transaction: Transaction, fixture: Fixture) => Promise<void>) {
  const transaction = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE });
  try {
    const fixtureKey = randomUUID();
    const [manufacturer] = await sequelize.query<{ id: string }>(
      `INSERT INTO manufacturers(name,code) VALUES(:name,:code) RETURNING id;`,
      { replacements: { name: `Phase 1A ${fixtureKey}`, code: `P1A-${fixtureKey}` }, type: QueryTypes.SELECT, transaction }
    );
    const [assetType] = await sequelize.query<{ id: string }>(
      `INSERT INTO rf_asset_type(code,label) VALUES(:code,:label) RETURNING id;`,
      { replacements: { code: `P1A-${fixtureKey}`, label: 'Phase 1A test asset' }, type: QueryTypes.SELECT, transaction }
    );
    const [model] = await sequelize.query<{ id: string }>(
      `INSERT INTO component_models(manufacturer_id,model_name,asset_type_id,is_life_limited,is_active)
       VALUES(:manufacturer,'Phase 1A test model',:assetType,false,true) RETURNING id;`,
      { replacements: { manufacturer: manufacturer!.id, assetType: assetType!.id }, type: QueryTypes.SELECT, transaction }
    );
    const users = await sequelize.query<{ id: string }>(
      `INSERT INTO users(email,password_hash,full_name,is_active,created_at,updated_at) VALUES
       (:a,'test','Phase 1A A',true,NOW(),NOW()),(:b,'test','Phase 1A B',true,NOW(),NOW()),(:c,'test','Phase 1A C',true,NOW(),NOW()) RETURNING id;`,
      { replacements: { a: `a-${fixtureKey}@test.invalid`, b: `b-${fixtureKey}@test.invalid`, c: `c-${fixtureKey}@test.invalid` }, type: QueryTypes.SELECT, transaction }
    );
    await work(transaction, { model_id: model.id, user_a: users[0]!.id, user_b: users[1]!.id, user_c: users[2]!.id });
  } finally { await transaction.rollback(); }
}

async function expectDatabaseRejection(
  transaction: Transaction,
  work: (savepoint: Transaction) => Promise<unknown>,
  message?: string
) {
  const assertion = expect(
    sequelize.transaction({ transaction }, async (savepoint) => work(savepoint))
  ).rejects;
  if (message) await assertion.toThrow(message);
  else await assertion.toThrow();
}

function proposalSql(overrides: Record<string, unknown> = {}) {
  const values = {
    id: randomUUID(), lineage: randomUUID(), purpose: 'ESTABLISH', revision: 1,
    target: null, determination: 'LIFE_LIMITED', scope: 'ALL_SERIALS_OF_MODEL',
    absent: true, type: 'TBO_HOURS', basis: 'SINCE_OVERHAUL', hours: 100,
    cycles: null, months: null, statement: 'All serials', source: 'ICA-1',
    effective: '2026-01-01', evidence: 'Approved ICA section', reason: 'Governed source',
    ...overrides,
  };
  return { values, sql: `INSERT INTO component_life_limit_proposals
    (id, component_model_id, lineage_id, revision_number, proposal_purpose,
     target_proposal_id, determination, applicability_scope, applicability_statement,
     narrower_effectivity_absent, limit_type, basis, limit_hours, limit_cycles,
     limit_months, source_reference, source_effective_date, evidence_summary,
     proposal_reason, proposed_by)
    VALUES (:id, :model, :lineage, :revision, :purpose, :target, :determination,
     :scope, :statement, :absent, :type, :basis, :hours, :cycles, :months,
     :source, :effective, :evidence, :reason, :actor) RETURNING *;` };
}

describe('component life-limit governance Phase 1A persistence', () => {
  it('enforces service authority and atomically approves, supersedes, and withdraws dormant publications', async () => {
    await withRollback(async (transaction, fixture) => {
      await sequelize.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT :proposer, id FROM rf_role WHERE code = 'ENGINEER'
         ON CONFLICT DO NOTHING;
         INSERT INTO user_roles (user_id, role_id)
         SELECT :approver, id FROM rf_role WHERE code = 'QA'
         ON CONFLICT DO NOTHING;
         INSERT INTO user_roles (user_id, role_id)
         SELECT :proposer, id FROM rf_role WHERE code = 'ADMIN'
         ON CONFLICT DO NOTHING;
         INSERT INTO rf_role_permissions (role_id, permission_id)
         SELECT r.id, p.id FROM rf_role r CROSS JOIN rf_permission p
         WHERE (r.code = 'ENGINEER' AND p.code = 'COMPONENT_LIFE_LIMIT_PROPOSE')
            OR (r.code = 'QA' AND p.code = 'COMPONENT_LIFE_LIMIT_APPROVE')
         ON CONFLICT (role_id, permission_id) DO NOTHING;`,
        { replacements: { proposer: fixture.user_a, approver: fixture.user_b }, transaction }
      );
      const input = {
        component_model_id: fixture.model_id,
        determination: 'LIFE_LIMITED' as const,
        applicability_scope: 'ALL_SERIALS_OF_MODEL' as const,
        applicability_statement: 'All serials of this model',
        narrower_effectivity_absent: true as const,
        limit_type: 'TBO_HOURS' as const,
        basis: 'SINCE_OVERHAUL' as const,
        limit_hours: 100,
        source_reference: 'ICA 04-10-00',
        source_effective_date: '2026-01-01',
        evidence_summary: 'ICA model-wide limit',
        proposal_reason: 'Establish controlled limit',
      };
      const countBeforeDenied = await sequelize.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM component_life_limit_proposals;`,
        { type: QueryTypes.SELECT, transaction }
      );
      await sequelize.query(`DELETE FROM user_roles WHERE user_id = :userId;`, {
        replacements: { userId: fixture.user_c },
        transaction,
      });
      await expect(ComponentLifeLimitGovernanceService.propose(fixture.user_c, input, transaction))
        .rejects.toThrow('PERMISSION_DENIED');
      const countAfterDenied = await sequelize.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM component_life_limit_proposals;`,
        { type: QueryTypes.SELECT, transaction }
      );
      expect(countAfterDenied).toEqual(countBeforeDenied);
      const established = await ComponentLifeLimitGovernanceService.propose(fixture.user_a, input, transaction);
      await expect(ComponentLifeLimitGovernanceService.approve(fixture.user_a, established.id, 'self', true, transaction))
        .rejects.toThrow('SELF_DECISION_FORBIDDEN');
      const firstApproval = await ComponentLifeLimitGovernanceService.approve(fixture.user_b, established.id, 'Independent approval', true, transaction);
      expect(firstApproval.publication?.publication_state).toBe('DORMANT');

      const replacement = await ComponentLifeLimitGovernanceService.proposeRevision(
        fixture.user_a,
        established.id,
        'REPLACEMENT',
        { ...input, limit_hours: 120, proposal_reason: 'Correct source revision' },
        transaction
      );
      const replacementApproval = await ComponentLifeLimitGovernanceService.approve(fixture.user_b, replacement.id, 'Replacement approved', true, transaction);
      expect(replacementApproval.publication?.publication_state).toBe('DORMANT');
      const [superseded] = await sequelize.query<any>(
        `SELECT p.status, pub.publication_state, l.is_active
         FROM component_life_limit_proposals p
         JOIN component_life_limit_publications pub ON pub.proposal_id = p.id
         JOIN component_life_limits l ON l.id = pub.component_life_limit_id
         WHERE p.id = :id;`,
        { replacements: { id: established.id }, type: QueryTypes.SELECT, transaction }
      );
      expect(superseded).toMatchObject({ status: 'SUPERSEDED', publication_state: 'SUPERSEDED', is_active: false });

      const withdrawal = await ComponentLifeLimitGovernanceService.proposeRevision(
        fixture.user_a,
        replacement.id,
        'WITHDRAWAL',
        {
          ...input,
          limit_type: null,
          basis: null,
          limit_hours: null,
          proposal_reason: 'Authority withdrew the limit',
        },
        transaction
      );
      await ComponentLifeLimitGovernanceService.approve(fixture.user_b, withdrawal.id, 'Withdrawal approved', true, transaction);
      const [withdrawn] = await sequelize.query<any>(
        `SELECT p.status, pub.publication_state, l.is_active
         FROM component_life_limit_proposals p
         JOIN component_life_limit_publications pub ON pub.proposal_id = p.id
         JOIN component_life_limits l ON l.id = pub.component_life_limit_id
         WHERE p.id = :id;`,
        { replacements: { id: replacement.id }, type: QueryTypes.SELECT, transaction }
      );
      expect(withdrawn).toMatchObject({ status: 'WITHDRAWN', publication_state: 'WITHDRAWN', is_active: false });
      const history = await sequelize.query<any>(
        `SELECT event_code, before_snapshot, after_snapshot
         FROM component_life_limit_governance_history
         WHERE proposal_id IN (:ids) ORDER BY created_at, id;`,
        { replacements: { ids: [established.id, replacement.id, withdrawal.id] }, type: QueryTypes.SELECT, transaction }
      );
      expect(history.map(({ event_code }) => event_code)).toEqual(expect.arrayContaining([
        'PROPOSAL_CREATED', 'PROPOSAL_APPROVED', 'PUBLICATION_CREATED_DORMANT',
        'REPLACEMENT_PROPOSED', 'PUBLICATION_SUPERSEDED', 'WITHDRAWAL_PROPOSED',
        'PUBLICATION_WITHDRAWN',
      ]));
      expect(history.every(({ before_snapshot, after_snapshot }) => before_snapshot && after_snapshot)).toBe(true);
    });
  });

  it.each([
    ['TBO_HOURS', 'SINCE_OVERHAUL', 100, null, null],
    ['TBO_CYCLES', 'SINCE_OVERHAUL', null, 100, null],
    ['LIFE_LIMIT_HOURS', 'SINCE_NEW', 100, null, null],
    ['LIFE_LIMIT_CYCLES', 'SINCE_NEW', null, 100, null],
    ['CALENDAR_LIFE', 'CALENDAR', null, null, 12],
  ])('accepts ALL_SERIALS_OF_MODEL one-dimensional %s/%s', async (type, basis, hours, cycles, months) => {
    await withRollback(async (transaction, fixture) => {
      const { sql, values } = proposalSql({ type, basis, hours, cycles, months });
      const rows = await sequelize.query(sql, { replacements: { ...values, model: fixture.model_id, actor: fixture.user_a }, type: QueryTypes.SELECT, transaction });
      expect(rows).toHaveLength(1);
    });
  });

  it.each([
    [{ scope: 'SERIAL_RANGE' }, 'applicability_scope'],
    [{ absent: false }, 'narrower_effectivity_absent'],
    [{ type: 'TBO_HOURS', basis: 'SINCE_NEW' }, 'payload_shape'],
    [{ cycles: 50 }, 'payload_shape'],
    [{ evidence: ' ' }, 'evidence_summary'],
  ])('rejects invalid applicability, dimension, combination, or evidence %#', async (overrides) => {
    await withRollback(async (transaction, fixture) => {
      const { sql, values } = proposalSql(overrides);
      await expectDatabaseRejection(transaction, (savepoint) =>
        sequelize.query(sql, { replacements: { ...values, model: fixture.model_id, actor: fixture.user_a }, transaction: savepoint })
      );
    });
  });

  it('enforces independent decision, terminal immutability, hard-delete, and history immutability', async () => {
    await withRollback(async (transaction, fixture) => {
      const { sql, values } = proposalSql();
      const [proposal] = await sequelize.query<any>(sql, { replacements: { ...values, model: fixture.model_id, actor: fixture.user_a }, type: QueryTypes.SELECT, transaction });
      await expectDatabaseRejection(transaction, (savepoint) => sequelize.query(`UPDATE component_life_limit_proposals SET status='APPROVED', decision_by=:actor, decision_at=NOW(), decision_reason='self', evidence_confirmed=true WHERE id=:id`, { replacements: { actor: fixture.user_a, id: proposal.id }, transaction: savepoint }));
      await expectDatabaseRejection(transaction, (savepoint) => sequelize.query(`UPDATE component_life_limit_proposals SET status='APPROVED', decision_by=:actor, decision_at=NOW(), decision_reason='independent', evidence_confirmed=true WHERE id=:id`, { replacements: { actor: fixture.user_b, id: proposal.id }, transaction: savepoint }), 'DIRECT_TRANSITION_FORBIDDEN');
      await sequelize.query(`SELECT public.fn_cllg_decide_proposal(:id,:actor,'APPROVED','independent',true);`, { replacements: { actor: fixture.user_b, id: proposal.id }, transaction });
      const [approved] = await sequelize.query<any>(`SELECT * FROM component_life_limit_proposals WHERE id=:id`, { replacements: { id: proposal.id }, type: QueryTypes.SELECT, transaction });
      await expectDatabaseRejection(transaction, (savepoint) => sequelize.query(`UPDATE component_life_limit_proposals SET limit_hours=200 WHERE id=:id`, { replacements: { id: approved.id }, transaction: savepoint }), 'PAYLOAD_IMMUTABLE');
      for (const statement of [
        `UPDATE component_life_limit_proposals SET evidence_summary='changed' WHERE id=:id`,
        `UPDATE component_life_limit_proposals SET source_reference='changed' WHERE id=:id`,
        `UPDATE component_life_limit_proposals SET applicability_statement='changed' WHERE id=:id`,
        `UPDATE component_life_limit_proposals SET source_effective_date='2027-01-01' WHERE id=:id`,
      ]) await expectDatabaseRejection(transaction, (savepoint) => sequelize.query(statement, { replacements: { id: approved.id }, transaction: savepoint }), 'PAYLOAD_IMMUTABLE');
      await expectDatabaseRejection(transaction, (savepoint) => sequelize.query(`DELETE FROM component_life_limit_proposals WHERE id=:id`, { replacements: { id: approved.id }, transaction: savepoint }), 'GOVERNANCE_IMMUTABLE');
      const [publication] = await sequelize.query<any>(`SELECT * FROM component_life_limit_publications WHERE proposal_id=:id`, { replacements: { id: approved.id }, type: QueryTypes.SELECT, transaction });
      await expectDatabaseRejection(transaction, (savepoint) => sequelize.query(`UPDATE component_life_limit_publications SET publication_state='WITHDRAWN',terminal_by=:actor,terminal_at=NOW(),terminal_reason='direct' WHERE id=:id`, { replacements: { id: publication.id, actor: fixture.user_b }, transaction: savepoint }), 'DIRECT_TRANSITION_FORBIDDEN');
      await expectDatabaseRejection(transaction, (savepoint) => sequelize.query(`UPDATE component_life_limits SET limit_hours=200 WHERE id=:id`, { replacements: { id: publication.component_life_limit_id }, transaction: savepoint }), 'GOVERNED_ROW_IMMUTABLE');
      await expectDatabaseRejection(transaction, (savepoint) => sequelize.query(`DELETE FROM component_life_limits WHERE id=:id`, { replacements: { id: publication.component_life_limit_id }, transaction: savepoint }));
      await expectDatabaseRejection(transaction, (savepoint) => sequelize.query(`DELETE FROM component_life_limit_publications WHERE id=:id`, { replacements: { id: publication.id }, transaction: savepoint }), 'GOVERNANCE_IMMUTABLE');
      const [history] = await sequelize.query<any>(`INSERT INTO component_life_limit_governance_history (proposal_id,event_code,actor_id,reason,from_status,to_status,before_snapshot,after_snapshot) VALUES (:id,'PROPOSAL_APPROVED',:actor,'test','PROPOSED','APPROVED','{}','{}') RETURNING id`, { replacements: { id: approved.id, actor: fixture.user_b }, type: QueryTypes.SELECT, transaction });
      await expectDatabaseRejection(transaction, (savepoint) => sequelize.query(`UPDATE component_life_limit_governance_history SET reason='changed' WHERE id=:id`, { replacements: { id: history.id }, transaction: savepoint }), 'HISTORY_IMMUTABLE');
      await expectDatabaseRejection(transaction, (savepoint) => sequelize.query(`DELETE FROM component_life_limit_governance_history WHERE id=:id`, { replacements: { id: history.id }, transaction: savepoint }), 'HISTORY_IMMUTABLE');
    });
  });

  it('preserves legacy rows and evaluator UNKNOWN behavior while dormant rows remain excluded', async () => {
    await withRollback(async (transaction, fixture) => {
      const before = await sequelize.query(`SELECT * FROM component_life_limits ORDER BY id`, { type: QueryTypes.SELECT, transaction });
      const unknownBefore = LibraryService.evaluateSerializedComponentLifeLimits([], null);
      const { sql, values } = proposalSql();
      const [proposal] = await sequelize.query<any>(sql, { replacements: { ...values, model: fixture.model_id, actor: fixture.user_a }, type: QueryTypes.SELECT, transaction });
      const [decision] = await sequelize.query<{ publication_id: string }>(`SELECT public.fn_cllg_decide_proposal(:id,:actor,'APPROVED','independent',true) AS publication_id;`, { replacements: { actor: fixture.user_b, id: proposal.id }, type: QueryTypes.SELECT, transaction });
      const [limit] = await sequelize.query<any>(`SELECT l.* FROM component_life_limits l JOIN component_life_limit_publications p ON p.component_life_limit_id=l.id WHERE p.id=:id`, { replacements: { id: decision!.publication_id }, type: QueryTypes.SELECT, transaction });
      expect(LibraryService.evaluateSerializedComponentLifeLimits([limit], null)).toEqual(unknownBefore);
      const legacyAfter = await sequelize.query(`SELECT * FROM component_life_limits WHERE id <> :id ORDER BY id`, { replacements: { id: limit.id }, type: QueryTypes.SELECT, transaction });
      expect(legacyAfter).toEqual(before);
    });
  });
});

afterAll(async () => sequelize.close());
