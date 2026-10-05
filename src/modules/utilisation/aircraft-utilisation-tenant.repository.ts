import type { Transaction } from 'sequelize';
import { assertTenantQueryAuthority, type TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
export interface UtilisationEventRecord { readonly id: string; readonly source_type?: string; readonly [key: string]: unknown; }
export interface UtilisationEventModelPort { findOne(options: Readonly<Record<string, unknown>>): Promise<UtilisationEventRecord | null>; create(values: Readonly<Record<string, unknown>>, options: Readonly<{ transaction: Transaction }>): Promise<UtilisationEventRecord>; }
const aircraftRoot = (authority: TenantQueryAuthority, aircraftId: string) => Object.freeze({ association: 'Aircraft', attributes: Object.freeze(['id']), required: true, where: Object.freeze({ id: aircraftId, tenant_id: authority.tenantId }) });
export class AircraftUtilisationTenantRepository {
  constructor(private readonly model: UtilisationEventModelPort) {}
  async resolveCorrectionEvent(authority: TenantQueryAuthority, eventId: string, aircraftId: string, transaction: Transaction) { assertTenantQueryAuthority(authority); return (await this.model.findOne({ where: Object.freeze({ id: eventId, aircraft_id: aircraftId }), include: Object.freeze([aircraftRoot(authority, aircraftId)]), transaction })) ?? undefined; }
  async createForAircraft(authority: TenantQueryAuthority, aircraftId: string, values: Readonly<Record<string, unknown>>, transaction: Transaction) { assertTenantQueryAuthority(authority); return this.model.create({ ...values, aircraft_id: aircraftId }, { transaction }); }
}
