import type { Transaction } from 'sequelize';
import {
  assertTenantQueryAuthority,
  type TenantQueryAuthority,
} from '../tenancy/tenant-query-authority.js';
import {
  aircraftTenantWhere,
  customerTenantWhere,
} from '../tenancy/tenant-query-scope.js';
import type { TenantRepositoryOptions } from '../tenancy/tenant-root-repository.types.js';

export const CUSTOMER_AIRCRAFT_RELATIONSHIP_TYPES = Object.freeze([
  'OWNER',
  'CO_OWNER',
  'OPERATOR',
  'BILLING_CUSTOMER',
  'MANAGEMENT_COMPANY',
  'CONTACT_ONLY',
] as const);

export type CustomerAircraftRelationshipType =
  (typeof CUSTOMER_AIRCRAFT_RELATIONSHIP_TYPES)[number];

export interface CustomerAircraftLinkTenantRecord {
  readonly id: string;
  readonly customer_id: string;
  readonly aircraft_id: string;
  readonly relationship_type: CustomerAircraftRelationshipType;
  readonly is_current: boolean;
  readonly start_date: string;
  readonly end_date: string | null;
  readonly notes: string | null;
  readonly [attribute: string]: unknown;
  toJSON(): Record<string, unknown>;
}

export interface CustomerAircraftLinkCreateInput {
  readonly customerId: string;
  readonly aircraftId: string;
  readonly relationshipType: CustomerAircraftRelationshipType;
  readonly startDate: string;
  readonly notes?: string | null;
  readonly tenant_id?: never;
  readonly tenantId?: never;
  readonly customer_tenant_id?: never;
  readonly aircraft_tenant_id?: never;
}

export interface CustomerAircraftLinkCreateOptions {
  readonly transaction: Transaction;
}

export interface CustomerWithAircraftLinksProjection {
  readonly customer: CustomerTenantRoot;
  readonly links: readonly CustomerAircraftLinkTenantRecord[];
}

interface CustomerTenantRoot {
  readonly id: string;
  readonly [attribute: string]: unknown;
}

interface AircraftTenantRoot {
  readonly id: string;
}

interface CustomerRootRepositoryPort {
  getById(
    authority: TenantQueryAuthority,
    id: string,
    options?: TenantRepositoryOptions<Transaction>,
  ): Promise<CustomerTenantRoot | undefined>;
}

interface AircraftRootRepositoryPort {
  resolveOwnedRoot(
    authority: TenantQueryAuthority,
    id: string,
    options?: TenantRepositoryOptions<Transaction>,
  ): Promise<AircraftTenantRoot | undefined>;
}

interface LinkModelPort {
  findOne(options: Readonly<Record<string, unknown>>): Promise<CustomerAircraftLinkTenantRecord | null>;
  findAll(options: Readonly<Record<string, unknown>>): Promise<readonly CustomerAircraftLinkTenantRecord[]>;
  create(
    values: Readonly<Record<string, unknown>>,
    options: Readonly<{ transaction: Transaction }>,
  ): Promise<CustomerAircraftLinkTenantRecord>;
}

const ownershipAliases = Object.freeze([
  'tenant_id',
  'tenantId',
  'customer_tenant_id',
  'aircraft_tenant_id',
  'organisation_id',
  'organisationId',
]);

function transactionOption(
  options: TenantRepositoryOptions<Transaction>,
): Readonly<{ transaction?: Transaction }> {
  return options.transaction === undefined ? {} : { transaction: options.transaction };
}

function rejectOwnershipInput(input: object): void {
  if (ownershipAliases.some((field) => Object.prototype.hasOwnProperty.call(input, field))) {
    throw new Error('TENANT_QUERY_FAILED');
  }
}

function stableFailure(error: unknown): never {
  if (
    error instanceof Error &&
    [
      'TENANT_AUTHORITY_REQUIRED',
      'TENANT_RESOURCE_UNAVAILABLE',
      'CURRENT_CUSTOMER_ALREADY_ASSIGNED',
      'TENANT_QUERY_FAILED',
    ].includes(error.message)
  ) {
    throw error;
  }
  throw new Error('TENANT_QUERY_FAILED');
}

export class CustomerAircraftLinkTenantRepository {
  readonly repositoryScope = 'TENANT_OWNED_RELATIONSHIP' as const;

  constructor(
    private readonly linkModel: LinkModelPort,
    private readonly customerRoots: CustomerRootRepositoryPort,
    private readonly aircraftRoots: AircraftRootRepositoryPort,
    private readonly customerAssociation: object,
    private readonly aircraftAssociation: object,
  ) {}

  private fixedRootIncludes(authority: TenantQueryAuthority) {
    return Object.freeze([
      Object.freeze({
        model: this.customerAssociation,
        as: 'Customer',
        attributes: Object.freeze(['id']),
        required: true,
        where: customerTenantWhere(authority, Object.freeze({})),
      }),
      Object.freeze({
        model: this.aircraftAssociation,
        as: 'Aircraft',
        attributes: Object.freeze(['id', 'registration', 'serial_number']),
        required: true,
        where: aircraftTenantWhere(authority, Object.freeze({})),
      }),
    ]);
  }

  async getById(
    authority: TenantQueryAuthority,
    linkId: string,
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<CustomerAircraftLinkTenantRecord | undefined> {
    assertTenantQueryAuthority(authority);
    try {
      return (await this.linkModel.findOne({
        where: Object.freeze({ id: linkId }),
        include: this.fixedRootIncludes(authority),
        ...transactionOption(options),
      })) ?? undefined;
    } catch (error) {
      return stableFailure(error);
    }
  }

  async getCustomerWithLinks(
    authority: TenantQueryAuthority,
    customerId: string,
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<CustomerWithAircraftLinksProjection | undefined> {
    assertTenantQueryAuthority(authority);
    try {
      const customer = await this.customerRoots.getById(authority, customerId, options);
      if (!customer) return undefined;
      const links = await this.linkModel.findAll({
        where: Object.freeze({ customer_id: customerId }),
        include: this.fixedRootIncludes(authority),
        order: Object.freeze([
          Object.freeze(['is_current', 'DESC']),
          Object.freeze(['start_date', 'DESC']),
        ]),
        ...transactionOption(options),
      });
      return Object.freeze({ customer, links: Object.freeze([...links]) });
    } catch (error) {
      return stableFailure(error);
    }
  }

  async create(
    authority: TenantQueryAuthority,
    input: CustomerAircraftLinkCreateInput,
    options: CustomerAircraftLinkCreateOptions,
  ): Promise<CustomerAircraftLinkTenantRecord> {
    assertTenantQueryAuthority(authority);
    rejectOwnershipInput(input);
    try {
      const scopedOptions = Object.freeze({ transaction: options.transaction });
      const customer = await this.customerRoots.getById(
        authority,
        input.customerId,
        scopedOptions,
      );
      const aircraft = await this.aircraftRoots.resolveOwnedRoot(
        authority,
        input.aircraftId,
        scopedOptions,
      );
      if (!customer || !aircraft) throw new Error('TENANT_RESOURCE_UNAVAILABLE');

      const existing = await this.linkModel.findOne({
        where: Object.freeze({
          customer_id: customer.id,
          aircraft_id: aircraft.id,
          relationship_type: input.relationshipType,
          is_current: true,
        }),
        include: this.fixedRootIncludes(authority),
        transaction: options.transaction,
      });
      if (existing) throw new Error('CURRENT_CUSTOMER_ALREADY_ASSIGNED');

      return await this.linkModel.create(
        {
          customer_id: customer.id,
          aircraft_id: aircraft.id,
          relationship_type: input.relationshipType,
          is_current: true,
          start_date: input.startDate,
          end_date: null,
          notes: input.notes ?? null,
        },
        { transaction: options.transaction },
      );
    } catch (error) {
      return stableFailure(error);
    }
  }
}
