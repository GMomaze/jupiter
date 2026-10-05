import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  Aircraft, AircraftCategory, AircraftComponent, AircraftComponentInstallation,
  AssetType, ComplianceAssignment, ComplianceItem, ComponentModel, Manufacturer,
  SerializedComponent, Tenant, User, sequelize,
} from '../../models/index.js';
import { createTenantQueryAuthority, type TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { serializedComponentTenantRepository } from '../library/serialized-component-tenant.repository.live.js';
import { aircraftUtilisationTenantRepository } from '../utilisation/aircraft-utilisation-tenant.repository.live.js';
import { UtilisationService } from '../utilisation/utilisation.service.js';
import { aircraftTenantRepository } from './aircraft-tenant.repository.live.js';
import { aircraftComponentTenantRepository } from './aircraft-component-tenant.repository.live.js';
import { aircraftComponentInstallationTenantRepository } from './aircraft-component-installation-tenant.repository.live.js';
import { AircraftComponentService } from './aircraft-component.service.js';
import { AircraftService } from './aircraft.service.js';
import { ComponentLifeCalculationService } from './component-life-calculation.service.js';

type Context = { authority: TenantQueryAuthority; tenant: Tenant; aircraft: Aircraft; serialized: SerializedComponent; installation: AircraftComponentInstallation; legacy: AircraftComponent; utilisationEventId: string };
let a: Context;
let b: Context;
let complianceId: string;
let assignmentId: string;
const missing = randomUUID();

async function context(label: string): Promise<Context> {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  const user = await User.create({ email: `b8-${label}-${suffix}@example.test`, password_hash: 'test', full_name: `B8 ${label}`, is_active: true });
  const tenant = await Tenant.create({ code: `B8_${label}_${suffix}`, display_name: `B8 ${label} ${suffix}`, status: 'ACTIVE', created_by_user_id: user.id, updated_by_user_id: user.id });
  const authority = createTenantQueryAuthority({ state: 'VALID_ACTIVE_TENANT', tenant: { id: tenant.id, publicId: tenant.public_id, code: tenant.code, displayName: tenant.display_name, status: 'ACTIVE' }, membership: { id: randomUUID(), tenantId: tenant.id, userId: user.id, status: 'ACTIVE' }, validatedAt: Date.now() });
  const manufacturer = await Manufacturer.create({ code: `B8M_${label}_${suffix}`, name: `B8 Manufacturer ${label} ${suffix}`, is_active: true });
  const assetType = await AssetType.create({ code: `B8A_${label}_${suffix}`, label: `B8 Asset ${label}`, is_installable_on_aircraft: true, is_required_for_aircraft: false, required_quantity: 0, is_active: true, system_locked: false });
  const category = await AircraftCategory.create({ code: `B8C_${label}_${suffix}`, label: `B8 Category ${label}`, is_active: true, system_locked: false });
  const model = await ComponentModel.create({ model_name: `B8 Model ${label}`, model_code: `B8MOD_${label}_${suffix}`, manufacturer_id: manufacturer.id, asset_type_id: assetType.id, is_active: true });
  const aircraft = await Aircraft.create({ registration: `B8-${label}-${suffix}`, serial_number: `B8-SN-${label}-${suffix}`, model_id: model.id, category_id: category.id, status: 'ACTIVE', total_time_hours: 0, total_time_cycles: 0, version: 0, tenant_id: tenant.id });
  const utilisation = await UtilisationService.recordUtilisation(authority, { aircraftId: aircraft.id, newTotalTimeHours: 25, newTotalTimeCycles: 12, sourceType: 'MANUAL_ENTRY', effectiveDate: '2026-09-05', reason: 'B8 live fixture' });
  const serialized = await SerializedComponent.create({ component_model_id: model.id, serial_number: `B8-SC-${label}-${suffix}`, status: 'AVAILABLE', custodian_tenant_id: tenant.id });
  await AircraftComponentService.baselineCaptureSerializedComponent(authority, { aircraft_id: aircraft.id, serialized_component_id: serialized.id, installed_at: '2026-09-05', tracking_basis: 'AIRCRAFT_HOURS', install_tsn: 100 });
  const installation = (await AircraftComponentInstallation.findOne({ where: { aircraft_id: aircraft.id, serialized_component_id: serialized.id } }))!;
  await AircraftComponentService.installComponent(authority, { aircraft_id: aircraft.id, model_id: model.id, serial_number: `B8-LEG-${label}-${suffix}`, installation_date: '2026-09-05', position_code: `LEG-${label}`, tsn_at_install: 0, tso_at_install: 0 });
  const legacy = (await AircraftComponent.findOne({ where: { aircraft_id: aircraft.id, serial_number: `B8-LEG-${label}-${suffix}` } }))!;
  return { authority, tenant, aircraft, serialized, installation, legacy, utilisationEventId: (utilisation as any).event.id };
}

beforeAll(async () => {
  a = await context('A');
  b = await context('B');
  const item = await ComplianceItem.create({ item_type: 'AD', code: `B8-AD-${randomUUID()}`, title: 'B8 AD', source_type: 'AD', source_id: randomUUID(), compliance_basis: 'MANDATORY', status: 'ACTIVE' } as any);
  const assignment = await ComplianceAssignment.create({ compliance_item_id: item.id, assignment_type: 'AIRCRAFT', aircraft_id: b.aircraft.id, model_id: null, assignment_source: 'MANUAL', is_active: true });
  assignmentId = assignment.id;
  const [rows] = await sequelize.query(`INSERT INTO aircraft_compliance (aircraft_id, compliance_item_id, status, notes) VALUES (:aircraftId, :itemId, 'DUE', 'B8') RETURNING id::text`, { replacements: { aircraftId: b.aircraft.id, itemId: item.id } });
  complianceId = String((rows as any[])[0].id);
});

describe('MT-4C3B8 guarded two-tenant live isolation', () => {
  it('isolates Aircraft discovery, reads, counts, references, and mutations', async () => {
    expect(await aircraftTenantRepository.getById(a.authority, b.aircraft.id)).toBeUndefined();
    expect(await aircraftTenantRepository.getById(a.authority, missing)).toBeUndefined();
    const visible = await aircraftTenantRepository.list(a.authority);
    expect(visible.some((row) => row.id === b.aircraft.id)).toBe(false);
    expect(await aircraftTenantRepository.count(a.authority)).toBe(visible.length);
    expect(await aircraftTenantRepository.updateById(a.authority, b.aircraft.id, { registration: 'DENIED-B8' })).toEqual({ outcome: 'UNAVAILABLE' });
    expect(await aircraftTenantRepository.updateById(a.authority, missing, { registration: 'DENIED-B8' })).toEqual({ outcome: 'UNAVAILABLE' });
    expect(await aircraftTenantRepository.getById(a.authority, a.aircraft.id)).toBeDefined();
  });

  it('isolates serialized roots and both-root installations', async () => {
    expect(await serializedComponentTenantRepository.getById(a.authority, b.serialized.id)).toBeUndefined();
    expect(await serializedComponentTenantRepository.findBySerialIdentity(a.authority, b.serialized.component_model_id, b.serialized.serial_number)).toBeUndefined();
    expect(await serializedComponentTenantRepository.updateById(a.authority, b.serialized.id, { status: 'REMOVED' })).toEqual({ outcome: 'UNAVAILABLE' });
    expect(await aircraftComponentInstallationTenantRepository.getById(a.authority, b.installation.id)).toBeUndefined();
    expect(await aircraftComponentInstallationTenantRepository.getById(a.authority, missing)).toBeUndefined();
    expect(await aircraftComponentInstallationTenantRepository.getById(a.authority, a.installation.id)).toBeDefined();
  });

  it('isolates legacy children, utilisation references, and local life state', async () => {
    expect(await aircraftComponentTenantRepository.getById(a.authority, b.legacy.id)).toBeUndefined();
    await expect(AircraftComponentService.removeComponent(a.authority, b.legacy.id, 'actor-a')).rejects.toThrow('TENANT_RESOURCE_UNAVAILABLE');
    await expect(AircraftComponentService.removeComponent(a.authority, missing, 'actor-a')).rejects.toThrow('TENANT_RESOURCE_UNAVAILABLE');
    const transaction = await sequelize.transaction();
    try {
      expect(await aircraftUtilisationTenantRepository.resolveCorrectionEvent(a.authority, b.utilisationEventId, b.aircraft.id, transaction)).toBeUndefined();
    } finally { await transaction.rollback(); }
    await expect(ComponentLifeCalculationService.calculateForInstallation(a.authority, b.installation.id)).rejects.toThrow('TENANT_RESOURCE_UNAVAILABLE');
    await expect(ComponentLifeCalculationService.calculateForInstallation(a.authority, missing)).rejects.toThrow('TENANT_RESOURCE_UNAVAILABLE');
    expect((await ComponentLifeCalculationService.calculateForInstallation(a.authority, a.installation.id)).status).toBe('CALCULATED');
  });

  it('isolates B6 compliance children while preserving owned mutation success', async () => {
    await expect(AircraftService.updateAdOperationalComplianceStatus(a.authority, { aircraftId: a.aircraft.id, complianceId, status: 'IN_PROGRESS' })).rejects.toThrow('AIRCRAFT_COMPLIANCE_NOT_FOUND');
    await expect(AircraftService.updateAdOperationalComplianceStatus(a.authority, { aircraftId: a.aircraft.id, complianceId: missing, status: 'IN_PROGRESS' })).rejects.toThrow('AIRCRAFT_COMPLIANCE_NOT_FOUND');
    await expect(AircraftService.updateAdOperationalComplianceDueData(a.authority, { aircraftId: a.aircraft.id, complianceId })).rejects.toThrow('AIRCRAFT_COMPLIANCE_NOT_FOUND');
    await expect(AircraftService.createAdOperationalComplianceRecordFromAssignment(a.authority, { aircraftId: a.aircraft.id, assignmentId })).rejects.toThrow('AD_COMPLIANCE_ASSIGNMENT_NOT_FOUND');
    await expect(AircraftService.createAdOperationalComplianceRecordFromAssignment(a.authority, { aircraftId: a.aircraft.id, assignmentId: missing })).rejects.toThrow('AD_COMPLIANCE_ASSIGNMENT_NOT_FOUND');
    await expect(AircraftService.getAdApplicabilityPreviewForAircraft(a.authority, b.aircraft.id)).rejects.toThrow('AIRCRAFT_NOT_FOUND');
    await expect(AircraftService.getAdApplicabilityPreviewForAircraft(a.authority, missing)).rejects.toThrow('AIRCRAFT_NOT_FOUND');
    await expect(AircraftService.getServiceBulletinsForAircraft(a.authority, b.aircraft.id)).rejects.toThrow('AIRCRAFT_NOT_FOUND');
    await expect(AircraftService.getApplicableStandardTasksForAircraft(a.authority, b.aircraft.id)).rejects.toThrow('AIRCRAFT_NOT_FOUND');
    const result = await AircraftService.updateAdOperationalComplianceStatus(b.authority, { aircraftId: b.aircraft.id, complianceId, status: 'IN_PROGRESS', notes: 'B8 owned update' });
    expect(result.status).toBe('IN_PROGRESS');
  });
});
