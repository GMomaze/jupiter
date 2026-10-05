import { describe, expect, it, vi } from 'vitest';
import migration from '../../migrations/619_add_user_retirement.js';

function mockQi(duplicate: boolean) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('JOIN public.users b')) {
      return [{ has: duplicate }];
    }
    if (sql.includes('conname=') || sql.includes('attname=')) {
      return [{ constraint: true, column: 0, index: 0 }];
    }
    return [];
  });
  const sequelize = {
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => fn({})),
    query,
  };
  return { sequelize, query };
}

describe('619_add_user_retirement', () => {
  it('DOWN refuses safely when a retired/live email collision would break full uniqueness', async () => {
    const qi = mockQi(true) as any;
    await expect(migration.down(qi)).rejects.toThrow('MIGRATION_619_DOWN_REFUSES_EMAIL_COLLISION');
    // No destructive SQL may run after refusal.
    expect(qi.query).toHaveBeenCalledTimes(1);
  });

  it('DOWN succeeds when email uniqueness is representable', async () => {
    const qi = mockQi(false) as any;
    await expect(migration.down(qi)).resolves.toBeUndefined();
    const sqls = qi.query.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(sqls).toContain('DROP INDEX');
    expect(sqls).toContain('DROP COLUMN retired_at');
    expect(sqls).toContain('ADD CONSTRAINT users_email_key UNIQUE (email)');
  });
});
