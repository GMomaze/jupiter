export const TENANT_SWITCH_RUNTIME_CONFIGURATION_ERROR =
  'Tenant switch runtime configuration is invalid.';

const MINIMUM_SECRET_BYTES = 32;
const DOCUMENTED_PLACEHOLDER = '<operator-supplied-minimum-32-bytes>';

export function requireTenantSwitchTokenSecret(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const secret = environment.TENANT_SWITCH_TOKEN_SECRET;
  if (
    typeof secret !== 'string' ||
    secret.length === 0 ||
    secret === DOCUMENTED_PLACEHOLDER ||
    Buffer.byteLength(secret, 'utf8') < MINIMUM_SECRET_BYTES
  ) {
    throw new Error(TENANT_SWITCH_RUNTIME_CONFIGURATION_ERROR);
  }
  return secret;
}
