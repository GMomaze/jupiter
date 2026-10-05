import {
  validateTestDatabaseSafety,
  type TestDatabaseSafetyConfig,
} from './testDatabaseSafety.js';

export type TestPreparationOperation = 'reset' | 'migrate:undo' | 'harden';

export interface TestPreparationConnectionConfig {
  database: string;
  username: string;
  host: string;
  port: number;
}

export interface TestPreparationIdentity extends Record<string, unknown> {
  database_name: string;
  current_user: string;
  session_user: string;
  server_address: string;
  server_port: number;
}

export interface TestPreparationQueryable {
  query<Row extends Record<string, unknown>>(
    sql: string
  ): Promise<{ rows: Row[] }>;
}

const OPERATIONS: readonly TestPreparationOperation[] = ['reset', 'migrate:undo', 'harden'];

export function parseTestPreparationOperation(
  value: string | undefined
): TestPreparationOperation {
  if (!OPERATIONS.includes(value as TestPreparationOperation)) {
    throw new Error(
      `TEST_PREPARATION_SAFETY: operation must be exactly one of ${OPERATIONS.join(', ')}`
    );
  }
  return value as TestPreparationOperation;
}

export function validateTestPreparationAuthorization(
  runtimeSafety: TestDatabaseSafetyConfig,
  authorization: string | undefined,
  adminConfig: TestPreparationConnectionConfig
): void {
  validateTestDatabaseSafety(runtimeSafety);
  if (authorization !== 'YES') {
    throw new Error(
      'TEST_PREPARATION_SAFETY: ALLOW_TEST_DATABASE_PREPARATION must be exactly YES'
    );
  }
  if (adminConfig.database !== 'jupiter_test') {
    throw new Error(
      'TEST_PREPARATION_SAFETY: administrator database must be exactly jupiter_test'
    );
  }
  if (adminConfig.username !== 'postgres') {
    throw new Error(
      'TEST_PREPARATION_SAFETY: administrator user must be exactly postgres'
    );
  }
}

export function validateTestPreparationIdentities(
  runtimeConfig: TestPreparationConnectionConfig,
  adminConfig: TestPreparationConnectionConfig,
  runtimeIdentity: TestPreparationIdentity,
  adminIdentity: TestPreparationIdentity,
  runtimeResolvedAddresses: readonly string[],
  adminResolvedAddresses: readonly string[]
): void {
  if (runtimeConfig.database !== 'jupiter_test' || runtimeConfig.username !== 'jupiter_test') {
    throw new Error(
      'TEST_PREPARATION_SAFETY: runtime configuration must be jupiter_test on jupiter_test'
    );
  }
  if (
    runtimeIdentity.database_name !== 'jupiter_test' ||
    runtimeIdentity.current_user !== 'jupiter_test' ||
    runtimeIdentity.session_user !== 'jupiter_test'
  ) {
    throw new Error(
      'TEST_PREPARATION_SAFETY: live runtime identity must be jupiter_test on jupiter_test'
    );
  }
  if (
    adminIdentity.database_name !== 'jupiter_test' ||
    adminIdentity.current_user !== 'postgres' ||
    adminIdentity.session_user !== 'postgres'
  ) {
    throw new Error(
      'TEST_PREPARATION_SAFETY: live administrator identity must be postgres on jupiter_test'
    );
  }
  if (
    !runtimeResolvedAddresses.includes(runtimeIdentity.server_address) ||
    !adminResolvedAddresses.includes(adminIdentity.server_address)
  ) {
    throw new Error(
      'TEST_PREPARATION_SAFETY: a live server address does not match its configured host'
    );
  }
  if (
    runtimeIdentity.server_address !== adminIdentity.server_address ||
    runtimeIdentity.server_port !== adminIdentity.server_port
  ) {
    throw new Error(
      'TEST_PREPARATION_SAFETY: runtime and administrator endpoints must match exactly'
    );
  }
  if (
    runtimeIdentity.server_port !== runtimeConfig.port ||
    adminIdentity.server_port !== adminConfig.port
  ) {
    throw new Error(
      'TEST_PREPARATION_SAFETY: a live server port does not match its configured port'
    );
  }
}

const IDENTITY_SQL = `SELECT current_database() AS database_name,
  current_user,
  session_user,
  host(inet_server_addr()) AS server_address,
  inet_server_port() AS server_port`;

export async function assertTestPreparationIdentities(
  runtime: TestPreparationQueryable,
  admin: TestPreparationQueryable,
  runtimeConfig: TestPreparationConnectionConfig,
  adminConfig: TestPreparationConnectionConfig,
  runtimeResolvedAddresses: readonly string[],
  adminResolvedAddresses: readonly string[]
): Promise<void> {
  const [runtimeResult, adminResult] = await Promise.all([
    runtime.query<TestPreparationIdentity>(IDENTITY_SQL),
    admin.query<TestPreparationIdentity>(IDENTITY_SQL),
  ]);
  const runtimeIdentity = runtimeResult.rows[0];
  const adminIdentity = adminResult.rows[0];
  if (!runtimeIdentity || !adminIdentity) {
    throw new Error(
      'TEST_PREPARATION_SAFETY: both live identity queries must return a row'
    );
  }
  validateTestPreparationIdentities(
    runtimeConfig,
    adminConfig,
    runtimeIdentity,
    adminIdentity,
    runtimeResolvedAddresses,
    adminResolvedAddresses
  );
}
