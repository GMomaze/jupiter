import {
  col,
  fn,
  where,
  type FindOptions,
  type SaveOptions,
  type Transaction,
  type WhereOptions,
} from 'sequelize';
import {
  assertTenantQueryAuthority,
  type TenantQueryAuthority,
} from '../tenancy/tenant-query-authority.js';
import {
  aircraftTenantWhere,
  type TenantScopedWhere,
} from '../tenancy/tenant-query-scope.js';
import type {
  TenantRepositoryOptions,
  TenantUniqueMutationResult,
} from '../tenancy/tenant-root-repository.types.js';

export interface AircraftTenantRecord {
  readonly id: string;
  readonly model_id?: unknown;
  readonly registration?: string;
  readonly total_time_hours?: number;
  readonly total_time_cycles?: number;
  toJSON?(): Record<string, unknown>;
}

export interface AircraftTenantCreateInput {
  readonly registration: string;
  readonly serial_number: string;
  readonly model_id: string;
  readonly category_id: string;
  readonly status?: string;
  readonly total_time_hours?: number;
  readonly total_time_cycles?: number;
  readonly loaded_into_system_at?: string | null;
  readonly manufacture_date?: string | null;
  readonly tcds_number?: string | null;
  readonly tcds_url?: string | null;
  readonly photo_url?: string | null;
  readonly version?: number;
  readonly tenant_id?: never;
  readonly tenantId?: never;
}

export interface AircraftTenantUpdateInput {
  readonly registration?: string;
  readonly serial_number?: string;
  readonly model_id?: string;
  readonly category_id?: string;
  readonly total_time_hours?: number;
  readonly total_time_cycles?: number;
  readonly loaded_into_system_at?: string | null;
  readonly manufacture_date?: string | null;
  readonly tcds_number?: string | null;
  readonly tcds_url?: string | null;
  readonly photo_url?: string | null;
  readonly version?: number;
  readonly tenant_id?: never;
  readonly tenantId?: never;
}

export interface AircraftTenantListFilter {
  readonly status?: string;
}

export interface AircraftLifecycleUpdateOptions {
  readonly transaction: Transaction;
  readonly lock: NonNullable<FindOptions['lock']>;
}

export interface AircraftLifecycleInstance extends AircraftTenantRecord {
  status: string;
  version: number;
  save(options?: SaveOptions): Promise<this>;
}

export interface AircraftRootUpdateInstance extends AircraftLifecycleInstance {
  registration: string;
  serial_number: string;
  model_id: string;
  category_id: string;
  total_time_hours: number;
  total_time_cycles: number;
  loaded_into_system_at: string | null;
  manufacture_date: string | null;
  tcds_number: string | null;
  tcds_url: string | null;
  photo_url: string | null;
}

export interface OwnedAircraftRoot {
  readonly id: string;
}

export interface AircraftModelPort {
  findOne(
    options: Readonly<{
      where: TenantScopedWhere;
      transaction: Transaction;
      lock: NonNullable<FindOptions['lock']>;
    }>,
  ): Promise<AircraftRootUpdateInstance | null>;
  findOne(options: Readonly<Record<string, unknown>>): Promise<AircraftTenantRecord | null>;
  findAll(options: Readonly<Record<string, unknown>>): Promise<readonly AircraftTenantRecord[]>;
  count(options: Readonly<Record<string, unknown>>): Promise<number>;
  create(
    values: Readonly<Record<string, unknown>>,
    options: Readonly<{ transaction?: Transaction }>,
  ): Promise<AircraftTenantRecord>;
  update(
    values: Readonly<Record<string, unknown>>,
    options: Readonly<Record<string, unknown>>,
  ): Promise<readonly [number] | readonly [number, readonly AircraftTenantRecord[]]>;
}

const CHANGED: TenantUniqueMutationResult = Object.freeze({ outcome: 'CHANGED' });
const UNAVAILABLE: TenantUniqueMutationResult = Object.freeze({ outcome: 'UNAVAILABLE' });
const ownershipAliases = Object.freeze([
  'tenant_id',
  'tenantId',
  'organisation_id',
  'organisationId',
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

function registrationPredicate(registration: string): WhereOptions {
  const normalized = registration.trim().toUpperCase();
  return where(fn('upper', fn('btrim', col('registration'))), normalized);
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

export class AircraftTenantRepository {
  readonly repositoryScope = 'TENANT_OWNED_ROOT' as const;

  constructor(private readonly aircraftModel: AircraftModelPort) {}

  async getById(
    authority: TenantQueryAuthority,
    id: string,
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<AircraftTenantRecord | undefined> {
    assertTenantQueryAuthority(authority);
    try {
      return (
        (await this.aircraftModel.findOne({
          where: aircraftTenantWhere(authority, Object.freeze({ id })),
          ...transactionOption(options),
        })) ?? undefined
      );
    } catch (error) {
      return stableFailure(error);
    }
  }

  async getByRegistration(
    authority: TenantQueryAuthority,
    registration: string,
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<AircraftTenantRecord | undefined> {
    assertTenantQueryAuthority(authority);
    try {
      return (
        (await this.aircraftModel.findOne({
          where: aircraftTenantWhere(authority, registrationPredicate(registration)),
          ...transactionOption(options),
        })) ?? undefined
      );
    } catch (error) {
      return stableFailure(error);
    }
  }

  async registrationExists(
    authority: TenantQueryAuthority,
    registration: string,
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<boolean> {
    assertTenantQueryAuthority(authority);
    return Boolean(await this.getByRegistration(authority, registration, options));
  }

  async list(
    authority: TenantQueryAuthority,
    filter: AircraftTenantListFilter = {},
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<readonly AircraftTenantRecord[]> {
    assertTenantQueryAuthority(authority);
    const businessWhere = Object.freeze(
      filter.status === undefined ? {} : { status: filter.status },
    );
    try {
      return await this.aircraftModel.findAll({
        where: aircraftTenantWhere(authority, businessWhere),
        order: Object.freeze([Object.freeze(['registration', 'ASC'])]),
        ...transactionOption(options),
      });
    } catch (error) {
      return stableFailure(error);
    }
  }

  async count(
    authority: TenantQueryAuthority,
    filter: AircraftTenantListFilter = {},
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<number> {
    assertTenantQueryAuthority(authority);
    const businessWhere = Object.freeze(
      filter.status === undefined ? {} : { status: filter.status },
    );
    try {
      return await this.aircraftModel.count({
        where: aircraftTenantWhere(authority, businessWhere),
        ...transactionOption(options),
      });
    } catch (error) {
      return stableFailure(error);
    }
  }

  async create(
    authority: TenantQueryAuthority,
    input: AircraftTenantCreateInput,
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<AircraftTenantRecord> {
    assertTenantQueryAuthority(authority);
    rejectOwnershipInput(input);
    const values = {
      tenant_id: authority.tenantId,
      registration: input.registration,
      serial_number: input.serial_number,
      model_id: input.model_id,
      category_id: input.category_id,
      status: input.status,
      total_time_hours: input.total_time_hours,
      total_time_cycles: input.total_time_cycles,
      loaded_into_system_at: input.loaded_into_system_at,
      manufacture_date: input.manufacture_date,
      tcds_number: input.tcds_number,
      tcds_url: input.tcds_url,
      photo_url: input.photo_url,
      version: input.version,
    };
    try {
      return await this.aircraftModel.create(values, transactionOption(options));
    } catch (error) {
      return stableFailure(error);
    }
  }

  async updateById(
    authority: TenantQueryAuthority,
    id: string,
    changes: AircraftTenantUpdateInput,
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<TenantUniqueMutationResult> {
    assertTenantQueryAuthority(authority);
    rejectOwnershipInput(changes);
    const values = {
      registration: changes.registration,
      serial_number: changes.serial_number,
      model_id: changes.model_id,
      category_id: changes.category_id,
      total_time_hours: changes.total_time_hours,
      total_time_cycles: changes.total_time_cycles,
      loaded_into_system_at: changes.loaded_into_system_at,
      manufacture_date: changes.manufacture_date,
      tcds_number: changes.tcds_number,
      tcds_url: changes.tcds_url,
      photo_url: changes.photo_url,
      version: changes.version,
    };
    try {
      const [affectedCount] = await this.aircraftModel.update(values, {
        where: aircraftTenantWhere(authority, Object.freeze({ id })),
        ...transactionOption(options),
      });
      return mutationResult(affectedCount);
    } catch (error) {
      return stableFailure(error);
    }
  }

  async getForLifecycleUpdate(
    authority: TenantQueryAuthority,
    id: string,
    options: AircraftLifecycleUpdateOptions,
  ): Promise<AircraftLifecycleInstance | undefined> {
    assertTenantQueryAuthority(authority);
    try {
      const query: Readonly<{
        where: TenantScopedWhere;
        transaction: Transaction;
        lock: NonNullable<FindOptions['lock']>;
      }> = {
        where: aircraftTenantWhere(authority, Object.freeze({ id })),
        transaction: options.transaction,
        lock: options.lock,
      };
      return (
        (await this.aircraftModel.findOne(query)) ?? undefined
      );
    } catch (error) {
      return stableFailure(error);
    }
  }

  async getForRootUpdate(
    authority: TenantQueryAuthority,
    id: string,
    options: AircraftLifecycleUpdateOptions,
  ): Promise<AircraftRootUpdateInstance | undefined> {
    assertTenantQueryAuthority(authority);
    try {
      const query: Readonly<{
        where: TenantScopedWhere;
        transaction: Transaction;
        lock: NonNullable<FindOptions['lock']>;
      }> = {
        where: aircraftTenantWhere(authority, Object.freeze({ id })),
        transaction: options.transaction,
        lock: options.lock,
      };
      return (await this.aircraftModel.findOne(query)) ?? undefined;
    } catch (error) {
      return stableFailure(error);
    }
  }

  async resolveOwnedRoot(
    authority: TenantQueryAuthority,
    id: string,
    options: TenantRepositoryOptions<Transaction> = {},
  ): Promise<OwnedAircraftRoot | undefined> {
    assertTenantQueryAuthority(authority);
    try {
      const aircraft = await this.aircraftModel.findOne({
        attributes: Object.freeze(['id']),
        where: aircraftTenantWhere(authority, Object.freeze({ id })),
        ...transactionOption(options),
      });
      return aircraft ? Object.freeze({ id: aircraft.id }) : undefined;
    } catch (error) {
      return stableFailure(error);
    }
  }
}
