import { randomUUID } from 'node:crypto';
import { QueryTypes, Transaction } from 'sequelize';
import { afterAll, describe, expect, it } from 'vitest';
import sequelize from '../../src/config/database.js';
import {
  OPERATIONAL_ROLES,
  seedOperationalRoles,
} from '../../seeders/010_reference_seeds.js';
import {
  SEEDED_USERS,
  seedOperationalIdentities,
} from '../../seeders/020_identity_seeds.js';

type IdRow = { id: string };
type RoleIdRow = { code: string; id: string };
type UserSnapshotRow = {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  is_active: boolean;
};

const queryInterface = sequelize.getQueryInterface();

async function withRollback(
  work: (transaction: Transaction) => Promise<void>
): Promise<void> {
  const transaction = await sequelize.transaction();

  try {
    await work(transaction);
  } finally {
    await transaction.rollback();
  }
}

async function roleIds(transaction: Transaction): Promise<RoleIdRow[]> {
  return sequelize.query<RoleIdRow>(
    `
    SELECT code, id
    FROM rf_role
    WHERE code IN (:roleCodes)
    ORDER BY code;
    `,
    {
      replacements: {
        roleCodes: OPERATIONAL_ROLES.map((role) => role.code),
      },
      type: QueryTypes.SELECT,
      transaction,
    }
  );
}

describe('RBAC seed safety', () => {
  it('creates a missing operational role without replacing existing role IDs', async () => {
    await withRollback(async (transaction) => {
      const before = await roleIds(transaction);
      const preservedBefore = before.filter((role) => role.code !== 'VIEWER');

      await sequelize.query(`DELETE FROM rf_role WHERE code = 'VIEWER'`, {
        transaction,
      });

      await seedOperationalRoles(queryInterface, transaction);
      const afterFirstSeed = await roleIds(transaction);
      await seedOperationalRoles(queryInterface, transaction);
      const afterSecondSeed = await roleIds(transaction);

      expect(afterFirstSeed).toHaveLength(OPERATIONAL_ROLES.length);
      expect(afterSecondSeed).toEqual(afterFirstSeed);
      expect(afterFirstSeed.filter((role) => role.code !== 'VIEWER')).toEqual(
        preservedBefore
      );
    });
  });

  it('preserves custom roles and existing role-permission mappings', async () => {
    await withRollback(async (transaction) => {
      const customRoleCode = `TEST_CUSTOM_${randomUUID()}`;
      const [customRole] = await sequelize.query<IdRow>(
        `
        INSERT INTO rf_role (code, label, system_locked)
        VALUES (:code, 'Test Custom Role', false)
        RETURNING id;
        `,
        {
          replacements: { code: customRoleCode },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      const [permission] = await sequelize.query<IdRow>(
        `SELECT id FROM rf_permission WHERE code = 'REFERENCE_VIEW';`,
        { type: QueryTypes.SELECT, transaction }
      );

      expect(customRole).toBeDefined();
      expect(permission).toBeDefined();

      await sequelize.query(
        `
        INSERT INTO rf_role_permissions (role_id, permission_id)
        VALUES (:roleId, :permissionId);
        `,
        {
          replacements: {
            roleId: customRole!.id,
            permissionId: permission!.id,
          },
          transaction,
        }
      );

      const before = await roleIds(transaction);
      await seedOperationalRoles(queryInterface, transaction);
      await seedOperationalRoles(queryInterface, transaction);
      const after = await roleIds(transaction);
      const [customRoleCount] = await sequelize.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM rf_role WHERE code = :code;`,
        {
          replacements: { code: customRoleCode },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      const [mappingCount] = await sequelize.query<{ count: number }>(
        `
        SELECT COUNT(*)::int AS count
        FROM rf_role_permissions
        WHERE role_id = :roleId AND permission_id = :permissionId;
        `,
        {
          replacements: {
            roleId: customRole!.id,
            permissionId: permission!.id,
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );

      expect(after).toEqual(before);
      expect(customRoleCount?.count).toBe(1);
      expect(mappingCount?.count).toBe(1);
    });
  });

  it('preserves users, hashes, profiles, and unrelated mappings while adding missing approved mappings once', async () => {
    await withRollback(async (transaction) => {
      const customRoleCode = `TEST_EXTRA_${randomUUID()}`;
      const customEmail = `custom-${randomUUID()}@example.test`;
      const [customRole] = await sequelize.query<IdRow>(
        `
        INSERT INTO rf_role (code, label, system_locked)
        VALUES (:code, 'Test Extra Role', false)
        RETURNING id;
        `,
        {
          replacements: { code: customRoleCode },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      const [customUser] = await sequelize.query<IdRow>(
        `
        INSERT INTO users (
          id,
          email,
          password_hash,
          full_name,
          is_active,
          created_at,
          updated_at
        )
        VALUES (
          gen_random_uuid(),
          :email,
          'custom-preserved-hash',
          'Custom Preserved User',
          false,
          NOW(),
          NOW()
        )
        RETURNING id;
        `,
        {
          replacements: { email: customEmail },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      const [viewerRole] = await sequelize.query<IdRow>(
        `SELECT id FROM rf_role WHERE code = 'VIEWER';`,
        { type: QueryTypes.SELECT, transaction }
      );
      const [adminRole] = await sequelize.query<IdRow>(
        `SELECT id FROM rf_role WHERE code = 'ADMIN';`,
        { type: QueryTypes.SELECT, transaction }
      );
      const [viewerBefore] = await sequelize.query<UserSnapshotRow>(
        `
        SELECT id, email, password_hash, full_name, is_active
        FROM users
        WHERE LOWER(BTRIM(email)) = 'viewer@jupiter.aero';
        `,
        { type: QueryTypes.SELECT, transaction }
      );

      expect(customRole).toBeDefined();
      expect(customUser).toBeDefined();
      expect(viewerRole).toBeDefined();
      expect(adminRole).toBeDefined();
      expect(viewerBefore).toBeDefined();

      await sequelize.query(
        `
        INSERT INTO user_roles (user_id, role_id)
        VALUES (:customUserId, :customRoleId), (:viewerId, :adminRoleId)
        ON CONFLICT (user_id, role_id) DO NOTHING;
        `,
        {
          replacements: {
            customUserId: customUser!.id,
            customRoleId: customRole!.id,
            viewerId: viewerBefore!.id,
            adminRoleId: adminRole!.id,
          },
          transaction,
        }
      );
      await sequelize.query(
        `DELETE FROM user_roles WHERE user_id = :viewerId AND role_id = :viewerRoleId;`,
        {
          replacements: {
            viewerId: viewerBefore!.id,
            viewerRoleId: viewerRole!.id,
          },
          transaction,
        }
      );
      await sequelize.query(
        `
        UPDATE users
        SET email = ' Viewer@Jupiter.Aero ',
            full_name = 'Preserved Viewer Profile',
            is_active = false
        WHERE id = :viewerId;
        `,
        {
          replacements: { viewerId: viewerBefore!.id },
          transaction,
        }
      );

      await seedOperationalIdentities(queryInterface, transaction);
      await seedOperationalIdentities(queryInterface, transaction);

      const [viewerAfter] = await sequelize.query<UserSnapshotRow>(
        `
        SELECT id, email, password_hash, full_name, is_active
        FROM users
        WHERE id = :viewerId;
        `,
        {
          replacements: { viewerId: viewerBefore!.id },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      const [customUserCount] = await sequelize.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM users WHERE id = :customUserId;`,
        {
          replacements: { customUserId: customUser!.id },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      const [approvedMappingCount] = await sequelize.query<{ count: number }>(
        `
        SELECT COUNT(*)::int AS count
        FROM user_roles
        WHERE user_id = :viewerId AND role_id = :viewerRoleId;
        `,
        {
          replacements: {
            viewerId: viewerBefore!.id,
            viewerRoleId: viewerRole!.id,
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      const [additionalMappingCount] = await sequelize.query<{ count: number }>(
        `
        SELECT COUNT(*)::int AS count
        FROM user_roles
        WHERE user_id = :viewerId AND role_id = :adminRoleId;
        `,
        {
          replacements: {
            viewerId: viewerBefore!.id,
            adminRoleId: adminRole!.id,
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      const [customMappingCount] = await sequelize.query<{ count: number }>(
        `
        SELECT COUNT(*)::int AS count
        FROM user_roles
        WHERE user_id = :customUserId AND role_id = :customRoleId;
        `,
        {
          replacements: {
            customUserId: customUser!.id,
            customRoleId: customRole!.id,
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      const [seededUserCount] = await sequelize.query<{ count: number }>(
        `
        SELECT COUNT(*)::int AS count
        FROM users
        WHERE LOWER(BTRIM(email)) IN (:emails);
        `,
        {
          replacements: {
            emails: SEEDED_USERS.map((user) => user.email),
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );

      expect(viewerAfter).toEqual({
        ...viewerBefore,
        email: ' Viewer@Jupiter.Aero ',
        full_name: 'Preserved Viewer Profile',
        is_active: false,
      });
      expect(customUserCount?.count).toBe(1);
      expect(approvedMappingCount?.count).toBe(1);
      expect(additionalMappingCount?.count).toBe(1);
      expect(customMappingCount?.count).toBe(1);
      expect(seededUserCount?.count).toBe(SEEDED_USERS.length);
    });
  });
});

afterAll(async () => {
  await sequelize.close();
});
