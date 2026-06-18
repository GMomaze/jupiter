import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  Aircraft,
  AircraftCategory,
  AircraftComponentInstallation,
  AssetType,
  ComponentLifeLimit,
  ComponentModel,
  Manufacturer,
  SerializedComponent,
  SerializedComponentLifeState,
} from '../../models/index.js';
import { UtilisationService } from '../utilisation/utilisation.service.js';
import { ComponentLimitMonitoringService } from './component-limit-monitoring.service.js';

const testRunSuffix = Date.now().toString(36).toUpperCase();
let aircraftRegistrationCounter = 0;

async function createMonitoringContext(options: {
  trackingBasis: string;
  aircraftHours?: number;
  aircraftCycles?: number;
  installAircraftHours?: number | null;
  installAircraftCycles?: number | null;
  installTsn?: number | null;
  installTso?: number | null;
  installCsn?: number | null;
  installCso?: number | null;
  installedAt?: string;
  lifeState?: {
    tsn_hours?: number | null;
    tso_hours?: number | null;
    csn_cycles?: number | null;
    cso_cycles?: number | null;
    overhaul_reference_date?: string | null;
    calendar_reference_date?: string | null;
  };
  limit: {
    limit_type: string;
    basis: string;
    limit_hours?: number | null;
    limit_cycles?: number | null;
    limit_months?: number | null;
    description?: string | null;
  };
}) {
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const registrationSequence = (++aircraftRegistrationCounter)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0');
  const manufacturer = await Manufacturer.create({
    code: `MON_MFR_${suffix}`,
    name: `Monitor Manufacturer ${suffix}`,
    is_active: true,
  });
  const assetType = await AssetType.create({
    code: `MON_ASSET_${suffix}`,
    label: `Monitor Asset ${suffix}`,
    is_installable_on_aircraft: true,
    is_required_for_aircraft: false,
    required_quantity: 0,
    is_active: true,
    system_locked: false,
  });
  const category = await AircraftCategory.create({
    code: `MON_CAT_${suffix}`,
    label: `Monitor Category ${suffix}`,
    is_active: true,
    system_locked: false,
  });
  const model = await ComponentModel.create({
    model_name: `Monitor Model ${suffix}`,
    model_code: `MON_MODEL_${suffix}`,
    manufacturer_id: manufacturer.id,
    asset_type_id: assetType.id,
    is_active: true,
  });
  const aircraft = await Aircraft.create({
    registration: `ZS-MON-${testRunSuffix}-${registrationSequence}`,
    serial_number: `MON-AIR-${suffix}`,
    model_id: model.id,
    category_id: category.id,
    status: 'ACTIVE',
    total_time_hours: 0,
    total_time_cycles: 0,
    version: 0,
  });
  const serializedComponent = await SerializedComponent.create({
    component_model_id: model.id,
    serial_number: `MON-SC-${suffix}`,
    status: 'INSTALLED',
  });
  const lifeLimit = await ComponentLifeLimit.create({
    component_model_id: model.id,
    limit_type: options.limit.limit_type,
    basis: options.limit.basis,
    limit_hours: options.limit.limit_hours ?? null,
    limit_cycles: options.limit.limit_cycles ?? null,
    limit_months: options.limit.limit_months ?? null,
    description: options.limit.description ?? null,
    is_active: true,
  });

  if (options.lifeState) {
    await SerializedComponentLifeState.create({
      serialized_component_id: serializedComponent.id,
      tsn_hours: options.lifeState.tsn_hours ?? null,
      tso_hours: options.lifeState.tso_hours ?? null,
      csn_cycles: options.lifeState.csn_cycles ?? null,
      cso_cycles: options.lifeState.cso_cycles ?? null,
      overhaul_reference_date: options.lifeState.overhaul_reference_date ?? null,
      calendar_reference_date: options.lifeState.calendar_reference_date ?? null,
    });
  }

  const aircraftHours = options.aircraftHours ?? 0;
  const aircraftCycles = options.aircraftCycles ?? 0;

  if (aircraftHours > 0 || aircraftCycles > 0) {
    await UtilisationService.recordUtilisation({
      aircraftId: aircraft.id,
      newTotalTimeHours: aircraftHours,
      newTotalTimeCycles: aircraftCycles,
      sourceType: 'MANUAL_ENTRY',
      effectiveDate: '2026-06-17',
      reason: 'Seed component limit monitoring aircraft snapshot',
    });
  }

  const installation = await AircraftComponentInstallation.create({
    aircraft_id: aircraft.id,
    serialized_component_id: serializedComponent.id,
    installation_context: 'MAINTENANCE_INSTALL',
    installed_at: options.installedAt ?? '2026-06-17',
    tracking_basis: options.trackingBasis,
    install_aircraft_hours: options.installAircraftHours,
    install_aircraft_cycles: options.installAircraftCycles,
    install_tsn: options.installTsn,
    install_tso: options.installTso,
    install_csn: options.installCsn,
    install_cso: options.installCso,
    position: 'LH',
  });

  return { aircraft, installation, lifeLimit, model, serializedComponent };
}

describe('ComponentLimitMonitoringService', () => {
  it('monitors TBO hours from calculated TSO', async () => {
    const { installation } = await createMonitoringContext({
      trackingBasis: 'AIRCRAFT_HOURS',
      aircraftHours: 40,
      installAircraftHours: 10,
      installTsn: 100,
      installTso: 20,
      limit: {
        limit_type: 'TBO HOURS',
        basis: 'SINCE_OVERHAUL',
        limit_hours: 60,
      },
    });

    const [result] = await ComponentLimitMonitoringService.monitorInstallation(installation.id);

    expect(result.limit_type).toBe('TBO_HOURS');
    expect(result.current_value).toBe(50);
    expect(result.limit_value).toBe(60);
    expect(result.remaining_value).toBe(10);
    expect(result.due_status).toBe('DUE_SOON');
    expect(result.severity).toBe('WARNING');
  });

  it('monitors TBO cycles from calculated CSO', async () => {
    const { installation } = await createMonitoringContext({
      trackingBasis: 'AIRCRAFT_CYCLES',
      aircraftCycles: 20,
      installAircraftCycles: 8,
      installCsn: 50,
      installCso: 12,
      limit: {
        limit_type: 'TBO CYCLES',
        basis: 'CSO',
        limit_cycles: 30,
      },
    });

    const [result] = await ComponentLimitMonitoringService.monitorInstallation(installation.id);

    expect(result.limit_type).toBe('TBO_CYCLES');
    expect(result.current_value).toBe(24);
    expect(result.remaining_value).toBe(6);
    expect(result.due_status).toBe('DUE_SOON');
  });

  it('monitors retirement hours from calculated TSN', async () => {
    const { installation } = await createMonitoringContext({
      trackingBasis: 'AIRCRAFT_HOURS',
      aircraftHours: 50,
      installAircraftHours: 20,
      installTsn: 900,
      installTso: 100,
      limit: {
        limit_type: 'RETIREMENT HOURS',
        basis: 'SINCE_NEW',
        limit_hours: 1000,
      },
    });

    const [result] = await ComponentLimitMonitoringService.monitorInstallation(installation.id);

    expect(result.limit_type).toBe('RETIREMENT_HOURS');
    expect(result.current_value).toBe(930);
    expect(result.remaining_value).toBe(70);
    expect(result.due_status).toBe('NOT_DUE');
    expect(result.severity).toBe('NORMAL');
  });

  it('monitors retirement cycles from calculated CSN', async () => {
    const { installation } = await createMonitoringContext({
      trackingBasis: 'AIRCRAFT_CYCLES',
      aircraftCycles: 70,
      installAircraftCycles: 50,
      installCsn: 980,
      installCso: 100,
      limit: {
        limit_type: 'RETIREMENT CYCLES',
        basis: 'SINCE_NEW',
        limit_cycles: 1000,
      },
    });

    const [result] = await ComponentLimitMonitoringService.monitorInstallation(installation.id);

    expect(result.limit_type).toBe('RETIREMENT_CYCLES');
    expect(result.current_value).toBe(1000);
    expect(result.remaining_value).toBe(0);
    expect(result.due_status).toBe('DUE');
    expect(result.severity).toBe('SEVERE');
  });

  it('marks hard-life due and overdue limits as SEVERE', async () => {
    const { installation } = await createMonitoringContext({
      trackingBasis: 'AIRCRAFT_HOURS',
      aircraftHours: 25,
      installAircraftHours: 10,
      installTsn: 90,
      installTso: 5,
      limit: {
        limit_type: 'HARD LIFE LIMIT',
        basis: 'TSN',
        limit_hours: 100,
      },
    });

    const [result] = await ComponentLimitMonitoringService.monitorInstallation(installation.id);

    expect(result.due_status).toBe('OVERDUE');
    expect(result.severity).toBe('SEVERE');
  });

  it('monitors calendar life from an approved reference date', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { installation } = await createMonitoringContext({
      trackingBasis: 'CALENDAR',
      installedAt: today,
      lifeState: {
        calendar_reference_date: today,
      },
      limit: {
        limit_type: 'CALENDAR LIFE',
        basis: 'CALENDAR',
        limit_months: 12,
      },
    });

    const [result] = await ComponentLimitMonitoringService.monitorInstallation(installation.id);

    expect(result.limit_type).toBe('CALENDAR_LIFE');
    expect(result.due_status).toBe('NOT_DUE');
    expect(result.source_baseline.reference_date).toBe(today);
  });

  it('returns UNKNOWN when required life baselines are missing', async () => {
    const { installation } = await createMonitoringContext({
      trackingBasis: 'AIRCRAFT_HOURS',
      aircraftHours: 40,
      installAircraftHours: null,
      installTsn: 100,
      installTso: 20,
      limit: {
        limit_type: 'TBO HOURS',
        basis: 'SINCE_OVERHAUL',
        limit_hours: 60,
      },
    });

    const [result] = await ComponentLimitMonitoringService.monitorInstallation(installation.id);

    expect(result.due_status).toBe('UNKNOWN');
    expect(result.unknown_reason).toContain('install_aircraft_hours is missing');
  });

  it('monitors manual authorised limits through manual life-state values', async () => {
    const { installation } = await createMonitoringContext({
      trackingBasis: 'MANUAL_AUTHORISED',
      lifeState: {
        tsn_hours: 75,
      },
      limit: {
        limit_type: 'MANUAL AUTHORISED HOURS',
        basis: 'MANUAL',
        limit_hours: 100,
      },
    });

    const [result] = await ComponentLimitMonitoringService.monitorInstallation(installation.id);

    expect(result.limit_type).toBe('MANUAL_AUTHORISED');
    expect(result.current_value).toBe(75);
    expect(result.remaining_value).toBe(25);
    expect(result.source_baseline.life_state_value).toBe(75);
  });

  it('returns the required explanation fields', async () => {
    const { installation, serializedComponent } = await createMonitoringContext({
      trackingBasis: 'AIRCRAFT_HOURS',
      aircraftHours: 40,
      installAircraftHours: 10,
      installTsn: 100,
      installTso: 20,
      limit: {
        limit_type: 'TBO HOURS',
        basis: 'SINCE_OVERHAUL',
        limit_hours: 60,
      },
    });

    const [result] = await ComponentLimitMonitoringService.monitorInstallation(installation.id);

    expect(result.component.serialized_component_id).toBe(serializedComponent.id);
    expect(result.component.installation_id).toBe(installation.id);
    expect(result.component.position).toBe('LH');
    expect(result.limit_type).toBe('TBO_HOURS');
    expect(result.tracking_basis).toBe('AIRCRAFT_HOURS');
    expect(result.current_value).toBe(50);
    expect(result.limit_value).toBe(60);
    expect(result.remaining_value).toBe(10);
    expect(result.due_status).toBe('DUE_SOON');
    expect(result.severity).toBe('WARNING');
    expect(result.source_baseline).toEqual({
      install_tso: 20,
      install_aircraft_hours: 10,
    });
    expect(result.unknown_reason).toBeNull();
    expect(result.explanation).toContain('TBO_HOURS');
  });
});
