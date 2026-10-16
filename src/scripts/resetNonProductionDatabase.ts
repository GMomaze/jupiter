import 'dotenv/config';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { statSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import pg from 'pg';
import {
  NON_PRODUCTION_RESET_ERROR,
  validateNonProductionResetConfiguration,
  validateNonProductionResetIdentity,
  resolveNonProductionResetHost,
  assertBackupPathAvailable,
  buildResetReconciliationSql,
  assertResetReconciliation,
  type NonProductionResetConfig,
  type NonProductionResetIdentity,
  type ResetReconciliation,
} from '../config/nonProductionResetSafety.js';
import {
  buildDevelopmentRebuildCommandEnvironment,
  buildSystemOwnerBootstrapEnvironment,
} from '../config/dbDevelopmentRebuildCommand.js';
import {
  SYSTEM_OWNER_EMAIL,
  SYSTEM_OWNER_USER_ID,
  SYSTEM_OWNER_CAPABILITY_CODES,
} from '../config/systemOwnerCanonical.js';
import { resolveCanonicalMigrationHead } from './migrationLedgerComparison.js';

const IDENTITY_SQL = `SELECT current_database() AS database_name,
  current_user, session_user, host(inet_server_addr()) AS server_address,
  inet_server_port() AS server_port,
  current_setting('transaction_read_only') AS transaction_read_only`;

function promptConfirmation(prompt: string): Promise<string> {
  return new Promise((resolvePromise) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolvePromise(answer);
    });
  });
}

function run(command: string, args: string[], env: Record<string, string>): Promise<void> {
  return new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    child.once('error', rejectPromise);
    child.once('exit', (code, signal) => {
      if (code === 0) return resolvePromise();
      rejectPromise(
        new Error(
          `NON_PRODUCTION_RESET: ${command} ${args.join(' ')} failed with ${signal ? `signal ${signal}` : `exit code ${String(code)}`}`,
        ),
      );
    });
  });
}

function runTsx(script: string, env: Record<string, string>): Promise<void> {
  const tsxCli = resolve('node_modules', 'tsx', 'dist', 'cli.mjs');
  return run(process.execPath, [tsxCli, script], env);
}

async function backup(config: NonProductionResetConfig): Promise<void> {
  await run(
    'pg_dump',
    ['--format=custom', `--file=${config.backupPath}`, '--host', config.host, '--port', String(config.port), '--username', config.username, config.database],
    { PGPASSWORD: config.password },
  );
}

function verifyBackup(backupPath: string): void {
  const stat = statSync(backupPath);
  if (!stat.isFile() || stat.size === 0) {
    throw new Error('NON_PRODUCTION_RESET: backup file is missing or empty');
  }
}

async function main(): Promise<void> {
  const config = validateNonProductionResetConfiguration(process.env);

  // Independent interactive confirmation (the database name typed again).
  const answer = await promptConfirmation(
    `WARNING: This will DROP the public schema and ALL data in database "${config.database}".\n` +
      `A verified backup will be written to ${config.backupPath}.\n` +
      `Type ${config.database} to continue: `,
  );
  if (answer.trim() !== config.database) {
    throw new Error(NON_PRODUCTION_RESET_ERROR);
  }

  // Verify the exact live database, user, server address and port.
  const client = new pg.Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
  });
  try {
    await client.connect();
    const identity = (
      await client.query<Record<string, unknown>>(IDENTITY_SQL)
    ).rows[0] as NonProductionResetIdentity & Record<string, unknown> | undefined;
    if (!identity) throw new Error(NON_PRODUCTION_RESET_ERROR);
    const addresses = await resolveNonProductionResetHost(config.host);
    validateNonProductionResetIdentity(config, identity, addresses);
  } finally {
    await client.end().catch(() => undefined);
  }

  console.log('NON-PRODUCTION RESET — DESTRUCTIVE (full schema rebuild)');
  console.log(`Verified live identity for database "${config.database}".`);

  // Refuse to overwrite an existing backup; the backup is the only restorable
  // copy of historical audit evidence.
  assertBackupPathAvailable(config.backupPath, existsSync);

  // Verified pre-reset backup (preserves historical audit evidence).
  await backup(config);
  verifyBackup(config.backupPath);
  console.log(`Backup verified: ${config.backupPath}`);

  // Reuse the existing guarded rebuild (RESET → MIGRATE → REQUIRED SEEDS → HARDEN)
  // and the canonical System Owner bootstrap. Both are already independently gated.
  const rebuildEnv = {
    ...buildDevelopmentRebuildCommandEnvironment(process.env),
    DB_MIGRATION_NAME: config.database,
    CONFIRM_DEVELOPMENT_REBUILD_DATABASE: config.database,
    DB_MIGRATION_HOST: config.host,
    DB_MIGRATION_PORT: String(config.port),
  };
  await runTsx('src/scripts/developmentRebuild.ts', rebuildEnv);

  const ownerEnv = buildSystemOwnerBootstrapEnvironment();
  await runTsx('src/scripts/createInitialSystemOwnerUser.ts', ownerEnv);
  await runTsx('src/scripts/preflightInitialSystemOwner.ts', ownerEnv);
  await runTsx('src/scripts/bootstrapInitialSystemOwner.ts', ownerEnv);
  await runTsx('src/scripts/setDevelopmentSystemOwnerPassword.ts', ownerEnv);

  // Mandatory post-reset reconciliation: migration head, required reference
  // data + operational roles + RBAC mappings, privilege hardening, and the
  // canonical System Owner identity/principal/grants. Success is reported only
  // after every check passes.
  const expectedHead = resolveCanonicalMigrationHead();
  const reconcile = new pg.Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
  });
  try {
    await reconcile.connect();
    const row = (
      await reconcile.query<Record<string, unknown>>(
        buildResetReconciliationSql(SYSTEM_OWNER_USER_ID),
        [SYSTEM_OWNER_USER_ID],
      )
    ).rows[0] as ResetReconciliation | undefined;
    assertResetReconciliation(row as ResetReconciliation, {
      expectedHead,
      systemOwnerUserId: SYSTEM_OWNER_USER_ID,
      systemOwnerEmail: SYSTEM_OWNER_EMAIL,
      expectedGrantCount: SYSTEM_OWNER_CAPABILITY_CODES.length,
    });
  } finally {
    await reconcile.end().catch(() => undefined);
  }

  console.log(`NON-PRODUCTION RESET SUCCEEDED. System Owner: ${SYSTEM_OWNER_EMAIL}`);
  console.log(
    `RESTORATION (if needed): pg_restore --clean --if-exists --dbname=${config.database} ${config.backupPath}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : NON_PRODUCTION_RESET_ERROR);
  process.exitCode = 1;
});
