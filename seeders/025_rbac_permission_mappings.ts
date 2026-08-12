import { QueryInterface, QueryTypes, Transaction } from 'sequelize';

type CodedRow = {
  id: string;
  code: string;
};

export const APPROVED_ROLE_PERMISSION_MAPPINGS = [
  ...[
    'AD_APPLICABILITY_REVIEW_VIEW',
    'AD_APPLICABILITY_REVIEW_REFRESH',
    'AD_APPLICABILITY_REVIEW_ACCEPT',
    'AD_APPLICABILITY_REVIEW_IGNORE',
    'AD_APPLICABILITY_REVIEW_RESTORE',
    'AD_APPLICABILITY_REVIEW_LINK_MODEL',
    'AD_APPLICABILITY_REVIEW_LINK_MANUFACTURER',
    'AD_COMPLIANCE_ASSIGN_CREATE',
    'AD_COMPLIANCE_RECORD_CREATE',
    'AD_COMPLIANCE_STATUS_UPDATE',
    'AD_COMPLIANCE_DUE_UPDATE',
  ].flatMap((permissionCode) => [
    { roleCode: 'ADMIN', permissionCode },
    { roleCode: 'QA', permissionCode },
  ]),
  {
    roleCode: 'ENGINEER',
    permissionCode: 'AD_APPLICABILITY_REVIEW_VIEW',
  },
  {
    roleCode: 'PLANNER',
    permissionCode: 'AD_APPLICABILITY_REVIEW_VIEW',
  },
  {
    roleCode: 'VIEWER',
    permissionCode: 'AD_APPLICABILITY_REVIEW_VIEW',
  },
  { roleCode: 'REFERENCE_ADMIN', permissionCode: 'REFERENCE_VIEW' },
  { roleCode: 'REFERENCE_ADMIN', permissionCode: 'REFERENCE_CREATE' },
  { roleCode: 'REFERENCE_ADMIN', permissionCode: 'REFERENCE_EDIT' },
  {
    roleCode: 'REFERENCE_ADMIN',
    permissionCode: 'REFERENCE_DEACTIVATE',
  },
  { roleCode: 'REFERENCE_EDITOR', permissionCode: 'REFERENCE_VIEW' },
  { roleCode: 'REFERENCE_EDITOR', permissionCode: 'REFERENCE_CREATE' },
  { roleCode: 'REFERENCE_EDITOR', permissionCode: 'REFERENCE_EDIT' },
  { roleCode: 'REFERENCE_VIEWER', permissionCode: 'REFERENCE_VIEW' },
] as const;

const REQUIRED_ROLE_CODES = [
  ...new Set(APPROVED_ROLE_PERMISSION_MAPPINGS.map(({ roleCode }) => roleCode)),
];

const REQUIRED_PERMISSION_CODES = [
  ...new Set(
    APPROVED_ROLE_PERMISSION_MAPPINGS.map(
      ({ permissionCode }) => permissionCode
    )
  ),
];

export async function reconcileApprovedRolePermissionMappings(
  queryInterface: QueryInterface,
  transaction: Transaction
): Promise<void> {
  const roles = await queryInterface.sequelize.query<CodedRow>(
    `
    SELECT id, code
    FROM rf_role
    WHERE code IN (:roleCodes)
    FOR SHARE;
    `,
    {
      replacements: { roleCodes: REQUIRED_ROLE_CODES },
      type: QueryTypes.SELECT,
      transaction,
    }
  );
  const permissions = await queryInterface.sequelize.query<CodedRow>(
    `
    SELECT id, code
    FROM rf_permission
    WHERE code IN (:permissionCodes)
    FOR SHARE;
    `,
    {
      replacements: { permissionCodes: REQUIRED_PERMISSION_CODES },
      type: QueryTypes.SELECT,
      transaction,
    }
  );

  const roleByCode = new Map(roles.map((role) => [role.code, role]));
  const permissionByCode = new Map(
    permissions.map((permission) => [permission.code, permission])
  );
  const missingRoles = REQUIRED_ROLE_CODES.filter(
    (code) => !roleByCode.has(code)
  );
  const missingPermissions = REQUIRED_PERMISSION_CODES.filter(
    (code) => !permissionByCode.has(code)
  );

  if (missingRoles.length > 0 || missingPermissions.length > 0) {
    const failures = [
      missingRoles.length > 0
        ? `missing rf_role rows: ${missingRoles.join(', ')}`
        : null,
      missingPermissions.length > 0
        ? `missing rf_permission rows: ${missingPermissions.join(', ')}`
        : null,
    ].filter(Boolean);

    throw new Error(`RBAC mapping prerequisites failed: ${failures.join('; ')}`);
  }

  for (const { roleCode, permissionCode } of APPROVED_ROLE_PERMISSION_MAPPINGS) {
    const role = roleByCode.get(roleCode)!;
    const permission = permissionByCode.get(permissionCode)!;

    await queryInterface.sequelize.query(
      `
      INSERT INTO rf_role_permissions (role_id, permission_id)
      VALUES (:roleId, :permissionId)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
      `,
      {
        replacements: {
          roleId: role.id,
          permissionId: permission.id,
        },
        transaction,
      }
    );
  }
}

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await reconcileApprovedRolePermissionMappings(
        queryInterface,
        transaction
      );
    });
  },

  async down() {
    // Intentionally non-destructive: role-permission mappings may be operational
    // authority records and must not be removed by an ordinary seeder rollback.
  },
};
