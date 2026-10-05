import { describe, expect, it, vi } from 'vitest';
import { PLATFORM_MUTATION_CAPABILITIES } from './platform-authority.js';
import { PlatformAuthorityRepository } from './platform-authority.repository.js';
import { authorizeSharedOperation, REFERENCE_OPERATION_POLICY, referenceOperationPolicy, SHARED_OPERATION_POLICY, sharedOperationPolicy } from './shared-operation-policy.js';

function fixture(principalType: 'HUMAN' | 'SERVICE' = 'HUMAN', authorized = true) {
  const calls: string[] = [];
  const query = vi.fn(async (sql: string) => {
    calls.push(sql);
    if (sql.includes('FROM platform_principals pp LEFT JOIN')) return { rows: [{ id: 'principal', principal_type: principalType, principal_code: 'identity', capabilities: [...PLATFORM_MUTATION_CAPABILITIES] }], rowCount: 1 };
    if (sql.includes('JOIN platform_capability_grants')) return { rows: authorized ? [{}] : [], rowCount: authorized ? 1 : 0 };
    return { rows: [], rowCount: 0 };
  });
  const client = { query, release: vi.fn() };
  const pool = { query, connect: vi.fn().mockResolvedValue(client) };
  return { repository: new PlatformAuthorityRepository(pool as any), calls };
}

describe('fixed shared mutation operation policy', () => {
  it('maps every approved operation only to an approved granular capability', () => {
    const mapped = Object.values(SHARED_OPERATION_POLICY).map(([capability]) => capability);
    expect(new Set(mapped)).toEqual(new Set(PLATFORM_MUTATION_CAPABILITIES));
    expect(mapped).not.toContain('PLATFORM_AUTHORITY_MANAGE');
    expect(mapped.some(capability => capability.includes('WILDCARD'))).toBe(false);
  });
  it('keeps exported operation entries and nested principal restrictions runtime-immutable', () => {
    const reference = SHARED_OPERATION_POLICY.REFERENCE_CREATE;
    const manufacturer = SHARED_OPERATION_POLICY.MANUFACTURER_CREATE;
    const synchronization = SHARED_OPERATION_POLICY.SERVICE_BULLETIN_SYNC;

    expect(() => { (reference as any)[0] = 'SERVICE_BULLETIN_SYNC_EXECUTE'; }).toThrow(TypeError);
    expect(() => { (manufacturer as any)[0] = 'REFERENCE_DATA_UPDATE'; }).toThrow(TypeError);
    expect(() => { (reference[1] as any).push('SERVICE'); }).toThrow(TypeError);
    expect(() => { (synchronization[1] as any).splice(0, 2, 'SERVICE'); }).toThrow(TypeError);

    expect(reference).toEqual(['REFERENCE_DATA_CREATE', ['HUMAN']]);
    expect(manufacturer).toEqual(['MANUFACTURER_MASTER_MANAGE', ['HUMAN']]);
    expect(synchronization).toEqual(['SERVICE_BULLETIN_SYNC_EXECUTE', ['HUMAN', 'SERVICE']]);
  });
  it('returns immutable policy copies without exposing registry references', () => {
    const resolved = sharedOperationPolicy('SERVICE_BULLETIN_SYNC');
    expect(resolved.principalTypes).not.toBe(SHARED_OPERATION_POLICY.SERVICE_BULLETIN_SYNC[1]);
    expect(() => { (resolved as any).capability = 'REFERENCE_DATA_CREATE'; }).toThrow(TypeError);
    expect(() => { (resolved.principalTypes as any).pop(); }).toThrow(TypeError);
    expect(resolved).toEqual({ capability: 'SERVICE_BULLETIN_SYNC_EXECUTE', principalTypes: ['HUMAN', 'SERVICE'] });
    expect(sharedOperationPolicy('SERVICE_BULLETIN_SYNC')).toEqual(resolved);
  });
  it('fails closed for unknown operations', () => expect(() => sharedOperationPolicy('UNKNOWN')).toThrow('UNKNOWN_SHARED_MUTATION_OPERATION'));
  it('fixes ordinary and RBAC reference-table policies', () => {
    expect(referenceOperationPolicy('rf_component_type', 'CREATE').capability).toBe('REFERENCE_DATA_CREATE');
    expect(referenceOperationPolicy('rf_asset_type', 'UPDATE').capability).toBe('REFERENCE_DATA_UPDATE');
    expect(referenceOperationPolicy('rf_aircraft_category', 'DEACTIVATE').capability).toBe('REFERENCE_DATA_DEACTIVATE');
    expect(referenceOperationPolicy('rf_role', 'CREATE').capability).toBe('RBAC_DEFINITION_MANAGE');
    expect(REFERENCE_OPERATION_POLICY.rbacTables).toContain('rf_role_permissions');
    expect(() => referenceOperationPolicy('users', 'CREATE')).toThrow('UNKNOWN_REFERENCE_MUTATION_TABLE');
  });
  it('rejects missing, fabricated and tenant/global-role-shaped authority', async () => {
    const { repository } = fixture();
    for (const value of [null, {}, { roles: ['ADMIN', 'LIBRARY_EDIT'] }, { tenantId: 'tenant', roles: ['ADMIN'] }]) {
      await expect(authorizeSharedOperation(repository, value, 'REFERENCE_CREATE')).rejects.toThrow('PLATFORM_AUTHORITY_REQUIRED');
    }
  });
  it('transactionally revalidates repository authority and rejects stale or revoked grants', async () => {
    const valid = fixture();
    const authority = await valid.repository.resolveHuman('user');
    await expect(authorizeSharedOperation(valid.repository, authority, 'MANUFACTURER_CREATE')).resolves.toBeUndefined();
    expect(valid.calls).toEqual(expect.arrayContaining(['BEGIN', 'COMMIT']));
    const stale = fixture('HUMAN', false);
    const staleAuthority = await stale.repository.resolveHuman('user');
    await expect(authorizeSharedOperation(stale.repository, staleAuthority, 'MANUFACTURER_CREATE')).rejects.toThrow('PLATFORM_CAPABILITY_REQUIRED');
    expect(stale.calls).toEqual(expect.arrayContaining(['BEGIN', 'ROLLBACK']));
  });
  it('allows SERVICE only for SB sync and rejects wrong principal type elsewhere', async () => {
    const service = fixture('SERVICE');
    const authority = await service.repository.resolveService('job');
    await expect(authorizeSharedOperation(service.repository, authority, 'SERVICE_BULLETIN_SYNC')).resolves.toBeUndefined();
    await expect(authorizeSharedOperation(service.repository, authority, 'SHARED_MASTER_IMPORT')).rejects.toThrow('PLATFORM_PRINCIPAL_TYPE_REQUIRED');
  });
  it('denies before bootstrap when resolution returns no principal', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const repository = new PlatformAuthorityRepository({ query } as any);
    const authority = await repository.resolveHuman('unbootstrapped-user');
    await expect(authorizeSharedOperation(repository, authority, 'REFERENCE_CREATE')).rejects.toThrow('PLATFORM_AUTHORITY_REQUIRED');
  });
});
