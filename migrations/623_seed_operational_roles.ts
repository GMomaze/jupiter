'use strict';

import { QueryInterface, QueryTypes, Transaction } from 'sequelize';

// Canonical operational roles are global reference roles that are also used as
// tenant-local membership roles (tenant_membership_roles.role_id -> rf_role.id).
// Company provisioning requires exactly one ADMIN role
// (tenant-lifecycle-command.repository.ts: `SELECT id FROM rf_role WHERE code='ADMIN' LIMIT 2`).
//
// Historically these roles were created only by the destructive, development-only
// seeder `seeders/010_reference_seeds.ts`, which is never run on the production
// migration/install path. This migration initializes them idempotently and
// non-destructively so fresh installs and partially rebuilt databases both gain
// the exact required operational role set.

type OperationalRoleDefinition = {
  code: 'ADMIN' | 'ENGINEER' | 'MECHANIC' | 'SUPERVISOR' | 'QA' | 'PLANNER' | 'VIEWER';
  label: string;
  description: null;
  isActive: true;
  systemLocked: true;
};

type RoleRow = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  is_active: boolean;
  system_locked: boolean;
};

export const OPERATIONAL_ROLE_DEFINITIONS: readonly OperationalRoleDefinition[] = [
  { code: 'ADMIN', label: 'System Administrator', description: null, isActive: true, systemLocked: true },
  { code: 'ENGINEER', label: 'Licensed Engineer', description: null, isActive: true, systemLocked: true },
  { code: 'MECHANIC', label: 'Mechanic', description: null, isActive: true, systemLocked: true },
  { code: 'SUPERVISOR', label: 'Supervisor', description: null, isActive: true, systemLocked: true },
  { code: 'QA', label: 'Quality Assurance', description: null, isActive: true, systemLocked: true },
  { code: 'PLANNER', label: 'Planner', description: null, isActive: true, systemLocked: true },
  { code: 'VIEWER', label: 'Viewer', description: null, isActive: true, systemLocked: true },
] as const;

function metadataMatches(
  role: RoleRow,
  definition: OperationalRoleDefinition,
): boolean {
  return (
    role.label === definition.label &&
    role.description === definition.description &&
    role.is_active === definition.isActive &&
    role.system_locked === definition.systemLocked
  );
}

export async function seedOperationalRolesNonDestructively(
  queryInterface: QueryInterface,
  transaction: Transaction,
): Promise<void> {
  const roleCodes = OPERATIONAL_ROLE_DEFINITIONS.map(({ code }) => code);

  const existingRoles = await queryInterface.sequelize.query<RoleRow>(
    `
    SELECT id, code, label, description, is_active, system_locked
    FROM public.rf_role
    WHERE code IN (:roleCodes)
    FOR SHARE;
    `,
    {
      replacements: { roleCodes },
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  const existingRoleByCode = new Map(
    existingRoles.map((role) => [role.code, role]),
  );

  // Fail closed before mutating: an existing role with conflicting metadata must
  // never be silently accepted or overwritten.
  for (const definition of OPERATIONAL_ROLE_DEFINITIONS) {
    const existingRole = existingRoleByCode.get(definition.code);
    if (existingRole && !metadataMatches(existingRole, definition)) {
      throw new Error(
        `Operational role prerequisite failed: ${definition.code} has conflicting metadata`,
      );
    }
  }

  for (const definition of OPERATIONAL_ROLE_DEFINITIONS) {
    await queryInterface.sequelize.query(
      `
      INSERT INTO public.rf_role (
        code,
        label,
        description,
        is_active,
        system_locked
      )
      VALUES (
        :code,
        :label,
        NULL,
        :isActive,
        :systemLocked
      )
      ON CONFLICT (code) DO NOTHING;
      `,
      {
        replacements: {
          code: definition.code,
          label: definition.label,
          isActive: definition.isActive,
          systemLocked: definition.systemLocked,
        },
        transaction,
      },
    );
  }

  // Reconcile: every operational role must now exist exactly once with the exact
  // required metadata; otherwise the transaction rolls back without partial state.
  const reconciledRoles = await queryInterface.sequelize.query<RoleRow>(
    `
    SELECT id, code, label, description, is_active, system_locked
    FROM public.rf_role
    WHERE code IN (:roleCodes)
    FOR SHARE;
    `,
    {
      replacements: { roleCodes },
      type: QueryTypes.SELECT,
      transaction,
    },
  );
  const reconciledRoleByCode = new Map(
    reconciledRoles.map((role) => [role.code, role]),
  );

  for (const definition of OPERATIONAL_ROLE_DEFINITIONS) {
    const role = reconciledRoleByCode.get(definition.code);
    if (!role || !metadataMatches(role, definition)) {
      throw new Error(
        `Operational role reconciliation failed: ${definition.code} is missing or has conflicting metadata`,
      );
    }
  }
}

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await seedOperationalRolesNonDestructively(queryInterface, transaction);
    });
  },

  async down() {
    // Intentionally non-destructive: deleting operational roles could cascade
    // tenant membership roles, user_roles, and role-permission mappings that are
    // operational authority records.
  },
};
