import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export type MigrationTarget = 'development' | 'test' | 'production';

export interface MigrationConnectionConfig {
  target: MigrationTarget;
  database: string;
  username: string;
  host: string;
  port: number;
}

export interface MigrationLiveIdentity extends Record<string, unknown> {
  database_name: string;
  current_user: string;
  session_user: string;
  server_address: string;
  server_port: number;
}

export interface MigrationSafetyQueryable {
  query<Row extends Record<string, unknown>>(
    sql: string
  ): Promise<{ rows: Row[] }>;
}

export function validateMigrationLiveIdentity(
  config: MigrationConnectionConfig,
  identity: MigrationLiveIdentity,
  resolvedHostAddresses: readonly string[]
): void {
  if (identity.database_name !== config.database) {
    throw new Error('MIGRATION_SAFETY: live database does not match the configured database');
  }
  if (identity.current_user !== 'postgres') {
    throw new Error('MIGRATION_SAFETY: current_user must be exactly postgres');
  }
  if (identity.session_user !== 'postgres') {
    throw new Error('MIGRATION_SAFETY: session_user must be exactly postgres');
  }
  if (identity.server_port !== config.port) {
    throw new Error('MIGRATION_SAFETY: live server port does not match the configured port');
  }
  if (
    resolvedHostAddresses.length === 0 ||
    !resolvedHostAddresses.includes(identity.server_address)
  ) {
    throw new Error('MIGRATION_SAFETY: live server address does not match the configured host');
  }
  if (config.target === 'test' && identity.database_name !== 'jupiter_test') {
    throw new Error('MIGRATION_SAFETY: test target must be exactly jupiter_test');
  }
  if (config.target !== 'test' && identity.database_name === 'jupiter_test') {
    throw new Error(`MIGRATION_SAFETY: ${config.target} target must not use jupiter_test`);
  }
}

export async function resolveMigrationHost(host: string): Promise<string[]> {
  const ipVersion = isIP(host);
  if (ipVersion === 4) return [host];
  if (ipVersion !== 0) {
    throw new Error('MIGRATION_SAFETY: IPv6 literal hosts are not supported');
  }
  const addresses = await lookup(host, { all: true, verbatim: true });
  return [...new Set(addresses.map(({ address }) => address))];
}

export async function assertMigrationLiveIdentity(
  queryable: MigrationSafetyQueryable,
  config: MigrationConnectionConfig,
  resolvedHostAddresses?: readonly string[]
): Promise<MigrationLiveIdentity> {
  const result = await queryable.query<MigrationLiveIdentity>(
    `SELECT current_database() AS database_name,
            current_user,
            session_user,
            host(inet_server_addr()) AS server_address,
            inet_server_port() AS server_port`
  );
  const identity = result.rows[0];
  if (!identity) {
    throw new Error('MIGRATION_SAFETY: live identity query returned no row');
  }
  const addresses =
    resolvedHostAddresses ?? (await resolveMigrationHost(config.host));
  validateMigrationLiveIdentity(config, identity, addresses);
  return identity;
}
