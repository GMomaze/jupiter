export const TENANT_CODE_MAX_LENGTH = 50;

export function normalizeTenantCode(value: unknown): string {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalized) {
    throw new Error('TENANT_CODE_REQUIRED');
  }
  if (normalized.length > TENANT_CODE_MAX_LENGTH) {
    throw new Error('TENANT_CODE_TOO_LONG');
  }

  return normalized;
}
