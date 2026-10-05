'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

const CTX = "NULLIF(current_setting('jupiter.tenant_id', true), '')::uuid";

// Hybrid workpack + aircraft consistency predicate — unchanged security meaning
// from migration 609. Used for SELECT/UPDATE/DELETE.
const HYBRID = `EXISTS (SELECT 1 FROM public.workpack_tasks wt
      JOIN public.workpacks w ON w.id = wt.workpack_id
      WHERE wt.task_id = task_cards.id AND w.tenant_id = ${CTX})
   AND EXISTS (SELECT 1 FROM public.aircraft a
      WHERE a.id = task_cards.aircraft_id AND a.tenant_id = ${CTX})`;

// Aircraft-root ownership predicate for INSERT. aircraft_id is NOT NULL and is
// populated on every mounted TaskCard creation path, so it is the authoritative
// tenant root available at creation time (before any workpack_tasks link exists).
const AIRCRAFT_ROOT = `EXISTS (SELECT 1 FROM public.aircraft a
      WHERE a.id = aircraft_id AND a.tenant_id = ${CTX})`;

const ORIGINAL_POLICY = 'task_cards_tenant_rls';
const POLICIES: ReadonlyArray<{
  name: string;
  command: 'INSERT' | 'SELECT' | 'UPDATE' | 'DELETE';
  using: string | null;
  check: string | null;
}> = [
  { name: 'task_cards_tenant_rls_insert', command: 'INSERT', using: null, check: AIRCRAFT_ROOT },
  { name: 'task_cards_tenant_rls_select', command: 'SELECT', using: HYBRID, check: null },
  { name: 'task_cards_tenant_rls_update', command: 'UPDATE', using: HYBRID, check: HYBRID },
  { name: 'task_cards_tenant_rls_delete', command: 'DELETE', using: HYBRID, check: null },
];

function createPolicySql({ name, command, using, check }: (typeof POLICIES)[number]): string {
  const clauses = [`FOR ${command}`];
  if (using) clauses.push(`USING (${using})`);
  if (check) clauses.push(`WITH CHECK (${check})`);
  return `CREATE POLICY ${name} ON public.task_cards\n  ${clauses.join('\n  ')};`;
}

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `DROP POLICY IF EXISTS ${ORIGINAL_POLICY} ON public.task_cards;`,
        { transaction },
      );
      for (const policy of POLICIES) {
        await queryInterface.sequelize.query(createPolicySql(policy), { transaction });
      }

      const [verified] = await queryInterface.sequelize.query<{
        policies: number; forced: number; expected: number;
      }>(
        `SELECT
           (SELECT count(*)::int FROM pg_catalog.pg_policies
              WHERE tablename = 'task_cards' AND policyname LIKE 'task_cards_tenant_rls_%') AS policies,
           (SELECT count(*)::int FROM pg_catalog.pg_class
              WHERE relname = 'task_cards' AND relforcerowsecurity) AS forced,
           4::int AS expected`,
        { type: QueryTypes.SELECT, transaction },
      );
      if (!verified || verified.policies !== verified.expected || verified.forced !== 1) {
        throw new Error('TENANT_TASK_CARD_INSERT_RLS_VERIFICATION_FAILED');
      }
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const { name } of POLICIES) {
        await queryInterface.sequelize.query(
          `DROP POLICY IF EXISTS ${name} ON public.task_cards;`,
          { transaction },
        );
      }
      await queryInterface.sequelize.query(
        `CREATE POLICY ${ORIGINAL_POLICY} ON public.task_cards
           FOR ALL
           USING (${HYBRID})
           WITH CHECK (${HYBRID});`,
        { transaction },
      );

      const [verified] = await queryInterface.sequelize.query<{
        policies: number; forced: number;
      }>(
        `SELECT
           (SELECT count(*)::int FROM pg_catalog.pg_policies
              WHERE tablename = 'task_cards' AND policyname = :original) AS policies,
           (SELECT count(*)::int FROM pg_catalog.pg_class
              WHERE relname = 'task_cards' AND relforcerowsecurity) AS forced`,
        { replacements: { original: ORIGINAL_POLICY }, type: QueryTypes.SELECT, transaction },
      );
      if (!verified || verified.policies !== 1 || verified.forced !== 1) {
        throw new Error('TENANT_TASK_CARD_INSERT_RLS_ROLLBACK_VERIFICATION_FAILED');
      }
    });
  },
};
