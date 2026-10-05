import { QueryInterface, QueryTypes } from 'sequelize';

const CAPABILITIES = [
  ['REFERENCE_DATA_CREATE', 'Create reference data', 'Create allowlisted shared reference records.', 'REFERENCE_DATA'],
  ['REFERENCE_DATA_UPDATE', 'Update reference data', 'Update allowlisted shared reference records.', 'REFERENCE_DATA'],
  ['REFERENCE_DATA_DEACTIVATE', 'Deactivate reference data', 'Deactivate allowlisted shared reference records.', 'REFERENCE_DATA'],
  ['RBAC_DEFINITION_MANAGE', 'Manage RBAC definitions', 'Manage shared role, permission and mapping definitions.', 'RBAC_DEFINITION'],
  ['MANUFACTURER_MASTER_MANAGE', 'Manage manufacturers', 'Create and update shared Manufacturer masters.', 'MANUFACTURER_MASTER'],
  ['MANUFACTURER_FILE_REPLACE', 'Replace Manufacturer files', 'Upload or replace shared Manufacturer files.', 'MANUFACTURER_FILE'],
  ['COMPONENT_MODEL_MASTER_MANAGE', 'Manage component models', 'Create and update shared component-model masters.', 'COMPONENT_MODEL_MASTER'],
  ['MAINTENANCE_MASTER_MANAGE', 'Manage maintenance masters', 'Manage shared maintenance requirements and templates.', 'MAINTENANCE_MASTER'],
  ['REGULATORY_MASTER_MANAGE', 'Manage regulatory masters', 'Manage shared AD, SB and SID catalogue records.', 'REGULATORY_MASTER'],
  ['REGULATORY_RELATIONSHIP_MANAGE', 'Manage regulatory relationships', 'Manage shared applicability, allocation and model relationships.', 'REGULATORY_RELATIONSHIP'],
  ['SHARED_MASTER_IMPORT', 'Import shared masters', 'Preview and commit authorized shared-master imports.', 'SHARED_MASTER_IMPORT'],
  ['SERVICE_BULLETIN_SYNC_EXECUTE', 'Execute Service Bulletin sync', 'Execute authorized manual or scheduled Service Bulletin synchronization.', 'SERVICE_BULLETIN_SYNC'],
  ['LIFE_LIMIT_PROPOSE', 'Propose life-limit governance', 'Create replacement and withdrawal life-limit proposals.', 'LIFE_LIMIT_GOVERNANCE'],
  ['LIFE_LIMIT_APPROVE', 'Approve life-limit governance', 'Approve or reject life-limit proposals.', 'LIFE_LIMIT_GOVERNANCE'],
  ['LIFE_LIMIT_ACTIVATE', 'Activate life-limit publications', 'Activate approved life-limit publications.', 'LIFE_LIMIT_GOVERNANCE'],
] as const;

export default {
  async up(q: QueryInterface) {
    const [state]: any = await q.sequelize.query(`SELECT
      to_regclass('public.platform_capabilities') IS NOT NULL capabilities,
      to_regclass('public.platform_capability_grants') IS NOT NULL grants,
      to_regclass('public.platform_global_audit_log') IS NOT NULL audit,
      (SELECT count(*)::int FROM platform_capabilities WHERE code IN ('PLATFORM_AUTHORITY_MANAGE','PLATFORM_AUDIT_VIEW') AND is_active AND system_locked) foundation` , { type: QueryTypes.SELECT });
    if (!state?.capabilities || !state?.grants || !state?.audit || state.foundation !== 2) throw new Error('MIGRATION_599_REQUIRES_VERIFIED_598_FOUNDATION');
    const existing: any[] = await q.sequelize.query(`SELECT code FROM platform_capabilities WHERE code IN(:codes)`, { replacements: { codes: CAPABILITIES.map(([code]) => code) }, type: QueryTypes.SELECT });
    if (existing.length) throw new Error(`MIGRATION_599_REFUSES_EXISTING_CAPABILITY:${existing.map(row => row.code).sort().join(',')}`);
    await q.sequelize.transaction(async transaction => {
      for (const [code, label, description, domain] of CAPABILITIES) {
        await q.sequelize.query(`INSERT INTO platform_capabilities(id,code,label,description,domain,is_active,system_locked) VALUES(gen_random_uuid(),:code,:label,:description,:domain,true,true)`, { replacements: { code, label, description, domain }, transaction });
      }
    });
  },

  async down(q: QueryInterface) {
    const codes = CAPABILITIES.map(([code]) => code);
    const [state]: any = await q.sequelize.query(`SELECT
      (SELECT count(*)::int FROM platform_capabilities WHERE code IN(:codes) AND is_active AND system_locked) seeds,
      (SELECT count(*)::int FROM platform_capability_grants g JOIN platform_capabilities c ON c.id=g.capability_id WHERE c.code IN(:codes)) grants,
      (SELECT count(*)::int FROM platform_global_audit_log WHERE capability_code IN(:codes)) audits`, { replacements: { codes }, type: QueryTypes.SELECT });
    if (state?.seeds !== CAPABILITIES.length) throw new Error('MIGRATION_599_DOWN_REFUSES_INCONSISTENT_SEEDS');
    if (state.grants || state.audits) throw new Error('MIGRATION_599_DOWN_REFUSES_AUTHORITY_EVIDENCE');
    await q.sequelize.transaction(transaction => q.sequelize.query(`DELETE FROM platform_capabilities WHERE code IN(:codes)`, { replacements: { codes }, transaction }));
  },
};
