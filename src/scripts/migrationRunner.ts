import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import pg from 'pg';
import {
  assertMigrationLiveIdentity,
  type MigrationConnectionConfig,
  type MigrationTarget,
} from '../config/migrationSafety.js';
import { loadMigrationTargetEnvironment } from '../config/migrationEnvironment.js';
import {
  prepareMigrationCompatibility,
  finalizeMigrationCompatibility,
} from '../config/migrationCompatibility.js';
import { applyAndVerifyDatabasePrivilegeBaseline } from '../config/databasePrivilegeBaseline.js';

const require = createRequire(import.meta.url);
const { buildUnifiedMigrationConfig, MIGRATION_TARGETS } = require(
  '../../sequelize-migration-config.cjs'
) as {
  buildUnifiedMigrationConfig: (
    environment: NodeJS.ProcessEnv,
    target: MigrationTarget
  ) => Record<string, unknown>;
  MIGRATION_TARGETS: MigrationTarget[];
};

function parseTarget(value: string | undefined): MigrationTarget {
  if (!MIGRATION_TARGETS.includes(value as MigrationTarget)) {
    throw new Error(
      `MIGRATION_RUNNER: target must be exactly one of ${MIGRATION_TARGETS.join(', ')}`
    );
  }
  return value as MigrationTarget;
}

function requireApproval(): void {
  if (process.env.ALLOW_UNIFIED_DATABASE_MIGRATION !== 'YES') {
    throw new Error(
      'MIGRATION_RUNNER: ALLOW_UNIFIED_DATABASE_MIGRATION must be exactly YES'
    );
  }
}

async function runSequelize(target: MigrationTarget): Promise<void> {
  const cliPath = resolve('node_modules', 'sequelize-cli', 'lib', 'sequelize');
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(
      process.execPath,
      [cliPath, 'db:migrate', '--env', `migration-${target}`],
      { cwd: process.cwd(), env: { ...process.env }, stdio: 'inherit' }
    );
    child.once('error', rejectPromise);
    child.once('exit', (code, signal) => {
      if (code === 0) return resolvePromise();
      rejectPromise(
        new Error(
          `MIGRATION_RUNNER: Sequelize CLI failed with ${
            signal ? `signal ${signal}` : `exit code ${String(code)}`
          }`
        )
      );
    });
  });
}

async function main(): Promise<void> {
  const target = parseTarget(process.argv[2]);
  loadMigrationTargetEnvironment(target);
  const rawConfig = buildUnifiedMigrationConfig(process.env, target);
  requireApproval();
  const config: MigrationConnectionConfig = {
    target,
    database: String(rawConfig.database),
    username: String(rawConfig.username),
    host: String(rawConfig.host),
    port: Number(rawConfig.port),
  };
  const client = new pg.Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: String(rawConfig.password),
  });

  try {
    await client.connect();
    await assertMigrationLiveIdentity(client, config);
    await prepareMigrationCompatibility(client, target);
    await runSequelize(target);
    await finalizeMigrationCompatibility(client, target);
    await applyPrivilegeBaselineForTarget(client, target);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function applyPrivilegeBaselineForTarget(
  client: pg.Client,
  target: MigrationTarget,
): Promise<void> {
  if (target === 'test') return;
  await applyAndVerifyDatabasePrivilegeBaseline(
    client,
    target === 'production' ? ['jupiter_app'] : ['jupiter_app', 'jupiter_test'],
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
