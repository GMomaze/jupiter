import {
  assertTenantQueryAuthority,
  type TenantQueryAuthority,
} from '../tenancy/tenant-query-authority.js';
import type { AuditService } from '../audit/audit.service.js';
import type { Transaction } from 'sequelize';
import type {
  CustomerAircraftLinkCreateInput,
  CustomerAircraftLinkCreateOptions,
  CustomerAircraftLinkTenantRecord,
  CustomerAircraftLinkTenantRepository,
  CustomerWithAircraftLinksProjection,
} from './customer-aircraft-link-tenant.repository.js';

type CanonicalAuditService = Pick<typeof AuditService, 'log'>;

export interface CustomerAircraftLinkServiceCreateOptions {
  readonly transaction: Transaction;
  readonly actorId?: string | null;
}

function withOptionalActorId(
  payload: {
    readonly table_name: 'customer_aircraft_links';
    readonly row_id: string;
    readonly action: 'CREATE';
    readonly reason: 'Current customer relationship added to aircraft';
    readonly new_values: Record<string, unknown>;
  },
  actorId: string | null | undefined,
) {
  return actorId === undefined ? payload : { ...payload, actor_id: actorId };
}

export class CustomerAircraftLinkTenantService {
  constructor(
    private readonly repository: CustomerAircraftLinkTenantRepository,
    private readonly auditService: CanonicalAuditService,
  ) {}

  async createLink(
    authority: TenantQueryAuthority,
    input: CustomerAircraftLinkCreateInput,
    options: CustomerAircraftLinkServiceCreateOptions,
  ): Promise<CustomerAircraftLinkTenantRecord> {
    assertTenantQueryAuthority(authority);
    const repositoryOptions: CustomerAircraftLinkCreateOptions = {
      transaction: options.transaction,
    };
    const link = await this.repository.create(authority, input, repositoryOptions);
    await this.auditService.log(
      withOptionalActorId(
        {
          table_name: 'customer_aircraft_links',
          row_id: link.id,
          action: 'CREATE',
          reason: 'Current customer relationship added to aircraft',
          new_values: link.toJSON(),
        },
        options.actorId,
      ),
      options.transaction,
    );
    return link;
  }

  getLink(
    authority: TenantQueryAuthority,
    linkId: string,
  ): Promise<CustomerAircraftLinkTenantRecord | undefined> {
    assertTenantQueryAuthority(authority);
    return this.repository.getById(authority, linkId);
  }

  getCustomerWithLinks(
    authority: TenantQueryAuthority,
    customerId: string,
  ): Promise<CustomerWithAircraftLinksProjection | undefined> {
    assertTenantQueryAuthority(authority);
    return this.repository.getCustomerWithLinks(authority, customerId);
  }
}
