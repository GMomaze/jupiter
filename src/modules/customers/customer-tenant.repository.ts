import {
  col,
  fn,
  where,
  type FindOptions,
  type Transaction,
  type WhereOptions,
} from 'sequelize';
import {
  assertTenantQueryAuthority,
  type TenantQueryAuthority,
} from '../tenancy/tenant-query-authority.js';
import { customerTenantWhere } from '../tenancy/tenant-query-scope.js';
import type {
  TenantRepositoryOptions,
  TenantUniqueMutationResult,
} from '../tenancy/tenant-root-repository.types.js';

export interface CustomerTenantRecord {
  readonly id: string;
  readonly [attribute: string]: unknown;
  toJSON?(): Record<string, unknown>;
}

export interface CustomerRootUpdateOptions {
  readonly transaction: Transaction;
  readonly lock: NonNullable<FindOptions['lock']>;
}

export interface CustomerTenantCreateInput {
  readonly name: string;
  readonly contact_person: string;
  readonly email: string;
  readonly phone: string;
  readonly alternate_phone?: string | null;
  readonly billing_address_line_1?: string | null;
  readonly billing_address_line_2?: string | null;
  readonly billing_city?: string | null;
  readonly billing_state_or_province?: string | null;
  readonly billing_postal_code?: string | null;
  readonly billing_country?: string | null;
  readonly physical_address_line_1?: string | null;
  readonly physical_address_line_2?: string | null;
  readonly physical_city?: string | null;
  readonly physical_state_or_province?: string | null;
  readonly physical_postal_code?: string | null;
  readonly physical_country?: string | null;
  readonly vat_number?: string | null;
  readonly tax_number?: string | null;
  readonly account_reference?: string | null;
  readonly status: 'ACTIVE' | 'INACTIVE';
  readonly notes?: string | null;
  readonly tenant_id?: never;
  readonly tenantId?: never;
  readonly Tenant?: never;
  readonly organisation_id?: never;
  readonly organisationId?: never;
}

export type CustomerTenantUpdateInput = Partial<CustomerTenantCreateInput>;

export interface CustomerTenantListFilter {
  readonly status?: 'ACTIVE' | 'INACTIVE';
}

interface CustomerModelPort {
  findOne(options: Readonly<Record<string, unknown>>): Promise<CustomerTenantRecord | null>;
  findAll(options: Readonly<Record<string, unknown>>): Promise<readonly CustomerTenantRecord[]>;
  count(options: Readonly<Record<string, unknown>>): Promise<number>;
  create(
    values: Readonly<Record<string, unknown>>,
    options: Readonly<{ transaction?: Transaction }>,
  ): Promise<CustomerTenantRecord>;
  update(
    values: Readonly<Record<string, unknown>>,
    options: Readonly<Record<string, unknown>>,
  ): Promise<readonly [number] | readonly [number, readonly CustomerTenantRecord[]]>;
}

const CHANGED: TenantUniqueMutationResult = Object.freeze({ outcome: 'CHANGED' });
const UNAVAILABLE: TenantUniqueMutationResult = Object.freeze({ outcome: 'UNAVAILABLE' });
const ownershipAliases = Object.freeze([
  'tenant_id',
  'tenantId',
  'Tenant',
  'organisation_id',
  'organisationId',
]);
const customerRootAttributes = Object.freeze([
  'id',
  'tenant_id',
  'name',
  'contact_person',
  'email',
  'phone',
  'alternate_phone',
  'billing_address_line_1',
  'billing_address_line_2',
  'billing_city',
  'billing_state_or_province',
  'billing_postal_code',
  'billing_country',
  'physical_address_line_1',
  'physical_address_line_2',
  'physical_city',
  'physical_state_or_province',
  'physical_postal_code',
  'physical_country',
  'vat_number',
  'tax_number',
  'account_reference',
  'status',
  'notes',
  'created_at',
  'updated_at',
]);

function transactionOption(
  options: TenantRepositoryOptions<Transaction>,
): Readonly<{ transaction?: Transaction }> {
  return options.transaction === undefined
    ? Object.freeze({})
    : Object.freeze({ transaction: options.transaction });
}

function rejectOwnershipInput(input: object): void {
  if (ownershipAliases.some((field) => Object.prototype.hasOwnProperty.call(input, field))) {
    throw new Error('TENANT_QUERY_FAILED');
  }
}

function mutationResult(affectedCount: number): TenantUniqueMutationResult {
  if (affectedCount === 0) return UNAVAILABLE;
  if (affectedCount === 1) return CHANGED;
  throw new Error('TENANT_QUERY_FAILED');
}

function accountReferencePredicate(accountReference: string): WhereOptions {
  return where(
    fn('upper', fn('btrim', col('account_reference'))),
    accountReference.trim().toUpperCase(),
  );
}

function stableFailure(error: unknown): never {
  if (
    error instanceof Error &&
    ['TENANT_AUTHORITY_REQUIRED', 'TENANT_RESOURCE_UNAVAILABLE', 'TENANT_QUERY_FAILED'].includes(
      error.message,
    )
  ) {
    throw error;
  }
  throw new Error('TENANT_QUERY_FAILED');
}

function customerValues(input: CustomerTenantCreateInput | CustomerTenantUpdateInput) {
  return {
    name: input.name,
    contact_person: input.contact_person,
    email: input.email,
    phone: input.phone,
    alternate_phone: input.alternate_phone,
    billing_address_line_1: input.billing_address_line_1,
    billing_address_line_2: input.billing_address_line_2,
    billing_city: input.billing_city,
    billing_state_or_province: input.billing_state_or_province,
    billing_postal_code: input.billing_postal_code,
    billing_country: input.billing_country,
    physical_address_line_1: input.physical_address_line_1,
    physical_address_line_2: input.physical_address_line_2,
    physical_city: input.physical_city,
    physical_state_or_province: input.physical_state_or_province,
    physical_postal_code: input.physical_postal_code,
    physical_country: input.physical_country,
    vat_number: input.vat_number,
    tax_number: input.tax_number,
    account_reference: input.account_reference,
    status: input.status,
    notes: input.notes,
  };
}

export class CustomerTenantRepository {
  readonly repositoryScope = 'TENANT_OWNED_ROOT' as const;

  constructor(private readonly customerModel: CustomerModelPort) {}

  async getById(
    authority: TenantQueryAuthority,
    id: string,
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<CustomerTenantRecord | undefined> {
    assertTenantQueryAuthority(authority);
    try {
      return (await this.customerModel.findOne({
        attributes: customerRootAttributes,
        where: customerTenantWhere(authority, Object.freeze({ id })),
        ...transactionOption(options),
      })) ?? undefined;
    } catch (error) {
      return stableFailure(error);
    }
  }

  async getForRootUpdate(
    authority: TenantQueryAuthority,
    id: string,
    options: CustomerRootUpdateOptions,
  ): Promise<CustomerTenantRecord | undefined> {
    assertTenantQueryAuthority(authority);
    try {
      return (await this.customerModel.findOne({
        attributes: customerRootAttributes,
        where: customerTenantWhere(authority, Object.freeze({ id })),
        transaction: options.transaction,
        lock: options.lock,
      })) ?? undefined;
    } catch (error) {
      return stableFailure(error);
    }
  }

  async list(
    authority: TenantQueryAuthority,
    filter: CustomerTenantListFilter = {},
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<readonly CustomerTenantRecord[]> {
    assertTenantQueryAuthority(authority);
    const businessWhere = Object.freeze(
      filter.status === undefined ? {} : { status: filter.status },
    );
    try {
      return await this.customerModel.findAll({
        where: customerTenantWhere(authority, businessWhere),
        order: Object.freeze([Object.freeze(['name', 'ASC'])]),
        ...transactionOption(options),
      });
    } catch (error) {
      return stableFailure(error);
    }
  }

  listActive(
    authority: TenantQueryAuthority,
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<readonly CustomerTenantRecord[]> {
    assertTenantQueryAuthority(authority);
    return this.list(authority, Object.freeze({ status: 'ACTIVE' }), options);
  }

  async count(
    authority: TenantQueryAuthority,
    filter: CustomerTenantListFilter = {},
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<number> {
    assertTenantQueryAuthority(authority);
    const businessWhere = Object.freeze(
      filter.status === undefined ? {} : { status: filter.status },
    );
    try {
      return await this.customerModel.count({
        where: customerTenantWhere(authority, businessWhere),
        ...transactionOption(options),
      });
    } catch (error) {
      return stableFailure(error);
    }
  }

  async accountReferenceExists(
    authority: TenantQueryAuthority,
    accountReference: string | null | undefined,
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<boolean> {
    assertTenantQueryAuthority(authority);
    if (accountReference == null || accountReference.trim() === '') return false;
    try {
      return Boolean(await this.customerModel.findOne({
        attributes: Object.freeze(['id']),
        where: customerTenantWhere(authority, accountReferencePredicate(accountReference)),
        ...transactionOption(options),
      }));
    } catch (error) {
      return stableFailure(error);
    }
  }

  async create(
    authority: TenantQueryAuthority,
    input: CustomerTenantCreateInput,
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<CustomerTenantRecord> {
    assertTenantQueryAuthority(authority);
    rejectOwnershipInput(input);
    try {
      return await this.customerModel.create(
        { tenant_id: authority.tenantId, ...customerValues(input) },
        transactionOption(options),
      );
    } catch (error) {
      return stableFailure(error);
    }
  }

  async updateById(
    authority: TenantQueryAuthority,
    id: string,
    changes: CustomerTenantUpdateInput,
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<TenantUniqueMutationResult> {
    assertTenantQueryAuthority(authority);
    rejectOwnershipInput(changes);
    try {
      const [affectedCount] = await this.customerModel.update(customerValues(changes), {
        where: customerTenantWhere(authority, Object.freeze({ id })),
        ...transactionOption(options),
      });
      return mutationResult(affectedCount);
    } catch (error) {
      return stableFailure(error);
    }
  }
}
