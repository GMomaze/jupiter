'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

const OWNER_ROLE = 'jupiter_tenant_owner';
const ORIGINAL_OWNER = 'postgres';
const CTX = "NULLIF(current_setting('jupiter.tenant_id', true), '')::uuid";

// Polymorphic audit_log tenant predicate. Mirrors the canonical MT-4C7A
// ownership mapping (audit-tenant.repository.live.ts) with one deliberate,
// documented deviation for the task_cards branch (see §9.5 of the 4.1
// ownership architecture): the MT-4C7A `NOT EXISTS (foreign workpack)` clause
// cannot be expressed under RLS because the workpack_tasks subquery is itself
// tenant-filtered (nested RLS). It is replaced with the aircraft-tenancy
// consistency check already established for task_cards by migration 609, so the
// audit_log boundary never exceeds the task_cards boundary it documents.
//
// Every supported root resolves tenant through an approved tenant root:
//   aircraft/customers/workpacks           -> direct tenant_id
//   task_cards                             -> workpack root AND aircraft tenant
//   workpack_snags                         -> workpack root + aircraft (linked)
//                                             OR aircraft (standalone)
//   aircraft_compliance/utilisation_events -> aircraft tenant
//   customer_aircraft_links                -> customer AND aircraft tenant
// Unknown, malformed, deleted/unresolvable provenance -> ELSE FALSE (fail closed).

const PREDICATE = `
CASE table_name
  WHEN 'aircraft' THEN EXISTS (
    SELECT 1 FROM public.aircraft a WHERE a.id = row_id AND a.tenant_id = ${CTX})
  WHEN 'customers' THEN EXISTS (
    SELECT 1 FROM public.customers c WHERE c.id = row_id AND c.tenant_id = ${CTX})
  WHEN 'workpacks' THEN EXISTS (
    SELECT 1 FROM public.workpacks w WHERE w.id = row_id AND w.tenant_id = ${CTX})
  WHEN 'task_cards' THEN
    EXISTS (
      SELECT 1 FROM public.workpack_tasks wt
      JOIN public.workpacks w ON w.id = wt.workpack_id
      WHERE wt.task_id = row_id AND w.tenant_id = ${CTX})
    AND EXISTS (
      SELECT 1 FROM public.task_cards tc
      JOIN public.aircraft a ON a.id = tc.aircraft_id
      WHERE tc.id = row_id AND a.tenant_id = ${CTX})
  WHEN 'workpack_snags' THEN EXISTS (
    SELECT 1 FROM public.workpack_snags s WHERE s.id = row_id AND (
      (s.workpack_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.workpacks w WHERE w.id = s.workpack_id AND w.tenant_id = ${CTX})
        AND EXISTS (SELECT 1 FROM public.aircraft a WHERE a.id = s.aircraft_id AND a.tenant_id = ${CTX}))
      OR (s.workpack_id IS NULL
        AND EXISTS (SELECT 1 FROM public.aircraft a WHERE a.id = s.aircraft_id AND a.tenant_id = ${CTX}))))
  WHEN 'aircraft_compliance' THEN EXISTS (
    SELECT 1 FROM public.aircraft_compliance ac
    JOIN public.aircraft a ON a.id = ac.aircraft_id
    WHERE ac.id = row_id AND a.tenant_id = ${CTX})
  WHEN 'utilisation_events' THEN EXISTS (
    SELECT 1 FROM public.utilisation_events ue
    JOIN public.aircraft a ON a.id = ue.aircraft_id
    WHERE ue.id = row_id AND a.tenant_id = ${CTX})
  WHEN 'customer_aircraft_links' THEN EXISTS (
    SELECT 1 FROM public.customer_aircraft_links l
    JOIN public.customers c ON c.id = l.customer_id
    JOIN public.aircraft a ON a.id = l.aircraft_id
    WHERE l.id = row_id AND c.tenant_id = ${CTX} AND a.tenant_id = ${CTX})
  ELSE FALSE
END`;

const POLICY = 'audit_log_tenant_rls';

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [owner] = await queryInterface.sequelize.query<{ exists: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :owner) AS exists`,
        { replacements: { owner: OWNER_ROLE }, type: QueryTypes.SELECT, transaction }
      );
      if (!owner?.exists) throw new Error('TENANT_OWNER_ROLE_MISSING');

      await queryInterface.sequelize.query(
        `ALTER TABLE public.audit_log OWNER TO ${OWNER_ROLE};
         ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
         ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `CREATE POLICY ${POLICY} ON public.audit_log
           FOR ALL
           USING (${PREDICATE})
           WITH CHECK (${PREDICATE});`,
        { transaction }
      );

      // audit_log.actor_id -> users; users SELECT is already granted to the
      // owner role by migration 606, so no new referential grants are needed.

      const [verified] = await queryInterface.sequelize.query<{
        owned: number; rls_enabled: number; rls_forced: number; policies: number;
      }>(
        `SELECT
           (SELECT count(*)::int FROM pg_catalog.pg_class c JOIN pg_catalog.pg_roles r ON r.oid = c.relowner
              WHERE c.relname = 'audit_log' AND r.rolname = :owner) AS owned,
           (SELECT count(*)::int FROM pg_catalog.pg_class WHERE relname = 'audit_log' AND relrowsecurity) AS rls_enabled,
           (SELECT count(*)::int FROM pg_catalog.pg_class WHERE relname = 'audit_log' AND relforcerowsecurity) AS rls_forced,
           (SELECT count(*)::int FROM pg_catalog.pg_policies WHERE tablename = 'audit_log' AND policyname = :policy) AS policies`,
        { replacements: { owner: OWNER_ROLE, policy: POLICY }, type: QueryTypes.SELECT, transaction }
      );
      if (!verified || verified.owned !== 1 || verified.rls_enabled !== 1 || verified.rls_forced !== 1 || verified.policies !== 1) {
        throw new Error('TENANT_AUDIT_LOG_RLS_VERIFICATION_FAILED');
      }
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `DROP POLICY IF EXISTS ${POLICY} ON public.audit_log;
         ALTER TABLE public.audit_log DISABLE ROW LEVEL SECURITY;
         ALTER TABLE public.audit_log NO FORCE ROW LEVEL SECURITY;
         ALTER TABLE public.audit_log OWNER TO ${ORIGINAL_OWNER};`,
        { transaction }
      );
      const [verified] = await queryInterface.sequelize.query<{
        restored: number; rls_off: number; policies: number;
      }>(
        `SELECT
           (SELECT count(*)::int FROM pg_catalog.pg_class c JOIN pg_catalog.pg_roles r ON r.oid = c.relowner
              WHERE c.relname = 'audit_log' AND r.rolname = :owner) AS restored,
           (SELECT count(*)::int FROM pg_catalog.pg_class WHERE relname = 'audit_log' AND NOT relrowsecurity AND NOT relforcerowsecurity) AS rls_off,
           (SELECT count(*)::int FROM pg_catalog.pg_policies WHERE tablename = 'audit_log' AND policyname = :policy) AS policies`,
        { replacements: { owner: ORIGINAL_OWNER, policy: POLICY }, type: QueryTypes.SELECT, transaction }
      );
      if (!verified || verified.restored !== 1 || verified.rls_off !== 1 || verified.policies !== 0) {
        throw new Error('TENANT_AUDIT_LOG_RLS_ROLLBACK_VERIFICATION_FAILED');
      }
    });
  },
};
