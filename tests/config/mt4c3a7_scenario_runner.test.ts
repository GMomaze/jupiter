import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runScenarioWithCleanup } from '../support/mt4c3a7ScenarioRunner.js';

const tsxCli = resolve('node_modules', 'tsx', 'dist', 'cli.mjs');
const runner = resolve('tests', 'support', 'mt4c3a7ScenarioRunner.ts');

function execute(mode: string, databaseDenied = true) {
  const environment = { ...process.env };
  if (databaseDenied) environment.JUPITER_DENY_LIVE_DB = 'YES';
  else delete environment.JUPITER_DENY_LIVE_DB;
  return spawnSync(process.execPath, [tsxCli, runner, mode], {
    cwd: process.cwd(),
    env: environment,
    encoding: 'utf8',
  });
}

describe('MT-4C3A7 scenario runner harness', () => {
  it('launches from a TypeScript file and awaits async success', () => {
    const result = execute('--dry-run-success');
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout.trim());
    expect(output.result.awaited).toBe(true);
    expect(output.cleanupExecuted).toBe(true);
    expect(output.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('propagates failure to a non-zero process exit', () => {
    const result = execute('--dry-run-failure');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('MT4C3A7_DRY_RUN_FAILURE');
  });

  it('requires the exact live mode and explicit live opt-in', () => {
    const unknown = execute('--live-mt4c3a7-typo');
    expect(unknown.status).not.toBe(0);
    expect(unknown.stderr).toContain('explicit supported mode required');

    const liveWithoutOptIn = execute('--live-mt4c3a7');
    expect(liveWithoutOptIn.status).not.toBe(0);
    expect(liveWithoutOptIn.stderr).toContain(
      'ALLOW_MT4C3A7_LIVE_VERIFICATION must be exactly YES',
    );
  });

  it('always awaits cleanup with the same correlation ID', async () => {
    const cleanup = vi.fn(async () => undefined);
    const result = await runScenarioWithCleanup({
      correlationFactory: () => 'controlled-correlation',
      scenario: async (correlationId) => correlationId,
      cleanup,
    });
    expect(result).toEqual({
      correlationId: 'controlled-correlation',
      result: 'controlled-correlation',
    });
    expect(cleanup).toHaveBeenCalledWith('controlled-correlation');
  });

  it('preserves scenario and cleanup failures together', async () => {
    await expect(
      runScenarioWithCleanup({
        scenario: async () => { throw new Error('scenario failed'); },
        cleanup: async () => { throw new Error('cleanup failed'); },
      }),
    ).rejects.toMatchObject({
      message: 'MT4C3A7_SCENARIO_AND_CLEANUP_FAILED',
      errors: [expect.objectContaining({ message: 'scenario failed' }), expect.objectContaining({ message: 'cleanup failed' })],
    });
  });

  it('imports canonical live dependencies without executing database work', () => {
    const result = execute('--probe-imports', false);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout.trim())).toEqual({
      mode: '--probe-imports',
      imports: 'PASS',
    });
  });
});
