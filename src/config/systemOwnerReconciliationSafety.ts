import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

/**
 * Canonical installation-designation values. These are the single committed
 * source of truth for the commissioning/production designation used by the
 * reconciliation gate. They intentionally match the commissioning-reset
 * architecture so the reconciliation does not invent a competing designation
 * mechanism, but they are declared here (rather than imported from the
 * commissioning-reset module) so the committed reconciliation has no dependency
 * on files that are not yet part of the repository.
 */
export const COMMISSIONING_DESIGNATION = 'commissioning';
export const PRODUCTION_DESIGNATION = 'production';
export const DEFAULT_INSTALLATION_DESIGNATION_PATH =
  '/opt/jupiter/.jupiter-installation-designation';


/**
 * Guarded System Owner capability-reconciliation target gate.
 *
 * The reconciliation grants the canonical System Owner the missing platform
 * capabilities it does not already hold. It is an additive, idempotent access
 * grant and must therefore be able to run against the non-production
 * commissioning database (`jupiter_db`) as well as the guarded test database
 * (`jupiter_test`) — but never against production or any unexpected target.
 *
 * This module provides the pure, database-free safety decisions for that gate:
 *
 *   - an explicit, operation-specific authorisation flag (never NODE_ENV alone);
 *   - an exact target database name, host and port;
 *   - refusal of every database other than the two permitted non-production
 *     targets (`jupiter_test` requires a test environment; `jupiter_db` requires
 *     an installation designated "commissioning", never "production");
 *   - verification that the live connection identity (database name, server
 *     address and server port) matches the declared target.
 *
 * It never selects a database by default and never prints any credential.
 */

export const SYSTEM_OWNER_RECONCILIATION_ERROR =
  'SYSTEM_OWNER_RECONCILIATION: authorization, configuration or target is invalid';

export const TEST_RECONCILIATION_DATABASE = 'jupiter_test';
export const COMMISSIONING_RECONCILIATION_DATABASE = 'jupiter_db';

export interface SystemOwnerReconciliationTarget {
  readonly database: string;
  readonly host: string;
  readonly port: number;
}

export interface SystemOwnerReconciliationIdentity {
  readonly database_name: string;
  readonly server_address: string;
  readonly server_port: number;
}

function fail(): never {
  throw new Error(SYSTEM_OWNER_RECONCILIATION_ERROR);
}

function required(environment: NodeJS.ProcessEnv, key: string): string {
  const value = environment[key]?.trim();
  if (!value) fail();
  return value;
}

/**
 * Permits only the two explicit non-production reconciliation targets.
 * `jupiter_test` additionally requires a test environment (preserving the
 * existing test-database safeguard). `jupiter_db` additionally requires an
 * installation designation of "commissioning" (the marker file content, never
 * an environment variable), so a future production installation can never be
 * reconciled by an ordinary environment override.
 */
export function assertSystemOwnerReconciliationTargetPermitted(
  database: string,
  nodeEnv: string | undefined,
  installationDesignation: string | null | undefined,
): void {
  if (database === TEST_RECONCILIATION_DATABASE) {
    if (nodeEnv !== 'test') fail();
    return;
  }
  if (database === COMMISSIONING_RECONCILIATION_DATABASE) {
    const designation = (installationDesignation ?? '').trim().toLowerCase();
    if (designation === PRODUCTION_DESIGNATION) fail();
    if (designation !== COMMISSIONING_DESIGNATION) fail();
    return;
  }
  fail();
}

/**
 * Reads and validates the reconciliation configuration. Fails closed on any
 * missing, malformed or disallowed input. The explicit authorisation flag
 * (`ALLOW_SYSTEM_OWNER_CAPABILITY_RECONCILIATION=YES`) is independent of
 * NODE_ENV and is not itself sufficient without the permitted target and the
 * confirmation token checked by the caller.
 */
export function validateSystemOwnerReconciliationConfiguration(
  environment: NodeJS.ProcessEnv,
  installationDesignation: string | null | undefined,
): SystemOwnerReconciliationTarget {
  if (environment.ALLOW_SYSTEM_OWNER_CAPABILITY_RECONCILIATION !== 'YES') fail();

  const database = required(environment, 'SYSTEM_OWNER_RECONCILIATION_DATABASE');
  const host = required(environment, 'SYSTEM_OWNER_RECONCILIATION_HOST');
  const portValue = required(environment, 'SYSTEM_OWNER_RECONCILIATION_PORT');
  if (!/^\d+$/.test(portValue)) fail();
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) fail();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(database) || database.length > 63) fail();

  assertSystemOwnerReconciliationTargetPermitted(
    database,
    environment.NODE_ENV,
    installationDesignation,
  );

  return Object.freeze({ database, host, port });
}

/**
 * Verifies that the live PostgreSQL connection identity exactly matches the
 * declared reconciliation target. The database name, server port and resolved
 * server address must all agree or the reconciliation is refused before any
 * mutation.
 */
export function assertSystemOwnerReconciliationIdentityMatches(
  target: SystemOwnerReconciliationTarget,
  identity: SystemOwnerReconciliationIdentity,
  resolvedHostAddresses: readonly string[],
): void {
  if (identity.database_name !== target.database) fail();
  if (identity.server_port !== target.port) fail();
  if (
    resolvedHostAddresses.length === 0 ||
    !resolvedHostAddresses.includes(identity.server_address)
  ) {
    fail();
  }
}

/** Resolves a literal IPv4 address or a hostname to its candidate addresses. */
export async function resolveSystemOwnerReconciliationHost(
  host: string,
): Promise<string[]> {
  const ipVersion = isIP(host);
  if (ipVersion === 4) return [host];
  if (ipVersion !== 0) fail();
  const addresses = await lookup(host, { all: true, verbatim: true });
  return [...new Set(addresses.map(({ address }) => address))];
}
