import { describe, expect, it } from 'vitest';
import {
  requireTenantSwitchTokenSecret,
  TENANT_SWITCH_RUNTIME_CONFIGURATION_ERROR,
} from './tenantSwitchRuntimeSafety.js';

describe('tenant switch runtime safety', () => {
  it.each([
    undefined,
    '',
    'short',
    'x'.repeat(31),
    '<operator-supplied-minimum-32-bytes>',
  ])(
    'fails closed for a missing or insufficient secret %#',
    (secret) => {
      expect(() =>
        requireTenantSwitchTokenSecret(
          secret === undefined ? {} : { TENANT_SWITCH_TOKEN_SECRET: secret },
        ),
      ).toThrow(TENANT_SWITCH_RUNTIME_CONFIGURATION_ERROR);
    },
  );

  it('returns an injected secret of at least 32 bytes without a fallback', () => {
    const secret = '0123456789abcdef0123456789abcdef';
    expect(requireTenantSwitchTokenSecret({ TENANT_SWITCH_TOKEN_SECRET: secret }))
      .toBe(secret);
  });

  it('does not expose the secret through its stable error', () => {
    const supplied = 'sensitive-but-too-short';
    expect(() =>
      requireTenantSwitchTokenSecret({ TENANT_SWITCH_TOKEN_SECRET: supplied }),
    ).toThrow(TENANT_SWITCH_RUNTIME_CONFIGURATION_ERROR);
    expect(TENANT_SWITCH_RUNTIME_CONFIGURATION_ERROR).not.toContain(supplied);
  });
});
