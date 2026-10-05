import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const models = vi.hoisted(() => {
  const model = () => ({ findOne: vi.fn(), findAll: vi.fn(), findByPk: vi.fn(), create: vi.fn(), update: vi.fn() });
  return { sequelize: { transaction: vi.fn() }, Aircraft: model(), AircraftComponent: model(), AircraftComponentInstallation: model(), ComponentModel: model(), SerializedComponent: model(), SerializedComponentLifeState: model(), SerializedComponentMaintenanceEvent: model(), ComponentLifeLimit: model(), UtilisationEvent: model() };
});
vi.mock('../../models/index.js', () => models);

import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { aircraftTenantRepository } from '../aircraft/aircraft-tenant.repository.live.js';
import { aircraftComponentTenantRepository } from '../aircraft/aircraft-component-tenant.repository.live.js';
import { aircraftComponentInstallationTenantRepository } from '../aircraft/aircraft-component-installation-tenant.repository.live.js';
import { ComponentLifeCalculationService } from '../aircraft/component-life-calculation.service.js';
import { ComponentLimitMonitoringService } from '../aircraft/component-limit-monitoring.service.js';
import { AuditService } from '../audit/audit.service.js';
import { aircraftUtilisationTenantRepository } from './aircraft-utilisation-tenant.repository.live.js';
import { UtilisationPropagationPreviewService } from './utilisation-propagation-preview.service.js';
import { UtilisationService } from './utilisation.service.js';

const authority = createTenantQueryAuthority({ state: 'VALID_ACTIVE_TENANT', tenant: { id: 'tenant-a', publicId: 'a', code: 'A', displayName: 'A', status: 'ACTIVE' }, membership: { id: 'm-a', tenantId: 'tenant-a', userId: 'u-a', status: 'ACTIVE' }, validatedAt: 1 });
const lifeContext = {
  id: 'installation-a', aircraft_id: 'aircraft-a', serialized_component_id: 'component-a', installed_at: '2026-01-01', tracking_basis: 'AIRCRAFT_HOURS',
  install_tsn: 10, install_tso: 2, install_aircraft_hours: 100, install_csn: null, install_cso: null,
  Aircraft: { id: 'aircraft-a', total_time_hours: 125, total_time_cycles: 5 },
  SerializedComponent: { id: 'component-a', serial_number: 'SER-A', ComponentModel: { LifeLimits: [] }, LifeState: null, MaintenanceEvents: [] },
};
const utilisationInput = { aircraftId: 'aircraft-a', newTotalTimeHours: 12, newTotalTimeCycles: 3, sourceType: 'MANUAL_ENTRY' as const, effectiveDate: '2026-08-01', reason: 'Flight' };

beforeEach(() => vi.restoreAllMocks());

describe('MT-4C3B5 local utilisation and life conversion', () => {
  it.each([
    ['life', (bad: never) => ComponentLifeCalculationService.calculateForInstallation(bad, 'installation-a')],
    ['monitor', (bad: never) => ComponentLimitMonitoringService.monitorInstallation(bad, 'installation-a')],
    ['utilisation', (bad: never) => UtilisationService.recordUtilisation(bad, utilisationInput)],
    ['preview', (bad: never) => UtilisationPropagationPreviewService.preview(bad, { aircraftId: 'aircraft-a', proposedTotalTimeHours: 130, proposedTotalTimeCycles: 6, effectiveDate: '2026-08-01', sourceType: 'MANUAL_ENTRY' })],
  ])('rejects missing and structural authority before access: %s', async (_name, invoke) => {
    const installation = vi.spyOn(aircraftComponentInstallationTenantRepository, 'getOperationalLifeContext');
    const aircraft = vi.spyOn(aircraftTenantRepository, 'getForRootUpdate');
    await expect(invoke(undefined as never)).rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
    await expect(invoke(Object.freeze({ tenantId: 'tenant-a' }) as never)).rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
    expect(installation).not.toHaveBeenCalled();
    expect(aircraft).not.toHaveBeenCalled();
    expect(models.sequelize.transaction).not.toHaveBeenCalled();
  });

  it('calculates unchanged life arithmetic from a both-root authorized context', async () => {
    const context = vi.spyOn(aircraftComponentInstallationTenantRepository, 'getOperationalLifeContext').mockResolvedValue(lifeContext);
    const result = await ComponentLifeCalculationService.calculateForInstallation(authority, 'installation-a');
    expect(context).toHaveBeenCalledWith(authority, 'installation-a');
    expect(result.values.tsn_hours).toBe(35);
    expect(result.values.tso_hours).toBe(27);
  });

  it('makes foreign, mixed-root, and nonexistent installations neutral', async () => {
    vi.spyOn(aircraftComponentInstallationTenantRepository, 'getOperationalLifeContext').mockResolvedValue(undefined);
    await expect(ComponentLifeCalculationService.calculateForInstallation(authority, 'foreign-or-missing')).rejects.toThrow('TENANT_RESOURCE_UNAVAILABLE');
    await expect(ComponentLimitMonitoringService.monitorInstallation(authority, 'foreign-or-missing')).rejects.toThrow('TENANT_RESOURCE_UNAVAILABLE');
  });

  it('keeps local monitorInstallation authority-safe after broad monitoring conversion', async () => {
    vi.spyOn(aircraftComponentInstallationTenantRepository, 'getOperationalLifeContext').mockResolvedValue(lifeContext);
    const result = await ComponentLimitMonitoringService.monitorInstallation(authority, 'installation-a');
    expect(result[0]?.unknown_reason).toContain('No active component life limits');
    const source = fs.readFileSync(path.resolve('src/modules/aircraft/component-limit-monitoring.service.ts'), 'utf8');
    expect(source).toContain('calculateForDeferredBroadMonitoring(authority, installation.id)');
    expect(source).toContain('authority: TenantQueryAuthority');
    expect(source).toContain('listActiveOperationalLifeContexts');
  });

  it('records utilisation with root lock, child event, audit, and original arithmetic', async () => {
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    models.sequelize.transaction.mockImplementation(async (callback: (value: unknown) => unknown) => callback(transaction));
    const aircraftRecord = { id: 'aircraft-a', status: 'ACTIVE', total_time_hours: 10, total_time_cycles: 2, save: vi.fn() };
    const aircraft = vi.spyOn(aircraftTenantRepository, 'getForRootUpdate').mockResolvedValue(aircraftRecord as never);
    const event = vi.spyOn(aircraftUtilisationTenantRepository, 'createForAircraft').mockResolvedValue({ id: 'event-a', source_type: 'MANUAL_ENTRY' });
    vi.spyOn(aircraftComponentTenantRepository, 'listForUtilisationGrounding').mockResolvedValue([]);
    const audit = vi.spyOn(AuditService, 'log').mockResolvedValue(undefined as never);
    const result = await UtilisationService.recordUtilisation(authority, utilisationInput);
    expect(aircraft).toHaveBeenCalledWith(authority, 'aircraft-a', { transaction, lock: 'UPDATE' });
    expect(event).toHaveBeenCalledWith(authority, 'aircraft-a', expect.objectContaining({ delta_hours: 2, delta_cycles: 1 }), transaction);
    expect(aircraftRecord.save).toHaveBeenCalledWith({ transaction });
    expect(audit).toHaveBeenCalledTimes(2);
    expect(result.event.id).toBe('event-a');
  });

  it('rejects foreign/nonexistent Aircraft before event, audit, or grounding access', async () => {
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    models.sequelize.transaction.mockImplementation(async (callback: (value: unknown) => unknown) => callback(transaction));
    vi.spyOn(aircraftTenantRepository, 'getForRootUpdate').mockResolvedValue(undefined);
    const event = vi.spyOn(aircraftUtilisationTenantRepository, 'createForAircraft');
    const grounding = vi.spyOn(aircraftComponentTenantRepository, 'listForUtilisationGrounding');
    await expect(UtilisationService.recordUtilisation(authority, utilisationInput)).rejects.toThrow('TENANT_RESOURCE_UNAVAILABLE');
    expect(event).not.toHaveBeenCalled();
    expect(grounding).not.toHaveBeenCalled();
  });

  it('previews only both-root authorized installations and preserves projected arithmetic', async () => {
    vi.spyOn(aircraftTenantRepository, 'getById').mockResolvedValue({ id: 'aircraft-a', registration: 'ZS-AAA', total_time_hours: 125, total_time_cycles: 5 });
    vi.spyOn(aircraftComponentInstallationTenantRepository, 'listActiveOperationalLifeContexts').mockResolvedValue([lifeContext]);
    vi.spyOn(aircraftComponentInstallationTenantRepository, 'getOperationalLifeContext').mockResolvedValue(lifeContext);
    const preview = await UtilisationPropagationPreviewService.preview(authority, { aircraftId: 'aircraft-a', proposedTotalTimeHours: 130, proposedTotalTimeCycles: 6, effectiveDate: '2026-08-01', sourceType: 'MANUAL_ENTRY' });
    expect(preview.affected_components).toHaveLength(1);
    expect(preview.affected_components[0]?.projected_life.values.tsn_hours).toBe(40);
    expect(preview.affected_components[0]?.serialized_component_id).toBe('component-a');
  });

  it('contains no optional authority, association mixin, or generic raw escape in converted paths', () => {
    const sources = ['src/modules/utilisation/utilisation.service.ts', 'src/modules/utilisation/utilisation-propagation-preview.service.ts', 'src/modules/aircraft/component-life-calculation.service.ts'].map((file) => fs.readFileSync(path.resolve(file), 'utf8')).join('\n');
    expect(sources).not.toMatch(/authority\?:\s*TenantQueryAuthority|authority\?\.tenantId|sequelize\.query|rawQuery|req\.tenantContext|\bADMIN\b/);
    expect(sources).not.toMatch(/\b(aircraft|installation|serializedComponent)\.(get|set|add|remove|create)[A-Z][A-Za-z]+\(/);
  });
});
