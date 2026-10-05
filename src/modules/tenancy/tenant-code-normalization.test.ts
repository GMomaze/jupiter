import { describe, expect, it } from 'vitest';
import { normalizeTenantCode } from './tenant-code-normalization.js';

describe('tenant code normalization', () => {
  it('normalizes case, whitespace, punctuation, and repeated separators', () => {
    expect(normalizeTenantCode(' Acme Aviation ')).toBe('ACME_AVIATION');
    expect(normalizeTenantCode('acme---aviation')).toBe('ACME_AVIATION');
    expect(normalizeTenantCode('__Acme / Aviation__')).toBe('ACME_AVIATION');
  });

  it('maps equivalent administrative codes to one canonical identity', () => {
    const variants = ['ACME AVIATION', 'acme-aviation', ' Acme__Aviation '];
    expect(new Set(variants.map(normalizeTenantCode))).toEqual(new Set(['ACME_AVIATION']));
  });

  it('rejects empty and overlength canonical codes', () => {
    expect(() => normalizeTenantCode('---')).toThrow('TENANT_CODE_REQUIRED');
    expect(() => normalizeTenantCode('A'.repeat(51))).toThrow('TENANT_CODE_TOO_LONG');
  });
});
