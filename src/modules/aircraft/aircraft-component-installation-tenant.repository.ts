import type { FindOptions, Transaction } from 'sequelize';
import { assertTenantQueryAuthority, type TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import type { TenantRepositoryOptions, TenantUniqueMutationResult } from '../tenancy/tenant-root-repository.types.js';

export interface InstallationTenantRecord { readonly id: string; readonly aircraft_id?: string; readonly serialized_component_id?: string; readonly removed_at?: string | null; readonly [key: string]: unknown; }
export interface InstallationModelPort {
  findOne(options: Readonly<Record<string, unknown>>): Promise<InstallationTenantRecord | null>;
  findAll(options: Readonly<Record<string, unknown>>): Promise<readonly InstallationTenantRecord[]>;
  create(values: Readonly<Record<string, unknown>>, options: Readonly<{ transaction: Transaction }>): Promise<InstallationTenantRecord>;
  update(values: Readonly<Record<string, unknown>>, options: Readonly<Record<string, unknown>>): Promise<readonly [number] | readonly [number, readonly InstallationTenantRecord[]]>;
}
export interface InstallationLockOptions { readonly transaction: Transaction; readonly lock: NonNullable<FindOptions['lock']>; }
export interface InstallationCreateInput { readonly aircraft_id: string; readonly serialized_component_id: string; readonly installation_context: string; readonly installed_at: string; readonly removed_at: null; readonly position: string | null; readonly tracking_basis: string; readonly install_aircraft_hours: number; readonly install_aircraft_cycles: number; readonly install_tsn: number | null; readonly install_tso: number | null; readonly install_csn: number | null; readonly install_cso: number | null; readonly installed_by: string | null; readonly notes: string | null; }
export interface InstallationRemovalInput { readonly removed_at: string; readonly removal_aircraft_hours: number; readonly removal_aircraft_cycles: number; readonly removal_tsn: number | null; readonly removal_tso: number | null; readonly removal_csn: number | null; readonly removal_cso: number | null; readonly removed_by: string | null; readonly notes: string | null; }

const bothRoots = (authority: TenantQueryAuthority, aircraftId?: string) => Object.freeze([
  Object.freeze({ association: 'Aircraft', attributes: Object.freeze(['id']), required: true, where: Object.freeze(aircraftId ? { id: aircraftId, tenant_id: authority.tenantId } : { tenant_id: authority.tenantId }) }),
  Object.freeze({ association: 'SerializedComponent', required: true, where: Object.freeze({ custodian_tenant_id: authority.tenantId }), include: Object.freeze([Object.freeze({ association: 'ComponentModel', required: false })]) }),
]);
const lockedBothRoots = (authority: TenantQueryAuthority, aircraftId?: string) => Object.freeze([
  Object.freeze({ association: 'Aircraft', attributes: Object.freeze(['id']), required: true, where: Object.freeze(aircraftId ? { id: aircraftId, tenant_id: authority.tenantId } : { tenant_id: authority.tenantId }) }),
  Object.freeze({ association: 'SerializedComponent', required: true, where: Object.freeze({ custodian_tenant_id: authority.tenantId }) }),
]);
const operationalLifeRoots = (authority: TenantQueryAuthority, aircraftId?: string) => Object.freeze([
  Object.freeze({ association: 'Aircraft', attributes: Object.freeze(['id', 'registration', 'total_time_hours', 'total_time_cycles']), required: true, where: Object.freeze(aircraftId ? { id: aircraftId, tenant_id: authority.tenantId } : { tenant_id: authority.tenantId }) }),
  Object.freeze({ association: 'SerializedComponent', required: true, where: Object.freeze({ custodian_tenant_id: authority.tenantId }), include: Object.freeze([
    Object.freeze({ association: 'ComponentModel', required: false, include: Object.freeze([Object.freeze({ association: 'Manufacturer', required: false }), Object.freeze({ association: 'AssetType', required: false }), Object.freeze({ association: 'LifeLimits', required: false })]) }),
    Object.freeze({ association: 'LifeState', required: false }), Object.freeze({ association: 'MaintenanceEvents', required: false }),
  ]) }),
]);
const workflowRoots = (authority: TenantQueryAuthority, aircraftId?: string) => Object.freeze([
  Object.freeze({ association: 'Aircraft', attributes: Object.freeze(['id', 'registration', 'serial_number']), required: true, where: Object.freeze(aircraftId ? { id: aircraftId, tenant_id: authority.tenantId } : { tenant_id: authority.tenantId }) }),
  Object.freeze({ association: 'SerializedComponent', required: true, where: Object.freeze({ custodian_tenant_id: authority.tenantId }), include: Object.freeze([
    Object.freeze({ association: 'ComponentModel', required: false, include: Object.freeze([Object.freeze({ association: 'Manufacturer', required: false }), Object.freeze({ association: 'AssetType', required: false }), Object.freeze({ association: 'LifeLimits', required: false })]) }),
    Object.freeze({ association: 'LifeState', required: false }),
  ]) }),
]);
const transactionOption = (options: TenantRepositoryOptions<Transaction>) =>
  options.transaction === undefined ? Object.freeze({}) : Object.freeze({ transaction: options.transaction });
function stableFailure(error: unknown): never {
  if (error instanceof Error && ['TENANT_AUTHORITY_REQUIRED', 'TENANT_QUERY_FAILED'].includes(error.message)) throw error;
  throw new Error('TENANT_QUERY_FAILED');
}
function mutationResult(affectedCount: number): TenantUniqueMutationResult {
  if (affectedCount === 0) return Object.freeze({ outcome: 'UNAVAILABLE' });
  if (affectedCount === 1) return Object.freeze({ outcome: 'CHANGED' });
  throw new Error('TENANT_QUERY_FAILED');
}

export class AircraftComponentInstallationTenantRepository {
  readonly repositoryScope = 'DUAL_TENANT_ROOT_CHILD' as const;
  constructor(private readonly model: InstallationModelPort) {}

  async getById(authority: TenantQueryAuthority, id: string, options: TenantRepositoryOptions<Transaction> = {}) {
    assertTenantQueryAuthority(authority);
    try { return (await this.model.findOne({ where: Object.freeze({ id }), include: bothRoots(authority), ...transactionOption(options) })) ?? undefined; }
    catch (error) { return stableFailure(error); }
  }

  async getForUpdate(authority: TenantQueryAuthority, id: string, options: InstallationLockOptions) {
    assertTenantQueryAuthority(authority);
    try { return (await this.model.findOne({ where: Object.freeze({ id }), include: bothRoots(authority), transaction: options.transaction, lock: options.lock })) ?? undefined; }
    catch (error) { return stableFailure(error); }
  }

  async getActiveForUpdate(authority: TenantQueryAuthority, id: string, aircraftId: string, options: InstallationLockOptions) {
    assertTenantQueryAuthority(authority);
    try { return (await this.model.findOne({ where: Object.freeze({ id, aircraft_id: aircraftId, removed_at: null }), include: lockedBothRoots(authority, aircraftId), transaction: options.transaction, lock: options.lock })) ?? undefined; }
    catch (error) { return stableFailure(error); }
  }

  async listActiveForAircraft(authority: TenantQueryAuthority, aircraftId: string, options: TenantRepositoryOptions<Transaction> = {}) {
    assertTenantQueryAuthority(authority);
    try { return await this.model.findAll({ where: Object.freeze({ aircraft_id: aircraftId, removed_at: null }), include: bothRoots(authority, aircraftId), order: Object.freeze([Object.freeze(['installed_at', 'ASC'])]), ...transactionOption(options) }); }
    catch (error) { return stableFailure(error); }
  }

  async getActiveForSerializedComponent(authority: TenantQueryAuthority, serializedComponentId: string, options: TenantRepositoryOptions<Transaction> = {}) {
    assertTenantQueryAuthority(authority);
    try { return (await this.model.findOne({ where: Object.freeze({ serialized_component_id: serializedComponentId, removed_at: null }), include: bothRoots(authority), ...transactionOption(options) })) ?? undefined; }
    catch (error) { return stableFailure(error); }
  }

  async getActiveForSerializedComponentUpdate(authority: TenantQueryAuthority, serializedComponentId: string, options: InstallationLockOptions) {
    assertTenantQueryAuthority(authority);
    try { return (await this.model.findOne({ where: Object.freeze({ serialized_component_id: serializedComponentId, removed_at: null }), include: lockedBothRoots(authority), transaction: options.transaction, lock: options.lock })) ?? undefined; }
    catch (error) { return stableFailure(error); }
  }

  async hasActivePositionConflict(authority: TenantQueryAuthority, aircraftId: string, assetTypeId: string, position: string, options: InstallationLockOptions) {
    assertTenantQueryAuthority(authority);
    const roots = bothRoots(authority, aircraftId);
    const serializedRoot = roots[1] as Record<string, unknown>;
    const include = Object.freeze([roots[0], Object.freeze({ ...serializedRoot, include: Object.freeze([Object.freeze({ association: 'ComponentModel', attributes: Object.freeze(['id']), required: true, where: Object.freeze({ asset_type_id: assetTypeId }) })]) })]);
    try { return Boolean(await this.model.findOne({ attributes: Object.freeze(['id']), where: Object.freeze({ aircraft_id: aircraftId, position, removed_at: null }), include, transaction: options.transaction, lock: options.lock })); }
    catch (error) { return stableFailure(error); }
  }

  async create(authority: TenantQueryAuthority, input: InstallationCreateInput, options: { readonly transaction: Transaction }) {
    assertTenantQueryAuthority(authority);
    return this.model.create({ ...input }, options);
  }

  async removeActiveById(authority: TenantQueryAuthority, id: string, aircraftId: string, changes: InstallationRemovalInput, options: { readonly transaction: Transaction }): Promise<TenantUniqueMutationResult> {
    assertTenantQueryAuthority(authority);
    try { const [count] = await this.model.update({ ...changes }, { where: Object.freeze({ id, aircraft_id: aircraftId, removed_at: null }), transaction: options.transaction }); return mutationResult(count); }
    catch (error) { return stableFailure(error); }
  }

  async listForSerializedComponents(authority: TenantQueryAuthority, serializedComponentIds: readonly string[], options: TenantRepositoryOptions<Transaction> = {}) {
    assertTenantQueryAuthority(authority);
    if (serializedComponentIds.length === 0) return [];
    try { return await this.model.findAll({ where: Object.freeze({ serialized_component_id: Object.freeze([...serializedComponentIds]) }), include: bothRoots(authority), order: Object.freeze([Object.freeze(['installed_at', 'DESC'])]), ...transactionOption(options) }); }
    catch (error) { return stableFailure(error); }
  }

  async listActiveWorkflowForAircraft(authority: TenantQueryAuthority, aircraftId: string, options: TenantRepositoryOptions<Transaction> = {}) {
    assertTenantQueryAuthority(authority);
    try { return await this.model.findAll({ where: Object.freeze({ aircraft_id: aircraftId, removed_at: null }), include: workflowRoots(authority, aircraftId), order: Object.freeze([Object.freeze(['position', 'ASC']), Object.freeze(['installed_at', 'DESC'])]), ...transactionOption(options) }); }
    catch (error) { return stableFailure(error); }
  }

  async listWorkflowHistoryForSerializedComponents(authority: TenantQueryAuthority, serializedComponentIds: readonly string[], options: TenantRepositoryOptions<Transaction> = {}) {
    assertTenantQueryAuthority(authority);
    if (serializedComponentIds.length === 0) return [];
    try { return await this.model.findAll({ where: Object.freeze({ serialized_component_id: Object.freeze([...serializedComponentIds]) }), include: workflowRoots(authority), order: Object.freeze([Object.freeze(['installed_at', 'DESC']), Object.freeze(['created_at', 'DESC'])]), ...transactionOption(options) }); }
    catch (error) { return stableFailure(error); }
  }

  async getOperationalLifeContext(authority: TenantQueryAuthority, id: string, options: TenantRepositoryOptions<Transaction> = {}) {
    assertTenantQueryAuthority(authority);
    try { return (await this.model.findOne({ where: Object.freeze({ id }), include: operationalLifeRoots(authority), ...transactionOption(options) })) ?? undefined; }
    catch (error) { return stableFailure(error); }
  }

  async listActiveOperationalLifeContexts(authority: TenantQueryAuthority, aircraftId: string, options: TenantRepositoryOptions<Transaction> = {}) {
    assertTenantQueryAuthority(authority);
    try { return await this.model.findAll({ where: Object.freeze({ aircraft_id: aircraftId, removed_at: null }), include: operationalLifeRoots(authority, aircraftId), order: Object.freeze([Object.freeze(['installed_at', 'DESC'])]), ...transactionOption(options) }); }
    catch (error) { return stableFailure(error); }
  }

}
