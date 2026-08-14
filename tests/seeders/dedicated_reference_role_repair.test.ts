import { randomUUID } from "node:crypto";
import { QueryTypes, Transaction } from "sequelize";
import { afterAll, describe, expect, it } from "vitest";
import migration, {
  DEDICATED_REFERENCE_ROLE_DEFINITIONS,
  restoreDedicatedReferenceRoles,
} from "../../migrations/581_restore_dedicated_reference_roles.js";
import {
  APPROVED_ROLE_PERMISSION_MAPPINGS,
  reconcileApprovedRolePermissionMappings,
} from "../../seeders/025_rbac_permission_mappings.js";
import sequelize from "../../src/config/database.js";

type RoleRow = {
  id: string;
  code: string;
  label: string;
  description: string | null;
  is_active: boolean;
  system_locked: boolean;
};

type MappingRow = {
  id: string;
  role_code: string;
  permission_code: string;
};

const queryInterface = sequelize.getQueryInterface();
const referenceRoleCodes = DEDICATED_REFERENCE_ROLE_DEFINITIONS.map(
  ({ code }) => code,
);
const referenceRoleCodeSet = new Set<string>(referenceRoleCodes);
const operationalRoleCodes = [
  "ADMIN",
  "QA",
  "ENGINEER",
  "SUPERVISOR",
  "PLANNER",
  "MECHANIC",
  "VIEWER",
];

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

async function mappings(transaction: Transaction): Promise<MappingRow[]> {
  return sequelize.query<MappingRow>(
    `
    SELECT rp.id, role.code AS role_code, permission.code AS permission_code
    FROM public.rf_role_permissions rp
    JOIN public.rf_role role ON role.id = rp.role_id
    JOIN public.rf_permission permission ON permission.id = rp.permission_id
    ORDER BY rp.id;
    `,
    { type: QueryTypes.SELECT, transaction },
  );
}

async function tableSnapshot(
  table: "users" | "user_roles",
  orderBy: string,
  transaction: Transaction,
): Promise<Record<string, unknown>[]> {
  return sequelize.query<Record<string, unknown>>(
    `SELECT * FROM public.${table} ORDER BY ${orderBy};`,
    { type: QueryTypes.SELECT, transaction },
  );
}

describe("migration 581 dedicated Reference role repair", () => {
  it("restores only missing dedicated roles with exact migration-150 metadata", async () => {
    await withRollback(async (transaction) => {
      await sequelize.query(
        `DELETE FROM public.rf_role WHERE code IN (:codes);`,
        { replacements: { codes: referenceRoleCodes }, transaction },
      );

      await restoreDedicatedReferenceRoles(queryInterface, transaction);

      const restored = await roles(transaction, referenceRoleCodes);
      expect(restored.map(({ id: _id, ...role }) => role)).toEqual(
        [...DEDICATED_REFERENCE_ROLE_DEFINITIONS]
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

  it("is idempotent and preserves existing role IDs", async () => {
    await withRollback(async (transaction) => {
      await restoreDedicatedReferenceRoles(queryInterface, transaction);
      const before = await roles(transaction, referenceRoleCodes);

      await restoreDedicatedReferenceRoles(queryInterface, transaction);
      const after = await roles(transaction, referenceRoleCodes);

      expect(after).toEqual(before);
      expect(after).toHaveLength(3);
    });
  });

  it("preserves custom and operational roles, users, assignments, and mappings", async () => {
    await withRollback(async (transaction) => {
      const customCode = `TEST_REFERENCE_REPAIR_${randomUUID()}`;
      await sequelize.query(
        `INSERT INTO public.rf_role (code, label, description, is_active, system_locked)
         VALUES (:code, 'Custom Role', 'Preserve me', false, false);`,
        { replacements: { code: customCode }, transaction },
      );
      const roleSnapshot = await roles(transaction, [
        ...operationalRoleCodes,
        customCode,
      ]);
      const userSnapshot = await tableSnapshot("users", "id", transaction);
      const userRoleSnapshot = await tableSnapshot(
        "user_roles",
        "user_id, role_id",
        transaction,
      );
      const mappingSnapshot = await mappings(transaction);

      await restoreDedicatedReferenceRoles(queryInterface, transaction);

      expect(
        await roles(transaction, [...operationalRoleCodes, customCode]),
      ).toEqual(roleSnapshot);
      expect(await tableSnapshot("users", "id", transaction)).toEqual(
        userSnapshot,
      );
      expect(
        await tableSnapshot("user_roles", "user_id, role_id", transaction),
      ).toEqual(userRoleSnapshot);
      expect(await mappings(transaction)).toEqual(mappingSnapshot);
    });
  });

  it("fails closed on conflicting metadata without overwriting or partial insertion", async () => {
    await withRollback(async (transaction) => {
      await sequelize.query(
        `DELETE FROM public.rf_role WHERE code IN (:codes);`,
        { replacements: { codes: referenceRoleCodes }, transaction },
      );
      const conflictId = randomUUID();
      await sequelize.query(
        `INSERT INTO public.rf_role
           (id, code, label, description, is_active, system_locked)
         VALUES
           (:id, 'REFERENCE_EDITOR', 'Conflicting Editor', 'Do not overwrite', false, false);`,
        { replacements: { id: conflictId }, transaction },
      );

      await expect(
        restoreDedicatedReferenceRoles(queryInterface, transaction),
      ).rejects.toThrow(
        "Dedicated Reference role prerequisite failed: REFERENCE_EDITOR has conflicting metadata",
      );

      const remaining = await roles(transaction, referenceRoleCodes);
      expect(remaining).toEqual([
        {
          id: conflictId,
          code: "REFERENCE_EDITOR",
          label: "Conflicting Editor",
          description: "Do not overwrite",
          is_active: false,
          system_locked: false,
        },
      ]);
    });
  });

  it("has a non-destructive down operation", async () => {
    await withRollback(async (transaction) => {
      await restoreDedicatedReferenceRoles(queryInterface, transaction);
      const before = await roles(transaction, referenceRoleCodes);

      await migration.down();

      expect(await roles(transaction, referenceRoleCodes)).toEqual(before);
    });
  });

  it("enables seeder 025 to reconcile all 47 approved mappings only", async () => {
    await withRollback(async (transaction) => {
      await restoreDedicatedReferenceRoles(queryInterface, transaction);
      await reconcileApprovedRolePermissionMappings(
        queryInterface,
        transaction,
      );

      const allMappings = await mappings(transaction);
      const approved = new Set(
        APPROVED_ROLE_PERMISSION_MAPPINGS.map(
          ({ roleCode, permissionCode }) => `${roleCode}:${permissionCode}`,
        ),
      );
      const presentApproved = allMappings.filter((mapping) =>
        approved.has(`${mapping.role_code}:${mapping.permission_code}`),
      );
      const referenceMappings = presentApproved
        .filter((mapping) => referenceRoleCodeSet.has(mapping.role_code))
        .map((mapping) => `${mapping.role_code}:${mapping.permission_code}`)
        .sort();
      const sensitivePermissionCodes = new Set([
        "LIBRARY_EDIT",
        "COMPONENT_LIFE_LIMIT_PROPOSE",
        "COMPONENT_LIFE_LIMIT_APPROVE",
        "COMPONENT_LIFE_LIMIT_ACTIVATE",
      ]);
      const unauthorizedSensitive = allMappings.filter(
        (mapping) =>
          sensitivePermissionCodes.has(mapping.permission_code) &&
          !approved.has(`${mapping.role_code}:${mapping.permission_code}`),
      );

      expect(APPROVED_ROLE_PERMISSION_MAPPINGS).toHaveLength(47);
      expect(presentApproved).toHaveLength(47);
      expect(referenceMappings).toEqual([
        "REFERENCE_ADMIN:REFERENCE_CREATE",
        "REFERENCE_ADMIN:REFERENCE_DEACTIVATE",
        "REFERENCE_ADMIN:REFERENCE_EDIT",
        "REFERENCE_ADMIN:REFERENCE_VIEW",
        "REFERENCE_EDITOR:REFERENCE_CREATE",
        "REFERENCE_EDITOR:REFERENCE_EDIT",
        "REFERENCE_EDITOR:REFERENCE_VIEW",
        "REFERENCE_VIEWER:REFERENCE_VIEW",
      ]);
      expect(unauthorizedSensitive).toEqual([]);
    });
  });
});

afterAll(async () => {
  await sequelize.close();
});
