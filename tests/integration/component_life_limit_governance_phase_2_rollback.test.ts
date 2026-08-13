import { QueryTypes } from 'sequelize';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import migration from '../../migrations/580_add_component_life_limit_activation.js';
import sequelize from '../../src/config/database.js';
import { ComponentLifeLimitGovernanceService } from '../../src/modules/library/component-life-limit-governance.service.js';

const guardedRun = process.env.RUN_GOVERNANCE_ROLLBACK_TEST === 'true';

describe.skipIf(!guardedRun)('component life-limit governance Phase 2 rollback guard', () => {
  it('rolls back an empty Phase 2, reapplies it, then refuses atomically when activation history exists', async () => {
    const queryInterface = sequelize.getQueryInterface();
    let owned: { proposal: string; model: string; users: string[]; manufacturer: string; asset: string } | null = null;
    try {
    await migration.down(queryInterface);
    const [emptyDown] = await sequelize.query<any>(`SELECT to_regprocedure('public.fn_cllg_activate_publication(uuid,uuid,text)')::text AS fn, to_regclass('public.component_life_limit_proposals')::text AS phase1_table, EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='component_life_limit_publications' AND column_name='activated_by') AS activation_field` , { type: QueryTypes.SELECT });
    expect(emptyDown).toMatchObject({ fn: null, phase1_table: 'component_life_limit_proposals', activation_field: false });
    await migration.up(queryInterface);
    const key = randomUUID();
    const [manufacturer] = await sequelize.query<{ id: string }>(`INSERT INTO manufacturers(name,code) VALUES(:name,:code) RETURNING id`, { replacements: { name: `P2 rollback ${key}`, code: `P2R-${key}` }, type: QueryTypes.SELECT });
    const [asset] = await sequelize.query<{ id: string }>(`INSERT INTO rf_asset_type(code,label) VALUES(:code,'P2 rollback') RETURNING id`, { replacements: { code: `P2R-${key}` }, type: QueryTypes.SELECT });
    const [model] = await sequelize.query<{ id: string }>(`INSERT INTO component_models(manufacturer_id,model_name,asset_type_id,is_life_limited,is_active) VALUES(:manufacturer,'P2 rollback model',:asset,false,true) RETURNING id`, { replacements: { manufacturer: manufacturer!.id, asset: asset!.id }, type: QueryTypes.SELECT });
    const users = await sequelize.query<{ id: string }>(`INSERT INTO users(email,password_hash,full_name,is_active,created_at,updated_at) VALUES(:engineer,'test','P2 rollback engineer',true,NOW(),NOW()),(:qa,'test','P2 rollback qa',true,NOW(),NOW()) RETURNING id`, { replacements: { engineer: `p2r-engineer-${key}@test.invalid`, qa: `p2r-qa-${key}@test.invalid` }, type: QueryTypes.SELECT });
    await sequelize.query(`
      INSERT INTO user_roles(user_id,role_id) SELECT :engineer,id FROM rf_role WHERE code='ENGINEER';
      INSERT INTO user_roles(user_id,role_id) SELECT :qa,id FROM rf_role WHERE code='QA';`, { replacements: { engineer: users[0]!.id, qa: users[1]!.id } });
    const proposal = await ComponentLifeLimitGovernanceService.propose(users[0]!.id, {
      component_model_id: model!.id, determination: 'LIFE_LIMITED', applicability_scope: 'ALL_SERIALS_OF_MODEL',
      applicability_statement: 'All serials', narrower_effectivity_absent: true, limit_type: 'LIFE_LIMIT_HOURS',
      basis: 'SINCE_NEW', limit_hours: 100, limit_cycles: null, limit_months: null, source_reference: 'P2 rollback evidence',
      source_effective_date: '2099-01-01', evidence_summary: 'Rollback guard evidence', proposal_reason: 'Rollback guard fixture',
    });
    owned = { proposal: proposal.id, model: model!.id, users: users.map(({ id }) => id), manufacturer: manufacturer!.id, asset: asset!.id };
    const approval = await ComponentLifeLimitGovernanceService.approve(users[1]!.id, proposal.id, 'Rollback guard approval', true);
    await ComponentLifeLimitGovernanceService.activate(users[1]!.id, approval.publication!.id, 'Rollback guard activation', true);
    const before = await sequelize.query<any>(`
      SELECT to_regprocedure('public.fn_cllg_activate_publication(uuid,uuid,text)')::text AS fn,
             EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='component_life_limit_publications' AND column_name='activated_by') AS field;`,
      { type: QueryTypes.SELECT }
    );
    await expect(migration.down(queryInterface)).rejects.toThrow('COMPONENT_LIFE_LIMIT_ACTIVATION_HISTORY_EXISTS');
    const after = await sequelize.query<any>(`
      SELECT to_regprocedure('public.fn_cllg_activate_publication(uuid,uuid,text)')::text AS fn,
             EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='component_life_limit_publications' AND column_name='activated_by') AS field;`,
      { type: QueryTypes.SELECT }
    );
    expect(after).toEqual(before);
    } finally {
      const [phase2] = await sequelize.query<{ fn: string | null }>(`SELECT to_regprocedure('public.fn_cllg_activate_publication(uuid,uuid,text)')::text AS fn`, { type: QueryTypes.SELECT });
      if (!phase2?.fn) await migration.up(queryInterface);
      if (owned) await sequelize.transaction(async (transaction) => {
      await sequelize.query(`ALTER TABLE public.component_life_limit_governance_history DISABLE TRIGGER tr_cllg_history_protect; ALTER TABLE public.component_life_limit_publications DISABLE TRIGGER tr_cllg_publication_protect; ALTER TABLE public.component_life_limit_proposals DISABLE TRIGGER tr_cllg_proposal_protect;`, { transaction });
      await sequelize.query(`DELETE FROM public.component_life_limit_governance_history WHERE proposal_id=:proposal; DELETE FROM public.component_life_limit_publications WHERE proposal_id=:proposal; DELETE FROM public.component_life_limit_proposals WHERE id=:proposal; DELETE FROM public.component_life_limits WHERE component_model_id=:model; DELETE FROM public.user_roles WHERE user_id IN (:users); DELETE FROM public.users WHERE id IN (:users); DELETE FROM public.component_models WHERE id=:model; DELETE FROM public.manufacturers WHERE id=:manufacturer; DELETE FROM public.rf_asset_type WHERE id=:asset;`, { replacements: owned, transaction });
      await sequelize.query(`ALTER TABLE public.component_life_limit_governance_history ENABLE TRIGGER tr_cllg_history_protect; ALTER TABLE public.component_life_limit_publications ENABLE TRIGGER tr_cllg_publication_protect; ALTER TABLE public.component_life_limit_proposals ENABLE TRIGGER tr_cllg_proposal_protect;`, { transaction });
      });
      const [restored] = await sequelize.query<any>(`SELECT to_regprocedure('public.fn_cllg_activate_publication(uuid,uuid,text)')::text AS fn, EXISTS(SELECT 1 FROM rf_permission WHERE code='COMPONENT_LIFE_LIMIT_ACTIVATE') AS permission, (SELECT COUNT(*)::int FROM rf_role_permissions rp JOIN rf_role r ON r.id=rp.role_id JOIN rf_permission p ON p.id=rp.permission_id WHERE p.code='COMPONENT_LIFE_LIMIT_ACTIVATE' AND r.code IN ('ADMIN','QA')) AS mappings, (SELECT COUNT(*)::int FROM component_life_limit_proposals WHERE id=:proposal) AS owned_rows`, { replacements: { proposal: owned?.proposal || randomUUID() }, type: QueryTypes.SELECT });
      expect(restored.fn).toContain('fn_cllg_activate_publication');
      expect(restored).toMatchObject({ permission: true, mappings: 2, owned_rows: 0 });
    }
  });
});

afterAll(async () => sequelize.close());
