'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

const OWNER_ROLE = 'jupiter_tenant_owner';
const ORIGINAL_OWNER = 'postgres';
const CTX = "NULLIF(current_setting('jupiter.tenant_id', true), '')::uuid";

const batchRoot = (table: string) =>
  `EXISTS (SELECT 1 FROM public.migration_batches mb
     WHERE mb.id = ${table}.batch_id AND mb.tenant_id = ${CTX})`;

const TABLES: ReadonlyArray<{ table: string; predicate: string }> = [
  { table: 'migration_batch_rows', predicate: batchRoot('migration_batch_rows') },
  { table: 'migration_created_targets', predicate: batchRoot('migration_created_targets') },
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

      // migration_batches is already owned by jupiter_tenant_owner (migration 606),
      // so the batch_id referential-integrity checks need no additional grant.

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
        throw new Error('TENANT_MIGRATION_LEDGER_RLS_VERIFICATION_FAILED');
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
        throw new Error('TENANT_MIGRATION_LEDGER_RLS_ROLLBACK_VERIFICATION_FAILED');
      }
    });
  },
};
