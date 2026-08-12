'use strict';

import { QueryInterface, QueryTypes, Transaction } from 'sequelize';

type LibraryPermissionDefinition = {
  code: 'LIBRARY_VIEW' | 'LIBRARY_EDIT';
  label: string;
  description: string;
  module: 'LIBRARY';
  isActive: true;
  systemLocked: true;
};

type PermissionRow = {
  code: string;
  label: string;
  description: string | null;
  module: string;
  is_active: boolean;
  system_locked: boolean;
};

export const LIBRARY_PERMISSION_DEFINITIONS: readonly LibraryPermissionDefinition[] = [
  {
    code: 'LIBRARY_VIEW',
    label: 'Library View',
    description: 'View approved read-only Library pages and master-data records',
    module: 'LIBRARY',
    isActive: true,
    systemLocked: true,
  },
  {
    code: 'LIBRARY_EDIT',
    label: 'Library Edit',
    description:
      'Create, import, edit, allocate, and otherwise manage Library master data',
    module: 'LIBRARY',
    isActive: true,
    systemLocked: true,
  },
] as const;

export async function seedLibraryPermissions(
  queryInterface: QueryInterface,
  transaction: Transaction
): Promise<void> {
  for (const definition of LIBRARY_PERMISSION_DEFINITIONS) {
    await queryInterface.sequelize.query(
      `
      INSERT INTO rf_permission (
        code,
        label,
        description,
        module,
        is_active,
        system_locked
      )
      VALUES (
        :code,
        :label,
        :description,
        :module,
        :isActive,
        :systemLocked
      )
      ON CONFLICT (code) DO NOTHING;
      `,
      { replacements: definition, transaction }
    );
  }

  const permissionCodes = LIBRARY_PERMISSION_DEFINITIONS.map(
    ({ code }) => code
  );
  const permissions = await queryInterface.sequelize.query<PermissionRow>(
    `
    SELECT code, label, description, module, is_active, system_locked
    FROM rf_permission
    WHERE code IN (:permissionCodes)
    FOR SHARE;
    `,
    {
      replacements: { permissionCodes },
      type: QueryTypes.SELECT,
      transaction,
    }
  );
  const permissionByCode = new Map(
    permissions.map((permission) => [permission.code, permission])
  );

  for (const definition of LIBRARY_PERMISSION_DEFINITIONS) {
    const permission = permissionByCode.get(definition.code);
    const metadataMatches =
      permission?.label === definition.label &&
      permission.description === definition.description &&
      permission.module === definition.module &&
      permission.is_active === definition.isActive &&
      permission.system_locked === definition.systemLocked;

    if (!metadataMatches) {
      throw new Error(
        `Library permission prerequisite failed: ${definition.code} is missing or has conflicting metadata`
      );
    }
  }
}

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await seedLibraryPermissions(queryInterface, transaction);
    });
  },

  async down() {
    // Intentionally non-destructive: deleting these permission rows could
    // cascade operational or custom role-permission mappings.
  },
};
