'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

const OWNER_ROLE = 'jupiter_tenant_owner';
const ORIGINAL_OWNER = 'postgres';
const CTX = "NULLIF(current_setting('jupiter.tenant_id', true), '')::uuid";

const TABLES: ReadonlyArray<{ table: string; predicate: string }> = [
  { table: 'tenant_memberships', predicate: `tenant_id = ${CTX}` },
  {
    table: 'tenant_membership_roles',
    predicate: `EXISTS (SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.id = tenant_membership_roles.membership_id AND tm.tenant_id = ${CTX})`,
  },
  { table: 'tenant_membership_authority_audit', predicate: `tenant_id = ${CTX}` },
];

const policyName = (table: string) => `${table}_tenant_rls`;

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [owner] = await queryInterface.sequelize.query<{ exists: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :owner) AS exists`,
        { replacements: { owner: OWNER_ROLE }, type: QueryTypes.SELECT, transaction }
      );
      if (!owner?.exists) throw new Error('TENANT_OWNER_ROLE_MISSING');

      for (const { table, predicate } of TABLES) {
        await queryInterface.sequelize.query(
          `ALTER TABLE public.${table} OWNER TO ${OWNER_ROLE};
           ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
           ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY;`,
          { transaction }
        );
        await queryInterface.sequelize.query(
          `CREATE POLICY ${policyName(table)} ON public.${table}
             FOR ALL
             USING (${predicate})
             WITH CHECK (${predicate});`,
          { transaction }
        );
      }

      // FK referential-integrity requirements after ownership transfer:
      // tenant_memberships.tenant_id -> tenants (SELECT granted by 606),
      //   user/created_by/suspended_by/disabled_by/updated_by -> users (606);
      // tenant_membership_roles.membership_id -> tenant_memberships (now owned),
      //   assigned_by_user_id -> users (606), role_id -> rf_role (NOT yet granted);
      // tenant_membership_authority_audit.tenant_id -> tenants (606),
      //   membership_id -> tenant_memberships (owned), actor_user_id -> users (606).
      // Only rf_role is newly required.
      await queryInterface.sequelize.query(
        `GRANT SELECT ON public.rf_role TO ${OWNER_ROLE};`,
        { transaction }
      );

      const tableList = TABLES.map(({ table }) => `'${table}'`).join(',');
      const [verified] = await queryInterface.sequelize.query<{
        owned: number; rls_enabled: number; rls_forced: number; policies: number; expected: number;
      }>(
        `SELECT
           (SELECT count(*)::int FROM pg_catalog.pg_class c JOIN pg_catalog.pg_roles r ON r.oid = c.relowner
              WHERE c.relname = ANY(ARRAY[${tableList}]) AND r.rolname = :owner) AS owned,
           (SELECT count(*)::int FROM pg_catalog.pg_class WHERE relname = ANY(ARRAY[${tableList}]) AND relrowsecurity) AS rls_enabled,
           (SELECT count(*)::int FROM pg_catalog.pg_class WHERE relname = ANY(ARRAY[${tableList}]) AND relforcerowsecurity) AS rls_forced,
           (SELECT count(*)::int FROM pg_catalog.pg_policies WHERE tablename = ANY(ARRAY[${tableList}]) AND policyname LIKE '%_tenant_rls') AS policies,
           ${TABLES.length}::int AS expected`,
        { replacements: { owner: OWNER_ROLE }, type: QueryTypes.SELECT, transaction }
      );
      if (
        !verified || verified.owned !== verified.expected || verified.rls_enabled !== verified.expected ||
        verified.rls_forced !== verified.expected || verified.policies !== verified.expected
      ) {
        throw new Error('TENANT_MEMBERSHIP_RLS_VERIFICATION_FAILED');
      }
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const { table } of TABLES) {
        await queryInterface.sequelize.query(
          `DROP POLICY IF EXISTS ${policyName(table)} ON public.${table};
           ALTER TABLE public.${table} DISABLE ROW LEVEL SECURITY;
           ALTER TABLE public.${table} NO FORCE ROW LEVEL SECURITY;
           ALTER TABLE public.${table} OWNER TO ${ORIGINAL_OWNER};`,
          { transaction }
        );
      }
      await queryInterface.sequelize.query(
        `REVOKE SELECT ON public.rf_role FROM ${OWNER_ROLE};`,
        { transaction }
      );
      const tableList = TABLES.map(({ table }) => `'${table}'`).join(',');
      const [verified] = await queryInterface.sequelize.query<{
        restored: number; rls_off: number; policies: number; expected: number;
      }>(
        `SELECT
           (SELECT count(*)::int FROM pg_catalog.pg_class c JOIN pg_catalog.pg_roles r ON r.oid = c.relowner
              WHERE c.relname = ANY(ARRAY[${tableList}]) AND r.rolname = :owner) AS restored,
           (SELECT count(*)::int FROM pg_catalog.pg_class WHERE relname = ANY(ARRAY[${tableList}]) AND NOT relrowsecurity AND NOT relforcerowsecurity) AS rls_off,
           (SELECT count(*)::int FROM pg_catalog.pg_policies WHERE tablename = ANY(ARRAY[${tableList}]) AND policyname LIKE '%_tenant_rls') AS policies,
           ${TABLES.length}::int AS expected`,
        { replacements: { owner: ORIGINAL_OWNER }, type: QueryTypes.SELECT, transaction }
      );
      if (!verified || verified.restored !== verified.expected || verified.rls_off !== verified.expected || verified.policies !== 0) {
        throw new Error('TENANT_MEMBERSHIP_RLS_ROLLBACK_VERIFICATION_FAILED');
      }
    });
  },
};
