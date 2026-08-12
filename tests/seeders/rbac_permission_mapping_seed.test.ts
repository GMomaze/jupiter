import { randomUUID } from 'node:crypto';
import { QueryTypes, Transaction } from 'sequelize';
import { afterAll, describe, expect, it } from 'vitest';
import {
  APPROVED_ROLE_PERMISSION_MAPPINGS,
  reconcileApprovedRolePermissionMappings,
} from '../../seeders/025_rbac_permission_mappings.js';
import sequelize from '../../src/config/database.js';

type IdRow = { id: string };
type MappingRow = {
  id: string;
  role_code: string;
  permission_code: string;
};
type PermissionSnapshotRow = {
  id: string;
  code: string;
  label: string;
  module: string;
  is_active: boolean;
  system_locked: boolean;
};

const queryInterface = sequelize.getQueryInterface();
const operationalRoleCodes = [
  'ADMIN',
  'QA',
  'ENGINEER',
  'SUPERVISOR',
  'PLANNER',
  'MECHANIC',
  'VIEWER',
];
const excludedPermissionCodes = [
  'LIBRARY_VIEW',
  'LIBRARY_EDIT',
  'AUDIT_VIEW',
  'AUDIT_EXPORT',
];
const referenceRoleFixtures = [
  {
    code: 'REFERENCE_ADMIN',
    label: 'Reference Administrator',
    description: 'Full control of reference data',
  },
  {
    code: 'REFERENCE_EDITOR',
    label: 'Reference Editor',
    description: 'Create and edit reference data',
  },
  {
    code: 'REFERENCE_VIEWER',
    label: 'Reference Viewer',
    description: 'View-only access to reference data',
  },
];

async function ensureMigration150RoleFixtures(
  transaction: Transaction
): Promise<void> {
  for (const role of referenceRoleFixtures) {
    await sequelize.query(
      `
      INSERT INTO rf_role (code, label, description, system_locked)
      VALUES (:code, :label, :description, true)
      ON CONFLICT (code) DO NOTHING;
      `,
      { replacements: role, transaction }
    );
  }
}

async function withRollback(
  work: (transaction: Transaction) => Promise<void>
): Promise<void> {
  const transaction = await sequelize.transaction();

  try {
    await ensureMigration150RoleFixtures(transaction);
    await work(transaction);
  } finally {
    await transaction.rollback();
  }
}

async function approvedMappings(
  transaction: Transaction
): Promise<MappingRow[]> {
  return sequelize.query<MappingRow>(
    `
    SELECT rp.id, r.code AS role_code, p.code AS permission_code
    FROM rf_role_permissions rp
    JOIN rf_role r ON r.id = rp.role_id
    JOIN rf_permission p ON p.id = rp.permission_id
    WHERE (r.code, p.code) IN (
      ${APPROVED_ROLE_PERMISSION_MAPPINGS.map(
        (_, index) => `(:roleCode${index}, :permissionCode${index})`
      ).join(', ')}
    )
    ORDER BY r.code, p.code;
    `,
    {
      replacements: Object.fromEntries(
        APPROVED_ROLE_PERMISSION_MAPPINGS.flatMap(
          ({ roleCode, permissionCode }, index) => [
            [`roleCode${index}`, roleCode],
            [`permissionCode${index}`, permissionCode],
          ]
        )
      ),
      type: QueryTypes.SELECT,
      transaction,
    }
  );
}

async function idSnapshot(transaction: Transaction) {
  const roles = await sequelize.query<{ code: string; id: string }>(
    `SELECT code, id FROM rf_role ORDER BY code;`,
    { type: QueryTypes.SELECT, transaction }
  );
  const permissions = await sequelize.query<{ code: string; id: string }>(
    `SELECT code, id FROM rf_permission ORDER BY code;`,
    { type: QueryTypes.SELECT, transaction }
  );

  return { roles, permissions };
}

async function allMappings(transaction: Transaction): Promise<MappingRow[]> {
  return sequelize.query<MappingRow>(
    `
    SELECT rp.id, r.code AS role_code, p.code AS permission_code
    FROM rf_role_permissions rp
    JOIN rf_role r ON r.id = rp.role_id
    JOIN rf_permission p ON p.id = rp.permission_id
    ORDER BY rp.id;
    `,
    { type: QueryTypes.SELECT, transaction }
  );
}

async function permissionSnapshot(
  transaction: Transaction
): Promise<PermissionSnapshotRow[]> {
  return sequelize.query<PermissionSnapshotRow>(
    `
    SELECT id, code, label, module, is_active, system_locked
    FROM rf_permission
    ORDER BY id;
    `,
    { type: QueryTypes.SELECT, transaction }
  );
}

describe('RBAC permission mapping seed safety', () => {
  it('reconciles every approved mapping without broadening the contract', async () => {
    await withRollback(async (transaction) => {
      const allMappingsBefore = await allMappings(transaction);
      const permissionsBefore = await permissionSnapshot(transaction);
      const operationalReferenceMappingsBefore =
        await sequelize.query<MappingRow>(
          `
          SELECT rp.id, r.code AS role_code, p.code AS permission_code
          FROM rf_role_permissions rp
          JOIN rf_role r ON r.id = rp.role_id
          JOIN rf_permission p ON p.id = rp.permission_id
          WHERE r.code IN (:roleCodes)
            AND p.code LIKE 'REFERENCE_%'
          ORDER BY rp.id;
          `,
          {
            replacements: { roleCodes: operationalRoleCodes },
            type: QueryTypes.SELECT,
            transaction,
          }
        );
      const restrictedAdMappingsBefore = await sequelize.query<MappingRow>(
        `
        SELECT rp.id, r.code AS role_code, p.code AS permission_code
        FROM rf_role_permissions rp
        JOIN rf_role r ON r.id = rp.role_id
        JOIN rf_permission p ON p.id = rp.permission_id
        WHERE r.code IN ('SUPERVISOR', 'MECHANIC')
          AND p.code LIKE 'AD_%'
        ORDER BY rp.id;
        `,
        { type: QueryTypes.SELECT, transaction }
      );

      await reconcileApprovedRolePermissionMappings(
        queryInterface,
        transaction
      );

      const mappings = await approvedMappings(transaction);
      expect(mappings).toHaveLength(APPROVED_ROLE_PERMISSION_MAPPINGS.length);
      expect(
        new Set(
          mappings.map(
            ({ role_code, permission_code }) =>
              `${role_code}:${permission_code}`
          )
        ).size
      ).toBe(APPROVED_ROLE_PERMISSION_MAPPINGS.length);

      const operationalReferenceMappingsAfter = await sequelize.query<MappingRow>(
        `
        SELECT rp.id, r.code AS role_code, p.code AS permission_code
        FROM rf_role_permissions rp
        JOIN rf_role r ON r.id = rp.role_id
        JOIN rf_permission p ON p.id = rp.permission_id
          WHERE r.code IN (:roleCodes)
          AND p.code LIKE 'REFERENCE_%'
        ORDER BY rp.id;
        `,
        {
          replacements: { roleCodes: operationalRoleCodes },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      const restrictedAdMappingsAfter = await sequelize.query<MappingRow>(
        `
        SELECT rp.id, r.code AS role_code, p.code AS permission_code
        FROM rf_role_permissions rp
        JOIN rf_role r ON r.id = rp.role_id
        JOIN rf_permission p ON p.id = rp.permission_id
          WHERE r.code IN ('SUPERVISOR', 'MECHANIC')
          AND p.code LIKE 'AD_%'
        ORDER BY rp.id;
        `,
        { type: QueryTypes.SELECT, transaction }
      );

      expect(operationalReferenceMappingsAfter).toEqual(
        operationalReferenceMappingsBefore
      );
      expect(restrictedAdMappingsAfter).toEqual(restrictedAdMappingsBefore);

      const allMappingsAfter = await allMappings(transaction);
      const permissionsAfter = await permissionSnapshot(transaction);
      expect(permissionsAfter).toEqual(permissionsBefore);
      expect(allMappingsAfter).toEqual(
        expect.arrayContaining(allMappingsBefore)
      );
    });
  });

  it('is idempotent and preserves role, permission, and mapping IDs', async () => {
    await withRollback(async (transaction) => {
      await reconcileApprovedRolePermissionMappings(
        queryInterface,
        transaction
      );
      const idsAfterFirstRun = await idSnapshot(transaction);
      const mappingsAfterFirstRun = await approvedMappings(transaction);

      await reconcileApprovedRolePermissionMappings(
        queryInterface,
        transaction
      );
      const idsAfterSecondRun = await idSnapshot(transaction);
      const mappingsAfterSecondRun = await approvedMappings(transaction);

      expect(idsAfterSecondRun).toEqual(idsAfterFirstRun);
      expect(mappingsAfterSecondRun).toEqual(mappingsAfterFirstRun);
    });
  });

  it('restores a missing approved mapping exactly once', async () => {
    await withRollback(async (transaction) => {
      const mapping = APPROVED_ROLE_PERMISSION_MAPPINGS[0];
      await sequelize.query(
        `
        DELETE FROM rf_role_permissions rp
        USING rf_role r, rf_permission p
        WHERE rp.role_id = r.id
          AND rp.permission_id = p.id
          AND r.code = :roleCode
          AND p.code = :permissionCode;
        `,
        { replacements: mapping, transaction }
      );

      await reconcileApprovedRolePermissionMappings(
        queryInterface,
        transaction
      );
      await reconcileApprovedRolePermissionMappings(
        queryInterface,
        transaction
      );

      const restored = (await approvedMappings(transaction)).filter(
        (row) =>
          row.role_code === mapping.roleCode &&
          row.permission_code === mapping.permissionCode
      );
      expect(restored).toHaveLength(1);
    });
  });

  it('preserves custom and additional mappings without replacement', async () => {
    await withRollback(async (transaction) => {
      const customRoleCode = `TEST_ROLE_${randomUUID()}`;
      const customPermissionCode = `TEST_PERMISSION_${randomUUID()}`;
      const [customRole] = await sequelize.query<IdRow>(
        `
        INSERT INTO rf_role (code, label, system_locked)
        VALUES (:code, 'Test role', false)
        RETURNING id;
        `,
        {
          replacements: { code: customRoleCode },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      const [customPermission] = await sequelize.query<IdRow>(
        `
        INSERT INTO rf_permission (
          code, label, module, is_active, system_locked
        )
        VALUES (:code, 'Test permission', 'TEST', true, false)
        RETURNING id;
        `,
        {
          replacements: { code: customPermissionCode },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      const [admin] = await sequelize.query<IdRow>(
        `SELECT id FROM rf_role WHERE code = 'ADMIN';`,
        { type: QueryTypes.SELECT, transaction }
      );
      const [customMapping] = await sequelize.query<IdRow>(
        `
        INSERT INTO rf_role_permissions (role_id, permission_id)
        VALUES (:roleId, :permissionId)
        RETURNING id;
        `,
        {
          replacements: {
            roleId: customRole!.id,
            permissionId: customPermission!.id,
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      const [additionalMapping] = await sequelize.query<IdRow>(
        `
        INSERT INTO rf_role_permissions (role_id, permission_id)
        VALUES (:roleId, :permissionId)
        ON CONFLICT (role_id, permission_id) DO UPDATE SET role_id = EXCLUDED.role_id
        RETURNING id;
        `,
        {
          replacements: {
            roleId: admin!.id,
            permissionId: customPermission!.id,
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );

      await reconcileApprovedRolePermissionMappings(
        queryInterface,
        transaction
      );

      const preservedMappings = await sequelize.query<IdRow>(
        `
        SELECT id
        FROM rf_role_permissions
        WHERE id IN (:ids)
        ORDER BY id;
        `,
        {
          replacements: {
            ids: [customMapping!.id, additionalMapping!.id],
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      expect(preservedMappings.map(({ id }) => id).sort()).toEqual(
        [customMapping!.id, additionalMapping!.id].sort()
      );
    });
  });

  it.each([
    ['role', 'REFERENCE_VIEWER', 'rf_role'],
    ['permission', 'REFERENCE_DEACTIVATE', 'rf_permission'],
  ] as const)(
    'fails before inserting anything when a required %s is missing',
    async (_kind, missingCode, table) => {
      await withRollback(async (transaction) => {
        const removedMapping = APPROVED_ROLE_PERMISSION_MAPPINGS.find(
          ({ roleCode, permissionCode }) =>
            roleCode === 'ADMIN' &&
            permissionCode === 'AD_COMPLIANCE_DUE_UPDATE'
        )!;
        await sequelize.query(
          `
          DELETE FROM rf_role_permissions rp
          USING rf_role r, rf_permission p
          WHERE rp.role_id = r.id
            AND rp.permission_id = p.id
            AND r.code = :roleCode
            AND p.code = :permissionCode;
          `,
          { replacements: removedMapping, transaction }
        );
        await sequelize.query(
          `UPDATE ${table} SET code = :temporaryCode WHERE code = :missingCode;`,
          {
            replacements: {
              missingCode,
              temporaryCode: `TEMP_${randomUUID()}`,
            },
            transaction,
          }
        );
        const before = await approvedMappings(transaction);

        await expect(
          reconcileApprovedRolePermissionMappings(
            queryInterface,
            transaction
          )
        ).rejects.toThrow('RBAC mapping prerequisites failed');

        const after = await approvedMappings(transaction);
        expect(after).toEqual(before);
        expect(
          after.some(
            ({ role_code, permission_code }) =>
              role_code === removedMapping.roleCode &&
              permission_code === removedMapping.permissionCode
          )
        ).toBe(false);
      });
    }
  );

  it('does not introduce excluded or future-governance permissions', async () => {
    await withRollback(async (transaction) => {
      const excludedBefore = await sequelize.query<{ code: string }>(
        `
        SELECT code
        FROM rf_permission
        WHERE code IN (:excludedCodes)
           OR code LIKE 'COMPONENT_LIFE_LIMIT_%'
        ORDER BY code;
        `,
        {
          replacements: { excludedCodes: excludedPermissionCodes },
          type: QueryTypes.SELECT,
          transaction,
        }
      );

      await reconcileApprovedRolePermissionMappings(
        queryInterface,
        transaction
      );

      const excludedAfter = await sequelize.query<{ code: string }>(
        `
        SELECT code
        FROM rf_permission
        WHERE code IN (:excludedCodes)
           OR code LIKE 'COMPONENT_LIFE_LIMIT_%'
        ORDER BY code;
        `,
        {
          replacements: { excludedCodes: excludedPermissionCodes },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      expect(excludedAfter).toEqual(excludedBefore);
    });
  });
});

afterAll(async () => {
  await sequelize.close();
});
