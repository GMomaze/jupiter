import { normalizeTenantCode } from '../modules/tenancy/tenant-code-normalization.js';

export type FirstOrganisationProvisioningTarget = 'test' | 'production';

export interface FirstOrganisationProvisioningConfig {
  readonly target: FirstOrganisationProvisioningTarget;
  readonly database: string;
  readonly username: string;
  readonly password: string;
  readonly host: string;
  readonly port: number;
  readonly actorUserId: string;
  readonly initialUserId: string;
  readonly code: string;
  readonly displayName: string;
  readonly legalName: string | null;
}

export interface FirstOrganisationLiveIdentity extends Record<string, unknown> {
  readonly database_name: string;
  readonly current_user: string;
  readonly session_user: string;
  readonly server_address: string;
  readonly server_port: number;
  readonly transaction_read_only: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const FIRST_ORGANISATION_SAFETY_ERROR =
  'FIRST_ORGANISATION_PROVISIONING: authorization or configuration is invalid';

function fail(): never {
  throw new Error(FIRST_ORGANISATION_SAFETY_ERROR);
}

function required(environment: NodeJS.ProcessEnv, key: string): string {
  const value = environment[key]?.trim();
  if (!value) fail();
  return value;
}

export function parseFirstOrganisationTarget(
  value: string | undefined,
): FirstOrganisationProvisioningTarget {
  if (value !== 'test' && value !== 'production') fail();
  return value;
}

export function validateFirstOrganisationProvisioningConfiguration(
  target: FirstOrganisationProvisioningTarget,
  environment: NodeJS.ProcessEnv,
): FirstOrganisationProvisioningConfig {
  if (environment.ALLOW_FIRST_ORGANISATION_PROVISIONING !== 'YES') fail();
  if (environment.CONFIRM_FIRST_ORGANISATION_TARGET !== target) fail();
  if (
    target === 'production' &&
    environment.ALLOW_FIRST_ORGANISATION_PRODUCTION !== 'YES'
  ) fail();

  const actorUserId = required(environment, 'FIRST_ORGANISATION_ACTOR_USER_ID');
  const initialUserId = required(environment, 'FIRST_ORGANISATION_INITIAL_USER_ID');
  if (!UUID.test(actorUserId) || !UUID.test(initialUserId)) fail();

  let code: string;
  try {
    code = normalizeTenantCode(required(environment, 'FIRST_ORGANISATION_CODE'));
  } catch {
    fail();
  }
  if (environment.CONFIRM_FIRST_ORGANISATION_CODE !== code) fail();

  const displayName = required(environment, 'FIRST_ORGANISATION_DISPLAY_NAME');
  const legalValue = environment.FIRST_ORGANISATION_LEGAL_NAME?.trim();
  const legalName = legalValue ? legalValue : null;
  if (displayName.length > 150 || (legalName !== null && legalName.length > 200)) fail();

  const database = required(environment, 'DB_NAME');
  const username = required(environment, 'DB_USER');
  const password = required(environment, 'DB_PASSWORD');
  const host = required(environment, 'DB_HOST');
  const portValue = required(environment, 'DB_PORT');
  if (!/^\d+$/.test(portValue)) fail();
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) fail();
  if (target === 'test' && (database !== 'jupiter_test' || username !== 'jupiter_test')) fail();
  if (target === 'production' && (database === 'jupiter_test' || username === 'postgres')) fail();

  return Object.freeze({
    target, database, username, password, host, port,
    actorUserId, initialUserId, code, displayName, legalName,
  });
}

export function validateFirstOrganisationLiveIdentity(
  config: FirstOrganisationProvisioningConfig,
  identity: FirstOrganisationLiveIdentity,
  resolvedHostAddresses: readonly string[],
): void {
  if (
    identity.database_name !== config.database ||
    identity.current_user !== config.username ||
    identity.session_user !== config.username ||
    identity.server_port !== config.port ||
    identity.transaction_read_only !== 'off' ||
    resolvedHostAddresses.length === 0 ||
    !resolvedHostAddresses.includes(identity.server_address)
  ) fail();
}
