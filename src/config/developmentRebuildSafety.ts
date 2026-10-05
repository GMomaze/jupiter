import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

/**
 * Guarded DEVELOPMENT fresh-install/rebuild safety gate.
 *
 * This gate exists ONLY for an explicitly authorised development rebuild of a
 * named database. It is deliberately incapable of touching `jupiter_test`, and
 * requires a separate, even stronger confirmation before it will touch
 * `jupiter_db`. It never selects a database by default and never prints any
 * credential or secret.
 */

export const DEVELOPMENT_REBUILD_ERROR =
  'DEVELOPMENT_REBUILD: authorization or configuration is invalid';

export interface DevelopmentRebuildConfig {
  readonly database: string;
  readonly username: string;
  readonly password: string;
  readonly host: string;
  readonly port: number;
}

export interface DevelopmentRebuildIdentity extends Record<string, unknown> {
  readonly database_name: string;
  readonly current_user: string;
  readonly session_user: string;
  readonly server_address: string;
  readonly server_port: number;
  readonly transaction_read_only: string;
}

// System databases and the guarded test database can never be rebuilt here.
const UNREBUILDABLE_DATABASES = Object.freeze([
  'jupiter_test',
  'postgres',
  'template0',
  'template1',
]);

function fail(): never {
  throw new Error(DEVELOPMENT_REBUILD_ERROR);
}

function required(environment: NodeJS.ProcessEnv, key: string): string {
  const value = environment[key]?.trim();
  if (!value) fail();
  return value;
}

function validateDatabaseName(name: string): void {
  if (UNREBUILDABLE_DATABASES.includes(name)) fail();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) fail();
  if (name.length > 63) fail();
}

/**
 * Reads and validates the guarded development rebuild configuration. This is
 * the single authoritative gate: it fails closed on any missing, mismatched or
 * disallowed input.
 */
export function validateDevelopmentRebuildConfiguration(
  environment: NodeJS.ProcessEnv,
): DevelopmentRebuildConfig {
  if (environment.ALLOW_DEVELOPMENT_REBUILD !== 'YES') fail();
  // The rebuild performs a canonical migration; it must also carry the
  // canonical unified migration approval.
  if (environment.ALLOW_UNIFIED_DATABASE_MIGRATION !== 'YES') fail();

  // Development-only: refuse test and production execution contexts.
  const nodeEnv = environment.NODE_ENV;
  if (nodeEnv !== 'development') fail();

  const database = required(environment, 'DB_MIGRATION_NAME');
  const confirmation = required(
    environment,
    'CONFIRM_DEVELOPMENT_REBUILD_DATABASE',
  );
  // The operator must type the exact database name a second time.
  if (database !== confirmation) fail();
  validateDatabaseName(database);

  // Never rebuild the real development database without an extra explicit flag.
  if (database === 'jupiter_db' && environment.ALLOW_JUPITER_DB_REBUILD !== 'YES') {
    fail();
  }

  const username = required(environment, 'DB_MIGRATION_USER');
  if (username !== 'postgres') fail();

  const host = required(environment, 'DB_MIGRATION_HOST');
  const portValue = required(environment, 'DB_MIGRATION_PORT');
  if (!/^\d+$/.test(portValue)) fail();
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) fail();

  const password = required(environment, 'DB_MIGRATION_PASSWORD');

  return Object.freeze({ database, username, password, host, port });
}

export function validateDevelopmentRebuildIdentity(
  config: DevelopmentRebuildConfig,
  identity: DevelopmentRebuildIdentity,
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

export async function resolveDevelopmentRebuildHost(
  host: string,
): Promise<string[]> {
  const ipVersion = isIP(host);
  if (ipVersion === 4) return [host];
  if (ipVersion !== 0) fail();
  const addresses = await lookup(host, { all: true, verbatim: true });
  return [...new Set(addresses.map(({ address }) => address))];
}
