'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

const OWNER_ROLE = 'jupiter_tenant_owner';
const ORIGINAL_OWNER = 'postgres';
const CTX = "NULLIF(current_setting('jupiter.tenant_id', true), '')::uuid";
// "No tenant context" — platform/System Owner operations run with no tenant
// context (per 4.2 §4.8), which is the only available DB-level proxy for the
// platform-authority boundary on shared-master rows of mixed tables.
const NO_CTX = "NULLIF(current_setting('jupiter.tenant_id', true), '') IS NULL";

// task_templates: AIRCRAFT scope is tenant-owned via aircraft_id; MODEL/GLOBAL/MPI
// are shared-master. Shared rows are visible to all tenants (USING TRUE) but only
// writable by platform authority with no tenant context (WITH CHECK NO_CTX), which
// also blocks a tenant from converting an AIRCRAFT row to a shared scope.
const TASK_TEMPLATES_USING = `
CASE scope
  WHEN 'AIRCRAFT' THEN EXISTS (
    SELECT 1 FROM public.aircraft a WHERE a.id = task_templates.aircraft_id AND a.tenant_id = ${CTX})
  WHEN 'MODEL' THEN TRUE
  WHEN 'GLOBAL' THEN TRUE
  WHEN 'MPI' THEN TRUE
  ELSE FALSE
END`;
const TASK_TEMPLATES_CHECK = `
CASE scope
  WHEN 'AIRCRAFT' THEN EXISTS (
    SELECT 1 FROM public.aircraft a WHERE a.id = task_templates.aircraft_id AND a.tenant_id = ${CTX})
  WHEN 'MODEL' THEN ${NO_CTX}
  WHEN 'GLOBAL' THEN ${NO_CTX}
  WHEN 'MPI' THEN ${NO_CTX}
  ELSE FALSE
END`;

// compliance_assignments: AIRCRAFT assignment is tenant-owned via aircraft_id;
// MODEL assignment is shared-master.
const COMPLIANCE_ASSIGNMENTS_USING = `
CASE assignment_type
  WHEN 'AIRCRAFT' THEN EXISTS (
    SELECT 1 FROM public.aircraft a WHERE a.id = compliance_assignments.aircraft_id AND a.tenant_id = ${CTX})
  WHEN 'MODEL' THEN TRUE
  ELSE FALSE
END`;
const COMPLIANCE_ASSIGNMENTS_CHECK = `
CASE assignment_type
  WHEN 'AIRCRAFT' THEN EXISTS (
    SELECT 1 FROM public.aircraft a WHERE a.id = compliance_assignments.aircraft_id AND a.tenant_id = ${CTX})
  WHEN 'MODEL' THEN ${NO_CTX}
  ELSE FALSE
END`;

// staff_invitations: direct tenant_id ownership.
const STAFF_INVITATIONS_PREDICATE = `tenant_id = ${CTX}`;

const TABLES: ReadonlyArray<{ table: string; using: string; check: string }> = [
  { table: 'task_templates', using: TASK_TEMPLATES_USING, check: TASK_TEMPLATES_CHECK },
  { table: 'compliance_assignments', using: COMPLIANCE_ASSIGNMENTS_USING, check: COMPLIANCE_ASSIGNMENTS_CHECK },
  { table: 'staff_invitations', using: STAFF_INVITATIONS_PREDICATE, check: STAFF_INVITATIONS_PREDICATE },
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

      for (const { table, using: usingPred, check: checkPred } of TABLES) {
        await queryInterface.sequelize.query(
          `ALTER TABLE public.${table} OWNER TO ${OWNER_ROLE};
           ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;
           ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY;`,
          { transaction }
        );
        await queryInterface.sequelize.query(
          `CREATE POLICY ${policyName(table)} ON public.${table}
             FOR ALL
             USING (${usingPred})
             WITH CHECK (${checkPred});`,
          { transaction }
        );
      }

      // FK referential-integrity grants for the newly-owned tables:
      // task_templates.aircraft_model_id -> component_models (SELECT granted by 606);
      // compliance_assignments.model_id -> component_models (606),
      //   compliance_item_id -> compliance_items (607);
      // staff_invitations.tenant_id -> tenants (606), user/invited_by/revoked_by
      //   -> users (606), membership_id -> tenant_memberships (NOT yet granted).
      // Only tenant_memberships is newly required.
      await queryInterface.sequelize.query(
        `GRANT SELECT ON public.tenant_memberships TO ${OWNER_ROLE};`,
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
        throw new Error('TENANT_MIXED_STAFF_RLS_VERIFICATION_FAILED');
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
        `REVOKE SELECT ON public.tenant_memberships FROM ${OWNER_ROLE};`,
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
        throw new Error('TENANT_MIXED_STAFF_RLS_ROLLBACK_VERIFICATION_FAILED');
      }
    });
  },
};

