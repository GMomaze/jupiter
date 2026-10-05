import { afterAll, describe, expect, it } from 'vitest';
import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import migration604 from '../../../migrations/604_seed_tenant_export_capability.js';

describe('MP2 2E.2 Phase 1 migration 604 guarded capability seed', () => {
  afterAll(async () => { await sequelize.close(); });

  it('applies UP, refuses re-apply, and applies DOWN/reapply with zero residue', async () => {
    expect((await sequelize.query<{ name: string }>('SELECT current_database() name', { type: QueryTypes.SELECT }))[0]?.name).toBe('jupiter_test');
    const count = async () => (await sequelize.query<{ count: number }>(
      `SELECT count(*)::int count FROM platform_capabilities WHERE code='TENANT_EXPORT'`,
      { type: QueryTypes.SELECT }))[0]?.count ?? 0;
    const qi = sequelize.getQueryInterface();

    await migration604.up(qi);
    expect(await sequelize.query<any>(
      `SELECT is_active,system_locked FROM platform_capabilities WHERE code='TENANT_EXPORT'`,
      { type: QueryTypes.SELECT })).toEqual([{ is_active: true, system_locked: true }]);

    await expect(migration604.up(qi)).rejects.toThrow('MIGRATION_604_REFUSES_EXISTING_CAPABILITY');

    await migration604.down(qi);
    expect(await count()).toBe(0);

    await migration604.up(qi);
    expect(await count()).toBe(1);
    await migration604.down(qi);
    expect(await count()).toBe(0);
  });

  it('refuses DOWN when a grant exists and leaves the capability intact', async () => {
    const qi = sequelize.getQueryInterface();
    await migration604.up(qi);
    const principalId = '60400000-0000-4000-8000-00000000000a';
    const userId = '60400000-0000-4000-8000-00000000000b';
    const grantId = '60400000-0000-4000-8000-00000000000c';
    try {
      await sequelize.query(`INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES(:id,:email,'unused','604 fixture',true)`, { replacements: { id: userId, email: `604-${userId}@example.test` } });
      await sequelize.query(`INSERT INTO platform_principals(id,principal_type,user_id,display_name,status) VALUES(:id,'HUMAN',:userId,'604 fixture','ACTIVE')`, { replacements: { id: principalId, userId } });
      await sequelize.query(`INSERT INTO platform_capability_grants(id,principal_id,capability_id,granted_by_principal_id,grant_reason)
        SELECT :id,:principal,id,:principal,'604 guarded refusal' FROM platform_capabilities WHERE code='TENANT_EXPORT'`,
        { replacements: { id: grantId, principal: principalId } });
      await expect(migration604.down(qi)).rejects.toThrow('MIGRATION_604_DOWN_REFUSES_AUTHORITY_EVIDENCE');
    } finally {
      await sequelize.query('DELETE FROM platform_capability_grants WHERE id=:id', { replacements: { id: grantId } });
      await sequelize.query('DELETE FROM platform_principals WHERE id=:id', { replacements: { id: principalId } });
      await sequelize.query('DELETE FROM users WHERE id=:id', { replacements: { id: userId } });
      await migration604.down(qi);
    }
  });
});
