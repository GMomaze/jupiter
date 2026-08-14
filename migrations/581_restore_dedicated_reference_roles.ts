"use strict";

import { QueryInterface, QueryTypes, Transaction } from "sequelize";

type DedicatedReferenceRoleDefinition = {
  code: "REFERENCE_ADMIN" | "REFERENCE_EDITOR" | "REFERENCE_VIEWER";
  label: string;
  description: string;
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

export const DEDICATED_REFERENCE_ROLE_DEFINITIONS: readonly DedicatedReferenceRoleDefinition[] =
  [
    {
      code: "REFERENCE_ADMIN",
      label: "Reference Administrator",
      description: "Full control of reference data",
      isActive: true,
      systemLocked: true,
    },
    {
      code: "REFERENCE_EDITOR",
      label: "Reference Editor",
      description: "Create and edit reference data",
      isActive: true,
      systemLocked: true,
    },
    {
      code: "REFERENCE_VIEWER",
      label: "Reference Viewer",
      description: "View-only access to reference data",
      isActive: true,
      systemLocked: true,
    },
  ] as const;

function metadataMatches(
  role: RoleRow,
  definition: DedicatedReferenceRoleDefinition,
): boolean {
  return (
    role.label === definition.label &&
    role.description === definition.description &&
    role.is_active === definition.isActive &&
    role.system_locked === definition.systemLocked
  );
}

export async function restoreDedicatedReferenceRoles(
  queryInterface: QueryInterface,
  transaction: Transaction,
): Promise<void> {
  const roleCodes = DEDICATED_REFERENCE_ROLE_DEFINITIONS.map(
    ({ code }) => code,
  );
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

  for (const definition of DEDICATED_REFERENCE_ROLE_DEFINITIONS) {
    const existingRole = existingRoleByCode.get(definition.code);
    if (existingRole && !metadataMatches(existingRole, definition)) {
      throw new Error(
        `Dedicated Reference role prerequisite failed: ${definition.code} has conflicting metadata`,
      );
    }
  }

  for (const definition of DEDICATED_REFERENCE_ROLE_DEFINITIONS) {
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
        :description,
        :isActive,
        :systemLocked
      )
      ON CONFLICT (code) DO NOTHING;
      `,
      { replacements: definition, transaction },
    );
  }

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

  for (const definition of DEDICATED_REFERENCE_ROLE_DEFINITIONS) {
    const role = reconciledRoleByCode.get(definition.code);
    if (!role || !metadataMatches(role, definition)) {
      throw new Error(
        `Dedicated Reference role reconciliation failed: ${definition.code} is missing or has conflicting metadata`,
      );
    }
  }
}

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await restoreDedicatedReferenceRoles(queryInterface, transaction);
    });
  },

  async down() {
    // Intentionally non-destructive: deleting dedicated Reference roles could
    // cascade operational mappings or user-role assignments.
  },
};
