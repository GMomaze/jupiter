import { randomUUID } from 'node:crypto';
import { QueryTypes, Transaction } from 'sequelize';
import { afterAll, describe, expect, it } from 'vitest';
import sequelize from '../../src/config/database.js';
import { ComponentLifeLimitGovernanceService, type LifeLimitProposalInput } from '../../src/modules/library/component-life-limit-governance.service.js';
import { LibraryService } from '../../src/modules/library/library.service.js';
import { WorkpackComponentIntegrationService } from '../../src/modules/workpacks/services/workpack-component-integration.service.js';
import { ComponentLimitMonitoringService } from '../../src/modules/aircraft/component-limit-monitoring.service.js';

type Fixture = { model: string; proposer: string; qa: string; admin: string; legacy: string; manufacturer: string; asset: string };

async function fixture(transaction: Transaction): Promise<Fixture> {
  const key = randomUUID();
  const [manufacturer] = await sequelize.query<{ id: string }>(`INSERT INTO manufacturers(name,code) VALUES(:name,:code) RETURNING id`, { replacements: { name: `P2 ${key}`, code: `P2-${key}` }, type: QueryTypes.SELECT, transaction });
  const [asset] = await sequelize.query<{ id: string }>(`INSERT INTO rf_asset_type(code,label) VALUES(:code,'P2') RETURNING id`, { replacements: { code: `P2-${key}` }, type: QueryTypes.SELECT, transaction });
  const [model] = await sequelize.query<{ id: string }>(`INSERT INTO component_models(manufacturer_id,model_name,asset_type_id,is_life_limited,is_active) VALUES(:manufacturer,'P2 model',:asset,false,true) RETURNING id`, { replacements: { manufacturer: manufacturer!.id, asset: asset!.id }, type: QueryTypes.SELECT, transaction });
  const users = await sequelize.query<{ id: string }>(`INSERT INTO users(email,password_hash,full_name,is_active,created_at,updated_at) VALUES(:a,'test','P2 engineer',true,NOW(),NOW()),(:q,'test','P2 qa',true,NOW(),NOW()),(:d,'test','P2 admin',true,NOW(),NOW()) RETURNING id`, { replacements: { a: `p2-a-${key}@test.invalid`, q: `p2-q-${key}@test.invalid`, d: `p2-d-${key}@test.invalid` }, type: QueryTypes.SELECT, transaction });
  await sequelize.query(`
    INSERT INTO user_roles(user_id,role_id) SELECT :proposer,id FROM rf_role WHERE code='ENGINEER' ON CONFLICT DO NOTHING;
    INSERT INTO user_roles(user_id,role_id) SELECT :qa,id FROM rf_role WHERE code='QA' ON CONFLICT DO NOTHING;
    INSERT INTO user_roles(user_id,role_id) SELECT :admin,id FROM rf_role WHERE code='ADMIN' ON CONFLICT DO NOTHING;
    INSERT INTO rf_role_permissions(role_id,permission_id)
      SELECT r.id,p.id FROM rf_role r CROSS JOIN rf_permission p
      WHERE (r.code='ENGINEER' AND p.code='COMPONENT_LIFE_LIMIT_PROPOSE')
         OR (r.code='QA' AND p.code IN ('COMPONENT_LIFE_LIMIT_APPROVE','COMPONENT_LIFE_LIMIT_ACTIVATE'))
         OR (r.code='ADMIN' AND p.code='COMPONENT_LIFE_LIMIT_ACTIVATE')
      ON CONFLICT(role_id,permission_id) DO NOTHING;`, { replacements: { proposer: users[0]!.id, qa: users[1]!.id, admin: users[2]!.id }, transaction });
  const [legacy] = await sequelize.query<{ id: string }>(`INSERT INTO component_life_limits(component_model_id,limit_type,basis,limit_hours,is_active) VALUES(:model,'LIFE_LIMIT_HOURS','SINCE_NEW',900,true) RETURNING id`, { replacements: { model: model!.id }, type: QueryTypes.SELECT, transaction });
  return { model: model!.id, proposer: users[0]!.id, qa: users[1]!.id, admin: users[2]!.id, legacy: legacy!.id, manufacturer: manufacturer!.id, asset: asset!.id };
}

async function rollback(work: (transaction: Transaction, f: Fixture) => Promise<void>) {
  const transaction = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE });
  try { await work(transaction, await fixture(transaction)); } finally { await transaction.rollback(); }
}

function input(model: string, effective = '2099-01-01', type: LifeLimitProposalInput['limit_type'] = 'TBO_HOURS'): LifeLimitProposalInput {
  const basis = type === 'CALENDAR_LIFE' ? 'CALENDAR' : type?.startsWith('TBO_') ? 'SINCE_OVERHAUL' : 'SINCE_NEW';
  return { component_model_id: model, determination: 'LIFE_LIMITED', applicability_scope: 'ALL_SERIALS_OF_MODEL', applicability_statement: 'All serials', narrower_effectivity_absent: true, limit_type: type, basis, limit_hours: type?.endsWith('HOURS') ? 100 : null, limit_cycles: type?.endsWith('CYCLES') ? 100 : null, limit_months: type === 'CALENDAR_LIFE' ? 12 : null, source_reference: 'P2 ICA', source_effective_date: effective, evidence_summary: 'Governed evidence', proposal_reason: 'P2 proposal' };
}

async function approved(transaction: Transaction, f: Fixture, proposalInput = input(f.model)) {
  const proposal = await ComponentLifeLimitGovernanceService.propose(f.proposer, proposalInput, transaction);
  const result = await ComponentLifeLimitGovernanceService.approve(f.qa, proposal.id, 'Independent approval', true, transaction);
  return { proposal, publication: result.publication! };
}

async function rejectInSavepoint(transaction: Transaction, work: (savepoint: Transaction) => Promise<unknown>, message: string) {
  await expect(sequelize.transaction({ transaction }, work)).rejects.toThrow(message);
}

async function committedApprovedFixture() {
  const transaction = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE });
  try {
    const f = await fixture(transaction);
    const governed = await approved(transaction, f);
    await transaction.commit();
    return { f, ...governed };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function committedProposedFixture() {
  const transaction = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE });
  try {
    const f = await fixture(transaction);
    const proposal = await ComponentLifeLimitGovernanceService.propose(f.proposer, input(f.model), transaction);
    await transaction.commit();
    return { f, proposal };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function removeCommittedFixture(f: Fixture) {
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(`ALTER TABLE public.component_life_limit_governance_history DISABLE TRIGGER tr_cllg_history_protect; ALTER TABLE public.component_life_limit_publications DISABLE TRIGGER tr_cllg_publication_protect; ALTER TABLE public.component_life_limit_proposals DISABLE TRIGGER tr_cllg_proposal_protect;`, { transaction });
    const proposals = await sequelize.query<{ id: string }>(`SELECT id FROM public.component_life_limit_proposals WHERE component_model_id=:model`, { replacements: { model: f.model }, type: QueryTypes.SELECT, transaction });
    const ids = proposals.map(({ id }) => id);
    if (ids.length) {
      await sequelize.query(`DELETE FROM public.component_life_limit_governance_history WHERE proposal_id IN (:ids)`, { replacements: { ids }, transaction });
      const limits = await sequelize.query<{ id: string }>(`SELECT component_life_limit_id AS id FROM public.component_life_limit_publications WHERE proposal_id IN (:ids)`, { replacements: { ids }, type: QueryTypes.SELECT, transaction });
      await sequelize.query(`DELETE FROM public.component_life_limit_publications WHERE proposal_id IN (:ids); DELETE FROM public.component_life_limit_proposals WHERE id IN (:ids)`, { replacements: { ids }, transaction });
      if (limits.length) await sequelize.query(`DELETE FROM public.component_life_limits WHERE id IN (:ids)`, { replacements: { ids: limits.map(({ id }) => id) }, transaction });
    }
    await sequelize.query(`DELETE FROM public.component_life_limits WHERE id=:legacy; DELETE FROM public.user_roles WHERE user_id IN (:users); DELETE FROM public.users WHERE id IN (:users); DELETE FROM public.component_models WHERE id=:model; DELETE FROM public.manufacturers WHERE id=:manufacturer; DELETE FROM public.rf_asset_type WHERE id=:asset;`, { replacements: { legacy: f.legacy, users: [f.proposer, f.qa, f.admin], model: f.model, manufacturer: f.manufacturer, asset: f.asset }, transaction });
    await sequelize.query(`ALTER TABLE public.component_life_limit_governance_history ENABLE TRIGGER tr_cllg_history_protect; ALTER TABLE public.component_life_limit_publications ENABLE TRIGGER tr_cllg_publication_protect; ALTER TABLE public.component_life_limit_proposals ENABLE TRIGGER tr_cllg_proposal_protect;`, { transaction });
  });
}

describe('component life-limit governance Phase 2 activation', () => {
  it('allows the approval actor to activate future-effective limits with missing life evidence while preserving UNKNOWN and legacy rows', async () => rollback(async (transaction, f) => {
    const legacyBefore = await sequelize.query(`SELECT * FROM component_life_limits WHERE id=:id`, { replacements: { id: f.legacy }, type: QueryTypes.SELECT, transaction });
    const { publication } = await approved(transaction, f);
    const [dormant] = await sequelize.query<any>(`SELECT l.* FROM component_life_limits l JOIN component_life_limit_publications p ON p.component_life_limit_id=l.id WHERE p.id=:id`, { replacements: { id: publication.id }, type: QueryTypes.SELECT, transaction });
    expect(dormant.is_active).toBe(false);
    expect(LibraryService.evaluateSerializedComponentLifeLimits([dormant], null).state).toBe('UNKNOWN');
    const active = await ComponentLifeLimitGovernanceService.activate(f.qa, publication.id, 'QA activates approved evidence', true, transaction);
    expect(active.publication_state).toBe('ACTIVE');
    const [limit] = await sequelize.query<any>(`SELECT * FROM component_life_limits WHERE id=:id`, { replacements: { id: publication.component_life_limit_id }, type: QueryTypes.SELECT, transaction });
    expect(limit.is_active).toBe(true);
    expect(LibraryService.evaluateSerializedComponentLifeLimits([limit], null).state).toBe('UNKNOWN');
    expect(await sequelize.query(`SELECT * FROM component_life_limits WHERE id=:id`, { replacements: { id: f.legacy }, type: QueryTypes.SELECT, transaction })).toEqual(legacyBefore);
    const [history] = await sequelize.query<any>(`SELECT * FROM component_life_limit_governance_history WHERE publication_id=:id AND event_code='PUBLICATION_ACTIVATED'`, { replacements: { id: publication.id }, type: QueryTypes.SELECT, transaction });
    expect(history).toMatchObject({ actor_id: f.qa, from_status: 'DORMANT', to_status: 'ACTIVE', evidence_confirmed: true });
  }));

  it('blocks proposer activation including ADMIN, but allows a different ADMIN', async () => rollback(async (transaction, f) => {
    const { publication } = await approved(transaction, f);
    await sequelize.query(`INSERT INTO user_roles(user_id,role_id) SELECT :id,id FROM rf_role WHERE code='ADMIN' ON CONFLICT DO NOTHING`, { replacements: { id: f.proposer }, transaction });
    await rejectInSavepoint(transaction, (savepoint) => ComponentLifeLimitGovernanceService.activate(f.proposer, publication.id, 'self', true, savepoint), 'SELF_ACTIVATION_FORBIDDEN');
    expect((await ComponentLifeLimitGovernanceService.activate(f.admin, publication.id, 'Independent admin release', true, transaction)).publication_state).toBe('ACTIVE');
  }));

  it('rejects direct SQL and repeated activation without partial history', async () => rollback(async (transaction, f) => {
    const { publication } = await approved(transaction, f);
    await rejectInSavepoint(transaction, (savepoint) => sequelize.query(`UPDATE component_life_limit_publications SET publication_state='ACTIVE',activated_by=:actor,activated_at=NOW(),activation_reason='direct' WHERE id=:id`, { replacements: { actor: f.qa, id: publication.id }, transaction: savepoint }), 'DIRECT_TRANSITION_FORBIDDEN');
    await rejectInSavepoint(transaction, (savepoint) => sequelize.query(`UPDATE component_life_limits SET is_active=true WHERE id=:id`, { replacements: { id: publication.component_life_limit_id }, transaction: savepoint }), 'PUBLICATION_NOT_ACTIVE');
    await ComponentLifeLimitGovernanceService.activate(f.qa, publication.id, 'Valid release', true, transaction);
    await rejectInSavepoint(transaction, (savepoint) => ComponentLifeLimitGovernanceService.activate(f.admin, publication.id, 'repeat', true, savepoint), 'INVALID_ACTIVATION_TRANSITION');
    const [count] = await sequelize.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM component_life_limit_governance_history WHERE publication_id=:id AND event_code='PUBLICATION_ACTIVATED'`, { replacements: { id: publication.id }, type: QueryTypes.SELECT, transaction });
    expect(count!.count).toBe(1);
  }));

  it('rejects an altered governed description without activation side effects', async () => rollback(async (transaction, f) => {
    const { publication } = await approved(transaction, f);
    await sequelize.query(`ALTER TABLE public.component_life_limits DISABLE TRIGGER tr_cllg_operational_limit_protect`, { transaction });
    await sequelize.query(`UPDATE public.component_life_limits SET description='altered projection' WHERE id=:id`, { replacements: { id: publication.component_life_limit_id }, transaction });
    await sequelize.query(`ALTER TABLE public.component_life_limits ENABLE TRIGGER tr_cllg_operational_limit_protect`, { transaction });
    await rejectInSavepoint(transaction, (savepoint) => ComponentLifeLimitGovernanceService.activate(f.qa, publication.id, 'Must reject altered projection', true, savepoint), 'PUBLICATION_PROJECTION_MISMATCH');
    const [state] = await sequelize.query<any>(`SELECT p.publication_state,p.activated_by,l.is_active,(SELECT COUNT(*)::int FROM component_life_limit_governance_history h WHERE h.publication_id=p.id AND h.event_code='PUBLICATION_ACTIVATED') AS activation_events FROM component_life_limit_publications p JOIN component_life_limits l ON l.id=p.component_life_limit_id WHERE p.id=:id`, { replacements: { id: publication.id }, type: QueryTypes.SELECT, transaction });
    expect(state).toMatchObject({ publication_state: 'DORMANT', activated_by: null, is_active: false, activation_events: 0 });
  }));

  it.each([
    ['past', '2020-01-01'],
    ['current', new Date().toISOString().slice(0, 10)],
    ['future', '2099-01-01'],
  ])('allows a %s source-effective date', async (_label, effective) => rollback(async (transaction, f) => {
    const { publication } = await approved(transaction, f, input(f.model, effective));
    expect((await ComponentLifeLimitGovernanceService.activate(f.qa, publication.id, 'Date is evidence metadata only', true, transaction)).publication_state).toBe('ACTIVE');
  }));

  it.each(['TBO_HOURS','TBO_CYCLES','LIFE_LIMIT_HOURS','LIFE_LIMIT_CYCLES','CALENDAR_LIFE'] as const)('activates the immutable %s projection for existing evaluators', async (type) => rollback(async (transaction, f) => {
    const { publication } = await approved(transaction, f, input(f.model, '2020-01-01', type));
    await ComponentLifeLimitGovernanceService.activate(f.qa, publication.id, 'Activate controlled combination', true, transaction);
    const [limit] = await sequelize.query<any>(`SELECT * FROM component_life_limits WHERE id=:id`, { replacements: { id: publication.component_life_limit_id }, type: QueryTypes.SELECT, transaction });
    expect(limit).toMatchObject({ limit_type: type, is_active: true });
    expect(LibraryService.evaluateSerializedComponentLifeLimits([limit], null, '2026-08-13').state).toBe('UNKNOWN');
    const lifeState = type === 'TBO_HOURS' ? { tso_hours: 25 }
      : type === 'TBO_CYCLES' ? { cso_cycles: 25 }
      : type === 'LIFE_LIMIT_HOURS' ? { tsn_hours: 25 }
      : type === 'LIFE_LIMIT_CYCLES' ? { csn_cycles: 25 }
      : { calendar_reference_date: '2026-01-01' };
    expect(LibraryService.evaluateSerializedComponentLifeLimits([limit], lifeState, '2026-08-13').state).not.toBe('UNKNOWN');
  }));

  it.each([
    ['NOT_DUE', 25], ['DUE_SOON', 91], ['DUE', 100], ['OVERDUE', 101],
  ])('preserves the existing activated governed hour threshold %s', async (expected, tsoHours) => rollback(async (transaction, f) => {
    const { publication } = await approved(transaction, f, input(f.model, '2020-01-01', 'TBO_HOURS'));
    await ComponentLifeLimitGovernanceService.activate(f.qa, publication.id, 'Threshold fixture activation', true, transaction);
    const [limit] = await sequelize.query<any>(`SELECT * FROM component_life_limits WHERE id=:id`, { replacements: { id: publication.component_life_limit_id }, type: QueryTypes.SELECT, transaction });
    expect(LibraryService.evaluateSerializedComponentLifeLimits([limit], { tso_hours: tsoHours }).state).toBe(expected);
  }));

  it('grants only the application role, fixes search_path, and permits only one genuinely concurrent activation winner', async () => {
    const metadata = await sequelize.query<any>(`
      SELECT p.prosecdef, p.proconfig, has_function_privilege('public','public.fn_cllg_activate_publication(uuid,uuid,text)','EXECUTE') AS public_execute,
             has_function_privilege('jupiter_app','public.fn_cllg_activate_publication(uuid,uuid,text)','EXECUTE') AS app_execute
      FROM pg_proc p WHERE p.oid='public.fn_cllg_activate_publication(uuid,uuid,text)'::regprocedure;`, { type: QueryTypes.SELECT });
    expect(metadata[0]).toMatchObject({ prosecdef: true, public_execute: false, app_execute: true });
    expect(metadata[0].proconfig).toContain('search_path=pg_catalog, public');

    const owned = await committedApprovedFixture();
    try {
      const transactions = await Promise.all([
        sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }),
        sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }),
      ]);
      let release!: () => void;
      const barrier = new Promise<void>((resolve) => { release = resolve; });
      const contenders = [owned.f.qa, owned.f.admin].map((actor, index) => (async () => {
        const transaction = transactions[index]!;
        await barrier;
        try {
          const result = await ComponentLifeLimitGovernanceService.activate(actor, owned.publication.id, `Concurrent contender ${index}`, true, transaction);
          await transaction.commit();
          return result;
        } catch (error) {
          await transaction.rollback();
          throw error;
        }
      })());
      release();
      const attempts = await Promise.allSettled(contenders);
      expect(attempts.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
      expect(attempts.filter(({ status }) => status === 'rejected')).toHaveLength(1);
      const [state] = await sequelize.query<any>(`SELECT p.publication_state,l.is_active,(SELECT COUNT(*)::int FROM component_life_limit_governance_history h WHERE h.publication_id=p.id AND h.event_code='PUBLICATION_ACTIVATED') AS activation_events FROM component_life_limit_publications p JOIN component_life_limits l ON l.id=p.component_life_limit_id WHERE p.id=:id`, { replacements: { id: owned.publication.id }, type: QueryTypes.SELECT });
      expect(state).toMatchObject({ publication_state: 'ACTIVE', is_active: true, activation_events: 1 });
    } finally {
      await removeCommittedFixture(owned.f);
    }
  });

  it('does not expose approval to activation before the approving transaction commits', async () => {
    const owned = await committedProposedFixture();
    const approvalTransaction = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE });
    try {
      const approval = await ComponentLifeLimitGovernanceService.approve(owned.f.qa, owned.proposal.id, 'Approval held before commit', true, approvalTransaction);
      await expect(ComponentLifeLimitGovernanceService.activate(owned.f.admin, approval.publication!.id, 'Cannot see uncommitted approval', true)).rejects.toThrow('PUBLICATION_NOT_FOUND');
      await approvalTransaction.commit();
      const [state] = await sequelize.query<any>(`SELECT p.publication_state,l.is_active,(SELECT COUNT(*)::int FROM component_life_limit_governance_history h WHERE h.publication_id=p.id AND h.event_code='PUBLICATION_ACTIVATED') AS activation_events FROM component_life_limit_publications p JOIN component_life_limits l ON l.id=p.component_life_limit_id WHERE p.id=:id`, { replacements: { id: approval.publication!.id }, type: QueryTypes.SELECT });
      expect(state).toMatchObject({ publication_state: 'DORMANT', is_active: false, activation_events: 0 });
    } catch (error) {
      if (!(approvalTransaction as any).finished) await approvalTransaction.rollback();
      throw error;
    } finally {
      await removeCommittedFixture(owned.f);
    }
  });

  it.each(['WITHDRAWAL', 'REPLACEMENT'] as const)('keeps one valid governed authority during an activation versus approved %s race', async (purpose) => {
    const owned = await committedApprovedFixture();
    const legacyBefore = await sequelize.query(`SELECT * FROM component_life_limits WHERE id=:id`, { replacements: { id: owned.f.legacy }, type: QueryTypes.SELECT });
    const revisionInput = purpose === 'WITHDRAWAL'
      ? { ...input(owned.f.model), limit_type: null, basis: null, limit_hours: null, limit_cycles: null, limit_months: null, proposal_reason: 'Concurrent withdrawal' } as LifeLimitProposalInput
      : { ...input(owned.f.model), limit_hours: 125, proposal_reason: 'Concurrent replacement' };
    const revision = await ComponentLifeLimitGovernanceService.proposeRevision(owned.f.proposer, owned.proposal.id, purpose, revisionInput);
    const transactions = await Promise.all([
      sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }),
      sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }),
    ]);
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const run = async (transaction: Transaction, operation: () => Promise<unknown>) => {
      await barrier;
      try { const result = await operation(); await transaction.commit(); return result; }
      catch (error) { await transaction.rollback(); throw error; }
    };
    try {
      const attempts = [
        run(transactions[0]!, () => ComponentLifeLimitGovernanceService.activate(owned.f.admin, owned.publication.id, 'Concurrent activation', true, transactions[0]!)),
        run(transactions[1]!, () => ComponentLifeLimitGovernanceService.approve(owned.f.qa, revision.id, `Concurrent ${purpose.toLowerCase()} approval`, true, transactions[1]!)),
      ];
      release();
      await Promise.allSettled(attempts);
      const [target] = await sequelize.query<any>(`SELECT p.status,pub.publication_state,l.is_active FROM component_life_limit_proposals p JOIN component_life_limit_publications pub ON pub.proposal_id=p.id JOIN component_life_limits l ON l.id=pub.component_life_limit_id WHERE p.id=:id`, { replacements: { id: owned.proposal.id }, type: QueryTypes.SELECT });
      expect(target.publication_state === 'ACTIVE' ? target.is_active : !target.is_active).toBe(true);
      const activeGoverned = await sequelize.query<any>(`SELECT l.id FROM component_life_limits l JOIN component_life_limit_publications p ON p.component_life_limit_id=l.id WHERE l.component_model_id=:model AND l.is_active=true`, { replacements: { model: owned.f.model }, type: QueryTypes.SELECT });
      expect(activeGoverned.length).toBeLessThanOrEqual(1);
      const inconsistent = await sequelize.query<any>(`SELECT p.id FROM component_life_limit_publications p JOIN component_life_limits l ON l.id=p.component_life_limit_id WHERE (p.publication_state='ACTIVE') IS DISTINCT FROM l.is_active`, { type: QueryTypes.SELECT });
      expect(inconsistent).toHaveLength(0);
      expect(await sequelize.query(`SELECT * FROM component_life_limits WHERE id=:id`, { replacements: { id: owned.f.legacy }, type: QueryTypes.SELECT })).toEqual(legacyBefore);
    } finally {
      for (const transaction of transactions) if (!(transaction as any).finished) await transaction.rollback();
      await removeCommittedFixture(owned.f);
    }
  });

  it('changes the real workpack component result only after activation and authoritative life evidence', async () => {
    const owned = await committedApprovedFixture();
    const key = randomUUID();
    const [category] = await sequelize.query<{ id: string }>(`SELECT id FROM rf_aircraft_category ORDER BY code LIMIT 1`, { type: QueryTypes.SELECT });
    const [aircraft] = await sequelize.query<{ id: string }>(`INSERT INTO aircraft(registration,serial_number,model_id,category_id,status,total_time_hours,total_time_cycles) VALUES(:registration,:serial,:model,:category,'REGISTERED',0,0) RETURNING id`, { replacements: { registration: `P2-${key.slice(0,8)}`, serial: `P2-${key}`, model: owned.f.model, category: category!.id }, type: QueryTypes.SELECT });
    const [component] = await sequelize.query<{ id: string }>(`INSERT INTO serialized_components(component_model_id,serial_number,status,created_at,updated_at) VALUES(:model,:serial,'INSTALLED',NOW(),NOW()) RETURNING id`, { replacements: { model: owned.f.model, serial: `P2-C-${key}` }, type: QueryTypes.SELECT });
    const [installation] = await sequelize.query<{ id: string }>(`INSERT INTO aircraft_component_installations(aircraft_id,serialized_component_id,installation_context,installed_at,position,tracking_basis,install_tso,created_at,updated_at) VALUES(:aircraft,:component,'MAINTENANCE_INSTALL','2026-01-01','ENGINE','MANUAL_AUTHORISED',0,NOW(),NOW()) RETURNING id`, { replacements: { aircraft: aircraft!.id, component: component!.id }, type: QueryTypes.SELECT });
    try {
      const dormant = await WorkpackComponentIntegrationService.buildForWorkpack({ aircraftId: aircraft!.id });
      expect(dormant.items[0]!.due_state).toBe('UNKNOWN');
      expect((await ComponentLimitMonitoringService.monitorInstallation(installation!.id))[0]!.due_status).toBe('UNKNOWN');
      await ComponentLifeLimitGovernanceService.activate(owned.f.qa, owned.publication.id, 'Workpack-authoritative activation', true);
      const missing = await WorkpackComponentIntegrationService.buildForWorkpack({ aircraftId: aircraft!.id });
      expect(missing.items[0]!.due_state).toBe('UNKNOWN');
      await sequelize.query(`INSERT INTO serialized_component_life_states(serialized_component_id,tsn_hours,tso_hours,csn_cycles,cso_cycles,created_at,updated_at) VALUES(:component,25,25,25,25,NOW(),NOW())`, { replacements: { component: component!.id } });
      const calculated = await WorkpackComponentIntegrationService.buildForWorkpack({ aircraftId: aircraft!.id });
      const direct = LibraryService.evaluateSerializedComponentLifeLimits([{ ...(await sequelize.query<any>(`SELECT * FROM component_life_limits WHERE id=:id`, { replacements: { id: owned.publication.component_life_limit_id }, type: QueryTypes.SELECT }))[0], is_active: true }], { tso_hours: 25 });
      expect(calculated.items[0]!.due_state).toBe(direct.state);
      expect(calculated.items[0]!.due_state).not.toBe('UNKNOWN');
      expect((await ComponentLimitMonitoringService.monitorInstallation(installation!.id))[0]!.due_status).not.toBe('UNKNOWN');
    } finally {
      await sequelize.query(`DELETE FROM aircraft_component_installations WHERE serialized_component_id=:component; DELETE FROM serialized_component_life_states WHERE serialized_component_id=:component; DELETE FROM serialized_components WHERE id=:component; DELETE FROM aircraft WHERE id=:aircraft`, { replacements: { component: component!.id, aircraft: aircraft!.id } });
      await removeCommittedFixture(owned.f);
    }
  });
});

afterAll(async () => sequelize.close());
