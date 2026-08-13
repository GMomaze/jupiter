import { randomUUID } from 'node:crypto';
import { QueryTypes } from 'sequelize';
import { afterAll, describe, expect, it } from 'vitest';
import migration from '../../migrations/578_create_component_life_limit_governance.js';
import sequelize from '../../src/config/database.js';
import { ComponentLifeLimitGovernanceService } from '../../src/modules/library/component-life-limit-governance.service.js';

const guardedRun = process.env.RUN_GOVERNANCE_ROLLBACK_TEST === 'true';

describe.skipIf(!guardedRun)('component life-limit governance real rollback guard', () => {
  it('allows empty down, restores up, and refuses non-empty down without partial removal', async () => {
    const queryInterface = sequelize.getQueryInterface();
    const [phase2] = await sequelize.query<{ present: string | null }>(
      `SELECT to_regprocedure('public.fn_cllg_activate_publication(uuid,uuid,text)')::text AS present;`,
      { type: QueryTypes.SELECT }
    );
    if (phase2?.present) {
      await expect(migration.down(queryInterface)).rejects.toThrow('COMPONENT_LIFE_LIMIT_GOVERNANCE_HISTORY_EXISTS');
      const [preserved] = await sequelize.query<{ table_present: string; function_present: string }>(
        `SELECT to_regclass('public.component_life_limit_proposals')::text AS table_present,
                to_regprocedure('public.fn_cllg_decide_proposal(uuid,uuid,character varying,text,boolean)')::text AS function_present;`,
        { type: QueryTypes.SELECT }
      );
      expect(preserved?.table_present).toBe('component_life_limit_proposals');
      expect(preserved?.function_present).toContain('fn_cllg_decide_proposal');
      return;
    }
    await migration.down(queryInterface);
    const absent = await sequelize.query<{ present: string | null }>(
      `SELECT to_regclass('public.component_life_limit_proposals')::text AS present;`,
      { type: QueryTypes.SELECT }
    );
    expect(absent[0]?.present).toBeNull();

    await migration.up(queryInterface);
    const key = randomUUID();
    const users = await sequelize.query<{ id: string }>(
      `INSERT INTO users(email,password_hash,full_name,is_active,created_at,updated_at)
       VALUES(:emailA,'test','Rollback proposer',true,NOW(),NOW()),
             (:emailB,'test','Rollback approver',true,NOW(),NOW()) RETURNING id;`,
      { replacements: { emailA: `rollback-a-${key}@test.invalid`, emailB: `rollback-b-${key}@test.invalid` }, type: QueryTypes.SELECT }
    );
    const [manufacturer] = await sequelize.query<{ id: string }>(
      `INSERT INTO manufacturers(name,code) VALUES(:name,:code) RETURNING id;`,
      { replacements: { name: `Rollback ${key}`, code: `ROLLBACK-${key}` }, type: QueryTypes.SELECT }
    );
    const [asset] = await sequelize.query<{ id: string }>(
      `INSERT INTO rf_asset_type(code,label) VALUES(:code,'Rollback asset') RETURNING id;`,
      { replacements: { code: `ROLLBACK-${key}` }, type: QueryTypes.SELECT }
    );
    const [model] = await sequelize.query<{ id: string }>(
      `INSERT INTO component_models(manufacturer_id,model_name,asset_type_id,is_life_limited,is_active)
       VALUES(:manufacturer,'Rollback model',:asset,false,true) RETURNING id;`,
      { replacements: { manufacturer: manufacturer!.id, asset: asset!.id }, type: QueryTypes.SELECT }
    );
    await sequelize.query(
      `INSERT INTO user_roles(user_id,role_id)
       SELECT CAST(:proposer AS uuid),id FROM rf_role WHERE code='ENGINEER' UNION ALL
       SELECT CAST(:approver AS uuid),id FROM rf_role WHERE code='QA' ON CONFLICT DO NOTHING;`,
      { replacements: { proposer: users[0]!.id, approver: users[1]!.id } }
    );
    const input = {
      component_model_id: model!.id,
      determination: 'LIFE_LIMITED' as const,
      applicability_scope: 'ALL_SERIALS_OF_MODEL' as const,
      applicability_statement: 'All serials',
      narrower_effectivity_absent: true as const,
      limit_type: 'TBO_HOURS' as const,
      basis: 'SINCE_OVERHAUL' as const,
      limit_hours: 100,
      source_reference: 'ROLLBACK',
      source_effective_date: '2026-01-01',
      evidence_summary: 'Rollback refusal evidence',
      proposal_reason: 'Rollback refusal',
    };
    const proposal = await ComponentLifeLimitGovernanceService.propose(users[0]!.id, input);
    const approvals = await Promise.allSettled([
      ComponentLifeLimitGovernanceService.approve(users[1]!.id, proposal.id, 'Concurrent approval A', true),
      ComponentLifeLimitGovernanceService.approve(users[1]!.id, proposal.id, 'Concurrent approval B', true),
    ]);
    expect(approvals.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(approvals.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    const revisionRace = await Promise.allSettled([
      ComponentLifeLimitGovernanceService.proposeRevision(users[0]!.id, proposal.id, 'REPLACEMENT', { ...input, limit_hours: 120 }),
      ComponentLifeLimitGovernanceService.proposeRevision(users[0]!.id, proposal.id, 'WITHDRAWAL', { ...input, limit_type: null, basis: null, limit_hours: null }),
    ]);
    expect(revisionRace.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(revisionRace.filter(({ status }) => status === 'rejected')).toHaveLength(1);

    await expect(migration.down(queryInterface)).rejects.toThrow(
      'COMPONENT_LIFE_LIMIT_GOVERNANCE_HISTORY_EXISTS'
    );
    const preserved = await sequelize.query<{ table_present: string; function_present: string }>(
      `SELECT to_regclass('public.component_life_limit_proposals')::text AS table_present,
              to_regprocedure('public.fn_cllg_decide_proposal(uuid,uuid,character varying,text,boolean)')::text AS function_present;`,
      { type: QueryTypes.SELECT }
    );
    expect(preserved[0]?.table_present).toBe('component_life_limit_proposals');
    expect(preserved[0]?.function_present).toContain('fn_cllg_decide_proposal');
  });
});

afterAll(async () => sequelize.close());
