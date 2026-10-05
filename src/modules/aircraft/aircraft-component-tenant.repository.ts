import type { FindOptions, Transaction, UpdateOptions } from 'sequelize';
import { assertTenantQueryAuthority, type TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import type { TenantRepositoryOptions } from '../tenancy/tenant-root-repository.types.js';

export interface AircraftComponentTenantRecord { readonly id: string; readonly aircraft_id?: string; readonly custodian_tenant_id?: string; readonly [key: string]: unknown; }
export interface AircraftComponentModelPort {
  findOne(options: Readonly<Record<string, unknown>>): Promise<AircraftComponentTenantRecord | null>;
  findAll(options: Readonly<Record<string, unknown>>): Promise<readonly AircraftComponentTenantRecord[]>;
  create(values: Readonly<Record<string, unknown>>, options: Readonly<{ transaction: Transaction }>): Promise<AircraftComponentTenantRecord>;
  update(
    values: Readonly<Record<string, unknown>>,
    options: Readonly<Pick<UpdateOptions, 'where'>> & { readonly transaction: Transaction },
  ): Promise<readonly [number]>;
}
export interface AircraftComponentLockOptions { readonly transaction: Transaction; readonly lock: NonNullable<FindOptions['lock']>; }
export interface AircraftComponentCreateInput { readonly aircraft_id: string; readonly model_id: string; readonly serial_number: string; readonly position_code: string | null; readonly installation_date: string; readonly tsn_at_install: unknown; readonly tso_at_install: unknown; readonly install_af_hours: unknown; readonly current_status: 'INSTALLED'; readonly removed_at: null; readonly version: 0; }

const aircraftRoot = (authority: TenantQueryAuthority, aircraftId?: string) => Object.freeze({
  association: 'Aircraft', attributes: Object.freeze(['id']), required: true,
  where: Object.freeze(aircraftId ? { id: aircraftId, tenant_id: authority.tenantId } : { tenant_id: authority.tenantId }),
});
const sharedModel = Object.freeze({
  association: 'ComponentModel', required: false,
  attributes: Object.freeze(['id', 'model_name', 'model_code', 'manufacturer_id', 'asset_type_id']),
});
const workflowSharedModel = Object.freeze({
  ...sharedModel,
  include: Object.freeze([
    Object.freeze({ association: 'Manufacturer', required: false }),
    Object.freeze({ association: 'AssetType', required: false }),
  ]),
});
const mutationOperationalModel = Object.freeze({
  ...workflowSharedModel,
  attributes: Object.freeze([...sharedModel.attributes, 'default_tbo_hours']),
});
const transactionOption = (options: TenantRepositoryOptions<Transaction>) =>
  options.transaction === undefined ? Object.freeze({}) : Object.freeze({ transaction: options.transaction });
function stableFailure(error: unknown): never {
  if (error instanceof Error && ['TENANT_AUTHORITY_REQUIRED', 'TENANT_QUERY_FAILED'].includes(error.message)) throw error;
  throw new Error('TENANT_QUERY_FAILED');
}
function mutationResult(affectedCount: number) {
  if (affectedCount === 0) return Object.freeze({ outcome: 'UNAVAILABLE' as const });
  if (affectedCount === 1) return Object.freeze({ outcome: 'CHANGED' as const });
  throw new Error('TENANT_QUERY_FAILED');
}

export class AircraftComponentTenantRepository {
  readonly repositoryScope = 'AIRCRAFT_TENANT_CHILD' as const;
  constructor(private readonly model: AircraftComponentModelPort) {}

  async getById(authority: TenantQueryAuthority, id: string, options: TenantRepositoryOptions<Transaction> = {}) {
    assertTenantQueryAuthority(authority);
    try {
      return (await this.model.findOne({
        where: Object.freeze({ id }), include: Object.freeze([aircraftRoot(authority), sharedModel]),
        ...transactionOption(options),
      })) ?? undefined;
    } catch (error) { return stableFailure(error); }
  }

  async getForUpdate(authority: TenantQueryAuthority, id: string, options: AircraftComponentLockOptions) {
    assertTenantQueryAuthority(authority);
    try {
      return (await this.model.findOne({
        where: Object.freeze({ id }),
        include: Object.freeze([aircraftRoot(authority)]),
        transaction: options.transaction,
        lock: options.lock,
      })) ?? undefined;
    } catch (error) { return stableFailure(error); }
  }

  async getCustodyForUpdate(authority: TenantQueryAuthority, id: string, options: AircraftComponentLockOptions) {
    assertTenantQueryAuthority(authority);
    try {
      return (await this.model.findOne({
        where: Object.freeze({ id, custodian_tenant_id: authority.tenantId }),
        transaction: options.transaction,
        lock: options.lock,
      })) ?? undefined;
    } catch (error) { return stableFailure(error); }
  }

  async getCustodyOperationalContext(authority: TenantQueryAuthority, id: string, options: TenantRepositoryOptions<Transaction> = {}) {
    assertTenantQueryAuthority(authority);
    try {
      return (await this.model.findOne({
        where: Object.freeze({ id, custodian_tenant_id: authority.tenantId }),
        include: Object.freeze([mutationOperationalModel]),
        ...transactionOption(options),
      })) ?? undefined;
    } catch (error) { return stableFailure(error); }
  }

  async getOperationalContext(authority: TenantQueryAuthority, id: string, options: TenantRepositoryOptions<Transaction> = {}) {
    assertTenantQueryAuthority(authority);
    try {
      return (await this.model.findOne({
        where: Object.freeze({ id }),
        include: Object.freeze([aircraftRoot(authority), mutationOperationalModel]),
        ...transactionOption(options),
      })) ?? undefined;
    } catch (error) { return stableFailure(error); }
  }

  async listForAircraft(authority: TenantQueryAuthority, aircraftId: string, options: TenantRepositoryOptions<Transaction> = {}) {
    assertTenantQueryAuthority(authority);
    try {
      return await this.model.findAll({
        where: Object.freeze({ aircraft_id: aircraftId }),
        include: Object.freeze([aircraftRoot(authority, aircraftId), sharedModel]),
        order: Object.freeze([Object.freeze(['installation_date', 'ASC'])]),
        ...transactionOption(options),
      });
    } catch (error) { return stableFailure(error); }
  }

  async listInstalledForAircraft(authority: TenantQueryAuthority, aircraftId: string, options: TenantRepositoryOptions<Transaction> = {}) {
    assertTenantQueryAuthority(authority);
    try {
      return await this.model.findAll({
        where: Object.freeze({ aircraft_id: aircraftId, current_status: 'INSTALLED' }),
        include: Object.freeze([aircraftRoot(authority, aircraftId), workflowSharedModel]),
        order: Object.freeze([Object.freeze(['position_code', 'ASC'])]),
        ...transactionOption(options),
      });
    } catch (error) { return stableFailure(error); }
  }

  async hasActivePositionConflict(authority: TenantQueryAuthority, aircraftId: string, assetTypeId: string, position: string, options: { readonly transaction: Transaction; readonly lock: unknown }) {
    assertTenantQueryAuthority(authority);
    const model = Object.freeze({ ...sharedModel, required: true, where: Object.freeze({ asset_type_id: assetTypeId }) });
    try {
      return Boolean(await this.model.findOne({
        attributes: Object.freeze(['id']),
        where: Object.freeze({ aircraft_id: aircraftId, position_code: position, current_status: 'INSTALLED' }),
        include: Object.freeze([aircraftRoot(authority, aircraftId), model]),
        transaction: options.transaction,
        lock: options.lock,
      }));
    } catch (error) { return stableFailure(error); }
  }

  async hasInstalledSerialConflict(authority: TenantQueryAuthority, serialNumber: string, options: AircraftComponentLockOptions) {
    assertTenantQueryAuthority(authority);
    try {
      return Boolean(await this.model.findOne({
        attributes: Object.freeze(['id']),
        where: Object.freeze({ serial_number: serialNumber, current_status: 'INSTALLED' }),
        include: Object.freeze([aircraftRoot(authority)]),
        transaction: options.transaction,
        lock: options.lock,
      }));
    } catch (error) { return stableFailure(error); }
  }

  async hasInstalledPositionConflict(authority: TenantQueryAuthority, aircraftId: string, position: string, options: AircraftComponentLockOptions) {
    assertTenantQueryAuthority(authority);
    try {
      return Boolean(await this.model.findOne({
        attributes: Object.freeze(['id']),
        where: Object.freeze({ aircraft_id: aircraftId, position_code: position, current_status: 'INSTALLED' }),
        include: Object.freeze([aircraftRoot(authority, aircraftId)]),
        transaction: options.transaction,
        lock: options.lock,
      }));
    } catch (error) { return stableFailure(error); }
  }

  async create(authority: TenantQueryAuthority, input: AircraftComponentCreateInput, options: { readonly transaction: Transaction }) {
    assertTenantQueryAuthority(authority);
    try {
      return await this.model.create(
        { ...input, custodian_tenant_id: authority.tenantId },
        options,
      );
    }
    catch (error) { return stableFailure(error); }
  }

  async updateByVersion(authority: TenantQueryAuthority, id: string, aircraftId: string, version: number, changes: Readonly<Record<string, unknown>>, options: { readonly transaction: Transaction }) {
    assertTenantQueryAuthority(authority);
    try {
      const [affectedCount] = await this.model.update({ ...changes }, {
        where: Object.freeze({ id, aircraft_id: aircraftId, version }),
        transaction: options.transaction,
      });
      return mutationResult(affectedCount);
    } catch (error) { return stableFailure(error); }
  }

  async updateCustodyByVersion(authority: TenantQueryAuthority, id: string, version: number, changes: Readonly<Record<string, unknown>>, options: { readonly transaction: Transaction }) {
    assertTenantQueryAuthority(authority);
    try {
      const [affectedCount] = await this.model.update({ ...changes }, {
        where: Object.freeze({ id, custodian_tenant_id: authority.tenantId, version }),
        transaction: options.transaction,
      });
      return mutationResult(affectedCount);
    } catch (error) { return stableFailure(error); }
  }

  async listForUtilisationGrounding(authority: TenantQueryAuthority, aircraftId: string, options: TenantRepositoryOptions<Transaction> = {}) {
    assertTenantQueryAuthority(authority);
    const model = Object.freeze({ ...sharedModel, required: true, attributes: Object.freeze(['id', 'default_tbo_hours']) });
    try { return await this.model.findAll({ where: Object.freeze({ aircraft_id: aircraftId }), include: Object.freeze([aircraftRoot(authority, aircraftId), model]), ...transactionOption(options) }); }
    catch (error) { return stableFailure(error); }
  }

  async hasQuarantinedForAircraft(authority: TenantQueryAuthority, aircraftId: string, options: TenantRepositoryOptions<Transaction> = {}) {
    assertTenantQueryAuthority(authority);
    try {
      return Boolean(await this.model.findOne({
        attributes: Object.freeze(['id']),
        where: Object.freeze({ aircraft_id: aircraftId, current_status: 'QUARANTINED', removed_at: null }),
        include: Object.freeze([aircraftRoot(authority, aircraftId)]),
        ...transactionOption(options),
      }));
    } catch (error) { return stableFailure(error); }
  }

}
