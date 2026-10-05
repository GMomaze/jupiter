'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

const OWNER_ROLE = 'jupiter_tenant_owner';
const ORIGINAL_OWNER = 'postgres';
const CTX = "NULLIF(current_setting('jupiter.tenant_id', true), '')::uuid";

const WP = (col: string, table: string) =>
  `EXISTS (SELECT 1 FROM public.workpacks w WHERE w.id = ${table}.${col} AND w.tenant_id = ${CTX})`;
const EXEC = (table: string) =>
  `EXISTS (SELECT 1 FROM public.workpack_executions e JOIN public.workpacks w ON w.id = e.workpack_id
     WHERE e.id = ${table}.execution_id AND w.tenant_id = ${CTX})`;

const TABLES: ReadonlyArray<{ table: string; predicate: string }> = [
  { table: 'workpack_tasks', predicate: WP('workpack_id', 'workpack_tasks') },
  { table: 'workpack_executions', predicate: WP('workpack_id', 'workpack_executions') },
  { table: 'workpack_compliance', predicate: WP('workpack_id', 'workpack_compliance') },
  { table: 'workpack_requirements', predicate: WP('workpack_id', 'workpack_requirements') },
  { table: 'workpack_audit_log', predicate: WP('workpack_id', 'workpack_audit_log') },
  { table: 'workpack_measurements', predicate: EXEC('workpack_measurements') },
  { table: 'workpack_signatures', predicate: EXEC('workpack_signatures') },
  { table: 'workpack_sources', predicate: EXEC('workpack_sources') },
  {
    table: 'workpack_snags',
    predicate: `((workpack_id IS NOT NULL
        AND ${WP('workpack_id', 'workpack_snags')}
        AND EXISTS (SELECT 1 FROM public.aircraft a WHERE a.id = workpack_snags.aircraft_id AND a.tenant_id = ${CTX}))
      OR (workpack_id IS NULL
        AND EXISTS (SELECT 1 FROM public.aircraft a WHERE a.id = workpack_snags.aircraft_id AND a.tenant_id = ${CTX})))`,
  },
  {
    table: 'workpack_snag_audit_log',
    predicate: `EXISTS (SELECT 1 FROM public.workpack_snags s
      WHERE s.id = workpack_snag_audit_log.snag_id
        AND ((s.workpack_id IS NOT NULL
            AND EXISTS (SELECT 1 FROM public.workpacks w WHERE w.id = s.workpack_id AND w.tenant_id = ${CTX})
            AND EXISTS (SELECT 1 FROM public.aircraft a WHERE a.id = s.aircraft_id AND a.tenant_id = ${CTX}))
          OR (s.workpack_id IS NULL
            AND EXISTS (SELECT 1 FROM public.aircraft a WHERE a.id = s.aircraft_id AND a.tenant_id = ${CTX}))))`,
  },
  {
    table: 'task_cards',
    predicate: `EXISTS (SELECT 1 FROM public.workpack_tasks wt
      JOIN public.workpacks w ON w.id = wt.workpack_id
      WHERE wt.task_id = task_cards.id AND w.tenant_id = ${CTX})`,
  },
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
        throw new Error('TENANT_WORKPACK_RLS_VERIFICATION_FAILED');
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
    });
  },
};
