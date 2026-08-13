import { randomUUID } from 'node:crypto';
import { QueryTypes, Transaction } from 'sequelize';
import { afterAll, describe, expect, it } from 'vitest';
import {
  COMPONENT_LIFE_LIMIT_ACTIVATION_PERMISSION,
  seedComponentLifeLimitActivationPermission,
} from '../../migrations/579_seed_component_life_limit_activation_permission.js';
import sequelize from '../../src/config/database.js';

const queryInterface = sequelize.getQueryInterface();
async function rollback(work: (transaction: Transaction) => Promise<void>) {
  const transaction = await sequelize.transaction();
  try { await work(transaction); } finally { await transaction.rollback(); }
}

describe('component life-limit activation permission', () => {
  it('creates exact metadata idempotently', async () => rollback(async (transaction) => {
    await sequelize.query(`DELETE FROM rf_permission WHERE code=:code`, { replacements: { code: COMPONENT_LIFE_LIMIT_ACTIVATION_PERMISSION.code }, transaction });
    await seedComponentLifeLimitActivationPermission(queryInterface, transaction);
    const first = await sequelize.query(`SELECT * FROM rf_permission WHERE code=:code`, { replacements: { code: COMPONENT_LIFE_LIMIT_ACTIVATION_PERMISSION.code }, type: QueryTypes.SELECT, transaction });
    await seedComponentLifeLimitActivationPermission(queryInterface, transaction);
    const second = await sequelize.query(`SELECT * FROM rf_permission WHERE code=:code`, { replacements: { code: COMPONENT_LIFE_LIMIT_ACTIVATION_PERMISSION.code }, type: QueryTypes.SELECT, transaction });
    expect(second).toEqual(first);
    expect(second).toHaveLength(1);
  }));

  it('fails closed on conflicting metadata', async () => rollback(async (transaction) => {
    await sequelize.query(`DELETE FROM rf_permission WHERE code=:code; INSERT INTO rf_permission(id,code,label,module,is_active,system_locked) VALUES(:id,:code,'Conflict','CUSTOM',false,false);`, { replacements: { id: randomUUID(), code: COMPONENT_LIFE_LIMIT_ACTIVATION_PERMISSION.code }, transaction });
    await expect(seedComponentLifeLimitActivationPermission(queryInterface, transaction)).rejects.toThrow('conflicting metadata');
  }));
});

afterAll(async () => sequelize.close());
