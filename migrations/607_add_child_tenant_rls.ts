'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

const OWNER_ROLE = 'jupiter_tenant_owner';
const ORIGINAL_OWNER = 'postgres';
const CTX = "NULLIF(current_setting('jupiter.tenant_id', true), '')::uuid";

const TABLES: ReadonlyArray<{ table: string; predicate: string }> = [
  { table: 'utilisation_events', predicate: `EXISTS (SELECT 1 FROM public.aircraft a WHERE a.id = utilisation_events.aircraft_id AND a.tenant_id = ${CTX})` },
  { table: 'aircraft_sb_compliance', predicate: `EXISTS (SELECT 1 FROM public.aircraft a WHERE a.id = aircraft_sb_compliance.aircraft_id AND a.tenant_id = ${CTX})` },
  { table: 'aircraft_compliance', predicate: `EXISTS (SELECT 1 FROM public.aircraft a WHERE a.id = aircraft_compliance.aircraft_id AND a.tenant_id = ${CTX})` },
  { table: 'aircraft_sid_status', predicate: `EXISTS (SELECT 1 FROM public.aircraft a WHERE a.id = aircraft_sid_status.aircraft_id AND a.tenant_id = ${CTX})` },
  { table: 'customer_users', predicate: `EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_users.customer_id AND c.tenant_id = ${CTX})` },
  { table: 'serialized_component_life_states', predicate: `EXISTS (SELECT 1 FROM public.serialized_components sc WHERE sc.id = serialized_component_life_states.serialized_component_id AND sc.custodian_tenant_id = ${CTX})` },
  { table: 'serialized_component_maintenance_events', predicate: `EXISTS (SELECT 1 FROM public.serialized_components sc WHERE sc.id = serialized_component_maintenance_events.serialized_component_id AND sc.custodian_tenant_id = ${CTX})` },
  {
    table: 'customer_aircraft_links',
    predicate: `EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_aircraft_links.customer_id AND c.tenant_id = ${CTX})
       AND EXISTS (SELECT 1 FROM public.aircraft a WHERE a.id = customer_aircraft_links.aircraft_id AND a.tenant_id = ${CTX})`,
  },
  {
    table: 'aircraft_component_installations',
    predicate: `EXISTS (SELECT 1 FROM public.aircraft a WHERE a.id = aircraft_component_installations.aircraft_id AND a.tenant_id = ${CTX})
       AND EXISTS (SELECT 1 FROM public.serialized_components sc WHERE sc.id = aircraft_component_installations.serialized_component_id AND sc.custodian_tenant_id = ${CTX})`,
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

      // FK referential-integrity checks run as the table owner; grant SELECT on
      // the newly-referenced shared-master tables.
      await queryInterface.sequelize.query(
        `GRANT SELECT ON public.service_bulletins, public.compliance_items, public.cessna_sids TO ${OWNER_ROLE};`,
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
        throw new Error('TENANT_CHILD_RLS_VERIFICATION_FAILED');
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
        `REVOKE SELECT ON public.service_bulletins, public.compliance_items, public.cessna_sids FROM ${OWNER_ROLE};`,
        { transaction }
      );
    });
  },
};
