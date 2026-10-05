import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, transaction } = vi.hoisted(() => ({
  query: vi.fn(),
  transaction: vi.fn(async (work: (tx: object) => Promise<unknown>) => work({ id: 'tx' })),
}));
vi.mock('../../config/database.js', () => ({ default: { query, transaction } }));

import { PlatformAuthorityRepository } from './platform-authority.repository.js';
import {
  executeAuthoritativePlatformMutation,
  platformMutationEvidence,
  requirePlatformMutationOperations,
} from './authoritative-platform-mutation.js';

function repository(principalType: 'HUMAN' | 'SERVICE' = 'HUMAN') {
  const poolQuery = vi.fn().mockResolvedValue({ rows: [{
    id: 'principal-1', principal_type: principalType, principal_code: 'actor-1',
    capabilities: ['REGULATORY_MASTER_MANAGE'],
  }] });
  return new PlatformAuthorityRepository({ query: poolQuery } as any);
}

describe('L2-2C authoritative mutation boundary', () => {
  beforeEach(() => {
    query.mockReset();
    transaction.mockClear();
    query.mockResolvedValueOnce([[{ allowed: 1 }]]).mockResolvedValueOnce([[], 1]);
  });

  it('requires repository-issued HUMAN authority and the writer-owned exact operation', async () => {
    const authority = await repository().resolveHuman('user-1');
    const evidence = platformMutationEvidence(authority, ['REGULATORY_MASTER_CREATE'], {
      reason: 'test', correlationId: '18c616b7-4a96-42e7-9cb8-8a4510af51c0',
      source: { kind: 'TEST' }, resourceType: 'airworthiness_directive',
    });
    const fixed = requirePlatformMutationOperations(evidence, ['REGULATORY_MASTER_CREATE']);
    await expect(executeAuthoritativePlatformMutation(fixed, async (_transaction, audit) => {
      audit.setBefore({ id: 'ad-1', title: 'before' });
      return { id: 'ad-1', title: 'after' };
    }, value => ({ resourceId: value.id, after: value })))
      .resolves.toEqual({ id: 'ad-1', title: 'after' });
    expect(query).toHaveBeenCalledTimes(2);
    expect(String(query.mock.calls[1]?.[0])).toContain('platform_global_audit_log');
    expect(query.mock.calls[1]?.[1]?.replacements).toMatchObject({
      oldValues: JSON.stringify({ id: 'ad-1', title: 'before' }),
      newValues: JSON.stringify({ id: 'ad-1', title: 'after' }),
    });
  });

  it('rejects fabricated, SERVICE, and operation-substitution evidence before mutation', async () => {
    expect(() => platformMutationEvidence({ principalId: 'fake' }, ['REGULATORY_MASTER_CREATE'], {
      reason: 'x', correlationId: '18c616b7-4a96-42e7-9cb8-8a4510af51c0', source: {}, resourceType: 'x',
    })).toThrow('PLATFORM_AUTHORITY_REQUIRED');
    const service = await repository('SERVICE').resolveService('worker');
    expect(() => platformMutationEvidence(service, ['REGULATORY_MASTER_CREATE'], {
      reason: 'x', correlationId: '18c616b7-4a96-42e7-9cb8-8a4510af51c0', source: {}, resourceType: 'x',
    })).toThrow('PLATFORM_PRINCIPAL_TYPE_REQUIRED');
    const human = await repository().resolveHuman('user-1');
    const evidence = platformMutationEvidence(human, ['REGULATORY_MASTER_CREATE'], {
      reason: 'x', correlationId: '18c616b7-4a96-42e7-9cb8-8a4510af51c0', source: {}, resourceType: 'x',
    });
    expect(() => requirePlatformMutationOperations(evidence, ['REGULATORY_RELATIONSHIP_MUTATE']))
      .toThrow('PLATFORM_MUTATION_OPERATION_MISMATCH');
  });

  it('does not append success audit when mutation fails and surfaces audit failure', async () => {
    const authority = await repository().resolveHuman('user-1');
    const evidence = platformMutationEvidence(authority, ['REGULATORY_MASTER_CREATE'], {
      reason: 'x', correlationId: '18c616b7-4a96-42e7-9cb8-8a4510af51c0', source: {}, resourceType: 'x',
    });
    await expect(executeAuthoritativePlatformMutation(evidence, async () => { throw new Error('MUTATION_FAILED'); }))
      .rejects.toThrow('MUTATION_FAILED');
    expect(query).toHaveBeenCalledTimes(1);

    query.mockReset();
    query.mockResolvedValueOnce([[{ allowed: 1 }]]).mockRejectedValueOnce(new Error('AUDIT_FAILED'));
    await expect(executeAuthoritativePlatformMutation(evidence, async () => ({ id: 'x' })))
      .rejects.toThrow('AUDIT_FAILED');
  });

  it('records authoritative delete before-state and canonical null after-state', async () => {
    const authority = await repository().resolveHuman('user-1');
    const evidence = platformMutationEvidence(authority, ['MAINTENANCE_MASTER_DELETE'], {
      reason: 'delete', correlationId: '18c616b7-4a96-42e7-9cb8-8a4510af51c0',
      source: { kind: 'TEST' }, resourceType: 'maintenance_requirement', resourceId: 'requirement-1',
    });
    await executeAuthoritativePlatformMutation(evidence, async (_transaction, audit) => {
      audit.setBefore({ id: 'requirement-1', title: 'before' });
      return true;
    }, () => ({ resourceId: 'requirement-1', after: null }));
    expect(query.mock.calls[1]?.[1]?.replacements).toMatchObject({
      oldValues: JSON.stringify({ id: 'requirement-1', title: 'before' }),
      newValues: null,
    });
  });
});
