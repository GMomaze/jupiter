import { randomUUID } from 'node:crypto';
import { QueryTypes, Transaction } from 'sequelize';
import { afterAll, describe, expect, it } from 'vitest';
import migration, {
  OPERATIONAL_ROLE_DEFINITIONS,
  seedOperationalRolesNonDestructively,
} from '../../migrations/623_seed_operational_roles.js';
import sequelize from '../../src/config/database.js';

type RoleRow = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  is_active: boolean;
  system_locked: boolean;
};

const queryInterface = sequelize.getQueryInterface();
const operationalRoleCodes = OPERATIONAL_ROLE_DEFINITIONS.map(({ code }) => code);

async function withRollback(
  work: (transaction: Transaction) => Promise<void>,
): Promise<void> {
  const transaction = await sequelize.transaction();
  try {
    await work(transaction);
  } finally {
    await transaction.rollback();
  }
}

async function roles(
  transaction: Transaction,
  codes: readonly string[],
): Promise<RoleRow[]> {
  return sequelize.query<RoleRow>(
    `
    SELECT id, code, label, description, is_active, system_locked
    FROM public.rf_role
    WHERE code IN (:codes)
    ORDER BY code;
    `,
    { replacements: { codes }, type: QueryTypes.SELECT, transaction },
  );
}

describe('migration 623 operational role initialization', () => {
  it('creates every missing operational role with exact canonical metadata', async () => {
    await withRollback(async (transaction) => {
      // Free each operational code slot by RENAMING (not deleting) the row, so we
      // never disturb tenant_membership_roles RESTRICT references or hit RLS on
      // that table. The helper must then insert a fresh row per missing code.
      const suffix = randomUUID();
      for (const code of operationalRoleCodes) {
        await sequelize.query(
          `UPDATE public.rf_role SET code = :temp WHERE code = :code;`,
          {
            replacements: { code, temp: `TMP_${code}_${suffix}` },
            transaction,
          },
        );
      }

      await seedOperationalRolesNonDestructively(queryInterface, transaction);

      const restored = await roles(transaction, operationalRoleCodes);
      expect(restored.map(({ id: _id, ...role }) => role)).toEqual(
        [...OPERATIONAL_ROLE_DEFINITIONS]
          .sort((left, right) => left.code.localeCompare(right.code))
          .map((definition) => ({
            code: definition.code,
            label: definition.label,
            description: definition.description,
            is_active: definition.isActive,
            system_locked: definition.systemLocked,
          })),
      );
    });
  });

  it('is idempotent and preserves existing role IDs', async () => {
    await withRollback(async (transaction) => {
      await seedOperationalRolesNonDestructively(queryInterface, transaction);
      const before = await roles(transaction, operationalRoleCodes);

      await seedOperationalRolesNonDestructively(queryInterface, transaction);
      const after = await roles(transaction, operationalRoleCodes);

      expect(after).toEqual(before);
      expect(after).toHaveLength(operationalRoleCodes.length);
    });
  });

  it('satisfies the provisioning prerequisite of exactly one ADMIN role', async () => {
    await withRollback(async (transaction) => {
      await seedOperationalRolesNonDestructively(queryInterface, transaction);
      const admins = await sequelize.query<{ id: string }>(
        `SELECT id FROM public.rf_role WHERE code='ADMIN' LIMIT 2;`,
        { type: QueryTypes.SELECT, transaction },
      );
      expect(admins).toHaveLength(1);
    });
  });

  it('preserves custom roles and existing role IDs', async () => {
    await withRollback(async (transaction) => {
      const customCode = `TEST_OPERATIONAL_${randomUUID()}`;
      await sequelize.query(
        `INSERT INTO public.rf_role (code, label, description, is_active, system_locked)
         VALUES (:code, 'Custom Role', 'Preserve me', false, false);`,
        { replacements: { code: customCode }, transaction },
      );
      const before = await roles(transaction, [
        ...operationalRoleCodes,
        customCode,
      ]);

      await seedOperationalRolesNonDestructively(queryInterface, transaction);

      expect(
        await roles(transaction, [...operationalRoleCodes, customCode]),
      ).toEqual(before);
    });
  });

  it('fails closed on conflicting metadata without overwriting or partial insertion', async () => {
    await withRollback(async (transaction) => {
      // Corrupt an existing operational role's metadata in place (no delete, so
      // no FK/RLS interaction with tenant membership references).
      await sequelize.query(
        `UPDATE public.rf_role
         SET label = 'Conflicting Administrator', is_active = false, system_locked = false
         WHERE code = 'ADMIN';`,
        { transaction },
      );

      await expect(
        seedOperationalRolesNonDestructively(queryInterface, transaction),
      ).rejects.toThrow(
        'Operational role prerequisite failed: ADMIN has conflicting metadata',
      );

      // The conflicting role is left untouched (fail-closed, no overwrite).
      const [admin] = await roles(transaction, ['ADMIN']);
      expect(admin).toMatchObject({
        code: 'ADMIN',
        label: 'Conflicting Administrator',
        is_active: false,
        system_locked: false,
      });
    });
  });

  it('has a non-destructive down operation', async () => {
    await withRollback(async (transaction) => {
      await seedOperationalRolesNonDestructively(queryInterface, transaction);
      const before = await roles(transaction, operationalRoleCodes);

      await migration.down();

      expect(await roles(transaction, operationalRoleCodes)).toEqual(before);
    });
  });
});

afterAll(async () => {
  await sequelize.close();
});
