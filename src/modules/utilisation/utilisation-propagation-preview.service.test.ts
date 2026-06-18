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
  UtilisationEvent,
} from '../../models/index.js';
import { UtilisationService } from './utilisation.service.js';
import { UtilisationPropagationPreviewService } from './utilisation-propagation-preview.service.js';

const previewTestRunSuffix = Date.now().toString(36).toUpperCase();
let previewAircraftCounter = 0;

async function createPreviewContext(options?: {
  trackingBasis?: string;
  installAircraftHours?: number | null;
  installAircraftCycles?: number | null;
  installTsn?: number | null;
  installTso?: number | null;
  installCsn?: number | null;
  installCso?: number | null;
}) {
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const sequence = (++previewAircraftCounter).toString(36).toUpperCase().padStart(4, '0');
  const manufacturer = await Manufacturer.create({
    code: `MFR_PREVIEW_${suffix}`,
    name: `Preview Manufacturer ${suffix}`,
    is_active: true,
  });
  const assetType = await AssetType.create({
    code: `PREVIEW_ASSET_${suffix}`,
    label: `Preview Asset ${suffix}`,
    is_installable_on_aircraft: true,
    is_required_for_aircraft: false,
    required_quantity: 0,
    is_active: true,
    system_locked: false,
  });
  const category = await AircraftCategory.create({
    code: `PREVIEW_CAT_${suffix}`,
    label: `Preview Category ${suffix}`,
    is_active: true,
    system_locked: false,
  });
  const model = await ComponentModel.create({
    model_name: `Preview Model ${suffix}`,
    model_code: `PREVIEW_MODEL_${suffix}`,
    manufacturer_id: manufacturer.id,
    asset_type_id: assetType.id,
    is_active: true,
  });
  const aircraft = await Aircraft.create({
    registration: `ZS-PREV-${previewTestRunSuffix}-${sequence}`,
    serial_number: `PREVIEW-SN-${suffix}`,
    model_id: model.id,
    category_id: category.id,
    status: 'ACTIVE',
    total_time_hours: 0,
    total_time_cycles: 0,
    version: 0,
  });
  const serializedComponent = await SerializedComponent.create({
    component_model_id: model.id,
    serial_number: `PREVIEW-SC-${suffix}`,
    part_number: `PN-${suffix}`,
    status: 'INSTALLED',
  });

  await UtilisationService.recordUtilisation({
    aircraftId: aircraft.id,
    newTotalTimeHours: 10,
    newTotalTimeCycles: 4,
    sourceType: 'MANUAL_ENTRY',
    effectiveDate: '2026-06-17',
    reason: 'Seed preview aircraft utilisation',
  });

  const installation = await AircraftComponentInstallation.create({
    aircraft_id: aircraft.id,
    serialized_component_id: serializedComponent.id,
    installation_context: 'MAINTENANCE_INSTALL',
    installed_at: '2026-06-17',
    removed_at: null,
    position: 'LH',
    tracking_basis: options?.trackingBasis ?? 'AIRCRAFT_HOURS',
    install_aircraft_hours:
      options && 'installAircraftHours' in options ? options.installAircraftHours : 5,
    install_aircraft_cycles:
      options && 'installAircraftCycles' in options ? options.installAircraftCycles : 1,
    install_tsn: options && 'installTsn' in options ? options.installTsn : 100,
    install_tso: options && 'installTso' in options ? options.installTso : 20,
    install_csn: options && 'installCsn' in options ? options.installCsn : 30,
    install_cso: options && 'installCso' in options ? options.installCso : 2,
  });

  return { aircraft, installation, serializedComponent };
}

describe('UtilisationPropagationPreviewService', () => {
  it('does not create utilisation events or update aircraft snapshots during preview', async () => {
    const { aircraft } = await createPreviewContext();
    const eventCountBefore = await UtilisationEvent.count({ where: { aircraft_id: aircraft.id } });

    await UtilisationPropagationPreviewService.preview({
      aircraftId: aircraft.id,
      proposedTotalTimeHours: 15,
      proposedTotalTimeCycles: 5,
      sourceType: 'MANUAL_ENTRY',
      effectiveDate: '2026-06-18',
      reason: 'Preview only',
    });

    const eventCountAfter = await UtilisationEvent.count({ where: { aircraft_id: aircraft.id } });
    const storedAircraft = await Aircraft.findByPk(aircraft.id);

    expect(eventCountAfter).toBe(eventCountBefore);
    expect(Number(storedAircraft?.total_time_hours)).toBe(10);
    expect(storedAircraft?.total_time_cycles).toBe(4);
  });

  it('returns current and projected component life with delta impact', async () => {
    const { aircraft, installation } = await createPreviewContext();

    const preview = await UtilisationPropagationPreviewService.preview({
      aircraftId: aircraft.id,
      proposedTotalTimeHours: 15,
      proposedTotalTimeCycles: 4,
      sourceType: 'MANUAL_ENTRY',
      effectiveDate: '2026-06-18',
      reason: 'Preview projected life',
    });

    const component = preview.affected_components.find(
      (item) => item.installation_id === installation.id
    );

    expect(component?.current_life.values.tsn_hours).toBe(105);
    expect(component?.projected_life.values.tsn_hours).toBe(110);
    expect(component?.impact.delta_tsn_hours).toBe(5);
    expect(component?.component_identity.serial_number).toMatch(/^PREVIEW-SC-/);
    expect(component?.position).toBe('LH');
    expect(component?.tracking_basis).toBe('AIRCRAFT_HOURS');
  });

  it('returns UNKNOWN reasons when projected component life cannot be calculated', async () => {
    const { aircraft } = await createPreviewContext({
      trackingBasis: 'AIRCRAFT_HOURS',
      installAircraftHours: null,
    });

    const preview = await UtilisationPropagationPreviewService.preview({
      aircraftId: aircraft.id,
      proposedTotalTimeHours: 15,
      proposedTotalTimeCycles: 4,
      sourceType: 'MANUAL_ENTRY',
      effectiveDate: '2026-06-18',
      reason: 'Preview unknown life',
    });

    expect(preview.affected_components[0]?.projected_life.dimensions.tsn_hours.status).toBe(
      'UNKNOWN'
    );
    expect(preview.affected_components[0]?.warnings[0]?.message).toContain(
      'install_aircraft_hours is missing.'
    );
    expect(preview.summary.unknown_component_count).toBe(1);
  });

  it('marks decreases as correction preview and warns about source reference', async () => {
    const { aircraft } = await createPreviewContext();

    const preview = await UtilisationPropagationPreviewService.preview({
      aircraftId: aircraft.id,
      proposedTotalTimeHours: 8,
      proposedTotalTimeCycles: 3,
      sourceType: 'MANUAL_ENTRY',
      effectiveDate: '2026-06-18',
      reason: 'Preview correction',
    });

    expect(preview.entry.classification).toBe('CORRECTION');
    expect(preview.entry.correction_warning?.decreases_hours).toBe(true);
    expect(preview.entry.correction_warning?.decreases_cycles).toBe(true);
    expect(preview.validation_warnings.map((warning) => warning.code)).toContain(
      'CORRECTION_SOURCE_REFERENCE_REQUIRED'
    );
  });

  it('returns due and compliance placeholders without calculating projected due status', async () => {
    const { aircraft } = await createPreviewContext();

    const preview = await UtilisationPropagationPreviewService.preview({
      aircraftId: aircraft.id,
      proposedTotalTimeHours: 15,
      proposedTotalTimeCycles: 5,
      sourceType: 'MANUAL_ENTRY',
      effectiveDate: '2026-06-18',
      reason: 'Preview due placeholders',
    });

    expect(preview.affected_due_items.map((item) => item.source_type)).toEqual([
      'AD',
      'SB',
      'SID',
      'SCHEDULED_TASK',
      'COMPONENT_TBO',
      'COMPONENT_RETIREMENT',
    ]);
    expect(
      preview.affected_due_items.every(
        (item) => item.projected_due_status === 'NOT_CALCULATED_IN_PHASE_5'
      )
    ).toBe(true);
  });

  it('confirm path still creates a utilisation event through UtilisationService', async () => {
    const { aircraft } = await createPreviewContext();
    const eventCountBefore = await UtilisationEvent.count({ where: { aircraft_id: aircraft.id } });

    await UtilisationPropagationPreviewService.preview({
      aircraftId: aircraft.id,
      proposedTotalTimeHours: 15,
      proposedTotalTimeCycles: 5,
      sourceType: 'MANUAL_ENTRY',
      effectiveDate: '2026-06-18',
      reason: 'Preview before confirm',
    });

    await UtilisationService.recordUtilisation({
      aircraftId: aircraft.id,
      newTotalTimeHours: 15,
      newTotalTimeCycles: 5,
      sourceType: 'MANUAL_ENTRY',
      effectiveDate: '2026-06-18',
      reason: 'Confirmed utilisation after preview',
    });

    const eventCountAfter = await UtilisationEvent.count({ where: { aircraft_id: aircraft.id } });
    const storedAircraft = await Aircraft.findByPk(aircraft.id);

    expect(eventCountAfter).toBe(eventCountBefore + 1);
    expect(Number(storedAircraft?.total_time_hours)).toBe(15);
    expect(storedAircraft?.total_time_cycles).toBe(5);
  });
});
