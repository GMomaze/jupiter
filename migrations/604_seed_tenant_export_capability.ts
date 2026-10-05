import { QueryInterface, QueryTypes } from 'sequelize';

const CAPABILITY = 'TENANT_EXPORT';

export default {
  async up(q: QueryInterface) {
    const [state]: any = await q.sequelize.query(`SELECT
      to_regclass('public.platform_capabilities') IS NOT NULL capabilities,
      to_regclass('public.platform_capability_grants') IS NOT NULL grants,
      to_regclass('public.platform_global_audit_log') IS NOT NULL audit`, { type: QueryTypes.SELECT });
    if (!state?.capabilities || !state.grants || !state.audit) {
      throw new Error('MIGRATION_604_REQUIRES_PLATFORM_AUTHORITY_FOUNDATION');
    }
    const existing: any[] = await q.sequelize.query(`SELECT code FROM platform_capabilities WHERE code=:code`, {
      replacements: { code: CAPABILITY }, type: QueryTypes.SELECT,
    });
    if (existing.length) throw new Error('MIGRATION_604_REFUSES_EXISTING_CAPABILITY');
    await q.sequelize.transaction(async transaction => q.sequelize.query(
      `INSERT INTO platform_capabilities(id,code,label,description,domain,is_active,system_locked)
       VALUES(gen_random_uuid(),:code,'Export tenant departure package',
         'Authorize a controlled tenant/company departure export while preserving tenant isolation.','TENANT_LIFECYCLE',true,true)`,
      { replacements: { code: CAPABILITY }, transaction },
    ));
  },

  async down(q: QueryInterface) {
    const [state]: any = await q.sequelize.query(`SELECT
      (SELECT count(*)::int FROM platform_capabilities WHERE code=:code AND is_active AND system_locked) capability,
      (SELECT count(*)::int FROM platform_capability_grants g JOIN platform_capabilities c ON c.id=g.capability_id WHERE c.code=:code) grants,
      (SELECT count(*)::int FROM platform_global_audit_log WHERE capability_code=:code) audits`, {
      replacements: { code: CAPABILITY }, type: QueryTypes.SELECT,
    });
    if (state?.capability !== 1) throw new Error('MIGRATION_604_DOWN_REFUSES_INCONSISTENT_CAPABILITY');
    if (state.grants || state.audits) throw new Error('MIGRATION_604_DOWN_REFUSES_AUTHORITY_EVIDENCE');
    await q.sequelize.transaction(transaction => q.sequelize.query(
      `DELETE FROM platform_capabilities WHERE code=:code`,
      { replacements: { code: CAPABILITY }, transaction },
    ));
  },
};
