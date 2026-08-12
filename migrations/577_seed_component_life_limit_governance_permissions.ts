'use strict';

import { QueryInterface, QueryTypes, Transaction } from 'sequelize';

export const COMPONENT_LIFE_LIMIT_PERMISSION_DEFINITIONS = [
  {
    code: 'COMPONENT_LIFE_LIMIT_PROPOSE',
    label: 'Component Life Limit Propose',
    description:
      'Propose governed model-wide component life-limit determinations and revisions',
    module: 'COMPONENT_LIFE_LIMIT',
    isActive: true,
    systemLocked: true,
  },
  {
    code: 'COMPONENT_LIFE_LIMIT_APPROVE',
    label: 'Component Life Limit Approve',
    description:
      'Independently approve or reject governed component life-limit determinations and revisions',
    module: 'COMPONENT_LIFE_LIMIT',
    isActive: true,
    systemLocked: true,
  },
] as const;

type PermissionRow = {
  code: string;
  label: string;
  description: string | null;
  module: string;
  is_active: boolean;
  system_locked: boolean;
};

export async function seedComponentLifeLimitGovernancePermissions(
  queryInterface: QueryInterface,
  transaction: Transaction
) {
  const existingRows = await queryInterface.sequelize.query<PermissionRow>(
    `SELECT code, label, description, module, is_active, system_locked
     FROM rf_permission
     WHERE code IN (:codes)
     FOR SHARE;`,
    {
      replacements: {
        codes: COMPONENT_LIFE_LIMIT_PERMISSION_DEFINITIONS.map(({ code }) => code),
      },
      type: QueryTypes.SELECT,
      transaction,
    }
  );
  const existingByCode = new Map(existingRows.map((row) => [row.code, row]));

  for (const definition of COMPONENT_LIFE_LIMIT_PERMISSION_DEFINITIONS) {
    const row = existingByCode.get(definition.code);
    if (!row) continue;
    if (
      row.label !== definition.label ||
      row.description !== definition.description ||
      row.module !== definition.module ||
      row.is_active !== definition.isActive ||
      row.system_locked !== definition.systemLocked
    ) {
      throw new Error(
        `Component life-limit permission prerequisite failed: ${definition.code} is missing or has conflicting metadata`
      );
    }
  }

  for (const definition of COMPONENT_LIFE_LIMIT_PERMISSION_DEFINITIONS) {
    await queryInterface.sequelize.query(
      `INSERT INTO rf_permission
       (code, label, description, module, is_active, system_locked)
       VALUES (:code, :label, :description, :module, :isActive, :systemLocked)
       ON CONFLICT (code) DO NOTHING;`,
      { replacements: definition, transaction }
    );
  }
}

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction((transaction) =>
      seedComponentLifeLimitGovernancePermissions(queryInterface, transaction)
    );
  },
  async down() {
    // Intentionally non-destructive: permission definitions and mappings may
    // represent operational authority and must survive ordinary rollback.
  },
};
