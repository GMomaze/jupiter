import { randomUUID } from 'node:crypto';
import { QueryTypes, Transaction } from 'sequelize';
import { afterAll, describe, expect, it } from 'vitest';
import {
  COMPONENT_LIFE_LIMIT_PERMISSION_DEFINITIONS,
  seedComponentLifeLimitGovernancePermissions,
} from '../../migrations/577_seed_component_life_limit_governance_permissions.js';
import sequelize from '../../src/config/database.js';

const queryInterface = sequelize.getQueryInterface();

async function rollback(work: (transaction: Transaction) => Promise<void>) {
  const transaction = await sequelize.transaction();
  try { await work(transaction); } finally { await transaction.rollback(); }
}

describe('component life-limit governance permission foundation', () => {
  it('creates exactly the approved metadata idempotently', async () => {
    await rollback(async (transaction) => {
      await seedComponentLifeLimitGovernancePermissions(queryInterface, transaction);
      const first = await sequelize.query(
        `SELECT id, code, label, description, module, is_active, system_locked
         FROM rf_permission WHERE code IN (:codes) ORDER BY code;`,
        { replacements: { codes: COMPONENT_LIFE_LIMIT_PERMISSION_DEFINITIONS.map(({ code }) => code) }, type: QueryTypes.SELECT, transaction }
      );
      await seedComponentLifeLimitGovernancePermissions(queryInterface, transaction);
      const second = await sequelize.query(
        `SELECT id, code, label, description, module, is_active, system_locked
         FROM rf_permission WHERE code IN (:codes) ORDER BY code;`,
        { replacements: { codes: COMPONENT_LIFE_LIMIT_PERMISSION_DEFINITIONS.map(({ code }) => code) }, type: QueryTypes.SELECT, transaction }
      );
      expect(second).toEqual(first);
      expect(second).toHaveLength(2);
      expect(second.map((row: any) => row.code).sort()).toEqual(
        COMPONENT_LIFE_LIMIT_PERMISSION_DEFINITIONS.map(({ code }) => code).sort()
      );
    });
  });

  it('fails closed on conflicting metadata without partial insertion', async () => {
    await rollback(async (transaction) => {
      await sequelize.query(
        `DELETE FROM rf_permission WHERE code IN ('COMPONENT_LIFE_LIMIT_PROPOSE','COMPONENT_LIFE_LIMIT_APPROVE');
         INSERT INTO rf_permission (id, code, label, description, module, is_active, system_locked)
         VALUES (:id, 'COMPONENT_LIFE_LIMIT_PROPOSE', 'Conflict', 'preserve', 'CUSTOM', false, false);`,
        { replacements: { id: randomUUID() }, transaction }
      );
      await expect(seedComponentLifeLimitGovernancePermissions(queryInterface, transaction))
        .rejects.toThrow('conflicting metadata');
      const approve = await sequelize.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM rf_permission WHERE code = 'COMPONENT_LIFE_LIMIT_APPROVE';`,
        { type: QueryTypes.SELECT, transaction }
      );
      expect(approve[0]?.count).toBe(0);
    });
  });
});

afterAll(async () => sequelize.close());
