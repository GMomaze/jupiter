import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
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
  Tenant,
  User,
} from '../../models/index.js';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { UtilisationService } from '../utilisation/utilisation.service.js';
import { AircraftComponentService } from './aircraft-component.service.js';

const testRunSuffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
let registrationSequence = 0;

async function createSerializedInstallContext() {
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const owner = await User.create({ email: `tracking-${suffix}@example.test`, password_hash: 'test', full_name: 'Tracking Test Owner', is_active: true });
  const tenant = await Tenant.create({ code: `TRACKING_${suffix}`, display_name: `Tracking Tenant ${suffix}`, status: 'ACTIVE', created_by_user_id: owner.id, updated_by_user_id: owner.id });
  const authority = createTenantQueryAuthority({ state: 'VALID_ACTIVE_TENANT', tenant: { id: tenant.id, publicId: tenant.public_id, code: tenant.code, displayName: tenant.display_name, status: 'ACTIVE' }, membership: { id: randomUUID(), tenantId: tenant.id, userId: owner.id, status: 'ACTIVE' }, validatedAt: Date.now() });
  registrationSequence += 1;
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
    registration: `ZS-TRK-${testRunSuffix}-${registrationSequence}`,
    serial_number: `TRK-SN-${suffix}-${registrationSequence}`,
    model_id: model.id,
    category_id: category.id,
    status: 'ACTIVE',
    total_time_hours: 0,
    total_time_cycles: 0,
    version: 0,
    tenant_id: tenant.id,
  });
  const serializedComponent = await SerializedComponent.create({
    component_model_id: model.id,
    serial_number: `SC-${suffix}`,
    status: 'AVAILABLE',
    custodian_tenant_id: tenant.id,
  });

  await UtilisationService.recordUtilisation(authority, {
    aircraftId: aircraft.id,
    newTotalTimeHours: 12.5,
    newTotalTimeCycles: 7,
    sourceType: 'MANUAL_ENTRY',
    effectiveDate: '2026-06-17',
    reason: 'Seed install baseline utilisation',
  });

  return { aircraft, model, serializedComponent, authority };
}

describe('AircraftComponentService serialized tracking basis baselines', () => {
  it('requires tracking basis for serialized installation', async () => {
    const { aircraft, serializedComponent, authority } = await createSerializedInstallContext();

    await expect(
      AircraftComponentService.installSerializedComponent(authority, {
        aircraft_id: aircraft.id,
        serialized_component_id: serializedComponent.id,
        installed_at: '2026-06-17',
      })
    ).rejects.toThrow(/TRACKING_BASIS_REQUIRED/);
  });

  it('requires tracking basis for baseline capture', async () => {
    const { aircraft, serializedComponent, authority } = await createSerializedInstallContext();

    await expect(
      AircraftComponentService.baselineCaptureSerializedComponent(authority, {
        aircraft_id: aircraft.id,
        serialized_component_id: serializedComponent.id,
        installed_at: '2026-06-17',
      })
    ).rejects.toThrow(/TRACKING_BASIS_REQUIRED/);
  });

  it('creates exactly one active baseline installation and installs the serialized component', async () => {
    const { aircraft, serializedComponent, authority } = await createSerializedInstallContext();

    await AircraftComponentService.baselineCaptureSerializedComponent(authority, {
      aircraft_id: aircraft.id,
      serialized_component_id: serializedComponent.id,
      installed_at: '2026-06-17',
      tracking_basis: 'AIRCRAFT_HOURS',
      install_tsn: '100.25',
      install_tso: '5.5',
    });

    const activeInstallations = await AircraftComponentInstallation.findAll({
      where: {
        aircraft_id: aircraft.id,
        serialized_component_id: serializedComponent.id,
        removed_at: null,
      },
    });
    const refreshedComponent = await SerializedComponent.findByPk(serializedComponent.id);

    expect(activeInstallations).toHaveLength(1);
    expect(activeInstallations[0]?.installation_context).toBe('BASELINE_CAPTURE');
    expect(activeInstallations[0]?.tracking_basis).toBe('AIRCRAFT_HOURS');
    expect(refreshedComponent?.status).toBe('INSTALLED');
  });

  it('keeps duplicate active baseline installation protection', async () => {
    const { aircraft, serializedComponent, authority } = await createSerializedInstallContext();

    await AircraftComponentService.baselineCaptureSerializedComponent(authority, {
      aircraft_id: aircraft.id,
      serialized_component_id: serializedComponent.id,
      installed_at: '2026-06-17',
      tracking_basis: 'AIRCRAFT_HOURS',
    });

    await SerializedComponent.update(
      { status: 'AVAILABLE' },
      { where: { id: serializedComponent.id } }
    );

    await expect(
      AircraftComponentService.baselineCaptureSerializedComponent(authority, {
        aircraft_id: aircraft.id,
        serialized_component_id: serializedComponent.id,
        installed_at: '2026-06-18',
        tracking_basis: 'AIRCRAFT_HOURS',
      })
    ).rejects.toThrow(/SERIALIZED_COMPONENT_ALREADY_INSTALLED/);

    expect(
      await AircraftComponentInstallation.count({
        where: { serialized_component_id: serializedComponent.id, removed_at: null },
      })
    ).toBe(1);
  });

  it('captures aircraft snapshot and CSN/CSO baselines on serialized install', async () => {
    const { aircraft, serializedComponent, authority } = await createSerializedInstallContext();

    await AircraftComponentService.installSerializedComponent(authority, {
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

  it('shows installed serialized components through active installation visibility after install', async () => {
    const { aircraft, serializedComponent, authority } = await createSerializedInstallContext();

    await AircraftComponentService.installSerializedComponent(authority, {
      aircraft_id: aircraft.id,
      serialized_component_id: serializedComponent.id,
      installed_at: '2026-06-17',
      tracking_basis: 'AIRCRAFT_HOURS',
      position: 'BAT-1',
    });

    const activeInstallations =
      await AircraftComponentService.getActiveSerializedInstallationsForAircraft(authority, aircraft.id);

    expect(activeInstallations).toHaveLength(1);
    expect(activeInstallations[0]?.serialized_component_id).toBe(serializedComponent.id);
    expect(activeInstallations[0]?.removed_at).toBeNull();
    expect(activeInstallations[0]?.SerializedComponent?.serial_number).toBe(
      serializedComponent.serial_number
    );
  });

  it('captures aircraft snapshot and CSN/CSO baselines on serialized removal', async () => {
    const { aircraft, serializedComponent, authority } = await createSerializedInstallContext();

    await AircraftComponentService.installSerializedComponent(authority, {
      aircraft_id: aircraft.id,
      serialized_component_id: serializedComponent.id,
      installed_at: '2026-06-17',
      tracking_basis: 'AIRCRAFT_HOURS',
    });

    const installation = await AircraftComponentInstallation.findOne({
      where: { serialized_component_id: serializedComponent.id, removed_at: null },
    });

    await UtilisationService.recordUtilisation(authority, {
      aircraftId: aircraft.id,
      newTotalTimeHours: 14.75,
      newTotalTimeCycles: 9,
      sourceType: 'MANUAL_ENTRY',
      effectiveDate: '2026-06-18',
      reason: 'Seed removal baseline utilisation',
    });

    await AircraftComponentService.removeSerializedComponent(authority, {
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
    const { aircraft, serializedComponent, authority } = await createSerializedInstallContext();

    await expect(
      AircraftComponentService.installSerializedComponent(authority, {
        aircraft_id: aircraft.id,
        serialized_component_id: serializedComponent.id,
        installed_at: '2026-06-17',
        tracking_basis: 'AIRCRAFT_CYCLES',
        install_csn: '1.5',
      })
    ).rejects.toThrow(/INVALID_INSTALL_CSN/);

    await expect(
      AircraftComponentService.installSerializedComponent(authority, {
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

  it('does not render a conflicting legacy empty message in installed component views', () => {
    const aircraftView = readFileSync('src/views/aircraft/view.ejs', 'utf8');
    const overviewPartial = readFileSync(
      'src/views/aircraft/partials/view-overview-panel.ejs',
      'utf8'
    );
    const operationalPartial = readFileSync(
      'src/views/aircraft/partials/installed-components-operational-ux.ejs',
      'utf8'
    );

    expect(aircraftView).toContain('No active serialized installations are currently visible on this aircraft.');
    expect(aircraftView).toContain('Legacy Component Records');
    expect(aircraftView).not.toContain('No components installed.');
    expect(overviewPartial).not.toContain('No components installed.');
    expect(operationalPartial).toContain('No active serialized installations are currently visible on this aircraft.');
    expect(operationalPartial).toContain('Legacy Component Records');
    expect(operationalPartial).not.toContain('No components installed.');
  });

  it('renders serialized allocation as a guided single entry point across aircraft views', () => {
    const aircraftView = readFileSync('src/views/aircraft/view.ejs', 'utf8');
    const overviewPartial = readFileSync(
      'src/views/aircraft/partials/view-overview-panel.ejs',
      'utf8'
    );
    const operationalPartial = readFileSync(
      'src/views/aircraft/partials/installed-components-operational-ux.ejs',
      'utf8'
    );

    for (const template of [aircraftView, overviewPartial, operationalPartial]) {
      expect(template).toContain('Allocate Serialized Component to Aircraft');
      expect(template).toContain('Is this component already installed on the aircraft?');
      expect(template).toContain('Yes - Capture Existing Installed Component');
      expect(template).toContain('No - Install Component Now');
      expect(template).toContain('Already installed / onboarding capture');
      expect(template).toContain('Install component now');
      expect(template).toContain('/serialized-components/baseline-capture');
      expect(template).toContain('/serialized-components');
      expect(template).toContain('Allocate to Aircraft');
    }
  });

  it('submits the established tracking basis options from every baseline form', () => {
    const aircraftView = readFileSync('src/views/aircraft/view.ejs', 'utf8');
    const overviewPartial = readFileSync(
      'src/views/aircraft/partials/view-overview-panel.ejs',
      'utf8'
    );
    const operationalPartial = readFileSync(
      'src/views/aircraft/partials/installed-components-operational-ux.ejs',
      'utf8'
    );
    const acceptedOptions = [
      'AIRCRAFT_HOURS',
      'AIRCRAFT_CYCLES',
      'CALENDAR',
      'ENGINE_METER',
      'PROPELLER_METER',
      'MANUAL_AUTHORISED',
    ];

    for (const template of [aircraftView, overviewPartial, operationalPartial]) {
      const baselineForm = template.match(
        /<form action="[^"]*\/serialized-components\/baseline-capture"[\s\S]*?<\/form>/
      )?.[0];

      expect(baselineForm).toBeTruthy();
      expect(baselineForm).toContain('name="tracking_basis"');
      expect(baselineForm).toContain('required');
      for (const option of acceptedOptions) {
        expect(baselineForm).toContain(`value="${option}"`);
      }
    }
  });

  it('shows a friendly tracking-basis validation message in installed component workflow', () => {
    const controller = readFileSync('src/modules/aircraft/aircraft.controller.ts', 'utf8');
    const aircraftView = readFileSync('src/views/aircraft/view.ejs', 'utf8');
    const operationalPartial = readFileSync(
      'src/views/aircraft/partials/installed-components-operational-ux.ejs',
      'utf8'
    );

    expect(controller).toContain("err.message === 'TRACKING_BASIS_REQUIRED'");
    expect(controller).toContain(
      'Select a tracking basis before capturing the existing installed component.'
    );
    for (const template of [aircraftView, operationalPartial]) {
      expect(template).toMatch(/installed-components-panel[\s\S]*messages\.error/);
    }
  });

  it('defaults serialized allocation to install and hides the onboarding form until selected', () => {
    const aircraftView = readFileSync('src/views/aircraft/view.ejs', 'utf8');
    const overviewPartial = readFileSync(
      'src/views/aircraft/partials/view-overview-panel.ejs',
      'utf8'
    );
    const operationalPartial = readFileSync(
      'src/views/aircraft/partials/installed-components-operational-ux.ejs',
      'utf8'
    );

    for (const template of [aircraftView, overviewPartial, operationalPartial]) {
      expect(template).toMatch(/data-serialized-allocation-intent="install"[\s\S]*checked/);
      expect(template).toMatch(
        /class="[^"]*hidden[^"]*"[\s\S]*data-serialized-allocation-panel="baseline"/
      );
      expect(template).toContain('data-serialized-allocation-panel="install"');
    }

    expect(aircraftView).toContain('activateSerializedAllocationIntent');
    expect(operationalPartial).toContain('activateAllocationIntent');
  });

  it('keeps installed serialized visibility primary and uses remove/unallocate wording', () => {
    const aircraftView = readFileSync('src/views/aircraft/view.ejs', 'utf8');
    const operationalPartial = readFileSync(
      'src/views/aircraft/partials/installed-components-operational-ux.ejs',
      'utf8'
    );

    for (const template of [aircraftView, operationalPartial]) {
      expect(template).toContain('Active Serialized Installations');
      expect(template).toContain('Legacy Component Records');
      expect(template).toContain('Remove / Unallocate');
    }
  });

  it('uses available serialized components as operational UX dropdown fallback candidates', () => {
    const operationalPartial = readFileSync(
      'src/views/aircraft/partials/installed-components-operational-ux.ejs',
      'utf8'
    );

    expect(operationalPartial).toContain("typeof availableSerializedComponents !== 'undefined'");
    expect(operationalPartial).toContain('fallbackSerializedCandidates');
    expect(operationalPartial).toContain('installedUxAvailableCandidates');
    expect(operationalPartial).toContain('serialized_component_id: component.id');
    expect(operationalPartial).not.toContain('serialized_component_id: component.component_model_id');
  });

  it('explains empty serialized candidate state and links to component creation', () => {
    const operationalPartial = readFileSync(
      'src/views/aircraft/partials/installed-components-operational-ux.ejs',
      'utf8'
    );

    expect(operationalPartial).toContain(
      'No available serialized components found. Create a serialized component first, then return here to allocate it to this aircraft.'
    );
    expect(operationalPartial).toContain('href="/library/serialized-components/create"');
    expect(operationalPartial).toContain('Create Serialized Component');
  });
});
