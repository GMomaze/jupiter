import 'dotenv/config';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import pg from 'pg';
import {
  validateDevelopmentRebuildConfiguration,
  validateDevelopmentRebuildIdentity,
  resolveDevelopmentRebuildHost,
  type DevelopmentRebuildIdentity,
} from '../config/developmentRebuildSafety.js';
import { applyAndVerifyDatabasePrivilegeBaseline } from '../config/databasePrivilegeBaseline.js';

const IDENTITY_SQL = `SELECT current_database() AS database_name,
  current_user,
  session_user,
  host(inet_server_addr()) AS server_address,
  inet_server_port() AS server_port,
  current_setting('transaction_read_only') AS transaction_read_only`;

// Migrations 582/583/584 are governance ownership/ACL administrator repairs
// (docs/governance-ownership-repair-administrator-preparation.md). Their own
// preflight deliberately gates `current_database() IN ('jupiter_db','jupiter_test')`
// and they are applied separately as the postgres administrator. They are NOT
// part of the ordinary migration chain for a differently-named disposable
// database, so the rebuild records them for deferred administrator execution.
const ADMINISTRATOR_MIGRATIONS = [
  '582_repair_component_life_limit_governance_ownership.ts',
  '583_repair_component_life_limit_governance_gate_acl.ts',
  '584_repair_component_life_limit_governance_activation_gate_write.ts',
] as const;

async function markAdministratorMigrationsDeferred(admin: pg.Client): Promise<void> {
  await admin.query(
    `CREATE TABLE IF NOT EXISTS public."SequelizeMeta" (name varchar(255) NOT NULL UNIQUE PRIMARY KEY)`,
  );
  for (const name of ADMINISTRATOR_MIGRATIONS) {
    await admin.query(
      `INSERT INTO public."SequelizeMeta" (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
      [name],
    );
  }
}

function runSequelizeCli(args: string[]): Promise<void> {
  const cliPath = resolve('node_modules', 'sequelize-cli', 'lib', 'sequelize');
  return new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: 'inherit',
    });
    child.once('error', rejectPromise);
    child.once('exit', (code, signal) => {
      if (code === 0) return resolvePromise();
      rejectPromise(
        new Error(
          `DEVELOPMENT_REBUILD: sequelize-cli failed with ${
            signal ? `signal ${signal}` : `exit code ${String(code)}`
          }`,
        ),
      );
    });
  });
}

async function main(): Promise<void> {
  const config = validateDevelopmentRebuildConfiguration(process.env);

  const admin = new pg.Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
  });

  try {
    await admin.connect();
    const identityResult = await admin.query<DevelopmentRebuildIdentity>(
      IDENTITY_SQL,
    );
    const identity = identityResult.rows[0];
    if (!identity) {
      throw new Error('DEVELOPMENT_REBUILD: live identity unavailable');
    }
    const addresses = await resolveDevelopmentRebuildHost(config.host);
    validateDevelopmentRebuildIdentity(config, identity, addresses);

    console.log(
      '============================================================',
    );
    console.log('DEVELOPMENT REBUILD — DESTRUCTIVE');
    console.log(
      `This will DROP the public schema and ALL data in database "${config.database}".`,
    );
    console.log(
      `Verified live identity: database=${identity.database_name}, user=${identity.current_user}, read_only=${identity.transaction_read_only}.`,
    );
    console.log(
      '============================================================',
    );

    // RESET
    await admin.query('BEGIN');
    try {
      await admin.query('DROP SCHEMA public CASCADE');
      await admin.query('CREATE SCHEMA public AUTHORIZATION postgres');
      await admin.query('COMMIT');
    } catch (error) {
      await admin.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
    console.log('RESET complete.');

    // MIGRATE (postgres migration authority, guarded by migration config).
    // Migrations 582/583/584 are governance administrator repairs that their own
    // preflight gates to jupiter_db/jupiter_test. On a differently-named
    // disposable database they are recorded for deferred administrator execution
    // so the ordinary migration chain (everything else through 618) can complete.
    const governanceApproved =
      config.database === 'jupiter_db' || config.database === 'jupiter_test';
    if (!governanceApproved) {
      await markAdministratorMigrationsDeferred(admin);
    }
    await runSequelizeCli(['db:migrate', '--env', 'migration-development']);
    console.log(
      governanceApproved
        ? 'MIGRATE complete (full chain including administrator migrations 582/583/584).'
        : 'MIGRATE complete (administrator migrations 582/583/584 deferred — gated to jupiter_db/jupiter_test).',
    );

    // REQUIRED SEEDS ONLY (no development/demo data)
    await runSequelizeCli([
      'db:seed:all',
      '--env',
      'migration-development',
      '--seeders-path',
      'seeders/required',
    ]);
    console.log('REQUIRED SEEDS complete.');

    // HARDEN
    await applyAndVerifyDatabasePrivilegeBaseline(admin);
    console.log('HARDEN complete.');

    console.log('DEVELOPMENT REBUILD SUCCEEDED.');
  } finally {
    await admin.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'DEVELOPMENT_REBUILD failed');
  process.exitCode = 1;
});
