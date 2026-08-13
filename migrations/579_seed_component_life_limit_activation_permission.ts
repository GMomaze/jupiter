'use strict';

import { QueryInterface, QueryTypes, Transaction } from 'sequelize';

export const COMPONENT_LIFE_LIMIT_ACTIVATION_PERMISSION = {
  code: 'COMPONENT_LIFE_LIMIT_ACTIVATE',
  label: 'Component Life Limit Activate',
  description: 'Independently activate an approved dormant governed component life-limit publication',
  module: 'COMPONENT_LIFE_LIMIT',
  isActive: true,
  systemLocked: true,
} as const;

type PermissionRow = {
  code: string;
  label: string;
  description: string | null;
  module: string;
  is_active: boolean;
  system_locked: boolean;
};

export async function seedComponentLifeLimitActivationPermission(
  queryInterface: QueryInterface,
  transaction: Transaction
) {
  const [existing] = await queryInterface.sequelize.query<PermissionRow>(
    `SELECT code, label, description, module, is_active, system_locked
     FROM public.rf_permission WHERE code = :code FOR SHARE;`,
    { replacements: { code: COMPONENT_LIFE_LIMIT_ACTIVATION_PERMISSION.code }, type: QueryTypes.SELECT, transaction }
  );
  const definition = COMPONENT_LIFE_LIMIT_ACTIVATION_PERMISSION;
  if (existing && (
    existing.label !== definition.label || existing.description !== definition.description ||
    existing.module !== definition.module || existing.is_active !== definition.isActive ||
    existing.system_locked !== definition.systemLocked
  )) throw new Error(`Component life-limit activation permission prerequisite failed: ${definition.code} has conflicting metadata`);

  await queryInterface.sequelize.query(
    `INSERT INTO public.rf_permission (code,label,description,module,is_active,system_locked)
     VALUES (:code,:label,:description,:module,:isActive,:systemLocked)
     ON CONFLICT (code) DO NOTHING;`,
    { replacements: definition, transaction }
  );
}

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction((transaction) =>
      seedComponentLifeLimitActivationPermission(queryInterface, transaction)
    );
  },
  async down() {
    // Intentionally non-destructive: operational authority definitions survive rollback.
  },
};
