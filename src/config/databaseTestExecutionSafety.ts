export const DATABASE_TEST_EXECUTION_APPROVAL =
  'ALLOW_DATABASE_TEST_EXECUTION';

export function requireDatabaseTestExecutionApproval(
  environment: NodeJS.ProcessEnv
): void {
  if (environment[DATABASE_TEST_EXECUTION_APPROVAL] !== 'YES') {
    throw new Error(
      'DATABASE_TEST_QUARANTINE: ALLOW_DATABASE_TEST_EXECUTION must be exactly YES'
    );
  }
}
