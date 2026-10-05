import {
  col,
  fn,
  Op,
  where,
  type FindOptions,
  type Transaction,
  type WhereOptions,
} from 'sequelize';
import {
  assertTenantQueryAuthority,
  type TenantQueryAuthority,
} from '../tenancy/tenant-query-authority.js';
import { serializedComponentTenantWhere } from '../tenancy/tenant-query-scope.js';
import type {
  TenantRepositoryOptions,
  TenantUniqueMutationResult,
} from '../tenancy/tenant-root-repository.types.js';

export interface SerializedComponentTenantRecord {
  readonly id: string;
  readonly custodian_tenant_id?: string;
  readonly component_model_id?: string;
  readonly serial_number?: string;
  readonly status?: string;
  readonly [attribute: string]: unknown;
}

export interface SerializedComponentTenantCreateInput {
  readonly component_model_id: string;
  readonly serial_number: string;
  readonly part_number?: string | null;
  readonly status?: string;
  readonly condition?: string | null;
  readonly notes?: string | null;
  readonly custodian_tenant_id?: never;
  readonly custodianTenantId?: never;
  readonly tenant_id?: never;
  readonly tenantId?: never;
}

export type SerializedComponentTenantUpdateInput =
  Partial<SerializedComponentTenantCreateInput>;

export interface SerializedComponentRootUpdateOptions {
  readonly transaction: Transaction;
  readonly lock: NonNullable<FindOptions['lock']>;
}

export interface SerializedComponentModelPort {
  findOne(options: Readonly<Record<string, unknown>>): Promise<SerializedComponentTenantRecord | null>;
  findAll(options: Readonly<Record<string, unknown>>): Promise<readonly SerializedComponentTenantRecord[]>;
  create(
    values: Readonly<Record<string, unknown>>,
    options: Readonly<{ transaction?: Transaction }>,
  ): Promise<SerializedComponentTenantRecord>;
  update(
    values: Readonly<Record<string, unknown>>,
    options: Readonly<Record<string, unknown>>,
  ): Promise<readonly [number] | readonly [number, readonly SerializedComponentTenantRecord[]]>;
}

const CHANGED: TenantUniqueMutationResult = Object.freeze({ outcome: 'CHANGED' });
const UNAVAILABLE: TenantUniqueMutationResult = Object.freeze({ outcome: 'UNAVAILABLE' });
const ownershipAliases = Object.freeze([
  'custodian_tenant_id', 'custodianTenantId', 'tenant_id', 'tenantId',
  'organisation_id', 'organisationId', 'CustodianTenant',
]);
const availableSharedMasterInclude = Object.freeze([
  Object.freeze({
    association: 'ComponentModel',
    attributes: Object.freeze(['id', 'model_name', 'model_code', 'manufacturer_id', 'asset_type_id']),
    required: true,
    include: Object.freeze([
      Object.freeze({ association: 'Manufacturer', attributes: Object.freeze(['id', 'name', 'code']), required: false }),
      Object.freeze({ association: 'AssetType', attributes: Object.freeze(['id', 'code', 'label', 'is_installable_on_aircraft']), required: true, where: Object.freeze({ is_installable_on_aircraft: true }) }),
    ]),
  }),
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

function normalizedSerialPredicate(serialNumber: string): WhereOptions {
  return where(
    fn('upper', fn('btrim', col('serial_number'))),
    serialNumber.trim().toUpperCase(),
  );
}

function identityWhere(componentModelId: string, serialNumber: string): WhereOptions {
  return Object.freeze({
    component_model_id: componentModelId,
    [Op.and]: Object.freeze([normalizedSerialPredicate(serialNumber)]),
  });
}

function values(
  input: SerializedComponentTenantCreateInput | SerializedComponentTenantUpdateInput,
): Readonly<Record<string, unknown>> {
  return {
    component_model_id: input.component_model_id,
    serial_number: input.serial_number?.trim(),
    part_number: input.part_number,
    status: input.status,
    condition: input.condition,
    notes: input.notes,
  };
}

function stableFailure(error: unknown): never {
  if (
    error instanceof Error &&
    ['TENANT_AUTHORITY_REQUIRED', 'TENANT_RESOURCE_UNAVAILABLE', 'TENANT_QUERY_FAILED'].includes(error.message)
  ) throw error;
  throw new Error('TENANT_QUERY_FAILED');
}

export class SerializedComponentTenantRepository {
  readonly repositoryScope = 'TENANT_OWNED_ROOT' as const;

  constructor(private readonly componentModel: SerializedComponentModelPort) {}

  async getById(
    authority: TenantQueryAuthority,
    id: string,
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<SerializedComponentTenantRecord | undefined> {
    assertTenantQueryAuthority(authority);
    try {
      return (await this.componentModel.findOne({
        where: serializedComponentTenantWhere(authority, Object.freeze({ id })),
        ...transactionOption(options),
      })) ?? undefined;
    } catch (error) { return stableFailure(error); }
  }

  async getForUpdate(
    authority: TenantQueryAuthority,
    id: string,
    options: SerializedComponentRootUpdateOptions,
  ): Promise<SerializedComponentTenantRecord | undefined> {
    assertTenantQueryAuthority(authority);
    try {
      return (await this.componentModel.findOne({
        where: serializedComponentTenantWhere(authority, Object.freeze({ id })),
        transaction: options.transaction,
        lock: options.lock,
      })) ?? undefined;
    } catch (error) { return stableFailure(error); }
  }

  async list(
    authority: TenantQueryAuthority,
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<readonly SerializedComponentTenantRecord[]> {
    assertTenantQueryAuthority(authority);
    try {
      return await this.componentModel.findAll({
        where: serializedComponentTenantWhere(authority, Object.freeze({})),
        order: Object.freeze([Object.freeze(['serial_number', 'ASC'])]),
        ...transactionOption(options),
      });
    } catch (error) { return stableFailure(error); }
  }

  async listAvailable(
    authority: TenantQueryAuthority,
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<readonly SerializedComponentTenantRecord[]> {
    assertTenantQueryAuthority(authority);
    try {
      return await this.componentModel.findAll({
        where: serializedComponentTenantWhere(authority, Object.freeze({ status: 'AVAILABLE' })),
        include: availableSharedMasterInclude,
        order: Object.freeze([Object.freeze(['serial_number', 'ASC'])]),
        ...transactionOption(options),
      });
    } catch (error) { return stableFailure(error); }
  }

  async findBySerialIdentity(
    authority: TenantQueryAuthority,
    componentModelId: string,
    serialNumber: string,
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<SerializedComponentTenantRecord | undefined> {
    assertTenantQueryAuthority(authority);
    try {
      return (await this.componentModel.findOne({
        attributes: Object.freeze(['id']),
        where: serializedComponentTenantWhere(authority, identityWhere(componentModelId, serialNumber)),
        ...transactionOption(options),
      })) ?? undefined;
    } catch (error) { return stableFailure(error); }
  }

  async create(
    authority: TenantQueryAuthority,
    input: SerializedComponentTenantCreateInput,
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<SerializedComponentTenantRecord> {
    assertTenantQueryAuthority(authority);
    rejectOwnershipInput(input);
    try {
      return await this.componentModel.create(
        { custodian_tenant_id: authority.tenantId, ...values(input) },
        transactionOption(options),
      );
    } catch (error) { return stableFailure(error); }
  }

  async updateById(
    authority: TenantQueryAuthority,
    id: string,
    changes: SerializedComponentTenantUpdateInput,
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<TenantUniqueMutationResult> {
    assertTenantQueryAuthority(authority);
    rejectOwnershipInput(changes);
    try {
      const [affectedCount] = await this.componentModel.update(values(changes), {
        where: serializedComponentTenantWhere(authority, Object.freeze({ id })),
        ...transactionOption(options),
      });
      return mutationResult(affectedCount);
    } catch (error) { return stableFailure(error); }
  }

  async updateInstallationStatus(
    authority: TenantQueryAuthority,
    id: string,
    status: 'INSTALLED' | 'REMOVED' | 'AVAILABLE',
    options: { readonly transaction: Transaction },
  ): Promise<TenantUniqueMutationResult> {
    assertTenantQueryAuthority(authority);
    try {
      const [affectedCount] = await this.componentModel.update({ status }, {
        where: serializedComponentTenantWhere(authority, Object.freeze({ id })),
        transaction: options.transaction,
      });
      return mutationResult(affectedCount);
    } catch (error) { return stableFailure(error); }
  }
}
