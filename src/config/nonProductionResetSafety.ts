import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

/**
 * Guarded NON-PRODUCTION database reset safety gate.
 *
 * This gate authorises a full application-schema rebuild (DROP SCHEMA public
 * CASCADE + canonical migration + required seeds + privilege hardening) on a
 * named non-production database such as the Ubuntu test `jupiter_db`. It is a
 * destructive operation and is deliberately gated independently of NODE_ENV:
 *
 *   - an explicit `ALLOW_NON_PRODUCTION_RESET=YES` authorisation (never NODE_ENV);
 *   - the exact target database name typed twice (config + confirmation phrase);
 *   - a required verified pre-reset backup path;
 *   - refusal of the system/test databases (jupiter_test/postgres/template*).
 *
 * It never selects a database by default and never prints any credential.
 */

export const NON_PRODUCTION_RESET_ERROR =
  'NON_PRODUCTION_RESET: authorization or configuration is invalid';

export interface NonProductionResetConfig {
  readonly database: string;
  readonly username: string;
  readonly password: string;
  readonly host: string;
  readonly port: number;
  readonly backupPath: string;
}

export interface NonProductionResetIdentity extends Record<string, unknown> {
  readonly database_name: string;
  readonly current_user: string;
  readonly session_user: string;
  readonly server_address: string;
  readonly server_port: number;
  readonly transaction_read_only: string;
}

const UNRESETTABLE_DATABASES = Object.freeze([
  'jupiter_test',
  'postgres',
  'template0',
  'template1',
]);

function fail(): never {
  throw new Error(NON_PRODUCTION_RESET_ERROR);
}

function required(environment: NodeJS.ProcessEnv, key: string): string {
  const value = environment[key]?.trim();
  if (!value) fail();
  return value;
}

function validateDatabaseName(name: string): void {
  if (UNRESETTABLE_DATABASES.includes(name)) fail();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) fail();
  if (name.length > 63) fail();
}

function validateBackupPath(path: string): void {
  if (path.length > 4096) fail();
  if (/[\0\r\n]/.test(path)) fail();
}

/**
 * Reads and validates the non-production reset configuration. Fails closed on
 * any missing, mismatched or disallowed input. The explicit reset authorisation
 * (`ALLOW_NON_PRODUCTION_RESET=YES`) is independent of NODE_ENV.
 */
export function validateNonProductionResetConfiguration(
  environment: NodeJS.ProcessEnv,
): NonProductionResetConfig {
  if (environment.ALLOW_NON_PRODUCTION_RESET !== 'YES') fail();
  if (environment.ALLOW_UNIFIED_DATABASE_MIGRATION !== 'YES') fail();

  const database = required(environment, 'DB_MIGRATION_NAME');
  const confirmation = required(environment, 'CONFIRM_NON_PRODUCTION_RESET_DATABASE');
  if (confirmation !== database) fail();
  validateDatabaseName(database);

  // A pre-reset backup is mandatory and is not itself sufficient without the
  // explicit reset authorisation above.
  const backupPath = required(environment, 'NON_PRODUCTION_RESET_BACKUP_PATH');
  validateBackupPath(backupPath);

  const username = required(environment, 'DB_MIGRATION_USER');
  if (username !== 'postgres') fail();

  const host = required(environment, 'DB_MIGRATION_HOST');
  const portValue = required(environment, 'DB_MIGRATION_PORT');
  if (!/^\d+$/.test(portValue)) fail();
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) fail();

  const password = required(environment, 'DB_ADMIN_PASSWORD');

  return Object.freeze({ database, username, password, host, port, backupPath });
}

export function validateNonProductionResetIdentity(
  config: NonProductionResetConfig,
  identity: NonProductionResetIdentity,
  resolvedHostAddresses: readonly string[],
): void {
  if (identity.database_name !== config.database) fail();
  if (identity.current_user !== config.username) fail();
  if (identity.session_user !== config.username) fail();
  if (identity.server_port !== config.port) fail();
  if (identity.transaction_read_only !== 'off') fail();
  if (
    resolvedHostAddresses.length === 0 ||
    !resolvedHostAddresses.includes(identity.server_address)
  ) {
    fail();
  }
}

export async function resolveNonProductionResetHost(
  host: string,
): Promise<string[]> {
  const ipVersion = isIP(host);
  if (ipVersion === 4) return [host];
  if (ipVersion !== 0) fail();
  const addresses = await lookup(host, { all: true, verbatim: true });
  return [...new Set(addresses.map(({ address }) => address))];
}

/**
 * Refuses to overwrite an existing backup file. The pre-reset backup is the only
 * restorable copy of historical audit evidence, so an unexpected overwrite must
 * fail closed rather than silently replace a prior archive.
 */
export function assertBackupPathAvailable(
  backupPath: string,
  exists: (path: string) => boolean,
): void {
  if (exists(backupPath)) {
    throw new Error(
      'NON_PRODUCTION_RESET: backup path already exists; refusing to overwrite',
    );
  }
}

export interface BackupArchiveListing {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Validates the result of `pg_restore --list` against the freshly written
 * pre-reset backup. A successful listing (exit code 0 and a non-empty table of
 * contents carrying the custom-archive `; TOC Entries:` header) proves the
 * archive is a readable PostgreSQL custom-format dump. It is NOT a test of a
 * complete database restoration — that requires a separate rehearsed
 * `pg_restore` run and is deliberately out of scope here.
 */
export function assertBackupArchiveValid(listing: BackupArchiveListing): void {
  if (listing.exitCode !== 0) {
    throw new Error(
      'NON_PRODUCTION_RESET: backup archive is not a valid PostgreSQL custom-format archive (pg_restore --list failed)',
    );
  }
  const toc = listing.stdout.trim();
  if (toc.length === 0) {
    throw new Error('NON_PRODUCTION_RESET: backup archive listing is empty or unreadable');
  }
  if (!toc.includes('; TOC Entries:')) {
    throw new Error(
      'NON_PRODUCTION_RESET: backup archive is not a valid PostgreSQL custom-format archive (missing table of contents)',
    );
  }
}

export const REQUIRED_OPERATIONAL_ROLES = Object.freeze([
  'ADMIN',
  'ENGINEER',
  'MECHANIC',
  'SUPERVISOR',
  'QA',
  'PLANNER',
  'VIEWER',
]);

export interface ResetReconciliation extends Record<string, unknown> {
  readonly migration_head: string | null;
  readonly role_count: number;
  readonly mapping_count: number;
  readonly hardened_no_public_create: boolean;
  readonly hardened_app_usage: boolean;
  readonly owner_user: number;
  readonly owner_principal: number;
  readonly owner_grants: number;
}

/**
 * Reconciliation query proving the reset produced a complete, hardened database
 * with the required reference data, operational roles/RBAC mappings, and the
 * canonical System Owner principal and grants. Run only after the rebuild and
 * System Owner bootstrap have completed.
 */
export function buildResetReconciliationSql(systemOwnerUserId: string): string {
  return `SELECT
    (SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 1) AS migration_head,
    (SELECT count(*)::int FROM rf_role WHERE code IN ('ADMIN','ENGINEER','MECHANIC','SUPERVISOR','QA','PLANNER','VIEWER')) AS role_count,
    (SELECT count(*)::int FROM rf_role_permissions) AS mapping_count,
    NOT has_schema_privilege('public','public','CREATE') AS hardened_no_public_create,
    has_schema_privilege('jupiter_app','public','USAGE') AS hardened_app_usage,
    (SELECT count(*)::int FROM users WHERE id=$1 AND is_active=true) AS owner_user,
    (SELECT count(*)::int FROM platform_principals WHERE user_id=$1 AND principal_type='HUMAN' AND status='ACTIVE') AS owner_principal,
    (SELECT count(*)::int FROM platform_capability_grants pg JOIN platform_capabilities pc ON pc.id=pg.capability_id
       WHERE pg.revoked_at IS NULL AND pg.principal_id IN (SELECT id FROM platform_principals WHERE user_id=$1)) AS owner_grants
  `;
}

export interface ResetReconciliationExpectation {
  readonly expectedHead: string;
  readonly systemOwnerUserId: string;
  readonly systemOwnerEmail: string;
  readonly expectedGrantCount: number;
}

export function assertResetReconciliation(
  row: ResetReconciliation,
  expectation: ResetReconciliationExpectation,
): void {
  if (!row || row.migration_head !== expectation.expectedHead) {
    throw new Error('NON_PRODUCTION_RESET: migration head does not match the canonical head');
  }
  if (row.role_count !== REQUIRED_OPERATIONAL_ROLES.length) {
    throw new Error('NON_PRODUCTION_RESET: required operational roles are incomplete');
  }
  if (row.mapping_count <= 0) {
    throw new Error('NON_PRODUCTION_RESET: RBAC role-permission mappings are missing');
  }
  if (!row.hardened_no_public_create || !row.hardened_app_usage) {
    throw new Error('NON_PRODUCTION_RESET: privilege hardening is incomplete');
  }
  if (row.owner_user !== 1 || row.owner_principal !== 1) {
    throw new Error('NON_PRODUCTION_RESET: canonical System Owner identity is not established');
  }
  if (row.owner_grants !== expectation.expectedGrantCount) {
    throw new Error('NON_PRODUCTION_RESET: System Owner capability grants are incomplete');
  }
}
