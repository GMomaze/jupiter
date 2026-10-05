import { QueryTypes } from 'sequelize';
import type { Sequelize } from 'sequelize';
import type { ActiveTenantContextRepository } from './active-tenant-context.service.js';
import type {
  TenantContextMembershipStatus,
  TenantContextTenantStatus,
  TenantMembershipRelationship,
} from './active-tenant-context.types.js';

interface MembershipResolverRow {
  membership_id: string;
  membership_tenant_id: string;
  membership_user_id: string;
  membership_status: string;
  tenant_id: string;
  tenant_public_id: string;
  tenant_code: string;
  tenant_display_name: string;
  tenant_status: string;
}

function toRelationship(row: MembershipResolverRow): TenantMembershipRelationship {
  return Object.freeze({
    membership: Object.freeze({
      id: row.membership_id,
      tenantId: row.membership_tenant_id,
      userId: row.membership_user_id,
      status: row.membership_status as TenantContextMembershipStatus,
    }),
    tenant: Object.freeze({
      id: row.tenant_id,
      publicId: row.tenant_public_id,
      code: row.tenant_code,
      displayName: row.tenant_display_name,
      status: row.tenant_status as TenantContextTenantStatus,
    }),
  });
}

/**
 * Pre-context membership resolution repository.
 *
 * tenant_memberships is FORCE RLS (tenant-scoped). This repository reads the
 * authenticated user's membership relationships through the narrow SECURITY
 * DEFINER resolver `public.resolve_authenticated_memberships(uuid)` (owned by
 * jupiter_tenant_owner), which is the ONLY cross-tenant membership discovery
 * boundary. Ordinary tenant-scoped membership operations elsewhere remain
 * governed by RLS.
 */
export class SequelizeActiveTenantContextRepository implements ActiveTenantContextRepository {
  constructor(
    private readonly sequelize: Sequelize,
  ) {}

  private async resolveMemberships(userId: string): Promise<readonly TenantMembershipRelationship[]> {
    const rows = await this.sequelize.query<MembershipResolverRow>(
      `SELECT membership_id, membership_tenant_id, membership_user_id, membership_status,
              tenant_id, tenant_public_id, tenant_code, tenant_display_name, tenant_status
       FROM public.resolve_authenticated_memberships(:userId)`,
      { replacements: { userId }, type: QueryTypes.SELECT },
    );
    return Object.freeze(rows.map(toRelationship));
  }

  async findStoredMembershipRelationship(
    userId: string,
    membershipId: string,
  ): Promise<TenantMembershipRelationship | null> {
    const relationships = await this.resolveMemberships(userId);
    const found = relationships.find((r) => r.membership.id === membershipId);
    return found ?? null;
  }

  async listMembershipRelationshipsForUser(
    userId: string,
  ): Promise<readonly TenantMembershipRelationship[]> {
    return this.resolveMemberships(userId);
  }

  async findMembershipRelationshipForUserAndTenantPublicId(
    userId: string,
    tenantPublicId: string,
  ): Promise<TenantMembershipRelationship | null> {
    const relationships = await this.resolveMemberships(userId);
    const found = relationships.find(
      (r) => r.tenant !== null && r.tenant.publicId === tenantPublicId,
    );
    return found ?? null;
  }
}

