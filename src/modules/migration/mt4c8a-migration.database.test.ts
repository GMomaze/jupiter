import { describe, expect, it } from 'vitest';
import { QueryTypes } from 'sequelize';
import { pool } from '../../config/database.js';
import { requireDatabaseTestExecutionApproval } from '../../config/databaseTestExecutionSafety.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import sequelize from '../../config/database.js';
import migration597 from '../../../migrations/597_add_migration_batch_tenant_ownership.js';

describe('MT-4C8A migration 597 applied schema', () => {
  it('runs only against exact guarded jupiter_test', async () => {
    requireDatabaseTestExecutionApproval(process.env);
    await assertTestDatabaseSafety(pool);
  });

  it('has non-null tenant FK and index on the parent only', async () => {
    const columns = await sequelize.query<{ column_name: string; is_nullable: string }>(
      `SELECT column_name, is_nullable FROM information_schema.columns
        WHERE table_schema='public' AND table_name IN ('migration_batches','migration_batch_rows')
          AND column_name='tenant_id' ORDER BY table_name`, { type: QueryTypes.SELECT },
    );
    expect(columns).toEqual([{ column_name: 'tenant_id', is_nullable: 'NO' }]);
    const indexes = await sequelize.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE schemaname='public'
        AND tablename='migration_batches' AND indexname='migration_batches_tenant_id_index'`,
      { type: QueryTypes.SELECT },
    );
    expect(indexes).toHaveLength(1);
    const fk = await sequelize.query<{ confupdtype: string; confdeltype: string }>(
      `SELECT confupdtype, confdeltype FROM pg_constraint
        WHERE conname='migration_batches_tenant_id_fkey'`, { type: QueryTypes.SELECT },
    );
    expect(fk).toEqual([{ confupdtype: 'r', confdeltype: 'r' }]);
  });

  it('has batch ownership and row-parent immutability triggers', async () => {
    const triggers = await sequelize.query<{ tgname: string; tgenabled: string }>(
      `SELECT tgname, tgenabled FROM pg_trigger WHERE NOT tgisinternal
        AND tgname IN ('tr_migration_batch_tenant_immutable','tr_migration_batch_row_parent_immutable')
        ORDER BY tgname`, { type: QueryTypes.SELECT },
    );
    expect(triggers).toEqual([
      { tgname: 'tr_migration_batch_row_parent_immutable', tgenabled: 'O' },
      { tgname: 'tr_migration_batch_tenant_immutable', tgenabled: 'O' },
    ]);
  });

  it('refuses unresolved or mixed historical ownership before schema mutation', async () => {
    const queries: string[] = [];
    const queryInterface = {
      describeTable: async () => ({}),
      sequelize: {
        transaction: async (callback: (transaction: object) => Promise<void>) => callback({}),
        query: async (sql: string) => {
          queries.push(sql);
          return [[{ id: 'unresolved' }], undefined];
        },
      },
    };
    await expect(migration597.up(queryInterface as any)).rejects.toThrow(
      'MIGRATION_597_HISTORICAL_BATCH_OWNERSHIP_UNRESOLVED',
    );
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('COUNT(DISTINCT ac.custodian_tenant_id) <> 1');
  });

  it('permits deterministic ownership and then establishes the guarded schema', async () => {
    const queries: string[] = [];
    const queryInterface = {
      describeTable: async () => ({}),
      sequelize: {
        transaction: async (callback: (transaction: object) => Promise<void>) => callback({}),
        query: async (sql: string) => {
          queries.push(sql);
          return queries.length === 1 ? [[], undefined] : [[], undefined];
        },
      },
    };
    await migration597.up(queryInterface as any);
    expect(queries).toHaveLength(2);
    expect(queries[1]).toContain('UPDATE public.migration_batches');
    expect(queries[1]).toContain('ALTER COLUMN tenant_id SET NOT NULL');
  });
});
