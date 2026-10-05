import { describe, expect, it, vi } from 'vitest';
import {
  PostgresTenantSwitchAdvisoryLock,
  TENANT_SWITCH_LOCK_UNAVAILABLE,
  type TenantSwitchLockClient,
} from './tenant-switch-advisory-lock.js';

function harness(acquisitions: boolean[], times = [0, 0, 10, 20, 30]) {
  const query = vi.fn(async (sql: string, values: readonly unknown[]) => {
    if (sql.includes('pg_try_advisory_lock')) {
      return { rows: [{ acquired: acquisitions.shift() ?? false }] };
    }
    return { rows: [{ released: true }] };
  });
  const release = vi.fn();
  const client: TenantSwitchLockClient = { query, release };
  const connect = vi.fn(async () => client);
  const clock = vi.fn(() => times.shift() ?? 30);
  const wait = vi.fn(async () => undefined);
  const lock = new PostgresTenantSwitchAdvisoryLock(
    { connect },
    { acquisitionTimeoutMs: 20, retryIntervalMs: 5, clock, wait },
  );
  return { lock, query, release, connect, wait };
}

describe('PostgresTenantSwitchAdvisoryLock', () => {
  it('uses one namespaced user-scoped key and the same checked-out client', async () => {
    const h = harness([true]);
    const work = vi.fn(async () => 'done');
    await expect(h.lock.withUserLock('user-a', work)).resolves.toBe('done');

    expect(h.connect).toHaveBeenCalledOnce();
    expect(h.query).toHaveBeenCalledTimes(2);
    expect(h.query.mock.calls[0][0]).toContain('pg_try_advisory_lock');
    expect(h.query.mock.calls[0][0]).toContain('hashtextextended');
    expect(h.query.mock.calls[0][1]).toEqual(['user-a']);
    expect(h.query.mock.calls[1][0]).toContain('pg_advisory_unlock');
    expect(h.query.mock.calls[1][1]).toEqual(['user-a']);
    expect(work).toHaveBeenCalledOnce();
    expect(h.release).toHaveBeenCalledOnce();
  });

  it('retries only within the bounded deadline', async () => {
    const h = harness([false, false, false], [0, 0, 5, 20, 20]);
    const work = vi.fn();
    await expect(h.lock.withUserLock('user-a', work)).rejects.toThrow(
      TENANT_SWITCH_LOCK_UNAVAILABLE,
    );
    expect(work).not.toHaveBeenCalled();
    expect(h.wait).toHaveBeenCalled();
    expect(h.release).toHaveBeenCalledOnce();
    expect(h.query.mock.calls.every(call => call[1][0] === 'user-a')).toBe(true);
  });

  it('unlocks and releases after work failure without granting success', async () => {
    const h = harness([true]);
    await expect(
      h.lock.withUserLock('user-a', async () => {
        throw new Error('work failed');
      }),
    ).rejects.toThrow('work failed');
    expect(h.query.mock.calls[1][0]).toContain('pg_advisory_unlock');
    expect(h.release).toHaveBeenCalledOnce();
  });

  it('fails when unlock cannot be certified and still releases the client', async () => {
    const h = harness([true]);
    h.query.mockResolvedValueOnce({ rows: [{ acquired: true }] });
    h.query.mockResolvedValueOnce({ rows: [{ released: false }] });
    await expect(h.lock.withUserLock('user-a', async () => 'done')).rejects.toThrow(
      TENANT_SWITCH_LOCK_UNAVAILABLE,
    );
    expect(h.release).toHaveBeenCalledOnce();
  });
});
