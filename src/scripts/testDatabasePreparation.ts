import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import pg from 'pg';
import '../config/environment.js';
import {
  configuredTestDatabaseSafety,
  assertTestDatabaseSafety,
} from '../config/testDatabaseSafety.js';
import {
  assertTestPreparationIdentities,
  parseTestPreparationOperation,
  validateTestPreparationAuthorization,
  type TestPreparationConnectionConfig,
} from '../config/testPreparationSafety.js';
import { resolveMigrationHost } from '../config/migrationSafety.js';
import { applyAndVerifyDatabasePrivilegeBaseline } from '../config/databasePrivilegeBaseline.js';

const require = createRequire(import.meta.url);
const { buildUnifiedMigrationConfig } = require(
  '../../sequelize-migration-config.cjs'
) as {
  buildUnifiedMigrationConfig: (
    environment: NodeJS.ProcessEnv,
    target: 'test'
  ) => Record<string, unknown>;
};

const actions = ['reset', 'migrate', 'migrate:undo', 'seed', 'harden'] as const;
type TestDatabasePreparationAction = (typeof actions)[number];

function parseAction(value: string | undefined): TestDatabasePreparationAction {
  if (!actions.includes(value as TestDatabasePreparationAction)) {
    throw new Error(
      `TEST_DATABASE_PREPARATION: action must be one of ${actions.join(', ')}`
    );
  }
  return value as TestDatabasePreparationAction;
}

function connectionConfig(
  database: unknown,
  username: unknown,
  host: unknown,
  port: unknown
): TestPreparationConnectionConfig {
  return {
    database: String(database),
    username: String(username),
    host: String(host),
    port: Number(port),
  };
}

function runSequelizeCli(
  command: 'db:migrate:undo' | 'db:seed:all',
  environmentName: 'migration-test' | 'test'
): Promise<void> {
  const cliPath = resolve('node_modules', 'sequelize-cli', 'lib', 'sequelize');
  return new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(
      process.execPath,
      [cliPath, command, '--env', environmentName],
      { env: { ...process.env, NODE_ENV: 'test' }, stdio: 'inherit' }
    );
    child.once('error', rejectPromise);
    child.once('exit', (code, signal) => {
      if (code === 0) return resolvePromise();
      rejectPromise(
        new Error(
          `TEST_DATABASE_PREPARATION: Sequelize CLI failed with ${
            signal ? `signal ${signal}` : `exit code ${String(code)}`
          }`
        )
      );
    });
  });
}

async function runAdministrativePreparation(
  action: 'reset' | 'migrate:undo' | 'harden'
): Promise<void> {
  parseTestPreparationOperation(action);
  const rawAdminConfig = buildUnifiedMigrationConfig(process.env, 'test');
  const runtimeConfig = connectionConfig(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_HOST,
    process.env.DB_PORT
  );
  const adminConfig = connectionConfig(
    rawAdminConfig.database,
    rawAdminConfig.username,
    rawAdminConfig.host,
    rawAdminConfig.port
  );
  validateTestPreparationAuthorization(
    configuredTestDatabaseSafety(),
    process.env.ALLOW_TEST_DATABASE_PREPARATION,
    adminConfig
  );

  const runtime = new pg.Client({
    host: runtimeConfig.host,
    port: runtimeConfig.port,
    database: runtimeConfig.database,
    user: runtimeConfig.username,
    password: process.env.DB_PASSWORD,
  });
  const admin = new pg.Client({
    host: adminConfig.host,
    port: adminConfig.port,
    database: adminConfig.database,
    user: adminConfig.username,
    password: String(rawAdminConfig.password),
  });

  try {
    await Promise.all([runtime.connect(), admin.connect()]);
    const [runtimeAddresses, adminAddresses] = await Promise.all([
      resolveMigrationHost(runtimeConfig.host),
      resolveMigrationHost(adminConfig.host),
    ]);
    await assertTestPreparationIdentities(
      runtime,
      admin,
      runtimeConfig,
      adminConfig,
      runtimeAddresses,
      adminAddresses
    );
    await runtime.end();

    if (action === 'migrate:undo') {
      await admin.end();
      await runSequelizeCli('db:migrate:undo', 'migration-test');
      return;
    }

    if (action === 'harden') {
      await applyAndVerifyDatabasePrivilegeBaseline(admin);
      return;
    }

    await admin.query('BEGIN');
    try {
      await admin.query('DROP SCHEMA public CASCADE');
      await admin.query('CREATE SCHEMA public AUTHORIZATION postgres');
      await admin.query('COMMIT');
    } catch (error) {
      await admin.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  } finally {
    await runtime.end().catch(() => undefined);
    await admin.end().catch(() => undefined);
  }
}

async function runRuntimeSeed(): Promise<void> {
  const runtime = new pg.Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  try {
    await assertTestDatabaseSafety(runtime);
  } finally {
    await runtime.end().catch(() => undefined);
  }
  await runSequelizeCli('db:seed:all', 'test');
}

async function main(): Promise<void> {
  const action = parseAction(process.argv[2]);
  if (action === 'migrate') {
    throw new Error(
      'TEST_DATABASE_PREPARATION: forward migration is disabled; use npm run migration:test'
    );
  }
  if (action === 'seed') {
    await runRuntimeSeed();
    return;
  }
  await runAdministrativePreparation(action);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
