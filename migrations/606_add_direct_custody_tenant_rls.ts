'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

const OWNER_ROLE = 'jupiter_tenant_owner';
const ORIGINAL_OWNER = 'postgres';

const TABLES = [
  { table: 'aircraft', column: 'tenant_id' },
  { table: 'customers', column: 'tenant_id' },
  { table: 'planning_sessions', column: 'tenant_id' },
  { table: 'workpacks', column: 'tenant_id' },
  { table: 'migration_batches', column: 'tenant_id' },
  { table: 'aircraft_component_movement_history', column: 'tenant_id' },
  { table: 'serialized_components', column: 'custodian_tenant_id' },
  { table: 'aircraft_components', column: 'custodian_tenant_id' },
] as const;

const policyName = (table: string) => `${table}_tenant_rls`;

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [owner] = await queryInterface.sequelize.query<{ exists: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :owner) AS exists`,
        { replacements: { owner: OWNER_ROLE }, type: QueryTypes.SELECT, transaction }
      );
      if (!owner?.exists) throw new Error('TENANT_OWNER_ROLE_MISSING');

      for (const { table, column } of TABLES) {
        await queryInterface.sequelize.query(
          `ALTER TABLE public.${table} OWNER TO ${OWNER_ROLE};
           ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
           ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY;`,
          { transaction }
        );
        await queryInterface.sequelize.query(
          `CREATE POLICY ${policyName(table)} ON public.${table}
             FOR ALL
             USING (${column} = NULLIF(current_setting('jupiter.tenant_id', true), '')::uuid)
             WITH CHECK (${column} = NULLIF(current_setting('jupiter.tenant_id', true), '')::uuid);`,
          { transaction }
        );
      }

      // Referential-integrity checks on these tables run with the privileges of
      // the table owner (jupiter_tenant_owner). Grant the minimal USAGE + SELECT
      // needed for the FK checks against non-owned referenced tables.
      await queryInterface.sequelize.query(
        `GRANT USAGE ON SCHEMA public TO ${OWNER_ROLE};
         GRANT SELECT ON public.component_models, public.maintenance_templates,
           public.rf_aircraft_category, public.rf_workpack_status, public.tenants,
           public.users TO ${OWNER_ROLE};`,
        { transaction }
      );

      const tableList = TABLES.map(({ table }) => `'${table}'`).join(',');
      const [verified] = await queryInterface.sequelize.query<{
        owned: number;
        rls_enabled: number;
        rls_forced: number;
        policies: number;
        expected: number;
      }>(
        `SELECT
           (SELECT count(*)::int FROM pg_catalog.pg_class c
              JOIN pg_catalog.pg_roles r ON r.oid = c.relowner
              WHERE c.relname = ANY(ARRAY[${tableList}]) AND r.rolname = :owner) AS owned,
           (SELECT count(*)::int FROM pg_catalog.pg_class
              WHERE relname = ANY(ARRAY[${tableList}]) AND relrowsecurity) AS rls_enabled,
           (SELECT count(*)::int FROM pg_catalog.pg_class
              WHERE relname = ANY(ARRAY[${tableList}]) AND relforcerowsecurity) AS rls_forced,
           (SELECT count(*)::int FROM pg_catalog.pg_policies
              WHERE tablename = ANY(ARRAY[${tableList}]) AND policyname LIKE '%_tenant_rls') AS policies,
           ${TABLES.length}::int AS expected`,
        { replacements: { owner: OWNER_ROLE }, type: QueryTypes.SELECT, transaction }
      );
      if (
        !verified ||
        verified.owned !== verified.expected ||
        verified.rls_enabled !== verified.expected ||
        verified.rls_forced !== verified.expected ||
        verified.policies !== verified.expected
      ) {
        throw new Error('TENANT_ROOT_RLS_VERIFICATION_FAILED');
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

      // Revoke the FK-check grants and schema USAGE added by up().
      await queryInterface.sequelize.query(
        `REVOKE SELECT ON public.component_models, public.maintenance_templates,
           public.rf_aircraft_category, public.rf_workpack_status, public.tenants,
           public.users FROM ${OWNER_ROLE};
         REVOKE USAGE ON SCHEMA public FROM ${OWNER_ROLE};`,
        { transaction }
      );

      const tableList = TABLES.map(({ table }) => `'${table}'`).join(',');
      const [verified] = await queryInterface.sequelize.query<{
        restored: number;
        rls_off: number;
        policies: number;
        expected: number;
      }>(
        `SELECT
           (SELECT count(*)::int FROM pg_catalog.pg_class c
              JOIN pg_catalog.pg_roles r ON r.oid = c.relowner
              WHERE c.relname = ANY(ARRAY[${tableList}]) AND r.rolname = :owner) AS restored,
           (SELECT count(*)::int FROM pg_catalog.pg_class
              WHERE relname = ANY(ARRAY[${tableList}]) AND NOT relrowsecurity AND NOT relforcerowsecurity) AS rls_off,
           (SELECT count(*)::int FROM pg_catalog.pg_policies
              WHERE tablename = ANY(ARRAY[${tableList}]) AND policyname LIKE '%_tenant_rls') AS policies,
           ${TABLES.length}::int AS expected`,
        { replacements: { owner: ORIGINAL_OWNER }, type: QueryTypes.SELECT, transaction }
      );
      if (
        !verified ||
        verified.restored !== verified.expected ||
        verified.rls_off !== verified.expected ||
        verified.policies !== 0
      ) {
        throw new Error('TENANT_ROOT_RLS_ROLLBACK_VERIFICATION_FAILED');
      }
    });
  },
};
