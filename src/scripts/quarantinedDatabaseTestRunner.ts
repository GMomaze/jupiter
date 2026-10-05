import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { requireDatabaseTestExecutionApproval } from '../config/databaseTestExecutionSafety.js';

const GOVERNANCE_OWNERSHIP_SUITE =
  'tests/integration/component_life_limit_governance_ownership_positive.test.ts';

function runLegacyDatabaseTests(
  environment: NodeJS.ProcessEnv,
  spawnProcess: typeof spawn
): Promise<void> {
  const vitestPath = resolve('node_modules', 'vitest', 'vitest.mjs');
  return new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawnProcess(
      process.execPath,
      [vitestPath, 'run', '--exclude', GOVERNANCE_OWNERSHIP_SUITE],
      {
        cwd: process.cwd(),
        env: {
          ...environment,
          NODE_ENV: 'test',
          RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST: 'NO',
        },
        stdio: 'inherit',
      }
    );
    child.once('error', rejectPromise);
    child.once('exit', (code, signal) => {
      if (code === 0) return resolvePromise();
      rejectPromise(
        new Error(
          `DATABASE_TEST_QUARANTINE: legacy database tests failed with ${
            signal ? `signal ${signal}` : `exit code ${String(code)}`
          }`
        )
      );
    });
  });
}

export async function runQuarantinedDatabaseTests(
  environment: NodeJS.ProcessEnv,
  spawnProcess: typeof spawn = spawn
): Promise<void> {
  requireDatabaseTestExecutionApproval(environment);
  await runLegacyDatabaseTests(environment, spawnProcess);
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  runQuarantinedDatabaseTests(process.env).catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
