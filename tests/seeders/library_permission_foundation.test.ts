import { randomUUID } from 'node:crypto';
import { QueryTypes, Transaction } from 'sequelize';
import { afterAll, describe, expect, it } from 'vitest';
import libraryPermissionMigration, {
  LIBRARY_PERMISSION_DEFINITIONS,
  seedLibraryPermissions,
} from '../../migrations/576_seed_library_permissions.js';
import sequelize from '../../src/config/database.js';

type PermissionRow = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  module: string;
  is_active: boolean;
  system_locked: boolean;
};

const queryInterface = sequelize.getQueryInterface();
const permissionCodes = LIBRARY_PERMISSION_DEFINITIONS.map(({ code }) => code);

async function withRollback(
  work: (transaction: Transaction) => Promise<void>
): Promise<void> {
  const transaction = await sequelize.transaction();

  try {
    await sequelize.query(
      `DELETE FROM rf_permission WHERE code IN (:permissionCodes);`,
      { replacements: { permissionCodes }, transaction }
    );
    await work(transaction);
  } finally {
    await transaction.rollback();
  }
}

async function libraryPermissions(
  transaction: Transaction
): Promise<PermissionRow[]> {
  return sequelize.query<PermissionRow>(
    `
    SELECT id, code, label, description, module, is_active, system_locked
    FROM rf_permission
    WHERE code IN (:permissionCodes)
    ORDER BY code;
    `,
    {
      replacements: { permissionCodes },
      type: QueryTypes.SELECT,
      transaction,
    }
  );
}

describe('Library permission foundation migration', () => {
  it('creates both permissions with exact metadata and is idempotent', async () => {
    await withRollback(async (transaction) => {
      await seedLibraryPermissions(queryInterface, transaction);
      const afterFirstRun = await libraryPermissions(transaction);
      await seedLibraryPermissions(queryInterface, transaction);
      const afterSecondRun = await libraryPermissions(transaction);

      expect(afterSecondRun).toEqual(afterFirstRun);
      expect(afterSecondRun).toEqual(
        LIBRARY_PERMISSION_DEFINITIONS.map((definition) => ({
          id: expect.any(String),
          code: definition.code,
          label: definition.label,
          description: definition.description,
          module: definition.module,
          is_active: definition.isActive,
          system_locked: definition.systemLocked,
        })).sort((left, right) => left.code.localeCompare(right.code))
      );
    });
  });

  it('fails closed without overwriting conflicting same-code metadata', async () => {
    await withRollback(async (transaction) => {
      const conflictingId = randomUUID();
      await sequelize.query(
        `
        INSERT INTO rf_permission (
          id, code, label, description, module, is_active, system_locked
        )
        VALUES (
          :id,
          'LIBRARY_VIEW',
          'Conflicting label',
          'Preserve this conflicting metadata',
          'CUSTOM',
          false,
          false
        );
        `,
        { replacements: { id: conflictingId }, transaction }
      );

      await expect(
        sequelize.transaction({ transaction }, async (migrationTransaction) => {
          await seedLibraryPermissions(queryInterface, migrationTransaction);
        })
      ).rejects.toThrow('LIBRARY_VIEW is missing or has conflicting metadata');

      const [conflictingPermission] = await sequelize.query<PermissionRow>(
        `
        SELECT id, code, label, description, module, is_active, system_locked
        FROM rf_permission
        WHERE code = 'LIBRARY_VIEW';
        `,
        { type: QueryTypes.SELECT, transaction }
      );
      const libraryEditCount = await sequelize.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM rf_permission WHERE code = 'LIBRARY_EDIT';`,
        { type: QueryTypes.SELECT, transaction }
      );

      expect(conflictingPermission).toEqual({
        id: conflictingId,
        code: 'LIBRARY_VIEW',
        label: 'Conflicting label',
        description: 'Preserve this conflicting metadata',
        module: 'CUSTOM',
        is_active: false,
        system_locked: false,
      });
      expect(libraryEditCount[0]?.count).toBe(0);
    });
  });

  it('has a non-destructive down operation', async () => {
    await withRollback(async (transaction) => {
      await seedLibraryPermissions(queryInterface, transaction);
      const before = await libraryPermissions(transaction);

      await libraryPermissionMigration.down();

      expect(await libraryPermissions(transaction)).toEqual(before);
    });
  });

  it('does not create Audit or life-governance permissions', async () => {
    await withRollback(async (transaction) => {
      const before = await sequelize.query<{ code: string }>(
        `
        SELECT code
        FROM rf_permission
        WHERE code IN ('AUDIT_VIEW', 'AUDIT_EXPORT')
           OR code LIKE 'COMPONENT_LIFE_LIMIT_%'
        ORDER BY code;
        `,
        { type: QueryTypes.SELECT, transaction }
      );

      await seedLibraryPermissions(queryInterface, transaction);

      const after = await sequelize.query<{ code: string }>(
        `
        SELECT code
        FROM rf_permission
        WHERE code IN ('AUDIT_VIEW', 'AUDIT_EXPORT')
           OR code LIKE 'COMPONENT_LIFE_LIMIT_%'
        ORDER BY code;
        `,
        { type: QueryTypes.SELECT, transaction }
      );
      expect(after).toEqual(before);
    });
  });
});

afterAll(async () => {
  await sequelize.close();
});
