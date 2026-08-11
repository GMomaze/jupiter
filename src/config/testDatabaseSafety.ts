export interface TestDatabaseSafetyConfig {
  nodeEnv: string | undefined;
  databaseName: string | undefined;
  databaseUser: string | undefined;
  resetApproval: string | undefined;
}

interface QueryResult<Row> {
  rows: Row[];
}

export interface TestDatabaseSafetyQueryable {
  query<Row extends Record<string, unknown>>(
    sql: string
  ): Promise<QueryResult<Row>>;
}

const APPROVED_TEST_DATABASE = 'jupiter_test';
const APPROVED_TEST_USER = 'jupiter_test';
const APPROVED_RESET_VALUE = 'YES';

export function validateTestDatabaseSafety(
  config: TestDatabaseSafetyConfig
): void {
  if (config.nodeEnv !== 'test') {
    throw new Error('TEST_DATABASE_SAFETY: NODE_ENV must be exactly test');
  }

  if (!config.databaseName) {
    throw new Error('TEST_DATABASE_SAFETY: DB_NAME is required');
  }

  if (config.databaseName !== APPROVED_TEST_DATABASE) {
    throw new Error(
      'TEST_DATABASE_SAFETY: DB_NAME must be exactly jupiter_test'
    );
  }

  if (!config.databaseUser) {
    throw new Error('TEST_DATABASE_SAFETY: DB_USER is required');
  }

  if (config.databaseUser !== APPROVED_TEST_USER) {
    throw new Error(
      'TEST_DATABASE_SAFETY: DB_USER must be exactly jupiter_test'
    );
  }

  if (config.resetApproval !== APPROVED_RESET_VALUE) {
    throw new Error(
      'TEST_DATABASE_SAFETY: ALLOW_TEST_DATABASE_RESET must be exactly YES'
    );
  }
}

export function configuredTestDatabaseSafety(): TestDatabaseSafetyConfig {
  return {
    nodeEnv: process.env.NODE_ENV,
    databaseName: process.env.DB_NAME,
    databaseUser: process.env.DB_USER,
    resetApproval: process.env.ALLOW_TEST_DATABASE_RESET,
  };
}

export async function assertTestDatabaseSafety(
  queryable: TestDatabaseSafetyQueryable
): Promise<void> {
  validateTestDatabaseSafety(configuredTestDatabaseSafety());

  const result = await queryable.query<{
    database_name: string;
    user_name: string;
  }>(
    'SELECT current_database() AS database_name, current_user AS user_name'
  );
  const identity = result.rows[0];

  if (identity?.database_name !== APPROVED_TEST_DATABASE) {
    throw new Error(
      'TEST_DATABASE_SAFETY: live database must be exactly jupiter_test'
    );
  }

  if (identity?.user_name !== APPROVED_TEST_USER) {
    throw new Error(
      'TEST_DATABASE_SAFETY: live user must be exactly jupiter_test'
    );
  }
}
