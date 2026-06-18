import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  Aircraft,
  AircraftCategory,
  AircraftComponent,
  AircraftComponentInstallation,
  AssetType,
  ComponentModel,
  Manufacturer,
  SerializedComponent,
} from '../../models/index.js';
import { UtilisationService } from '../utilisation/utilisation.service.js';
import { AircraftComponentService } from './aircraft-component.service.js';

async function createSerializedInstallContext() {
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const registrationSuffix = suffix
    .slice(0, 3)
    .split('')
    .map((char) => String.fromCharCode(65 + (char.charCodeAt(0) % 26)))
    .join('');
  const manufacturer = await Manufacturer.create({
    code: `MFR_${suffix}`,
    name: `Manufacturer ${suffix}`,
    is_active: true,
  });
  const assetType = await AssetType.create({
    code: `INSTALLABLE_${suffix}`,
    label: `Installable ${suffix}`,
    is_installable_on_aircraft: true,
    is_required_for_aircraft: false,
    required_quantity: 0,
    is_active: true,
    system_locked: false,
  });
  const category = await AircraftCategory.create({
    code: `CAT_${suffix}`,
    label: `Category ${suffix}`,
    is_active: true,
    system_locked: false,
  });
  const model = await ComponentModel.create({
    model_name: `Model ${suffix}`,
    model_code: `MODEL_${suffix}`,
    manufacturer_id: manufacturer.id,
    asset_type_id: assetType.id,
    is_active: true,
  });
  const aircraft = await Aircraft.create({
    registration: `ZS-${registrationSuffix}`,
    serial_number: `SN-${suffix}`,
    model_id: model.id,
    category_id: category.id,
    status: 'ACTIVE',
    total_time_hours: 0,
    total_time_cycles: 0,
    version: 0,
  });
  const serializedComponent = await SerializedComponent.create({
    component_model_id: model.id,
    serial_number: `SC-${suffix}`,
    status: 'AVAILABLE',
  });

  await UtilisationService.recordUtilisation({
    aircraftId: aircraft.id,
    newTotalTimeHours: 12.5,
    newTotalTimeCycles: 7,
    sourceType: 'MANUAL_ENTRY',
    effectiveDate: '2026-06-17',
    reason: 'Seed install baseline utilisation',
  });

  return { aircraft, model, serializedComponent };
}

describe('AircraftComponentService serialized tracking basis baselines', () => {
  it('requires tracking basis for serialized installation', async () => {
    const { aircraft, serializedComponent } = await createSerializedInstallContext();

    await expect(
      AircraftComponentService.installSerializedComponent({
        aircraft_id: aircraft.id,
        serialized_component_id: serializedComponent.id,
        installed_at: '2026-06-17',
      })
    ).rejects.toThrow(/TRACKING_BASIS_REQUIRED/);
  });

  it('captures aircraft snapshot and CSN/CSO baselines on serialized install', async () => {
    const { aircraft, serializedComponent } = await createSerializedInstallContext();

    await AircraftComponentService.installSerializedComponent({
      aircraft_id: aircraft.id,
      serialized_component_id: serializedComponent.id,
      installed_at: '2026-06-17',
      tracking_basis: 'AIRCRAFT_CYCLES',
      install_tsn: '100.25',
      install_tso: '5.5',
      install_csn: '42',
      install_cso: '6',
    });

    const installation = await AircraftComponentInstallation.findOne({
      where: { serialized_component_id: serializedComponent.id },
    });

    expect(installation?.tracking_basis).toBe('AIRCRAFT_CYCLES');
    expect(Number(installation?.install_aircraft_hours)).toBe(12.5);
    expect(installation?.install_aircraft_cycles).toBe(7);
    expect(Number(installation?.install_tsn)).toBe(100.25);
    expect(Number(installation?.install_tso)).toBe(5.5);
    expect(installation?.install_csn).toBe(42);
    expect(installation?.install_cso).toBe(6);
  });

  it('captures aircraft snapshot and CSN/CSO baselines on serialized removal', async () => {
    const { aircraft, serializedComponent } = await createSerializedInstallContext();

    await AircraftComponentService.installSerializedComponent({
      aircraft_id: aircraft.id,
      serialized_component_id: serializedComponent.id,
      installed_at: '2026-06-17',
      tracking_basis: 'AIRCRAFT_HOURS',
    });

    const installation = await AircraftComponentInstallation.findOne({
      where: { serialized_component_id: serializedComponent.id, removed_at: null },
    });

    await UtilisationService.recordUtilisation({
      aircraftId: aircraft.id,
      newTotalTimeHours: 14.75,
      newTotalTimeCycles: 9,
      sourceType: 'MANUAL_ENTRY',
      effectiveDate: '2026-06-18',
      reason: 'Seed removal baseline utilisation',
    });

    await AircraftComponentService.removeSerializedComponent({
      aircraft_id: aircraft.id,
      installation_id: installation?.id,
      removed_at: '2026-06-18',
      resulting_status: 'AVAILABLE',
      removal_tsn: '110.5',
      removal_tso: '15.25',
      removal_csn: '50',
      removal_cso: '8',
    });

    const removedInstallation = await AircraftComponentInstallation.findByPk(installation?.id);

    expect(Number(removedInstallation?.removal_aircraft_hours)).toBe(14.75);
    expect(removedInstallation?.removal_aircraft_cycles).toBe(9);
    expect(Number(removedInstallation?.removal_tsn)).toBe(110.5);
    expect(Number(removedInstallation?.removal_tso)).toBe(15.25);
    expect(removedInstallation?.removal_csn).toBe(50);
    expect(removedInstallation?.removal_cso).toBe(8);
  });

  it('rejects negative and fractional cycle baselines', async () => {
    const { aircraft, serializedComponent } = await createSerializedInstallContext();

    await expect(
      AircraftComponentService.installSerializedComponent({
        aircraft_id: aircraft.id,
        serialized_component_id: serializedComponent.id,
        installed_at: '2026-06-17',
        tracking_basis: 'AIRCRAFT_CYCLES',
        install_csn: '1.5',
      })
    ).rejects.toThrow(/INVALID_INSTALL_CSN/);

    await expect(
      AircraftComponentService.installSerializedComponent({
        aircraft_id: aircraft.id,
        serialized_component_id: serializedComponent.id,
        installed_at: '2026-06-17',
        tracking_basis: 'AIRCRAFT_CYCLES',
        install_cso: '-1',
      })
    ).rejects.toThrow(/INVALID_INSTALL_CSO/);
  });

  it('keeps legacy aircraft_components readable', async () => {
    const { aircraft, model } = await createSerializedInstallContext();
    const legacy = await AircraftComponent.create({
      aircraft_id: aircraft.id,
      model_id: model.id,
      serial_number: `LEGACY-${randomUUID().slice(0, 8)}`,
      installation_date: '2026-06-17',
      tsn_at_install: 10,
      tso_at_install: 2,
      install_af_hours: 12.5,
      current_status: 'INSTALLED',
      version: 0,
    });

    const stored = await AircraftComponent.findByPk(legacy.id);

    expect(stored?.serial_number).toBe(legacy.serial_number);
    expect(Number(stored?.install_af_hours)).toBe(12.5);
    expect(Number(stored?.tsn_at_install)).toBe(10);
    expect(Number(stored?.tso_at_install)).toBe(2);
  });
});
