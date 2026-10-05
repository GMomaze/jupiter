import { randomUUID } from 'node:crypto';

export interface ScenarioRunnerOptions<Result> {
  readonly scenario: (correlationId: string) => Promise<Result>;
  readonly cleanup: (correlationId: string) => Promise<void>;
  readonly correlationFactory?: () => string;
}

export interface ScenarioRunnerResult<Result> {
  readonly correlationId: string;
  readonly result: Result;
}

export async function runScenarioWithCleanup<Result>(
  options: ScenarioRunnerOptions<Result>,
): Promise<ScenarioRunnerResult<Result>> {
  const correlationId = (options.correlationFactory ?? randomUUID)();
  let scenarioFailure: unknown;
  try {
    const result = await options.scenario(correlationId);
    return Object.freeze({ correlationId, result });
  } catch (error) {
    scenarioFailure = error;
    throw error;
  } finally {
    try {
      await options.cleanup(correlationId);
    } catch (cleanupFailure) {
      if (scenarioFailure !== undefined) {
        throw new AggregateError(
          [scenarioFailure, cleanupFailure],
          'MT4C3A7_SCENARIO_AND_CLEANUP_FAILED',
        );
      }
      throw cleanupFailure;
    }
  }
}

async function probeCanonicalImports(): Promise<void> {
  await import('../../src/config/migrationSafety.js');
  await import('./migrationLedgerComparison.js');
  await import('../../src/modules/tenancy/tenant-query-authority.js');
  await import('../../src/modules/aircraft/aircraft.service.js');
  await import('../../src/modules/customers/customers.service.js');
  await import('../../src/modules/customers/customer-aircraft-link-tenant.live.js');
  const { sequelize } = await import('../../src/models/index.js');
  await sequelize.close();
}

async function main(args: readonly string[] = process.argv.slice(2)): Promise<void> {
  const mode = args[0];
  if (mode === '--live-mt4c3a7') {
    const { createMt4c3a7LiveExecution, createProductionMt4c3a7Dependencies } =
      await import('./mt4c3a7LiveScenario.js');
    const execution = createMt4c3a7LiveExecution(
      await createProductionMt4c3a7Dependencies(),
    );
    const outcome = await runScenarioWithCleanup({
      scenario: execution.scenario,
      cleanup: execution.cleanup,
    });
    console.log(JSON.stringify({ mode, ...outcome }));
    return;
  }
  if (mode === '--probe-imports') {
    await probeCanonicalImports();
    console.log(JSON.stringify({ mode, imports: 'PASS' }));
    return;
  }
  if (mode !== '--dry-run-success' && mode !== '--dry-run-failure') {
    throw new Error('MT4C3A7_RUNNER: explicit supported mode required');
  }

  let cleanupExecuted = false;
  const outcome = await runScenarioWithCleanup({
    scenario: async (correlationId) => {
      await Promise.resolve();
      if (mode === '--dry-run-failure') {
        throw new Error('MT4C3A7_DRY_RUN_FAILURE');
      }
      return Object.freeze({ awaited: true, correlationId });
    },
    cleanup: async () => {
      await Promise.resolve();
      cleanupExecuted = true;
    },
  });
  console.log(JSON.stringify({ mode, ...outcome, cleanupExecuted }));
}

const isDirectExecution = process.argv[1]?.replaceAll('\\', '/').endsWith(
  '/tests/support/mt4c3a7ScenarioRunner.ts',
);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
