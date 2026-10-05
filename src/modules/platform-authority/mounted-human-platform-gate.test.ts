import { describe, expect, it, vi } from 'vitest';
import { PLATFORM_MUTATION_CAPABILITIES } from './platform-authority.js';
import { PlatformAuthorityRepository } from './platform-authority.repository.js';
import { MOUNTED_HUMAN_MUTATION_POLICY, requireMountedHumanPlatformGate, type MountedSharedRouter } from './mounted-human-platform-gate.js';

function repositoryFixture(options: { principal?: boolean; authorized?: boolean; principalType?: 'HUMAN' | 'SERVICE'; capabilities?: readonly string[] } = {}) {
  const capabilities = options.capabilities ?? PLATFORM_MUTATION_CAPABILITIES;
  const query = vi.fn(async (sql: string, values?: unknown[]) => {
    if (sql.includes('FROM platform_principals pp LEFT JOIN')) return options.principal === false
      ? { rows: [], rowCount: 0 }
      : { rows: [{ id: 'principal', principal_type: options.principalType ?? 'HUMAN', principal_code: 'user', capabilities: [...capabilities] }], rowCount: 1 };
    if (sql.includes('JOIN platform_capability_grants')) {
      const allowed = options.authorized !== false && capabilities.includes(String(values?.[2]));
      return allowed ? { rows: [{}], rowCount: 1 } : { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  });
  const client = { query, release: vi.fn() };
  return new PlatformAuthorityRepository({ query, connect: vi.fn().mockResolvedValue(client) } as any);
}

async function invoke(repository: PlatformAuthorityRepository, router: MountedSharedRouter, method: string, path: string, user: unknown = { id: 'user' }) {
  const req = { method, path, user } as any;
  const res = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() } as any;
  const next = vi.fn();
  await requireMountedHumanPlatformGate(repository, router)(req, res, next);
  return { req, res, next };
}

describe('L2-2B mounted HUMAN platform gates', () => {
  it('keeps the mounted registry fixed and includes the D2 Manufacturer routes', () => {
    expect(Object.isFrozen(MOUNTED_HUMAN_MUTATION_POLICY)).toBe(true);
    expect(Object.values(MOUNTED_HUMAN_MUTATION_POLICY).every(Object.isFrozen)).toBe(true);
    expect(MOUNTED_HUMAN_MUTATION_POLICY.LIBRARY.some(entry => entry.pattern.test('/manufacturers'))).toBe(true);
    expect(MOUNTED_HUMAN_MUTATION_POLICY.LIBRARY.some(entry => entry.pattern.test('/manufacturers/id/update'))).toBe(true);
  });

  it.each([
    ['LIBRARY', '/asset-types'], ['LIBRARY', '/ads'], ['LIBRARY', '/sbs'], ['LIBRARY', '/sids'],
    ['LIBRARY', '/model'], ['LIBRARY', '/requirement'], ['LIBRARY', '/tasks/import/commit'],
    ['LIBRARY', '/life-limit-governance/proposals'], ['SERVICE_BULLETINS', '/'], ['SB_SYNC', '/sync'],
  ] as const)('allows repository-issued HUMAN authority through %s %s', async (router, path) => {
    const result = await invoke(repositoryFixture(), router, 'POST', path);
    expect(result.next).toHaveBeenCalledOnce();
    expect(result.req.platformAuthority).toBeDefined();
  });

  it.each([
    ['missing platform principal', repositoryFixture({ principal: false }), { id: 'tenant-admin', roles: ['ADMIN', 'LIBRARY_EDIT'] }],
    ['wrong or revoked capability', repositoryFixture({ authorized: false }), { id: 'user' }],
    ['authentication only', repositoryFixture(), {}],
  ])('denies %s without reaching the handler', async (_label, repository, user) => {
    const result = await invoke(repository, 'LIBRARY', 'POST', '/asset-types', user);
    expect(result.res.status).toHaveBeenCalledWith(403);
    expect(result.next).not.toHaveBeenCalled();
  });

  it('rejects fabricated and SERVICE authorities on HUMAN routes', async () => {
    const fabricated = repositoryFixture();
    vi.spyOn(fabricated, 'resolveHuman').mockResolvedValue({ principalId: 'fake', principalType: 'HUMAN' } as any);
    expect((await invoke(fabricated, 'LIBRARY', 'POST', '/asset-types')).res.status).toHaveBeenCalledWith(403);
    const source = repositoryFixture({ principalType: 'SERVICE' });
    const service = await source.resolveService('job');
    vi.spyOn(source, 'resolveHuman').mockResolvedValue(service);
    expect((await invoke(source, 'LIBRARY', 'POST', '/asset-types')).res.status).toHaveBeenCalledWith(403);
  });

  it.each([
    [['SHARED_MASTER_IMPORT', 'REGULATORY_RELATIONSHIP_MANAGE'], false],
    [['SHARED_MASTER_IMPORT', 'REGULATORY_MASTER_MANAGE'], false],
    [['REGULATORY_RELATIONSHIP_MANAGE', 'REGULATORY_MASTER_MANAGE'], false],
    [['SHARED_MASTER_IMPORT', 'REGULATORY_RELATIONSHIP_MANAGE', 'REGULATORY_MASTER_MANAGE'], true],
  ] as const)('requires every SID-import capability: %j', async (capabilities, allowed) => {
    const result = await invoke(repositoryFixture({ capabilities }), 'LIBRARY', 'POST', '/model/id/sids/import');
    if (allowed) expect(result.next).toHaveBeenCalledOnce();
    else expect(result.res.status).toHaveBeenCalledWith(403);
  });

  it('denies repository-issued SERVICE authority for SID import', async () => {
    const repository = repositoryFixture({ principalType: 'SERVICE' });
    const authority = await repository.resolveService('job');
    vi.spyOn(repository, 'resolveHuman').mockResolvedValue(authority);
    expect((await invoke(repository, 'LIBRARY', 'POST', '/model/id/sids/import')).res.status).toHaveBeenCalledWith(403);
  });

  it.each([
    [['SHARED_MASTER_IMPORT', 'REGULATORY_MASTER_MANAGE'], false],
    [['SHARED_MASTER_IMPORT', 'REGULATORY_RELATIONSHIP_MANAGE'], false],
    [['REGULATORY_MASTER_MANAGE', 'REGULATORY_RELATIONSHIP_MANAGE'], false],
    [['SHARED_MASTER_IMPORT', 'REGULATORY_MASTER_MANAGE', 'REGULATORY_RELATIONSHIP_MANAGE'], true],
  ] as const)('requires every AD-import capability: %j', async (capabilities, allowed) => {
    const result = await invoke(repositoryFixture({ capabilities }), 'LIBRARY', 'POST', '/ads/import/commit');
    if (allowed) expect(result.next).toHaveBeenCalledOnce();
    else expect(result.res.status).toHaveBeenCalledWith(403);
  });

  it('denies repository-issued SERVICE authority for AD import', async () => {
    const repository = repositoryFixture({ principalType: 'SERVICE' });
    const authority = await repository.resolveService('job');
    vi.spyOn(repository, 'resolveHuman').mockResolvedValue(authority);
    expect((await invoke(repository, 'LIBRARY', 'POST', '/ads/import/commit')).res.status).toHaveBeenCalledWith(403);
  });

  it.each([
    [['SHARED_MASTER_IMPORT', 'REGULATORY_MASTER_MANAGE'], false],
    [['SHARED_MASTER_IMPORT', 'REGULATORY_RELATIONSHIP_MANAGE'], false],
    [['REGULATORY_MASTER_MANAGE', 'REGULATORY_RELATIONSHIP_MANAGE'], false],
    [['SHARED_MASTER_IMPORT', 'REGULATORY_MASTER_MANAGE', 'REGULATORY_RELATIONSHIP_MANAGE'], true],
  ] as const)('requires every SB-import capability: %j', async (capabilities, allowed) => {
    const result = await invoke(repositoryFixture({ capabilities }), 'LIBRARY', 'POST', '/sbs/import/commit');
    if (allowed) expect(result.next).toHaveBeenCalledOnce();
    else expect(result.res.status).toHaveBeenCalledWith(403);
  });

  it('denies repository-issued SERVICE authority for SB import', async () => {
    const repository = repositoryFixture({ principalType: 'SERVICE' });
    const authority = await repository.resolveService('job');
    vi.spyOn(repository, 'resolveHuman').mockResolvedValue(authority);
    expect((await invoke(repository, 'LIBRARY', 'POST', '/sbs/import/commit')).res.status).toHaveBeenCalledWith(403);
  });

  it.each([
    ['LIBRARY', '/service-bulletin'],
    ['SERVICE_BULLETINS', '/'],
  ] as const)('requires master and relationship authority for %s %s', async (router, path) => {
    for (const capabilities of [['REGULATORY_MASTER_MANAGE'], ['REGULATORY_RELATIONSHIP_MANAGE']] as const) {
      expect((await invoke(repositoryFixture({ capabilities }), router, 'POST', path)).res.status).toHaveBeenCalledWith(403);
    }
    expect((await invoke(repositoryFixture({ capabilities: ['REGULATORY_MASTER_MANAGE', 'REGULATORY_RELATIONSHIP_MANAGE'] }), router, 'POST', path)).next).toHaveBeenCalledOnce();
  });

  it.each([
    ['LIBRARY', '/service-bulletin'],
    ['SERVICE_BULLETINS', '/'],
  ] as const)('denies SERVICE authority for model-bound SB creation at %s %s', async (router, path) => {
    const repository = repositoryFixture({ principalType: 'SERVICE' });
    const authority = await repository.resolveService('job');
    vi.spyOn(repository, 'resolveHuman').mockResolvedValue(authority);
    expect((await invoke(repository, router, 'POST', path)).res.status).toHaveBeenCalledWith(403);
  });

  it('fails closed for unallowlisted reference tables and leaves reads unchanged', async () => {
    expect((await invoke(repositoryFixture(), 'REFERENCE', 'POST', '/users/gap-create')).res.status).toHaveBeenCalledWith(403);
    expect((await invoke(repositoryFixture(), 'LIBRARY', 'GET', '/ads')).next).toHaveBeenCalledOnce();
    expect((await invoke(repositoryFixture({ capabilities: [] }), 'LIBRARY', 'POST', '/manufacturers')).res.status).toHaveBeenCalledWith(403);
    expect((await invoke(repositoryFixture({ capabilities: [] }), 'LIBRARY', 'POST', '/manufacturers/id/update')).res.status).toHaveBeenCalledWith(403);
  });
});
