import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  Aircraft,
  AircraftCategory,
  AircraftComponentInstallation,
  AssetType,
  ComponentModel,
  Manufacturer,
  SerializedComponent,
  SerializedComponentLifeState,
} from '../../models/index.js';
import { UtilisationService } from '../utilisation/utilisation.service.js';
import { ComponentLifeCalculationService } from './component-life-calculation.service.js';

const testRunSuffix = Date.now().toString(36).toUpperCase();
let aircraftRegistrationCounter = 0;

async function createCalculationContext(options: {
  trackingBasis: string;
  aircraftHours?: number;
  aircraftCycles?: number;
  installAircraftHours?: number | null;
  installAircraftCycles?: number | null;
  installTsn?: number | null;
  installTso?: number | null;
  installCsn?: number | null;
  installCso?: number | null;
}) {
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const registrationSequence = (++aircraftRegistrationCounter)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0');
  const manufacturer = await Manufacturer.create({
    code: `MFR_LIFE_${suffix}`,
    name: `Life Manufacturer ${suffix}`,
    is_active: true,
  });
  const assetType = await AssetType.create({
    code: `LIFE_ASSET_${suffix}`,
    label: `Life Asset ${suffix}`,
    is_installable_on_aircraft: true,
    is_required_for_aircraft: false,
    required_quantity: 0,
    is_active: true,
    system_locked: false,
  });
  const category = await AircraftCategory.create({
    code: `LIFE_CAT_${suffix}`,
    label: `Life Category ${suffix}`,
    is_active: true,
    system_locked: false,
  });
  const model = await ComponentModel.create({
    model_name: `Life Model ${suffix}`,
    model_code: `LIFE_MODEL_${suffix}`,
    manufacturer_id: manufacturer.id,
    asset_type_id: assetType.id,
    is_active: true,
  });
  const aircraft = await Aircraft.create({
    registration: `ZS-LIFE-${testRunSuffix}-${registrationSequence}`,
    serial_number: `LIFE-SN-${suffix}`,
    model_id: model.id,
    category_id: category.id,
    status: 'ACTIVE',
    total_time_hours: 0,
    total_time_cycles: 0,
    version: 0,
  });
  const serializedComponent = await SerializedComponent.create({
    component_model_id: model.id,
    serial_number: `LIFE-SC-${suffix}`,
    status: 'INSTALLED',
  });

  const aircraftHours = options.aircraftHours ?? 15.5;
  const aircraftCycles = options.aircraftCycles ?? 11;

  if (aircraftHours > 0 || aircraftCycles > 0) {
    await UtilisationService.recordUtilisation({
      aircraftId: aircraft.id,
      newTotalTimeHours: aircraftHours,
      newTotalTimeCycles: aircraftCycles,
      sourceType: 'MANUAL_ENTRY',
      effectiveDate: '2026-06-17',
      reason: 'Seed component life calculation aircraft snapshot',
    });
  }

  const installation = await AircraftComponentInstallation.create({
    aircraft_id: aircraft.id,
    serialized_component_id: serializedComponent.id,
    installation_context: 'MAINTENANCE_INSTALL',
    installed_at: '2026-06-17',
    tracking_basis: options.trackingBasis,
    install_aircraft_hours: options.installAircraftHours,
    install_aircraft_cycles: options.installAircraftCycles,
    install_tsn: options.installTsn,
    install_tso: options.installTso,
    install_csn: options.installCsn,
    install_cso: options.installCso,
  });

  return { aircraft, installation, serializedComponent };
}

describe('ComponentLifeCalculationService', () => {
  it('calculates AIRCRAFT_HOURS TSN from install baseline and aircraft hour delta', async () => {
    const { installation } = await createCalculationContext({
      trackingBasis: 'AIRCRAFT_HOURS',
      aircraftHours: 15.5,
      installAircraftHours: 10.25,
      installTsn: 100,
      installTso: 20,
    });

    const result = await ComponentLifeCalculationService.calculateForInstallation(installation.id);

    expect(result.dimensions.tsn_hours.status).toBe('CALCULATED');
    expect(result.dimensions.tsn_hours.value).toBe(105.25);
    expect(result.dimensions.tsn_hours.delta_applied).toBe(5.25);
  });

  it('calculates AIRCRAFT_HOURS TSO from install baseline and aircraft hour delta', async () => {
    const { installation } = await createCalculationContext({
      trackingBasis: 'AIRCRAFT_HOURS',
      aircraftHours: 22,
      installAircraftHours: 12,
      installTsn: 50,
      installTso: 7.5,
    });

    const result = await ComponentLifeCalculationService.calculateForInstallation(installation.id);

    expect(result.dimensions.tso_hours.status).toBe('CALCULATED');
    expect(result.dimensions.tso_hours.value).toBe(17.5);
    expect(result.dimensions.csn_cycles.status).toBe('UNKNOWN');
  });

  it('calculates AIRCRAFT_CYCLES CSN from install baseline and aircraft cycle delta', async () => {
    const { installation } = await createCalculationContext({
      trackingBasis: 'AIRCRAFT_CYCLES',
      aircraftCycles: 12,
      installAircraftCycles: 7,
      installCsn: 40,
      installCso: 3,
    });

    const result = await ComponentLifeCalculationService.calculateForInstallation(installation.id);

    expect(result.dimensions.csn_cycles.status).toBe('CALCULATED');
    expect(result.dimensions.csn_cycles.value).toBe(45);
    expect(result.dimensions.csn_cycles.delta_applied).toBe(5);
  });

  it('calculates AIRCRAFT_CYCLES CSO from install baseline and aircraft cycle delta', async () => {
    const { installation } = await createCalculationContext({
      trackingBasis: 'AIRCRAFT_CYCLES',
      aircraftCycles: 9,
      installAircraftCycles: 4,
      installCsn: 30,
      installCso: 8,
    });

    const result = await ComponentLifeCalculationService.calculateForInstallation(installation.id);

    expect(result.dimensions.cso_cycles.status).toBe('CALCULATED');
    expect(result.dimensions.cso_cycles.value).toBe(13);
    expect(result.dimensions.tsn_hours.status).toBe('UNKNOWN');
  });

  it('returns UNKNOWN instead of guessing when required baselines are missing', async () => {
    const { installation } = await createCalculationContext({
      trackingBasis: 'AIRCRAFT_HOURS',
      aircraftHours: 15.5,
      installAircraftHours: null,
      installTsn: 100,
    });

    const result = await ComponentLifeCalculationService.calculateForInstallation(installation.id);

    expect(result.dimensions.tsn_hours.status).toBe('UNKNOWN');
    expect(result.dimensions.tsn_hours.value).toBeNull();
    expect(result.dimensions.tsn_hours.missing_reasons).toContain(
      'install_aircraft_hours is missing.'
    );
  });

  it('returns UNKNOWN for CALENDAR hour and cycle life', async () => {
    const { installation } = await createCalculationContext({
      trackingBasis: 'CALENDAR',
    });

    const result = await ComponentLifeCalculationService.calculateForInstallation(installation.id);

    expect(result.status).toBe('UNKNOWN');
    expect(result.dimensions.tsn_hours.missing_reasons[0]).toMatch(/CALENDAR/);
    expect(result.dimensions.cso_cycles.missing_reasons[0]).toMatch(/CALENDAR/);
  });

  it('returns UNKNOWN placeholder for ENGINE_METER until engine meter authority exists', async () => {
    const { installation } = await createCalculationContext({
      trackingBasis: 'ENGINE_METER',
    });

    const result = await ComponentLifeCalculationService.calculateForInstallation(installation.id);

    expect(result.status).toBe('UNKNOWN');
    expect(result.dimensions.tsn_hours.missing_reasons[0]).toBe(
      'ENGINE_METER authority is not implemented.'
    );
  });

  it('returns UNKNOWN placeholder for PROPELLER_METER until propeller meter authority exists', async () => {
    const { installation } = await createCalculationContext({
      trackingBasis: 'PROPELLER_METER',
    });

    const result = await ComponentLifeCalculationService.calculateForInstallation(installation.id);

    expect(result.status).toBe('UNKNOWN');
    expect(result.dimensions.tsn_hours.missing_reasons[0]).toBe(
      'PROPELLER_METER authority is not implemented.'
    );
  });

  it('returns stored life-state values for MANUAL_AUTHORISED', async () => {
    const { installation, serializedComponent } = await createCalculationContext({
      trackingBasis: 'MANUAL_AUTHORISED',
    });

    await SerializedComponentLifeState.create({
      serialized_component_id: serializedComponent.id,
      tsn_hours: 123.45,
      tso_hours: 23.5,
      csn_cycles: 67,
      cso_cycles: 8,
    });

    const result = await ComponentLifeCalculationService.calculateForInstallation(installation.id);

    expect(result.status).toBe('CALCULATED');
    expect(result.dimensions.tsn_hours.value).toBe(123.45);
    expect(result.dimensions.tso_hours.value).toBe(23.5);
    expect(result.dimensions.csn_cycles.value).toBe(67);
    expect(result.dimensions.cso_cycles.value).toBe(8);
  });

  it('includes explainability fields for calculated dimensions', async () => {
    const { installation } = await createCalculationContext({
      trackingBasis: 'AIRCRAFT_HOURS',
      aircraftHours: 14,
      installAircraftHours: 10,
      installTsn: 80,
      installTso: 5,
    });

    const result = await ComponentLifeCalculationService.calculateForInstallation(installation.id);
    const tsn = result.dimensions.tsn_hours;

    expect(tsn.tracking_basis).toBe('AIRCRAFT_HOURS');
    expect(tsn.baseline_used).toEqual({ install_tsn: 80, install_aircraft_hours: 10 });
    expect(tsn.current_meter_value).toBe(14);
    expect(tsn.delta_applied).toBe(4);
    expect(tsn.explanation).toContain('aircraft hour delta 4');
  });
});
