export interface TenantSwitchLockQueryResult<Row> {
  readonly rows: readonly Row[];
}
export interface TenantSwitchLockClient {
  query<Row>(sql: string, values: readonly unknown[]): Promise<TenantSwitchLockQueryResult<Row>>;
  release(): void;
}

export interface TenantSwitchLockPool {
  connect(): Promise<TenantSwitchLockClient>;
}

export interface TenantSwitchLockOptions {
  readonly acquisitionTimeoutMs: number;
  readonly retryIntervalMs: number;
  readonly clock?: () => number;
  readonly wait?: (milliseconds: number) => Promise<void>;
}

export const TENANT_SWITCH_LOCK_UNAVAILABLE = 'Tenant switch is temporarily unavailable.';

const LOCK_NAMESPACE_SEED = '5357794345530192204';
const TRY_LOCK_SQL = `SELECT pg_try_advisory_lock(
  hashtextextended($1::text, ${LOCK_NAMESPACE_SEED}::bigint)
) AS acquired`;
const UNLOCK_SQL = `SELECT pg_advisory_unlock(
  hashtextextended($1::text, ${LOCK_NAMESPACE_SEED}::bigint)
) AS released`;

const defaultWait = (milliseconds: number) =>
  new Promise<void>(resolve => setTimeout(resolve, milliseconds));

export class PostgresTenantSwitchAdvisoryLock {
  private readonly clock: () => number;
  private readonly wait: (milliseconds: number) => Promise<void>;

  constructor(
    private readonly pool: TenantSwitchLockPool,
    private readonly options: TenantSwitchLockOptions,
  ) {
    if (options.acquisitionTimeoutMs < 0 || options.retryIntervalMs <= 0) {
      throw new Error('Tenant switch lock configuration is invalid.');
    }
    this.clock = options.clock ?? Date.now;
    this.wait = options.wait ?? defaultWait;
  }

  async withUserLock<Result>(
    authenticatedUserId: string,
    work: () => Promise<Result>,
  ): Promise<Result> {
    if (!authenticatedUserId.trim()) {
      throw new Error(TENANT_SWITCH_LOCK_UNAVAILABLE);
    }

    const client = await this.pool.connect();
    let acquired = false;
    let result: Result | undefined;
    let workError: unknown;
    const deadline = this.clock() + this.options.acquisitionTimeoutMs;

    try {
      do {
        const response = await client.query<{ readonly acquired: boolean }>(
          TRY_LOCK_SQL,
          [authenticatedUserId],
        );
        acquired = response.rows[0]?.acquired === true;
        if (acquired) break;
        if (this.clock() >= deadline) {
          throw new Error(TENANT_SWITCH_LOCK_UNAVAILABLE);
        }
        await this.wait(
          Math.min(this.options.retryIntervalMs, Math.max(0, deadline - this.clock())),
        );
      } while (this.clock() <= deadline);

      if (!acquired) throw new Error(TENANT_SWITCH_LOCK_UNAVAILABLE);
      result = await work();
    } catch (error) {
      workError = error;
    } finally {
      let cleanupError: unknown;
      if (acquired) {
        try {
          const response = await client.query<{ readonly released: boolean }>(
            UNLOCK_SQL,
            [authenticatedUserId],
          );
          if (response.rows[0]?.released !== true) {
            cleanupError = new Error(TENANT_SWITCH_LOCK_UNAVAILABLE);
          }
        } catch {
          cleanupError = new Error(TENANT_SWITCH_LOCK_UNAVAILABLE);
        }
      }
      try {
        client.release();
      } catch {
        cleanupError = new Error(TENANT_SWITCH_LOCK_UNAVAILABLE);
      }
      if (!workError && cleanupError) workError = cleanupError;
    }

    if (workError) throw workError;
    return result as Result;
  }
}
