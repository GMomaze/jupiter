import { describe, expect, it } from 'vitest';
import { QueryTypes } from 'sequelize';
import { pool } from '../../config/database.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import sequelize from '../../config/database.js';

const OWNER_ROLE = 'jupiter_tenant_owner';

describe('4.5-0 tenant data ownership role (migration 605)', () => {
  it('runs only against exact guarded jupiter_test', async () => {
    await assertTestDatabaseSafety(pool);
  });

  it('role exists with exact NOLOGIN / NOBYPASSRLS / NOINHERIT attributes', async () => {
    const [row] = await sequelize.query<Record<string, boolean>>(
      `SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolinherit
       FROM pg_roles WHERE rolname = :owner`,
      { replacements: { owner: OWNER_ROLE }, type: QueryTypes.SELECT },
    );
    expect(row).toMatchObject({
      rolcanlogin: false,
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolreplication: false,
      rolbypassrls: false,
      rolinherit: false,
    });
  });

  it('normal runtime identities cannot SET ROLE to the owner', async () => {
    const [row] = await sequelize.query<Record<string, boolean>>(
      `SELECT pg_has_role('jupiter_test', :owner, 'SET') AS test_can_set,
              pg_has_role('jupiter_app', :owner, 'SET') AS app_can_set`,
      { replacements: { owner: OWNER_ROLE }, type: QueryTypes.SELECT },
    );
    expect(row).toMatchObject({ test_can_set: false, app_can_set: false });
  });

  it('has zero memberships and every owned table is FORCE RLS (no runtime privilege expansion)', async () => {
    const [row] = await sequelize.query<Record<string, number>>(
      `SELECT
         (SELECT count(*)::int FROM pg_auth_members m
            JOIN pg_roles r ON r.oid = m.member OR r.oid = m.roleid
            WHERE r.rolname = :owner) AS memberships,
         (SELECT count(*)::int FROM pg_class c
            JOIN pg_roles r ON r.oid = c.relowner
            WHERE r.rolname = :owner AND c.relkind = 'r' AND NOT c.relforcerowsecurity) AS non_force_tables`,
      { replacements: { owner: OWNER_ROLE }, type: QueryTypes.SELECT },
    );
    expect(row).toMatchObject({ memberships: 0, non_force_tables: 0 });
  });

  it('leaves jupiter_governance_owner unchanged', async () => {
    const [row] = await sequelize.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_class c
         JOIN pg_roles r ON r.oid = c.relowner
         WHERE r.rolname = 'jupiter_governance_owner'`,
      { type: QueryTypes.SELECT },
    );
    expect(row.n).toBe(2);
  });

  it('605_create_tenant_owner_role migration is applied', async () => {
    const [row] = await sequelize.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "SequelizeMeta" WHERE name = '605_create_tenant_owner_role.ts'`,
      { type: QueryTypes.SELECT },
    );
    expect(row.n).toBe(1);
  });
});
