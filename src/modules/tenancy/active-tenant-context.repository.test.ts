import { describe, expect, it, vi } from 'vitest';
import { SequelizeActiveTenantContextRepository } from './active-tenant-context.repository.js';

function models() {
  const sequelize = { query: vi.fn() };
  const repository = new SequelizeActiveTenantContextRepository(sequelize as never);
  return { sequelize, repository };
}

const row = {
  membership_id: 'membership-1',
  membership_tenant_id: 'tenant-1',
  membership_user_id: 'user-1',
  membership_status: 'ACTIVE',
  tenant_id: 'tenant-1',
  tenant_public_id: 'public-1',
  tenant_code: 'ORG_ONE',
  tenant_display_name: 'Organisation One',
  tenant_status: 'ACTIVE',
};

const relationship = {
  membership: { id: 'membership-1', tenantId: 'tenant-1', userId: 'user-1', status: 'ACTIVE' },
  tenant: { id: 'tenant-1', publicId: 'public-1', code: 'ORG_ONE', displayName: 'Organisation One', status: 'ACTIVE' },
};

describe('SequelizeActiveTenantContextRepository', () => {
  it('resolves stored membership through the narrow resolver function', async () => {
    const { sequelize, repository } = models();
    sequelize.query.mockResolvedValue([row]);

    await expect(repository.findStoredMembershipRelationship('user-1', 'membership-1'))
      .resolves.toEqual(relationship);

    expect(sequelize.query).toHaveBeenCalledOnce();
    const [sql, options] = sequelize.query.mock.calls[0];
    expect(String(sql)).toContain('public.resolve_authenticated_memberships(:userId)');
    expect(options.replacements).toEqual({ userId: 'user-1' });
  });

  it('returns null when the stored membership does not belong to the user', async () => {
    const { sequelize, repository } = models();
    sequelize.query.mockResolvedValue([{ ...row, membership_id: 'membership-2' }]);

    await expect(repository.findStoredMembershipRelationship('user-1', 'membership-1'))
      .resolves.toBeNull();
  });

  it('lists the user membership relationships as a frozen collection', async () => {
    const { sequelize, repository } = models();
    sequelize.query.mockResolvedValue([row, { ...row, membership_id: 'membership-2' }]);

    const result = await repository.listMembershipRelationshipsForUser('user-1');
    expect(result).toHaveLength(2);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result[0]).toEqual(relationship);
  });

  it('resolves a public ID only inside the authenticated user relationship', async () => {
    const { sequelize, repository } = models();
    sequelize.query.mockResolvedValue([row]);

    await expect(repository.findMembershipRelationshipForUserAndTenantPublicId('user-1', 'public-1'))
      .resolves.toEqual(relationship);
    await expect(repository.findMembershipRelationshipForUserAndTenantPublicId('user-1', 'foreign'))
      .resolves.toBeNull();
  });
});

