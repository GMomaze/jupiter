import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import type { spawn } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_DATABASE_TEST_ALLOWLIST } from './noDatabaseTestAllowlist.js';
import { requireDatabaseTestExecutionApproval } from '../../src/config/databaseTestExecutionSafety.js';
import { runQuarantinedDatabaseTests } from '../../src/scripts/quarantinedDatabaseTestRunner.js';
import { rejectRawDatabaseCommand } from '../../src/scripts/blockedRawDatabaseCommand.js';

const DATABASE_BOUNDARY_ERROR =
  'NO_DATABASE_TEST_BOUNDARY: live database infrastructure was imported';

const { poolConstructor, sequelizeConstructor } = vi.hoisted(() => ({
  poolConstructor: vi.fn(),
  sequelizeConstructor: vi.fn(),
}));

vi.mock('pg', () => ({
  default: { Pool: poolConstructor },
}));

vi.mock('sequelize', () => ({
  Sequelize: sequelizeConstructor,
}));

afterEach(() => {
  vi.resetModules();
  poolConstructor.mockClear();
  sequelizeConstructor.mockClear();
});

describe('true no-database test boundary', () => {
  it('fails before constructing Pool or Sequelize infrastructure', async () => {
    process.env.JUPITER_DENY_LIVE_DB = 'YES';

    await expect(import('../../src/config/database.js')).rejects.toThrow(
      DATABASE_BOUNDARY_ERROR
    );
    expect(poolConstructor).not.toHaveBeenCalled();
    expect(sequelizeConstructor).not.toHaveBeenCalled();
  });

  it('keeps the ordinary runtime path gated only by the exact deny value', () => {
    const source = readFileSync('src/config/database.ts', 'utf8');
    expect(source).toContain(
      "process.env.JUPITER_DENY_LIVE_DB === 'YES'"
    );
    expect(source.indexOf('if (denyLiveDatabase)')).toBeLessThan(
      source.indexOf("await import('./environment.js')")
    );
    expect(source.indexOf("await import('./environment.js')")).toBeLessThan(
      source.indexOf('new Pool(appConfig)')
    );
    expect(source.indexOf('new Pool(appConfig)')).toBeLessThan(
      source.indexOf('new Sequelize({')
    );
  });

  it('uses only the explicit allowlist and never loads the live setup', () => {
    const config = readFileSync('vitest.nodb.config.ts', 'utf8');
    expect(config).toContain('NO_DATABASE_TEST_ALLOWLIST');
    expect(config).toContain("setupFiles: ['tests/nodb/setup.ts']");
    expect(config).not.toContain('tests/setup.ts');
    expect(config).not.toMatch(/include:\s*\[\s*['\"]\*\*/);
  });

  it('routes the default test command only through test:nodb', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts['test:nodb']).toBe(
      'cross-env NODE_ENV=test JUPITER_DENY_LIVE_DB=YES vitest run --config vitest.nodb.config.ts'
    );
    expect(packageJson.scripts.test).toBe('npm run test:nodb');
    expect(packageJson.scripts.test).not.toContain('vitest run');
    expect(packageJson.scripts.test).not.toContain('tests/setup.ts');
    expect(packageJson.scripts.test).not.toContain('test:database:quarantined');
    expect(packageJson.scripts.test).not.toContain(
      'test:governance-ownership-positive'
    );
    expect(packageJson.scripts.test).not.toContain('test:e2e');
  });

  it('fails closed unless database-test approval is exactly YES', () => {
    expect(() => requireDatabaseTestExecutionApproval({})).toThrow(
      'ALLOW_DATABASE_TEST_EXECUTION must be exactly YES'
    );
    expect(() =>
      requireDatabaseTestExecutionApproval({
        ALLOW_DATABASE_TEST_EXECUTION: 'yes',
      })
    ).toThrow('ALLOW_DATABASE_TEST_EXECUTION must be exactly YES');
    expect(() =>
      requireDatabaseTestExecutionApproval({
        ALLOW_DATABASE_TEST_EXECUTION: 'YES',
      })
    ).not.toThrow();
  });

  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['lowercase', 'yes'],
    ['boolean-like', 'TRUE'],
    ['arbitrary', 'anything'],
  ])('rejects %s database-test approval before spawn', async (_label, value) => {
    const spawnMock = vi.fn();
    const environment: NodeJS.ProcessEnv = {};
    if (value !== undefined) {
      environment.ALLOW_DATABASE_TEST_EXECUTION = value;
    }

    await expect(
      runQuarantinedDatabaseTests(
        environment,
        spawnMock as unknown as typeof spawn
      )
    ).rejects.toThrow(
      'DATABASE_TEST_QUARANTINE: ALLOW_DATABASE_TEST_EXECUTION must be exactly YES'
    );
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('spawns only legacy Vitest once when approval is exactly YES', async () => {
    const child = new EventEmitter();
    const spawnMock = vi.fn(() => {
      queueMicrotask(() => child.emit('exit', 0, null));
      return child;
    });

    await runQuarantinedDatabaseTests(
      { ALLOW_DATABASE_TEST_EXECUTION: 'YES' },
      spawnMock as unknown as typeof spawn
    );

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [command, args, options] = spawnMock.mock.calls[0];
    expect(command).toBe(process.execPath);
    expect(args).toEqual([
      expect.stringMatching(/[\\/]node_modules[\\/]vitest[\\/]vitest\.mjs$/),
      'run',
      '--exclude',
      'tests/integration/component_life_limit_governance_ownership_positive.test.ts',
    ]);
    expect(options).toMatchObject({
      cwd: process.cwd(),
      stdio: 'inherit',
      env: {
        ALLOW_DATABASE_TEST_EXECUTION: 'YES',
        NODE_ENV: 'test',
        RUN_GOVERNANCE_OWNERSHIP_POSITIVE_TEST: 'NO',
      },
    });
    expect(args.join(' ')).not.toMatch(
      /npm test|test:nodb|test:e2e|test:governance-ownership-positive|db:|migration:/
    );
  });

  it('quarantines legacy database Vitest behind the approval check', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    const command = packageJson.scripts['test:database:quarantined'];
    const runner = readFileSync(
      'src/scripts/quarantinedDatabaseTestRunner.ts',
      'utf8'
    );
    expect(command).toContain('NODE_ENV=test');
    expect(command).toContain('DB_NAME=jupiter_test');
    expect(command).toContain('DB_USER=jupiter_test');
    expect(command).toContain('ALLOW_TEST_DATABASE_RESET=YES');
    expect(command).not.toContain('ALLOW_DATABASE_TEST_EXECUTION=YES');
    expect(runner).toContain(
      'requireDatabaseTestExecutionApproval(environment)'
    );
    expect(runner.indexOf('requireDatabaseTestExecutionApproval(environment)')).toBeLessThan(
      runner.indexOf('await runLegacyDatabaseTests(environment, spawnProcess)')
    );
    expect(runner).toContain("[vitestPath, 'run', '--exclude', GOVERNANCE_OWNERSHIP_SUITE]");
    expect(command).not.toContain('test:e2e');
    expect(command).not.toContain('test:governance-ownership-positive');
  });

  it('blocks ambiguous raw seed and migration undo package commands', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts['db:seed']).toBe(
      'tsx src/scripts/blockedRawDatabaseCommand.ts seed'
    );
    expect(packageJson.scripts['db:migrate:undo']).toBe(
      'tsx src/scripts/blockedRawDatabaseCommand.ts migrate:undo'
    );
    expect(() => rejectRawDatabaseCommand('seed')).toThrow(
      'RAW_DATABASE_COMMAND_BLOCKED: db:seed is disabled'
    );
    expect(() => rejectRawDatabaseCommand('migrate:undo')).toThrow(
      'RAW_DATABASE_COMMAND_BLOCKED: db:migrate:undo is disabled'
    );
  });

  it('preserves guarded test seed and undo commands without raw CLI bypasses', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts['db:test:seed']).toBe(
      'cross-env NODE_ENV=test tsx src/scripts/testDatabasePreparation.ts seed'
    );
    expect(packageJson.scripts['db:test:migrate:undo']).toBe(
      'cross-env NODE_ENV=test tsx src/scripts/testDatabasePreparation.ts migrate:undo'
    );
    for (const [name, command] of Object.entries(packageJson.scripts)) {
      expect(command, name).not.toMatch(/sequelize-cli/);
      if (name === 'db:seed' || name === 'db:migrate:undo') {
        expect(command).toContain('blockedRawDatabaseCommand.ts');
      }
    }
  });

  it('keeps the raw-command blocker free of spawn, credentials, and database imports', () => {
    const source = readFileSync(
      'src/scripts/blockedRawDatabaseCommand.ts',
      'utf8'
    );
    expect(source).not.toMatch(/node:child_process|\bspawn\s*\(|sequelize-cli/);
    expect(source).not.toMatch(/DB_(?:HOST|PORT|NAME|USER|PASSWORD)/);
    expect(source).not.toMatch(/(?:from\s+|import\s*\()['"][^'"]*config\/database/);
    expect(source).not.toMatch(/db:seed:all|db:migrate:undo['"]/);
  });

  it('enforces owned-fixture safety for the database-backed authentication test', () => {
    const source = readFileSync('src/modules/auth/auth.test.ts', 'utf8');
    expect(source).toContain("'INTEGRATION SAFE-FIXTURE'");
    expect(source).toContain('auth+${fixtureId}@tests.jupiter.invalid');
    expect(source).toContain('ownedUserId = user.id');
    expect(source).toContain('if (!ownedUserId) return');
    expect(source).toContain("User.destroy({ where: { id: userId } })");
    expect(source).toContain(
      "DELETE FROM sessions WHERE sess -> 'passport' ->> 'user' = $1"
    );
    expect(source).toContain('[userId]');
    expect(source).not.toMatch(/User\.destroy\(\{\s*where:\s*\{\s*\}/);
    expect(source).not.toMatch(/\bTRUNCATE\b/i);
    expect(source).not.toMatch(/DELETE\s+FROM\s+users/i);
    expect(source).not.toMatch(/Role\.(?:destroy|create|findOrCreate)/);
    expect(source).not.toMatch(/DELETE\s+FROM\s+(?:rf_role|user_roles)\b/i);
    expect(source).not.toMatch(/DELETE\s+FROM\s+sessions(?![\s\S]*WHERE[\s\S]*\$1)/i);
    expect(source).not.toMatch(
      /resetDatabase|cleanDatabase|clearDatabase|tests\/bootstrap/
    );
    expect(source).not.toContain('test@example.com');
  });

  it('enforces owned-fixture safety for the service bulletin UI test', () => {
    const source = readFileSync(
      'src/modules/service-bulletins/service-bulletin-ui.test.ts',
      'utf8'
    );
    const serviceSource = readFileSync(
      'src/modules/service-bulletins/service-bulletin.service.ts',
      'utf8'
    );
    expect(source).toContain("'INTEGRATION SAFE-FIXTURE'");
    expect(source).toContain('sb-ui+${userFixtureId}@tests.jupiter.invalid');
    expect(source).toContain('ownedUserId = user.id');
    expect(source).toContain('ownedSyncRunIds.push(olderRun.id)');
    expect(source).toContain('ownedSyncRunIds.push(newerRun.id)');
    expect(source).toContain("new Date('9999-12-30T07:00:00.000Z')");
    expect(source).toContain("new Date('9999-12-31T07:00:00.000Z')");
    expect(serviceSource).toContain("order: [['started_at', 'DESC']]");
    expect(source).toContain('if (userId)');
    expect(source).toContain('if (syncRunIds.length > 0)');
    expect(source).toContain("User.destroy({ where: { id: userId } })");
    const directDeleteTargets = [
      ...source.matchAll(/\bDELETE\s+FROM\s+([a-z_]+)/gi),
    ].map(match => match[1].toLowerCase());
    expect(directDeleteTargets).toEqual(['sessions']);
    expect(source).toContain(
      '"DELETE FROM sessions WHERE sess -> \'passport\' ->> \'user\' = $1"'
    );
    expect(source).toContain('[userId]');
    expect(source).not.toMatch(/DELETE\s+FROM\s+service_bulletins\b/i);
    expect(source).not.toMatch(
      /DELETE\s+FROM\s+service_bulletin_sync_runs\b/i
    );
    expect(source).not.toMatch(/DELETE\s+FROM\s+sessions\s*(?:;|[`'"\r\n])/i);
    expect(source).toContain('[Op.in]: syncRunIds');
    expect(source).toContain('const syncRunIds = [...ownedSyncRunIds]');
    expect(source).toContain('ownedSyncRunIds = []');
    expect(source).not.toMatch(/\bTRUNCATE\b/i);
    expect(source).not.toMatch(/RESTART\s+IDENTITY|\bCASCADE\b/i);
    expect(source).not.toMatch(/\.destroy\(\{\s*where:\s*\{\s*\}/);
    expect(source).not.toMatch(/DELETE\s+FROM\s+(?:users|user_roles|rf_asset_type|manufacturers|component_models)\b/i);
    expect(source).not.toMatch(/Role\.(?:destroy|create|findOrCreate)/);
    expect(source).not.toMatch(
      /resetDatabase|cleanDatabase|clearDatabase|tests\/bootstrap/
    );
    expect(source).not.toMatch(/sb-ui@test\.com|OEM-1|Omega Engines|OE-900/);
    expect(NO_DATABASE_TEST_ALLOWLIST).not.toContain(
      'src/modules/service-bulletins/service-bulletin-ui.test.ts'
    );
  });

  it('excludes every representative database-backed suite', () => {
    const excluded = [
      'src/modules/auth/auth.test.ts',
      'src/modules/audit/audit.test.ts',
      'src/modules/service-bulletins/service-bulletin-ui.test.ts',
      'tests/domain/LibraryIntegrity.test.ts',
      'tests/aircraft_lifecycle.test.ts',
      'tests/seeders/rbac_permission_mapping_seed.test.ts',
      'tests/integration/component_life_limit_governance_phase_2_activation.test.ts',
      'tests/e2e/smoke.spec.ts',
    ];
    for (const path of excluded) {
      expect(NO_DATABASE_TEST_ALLOWLIST).not.toContain(path);
    }
  });

  it('rejects prohibited live-database imports in ordinary allowlisted tests', () => {
    const boundaryTest = 'tests/config/no_database_test_boundary.test.ts';
    const prohibitedImport = /(?:from\s+|import\s*\()['\"][^'\"]*(?:config\/database|tests\/setup|migrationRunner|testDatabasePreparation)['\"]/;
    const directPgImport = /from\s+['\"]pg['\"]/;

    for (const path of NO_DATABASE_TEST_ALLOWLIST) {
      if (path === boundaryTest) continue;
      const source = readFileSync(path, 'utf8').replaceAll('\\', '/');
      expect(source, path).not.toMatch(prohibitedImport);
      expect(source, path).not.toMatch(directPgImport);
    }
  });

  it('keeps TS1 setup and configuration free of live database imports', () => {
    const prohibitedImport = /(?:from\s+|import\s*\()['\"][^'\"]*(?:config\/database|tests\/setup|migrationRunner|testDatabasePreparation)['\"]/;
    for (const path of [
      'tests/nodb/setup.ts',
      'tests/config/noDatabaseTestAllowlist.ts',
      'vitest.nodb.config.ts',
    ]) {
      const source = readFileSync(path, 'utf8');
      expect(source, path).not.toMatch(/from\s+['\"](?:pg|sequelize)['\"]/);
      expect(source, path).not.toMatch(prohibitedImport);
    }
  });
});
