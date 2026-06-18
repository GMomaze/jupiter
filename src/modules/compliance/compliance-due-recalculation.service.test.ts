import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  Aircraft,
  AircraftCategory,
  AirworthinessDirective,
  AssetType,
  ComplianceAssignment,
  ComplianceItem,
  ComponentModel,
  Manufacturer,
  SidModelApplicability,
  SupplementalInspectionDocument,
  sequelize,
} from '../../models/index.js';
import { ComplianceDueRecalculationService } from './compliance-due-recalculation.service.js';

const testRunSuffix = Date.now().toString(36).toUpperCase();
let aircraftRegistrationCounter = 0;

async function createAircraftContext(options?: {
  hours?: number;
  cycles?: number;
}) {
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const registrationSequence = (++aircraftRegistrationCounter)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0');
  const manufacturer = await Manufacturer.create({
    code: `DUE_MFR_${suffix}`,
    name: `Due Manufacturer ${suffix}`,
    is_active: true,
  });
  const assetType = await AssetType.create({
    code: `DUE_ASSET_${suffix}`,
    label: `Due Asset ${suffix}`,
    is_installable_on_aircraft: true,
    is_required_for_aircraft: false,
    required_quantity: 0,
    is_active: true,
    system_locked: false,
  });
  const category = await AircraftCategory.create({
    code: `DUE_CAT_${suffix}`,
    label: `Due Category ${suffix}`,
    is_active: true,
    system_locked: false,
  });
  const model = await ComponentModel.create({
    model_name: `Due Model ${suffix}`,
    model_code: `DUE_MODEL_${suffix}`,
    manufacturer_id: manufacturer.id,
    asset_type_id: assetType.id,
    is_active: true,
  });
  const aircraft = await Aircraft.create({
    registration: `ZS-DUE-${testRunSuffix}-${registrationSequence}`,
    serial_number: `DUE-AIR-${suffix}`,
    model_id: model.id,
    category_id: category.id,
    status: 'ACTIVE',
    total_time_hours: options?.hours ?? 100,
    total_time_cycles: options?.cycles ?? 50,
    version: 0,
  });

  return { aircraft, model, suffix };
}

async function createProjectedCompliance(params: {
  modelId: string;
  sourceType: 'AD' | 'SB';
  sourceId: string;
  code: string;
  title: string;
}) {
  const item = await ComplianceItem.create({
    item_type: params.sourceType,
    code: params.code,
    title: params.title,
    source_type: params.sourceType,
    source_id: params.sourceId,
    source_table: params.sourceType === 'AD' ? 'airworthiness_directives' : 'service_bulletins',
    compliance_basis: params.sourceType === 'AD' ? 'MANDATORY' : 'RECOMMENDED',
    status: 'ACTIVE',
  });

  await ComplianceAssignment.create({
    compliance_item_id: item.id,
    assignment_type: 'MODEL',
    model_id: params.modelId,
    aircraft_id: null,
    assignment_source: 'MANUAL',
    is_active: true,
  });

  return item;
}

async function createAircraftCompliance(params: {
  aircraftId: string;
  complianceItemId: string;
  status?: string;
  lastCompliedAt?: string | null;
  nextDueAt?: string | null;
  lastCompliedHours?: number | null;
  nextDueHours?: number | null;
  complianceMethod?: string | null;
  notes?: string | null;
}) {
  await sequelize.query(
    `
    INSERT INTO aircraft_compliance (
      aircraft_id,
      compliance_item_id,
      status,
      last_complied_at,
      next_due_at,
      last_complied_hours,
      next_due_hours,
      compliance_method,
      notes,
      created_at,
      updated_at
    ) VALUES (
      :aircraftId,
      :complianceItemId,
      :status,
      :lastCompliedAt,
      :nextDueAt,
      :lastCompliedHours,
      :nextDueHours,
      :complianceMethod,
      :notes,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    `,
    {
      replacements: {
        aircraftId: params.aircraftId,
        complianceItemId: params.complianceItemId,
        status: params.status || 'DUE',
        lastCompliedAt: params.lastCompliedAt ?? null,
        nextDueAt: params.nextDueAt ?? null,
        lastCompliedHours: params.lastCompliedHours ?? null,
        nextDueHours: params.nextDueHours ?? null,
        complianceMethod: params.complianceMethod ?? null,
        notes: params.notes ?? null,
      },
    }
  );
}

function addDays(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe('ComplianceDueRecalculationService', () => {
  it('calculates AD due by hours', async () => {
    const { aircraft, model, suffix } = await createAircraftContext({ hours: 100 });
    const ad = await AirworthinessDirective.create({
      ad_number: `AD-H-${suffix}`,
      status: 'ACTIVE',
      is_active: true,
    });
    const item = await createProjectedCompliance({
      modelId: model.id,
      sourceType: 'AD',
      sourceId: ad.id,
      code: ad.ad_number,
      title: 'AD hour due',
    });
    await createAircraftCompliance({
      aircraftId: aircraft.id,
      complianceItemId: item.id,
      nextDueHours: 105,
    });

    const results = await ComplianceDueRecalculationService.recalculateForUtilisationEvent(aircraft.id);
    const result = results.find((row) => row.reference === ad.ad_number);

    expect(result?.item_type).toBe('AD');
    expect(result?.status).toBe('DUE_SOON');
    expect(result?.remaining_value).toBe(5);
    expect(result?.governing_limit?.tracking_basis).toBe('AIRCRAFT_HOURS');
  });

  it('calculates AD due by date', async () => {
    const { aircraft, model, suffix } = await createAircraftContext();
    const ad = await AirworthinessDirective.create({
      ad_number: `AD-D-${suffix}`,
      status: 'ACTIVE',
      is_active: true,
    });
    const item = await createProjectedCompliance({
      modelId: model.id,
      sourceType: 'AD',
      sourceId: ad.id,
      code: ad.ad_number,
      title: 'AD date due',
    });
    await createAircraftCompliance({
      aircraftId: aircraft.id,
      complianceItemId: item.id,
      nextDueAt: addDays(-1),
    });

    const [result] = await ComplianceDueRecalculationService.recalculateForComplianceEntry(aircraft.id);

    expect(result.status).toBe('OVERDUE');
    expect(result.governing_limit?.tracking_basis).toBe('CALENDAR');
  });

  it('calculates SB mixed due by hours and date', async () => {
    const { aircraft, model, suffix } = await createAircraftContext({ hours: 100 });
    const bulletinId = randomUUID();
    const bulletinNumber = `SB-M-${suffix}`;
    const item = await createProjectedCompliance({
      modelId: model.id,
      sourceType: 'SB',
      sourceId: bulletinId,
      code: bulletinNumber,
      title: 'SB mixed due',
    });
    await createAircraftCompliance({
      aircraftId: aircraft.id,
      complianceItemId: item.id,
      nextDueHours: 150,
      nextDueAt: addDays(5),
    });

    const [result] = await ComplianceDueRecalculationService.recalculateManually(aircraft.id);

    expect(result.item_type).toBe('SB');
    expect(result.status).toBe('DUE_SOON');
    expect(result.governing_limit?.tracking_basis).toBe('CALENDAR');
  });

  it('calculates SID due from initial interval', async () => {
    const { aircraft, model, suffix } = await createAircraftContext({ hours: 100 });
    const sid = await SupplementalInspectionDocument.create({
      manufacturer: 'CESSNA',
      reference: `SID-I-${suffix}`,
      title: 'SID initial due',
      initial_interval_hours: 105,
      initial_interval_months: null,
      repeat_interval_hours: 50,
      repeat_interval_months: null,
      is_active: true,
    });
    await SidModelApplicability.create({
      sid_id: sid.id,
      model_id: model.id,
      is_active: true,
    });

    const [result] = await ComplianceDueRecalculationService.recalculateForApplicabilityChange(aircraft.id);

    expect(result.item_type).toBe('SID');
    expect(result.status).toBe('DUE_SOON');
    expect(result.next_due.hours).toBe(105);
  });

  it('recalculates recurring compliance from last compliance and interval', async () => {
    const { aircraft, model, suffix } = await createAircraftContext({ hours: 100 });
    const ad = await AirworthinessDirective.create({
      ad_number: `AD-R-${suffix}`,
      status: 'ACTIVE',
      is_recurring: true,
      interval_hours: 25,
      is_active: true,
    });
    const item = await createProjectedCompliance({
      modelId: model.id,
      sourceType: 'AD',
      sourceId: ad.id,
      code: ad.ad_number,
      title: 'AD recurring due',
    });
    await createAircraftCompliance({
      aircraftId: aircraft.id,
      complianceItemId: item.id,
      lastCompliedHours: 80,
    });

    const [result] = await ComplianceDueRecalculationService.recalculateManually(aircraft.id);

    expect(result.next_due.hours).toBe(105);
    expect(result.status).toBe('DUE_SOON');
    expect(result.recurrence.is_recurring).toBe(true);
    expect(result.recurrence.interval_hours).toBe(25);
  });

  it('stops recurrence when terminating action is recorded', async () => {
    const { aircraft, model, suffix } = await createAircraftContext({ hours: 500 });
    const ad = await AirworthinessDirective.create({
      ad_number: `AD-T-${suffix}`,
      status: 'ACTIVE',
      is_recurring: true,
      interval_hours: 25,
      is_active: true,
    });
    const item = await createProjectedCompliance({
      modelId: model.id,
      sourceType: 'AD',
      sourceId: ad.id,
      code: ad.ad_number,
      title: 'AD terminating action',
    });
    await createAircraftCompliance({
      aircraftId: aircraft.id,
      complianceItemId: item.id,
      lastCompliedHours: 80,
      complianceMethod: 'TERMINATING_ACTION',
    });

    const [result] = await ComplianceDueRecalculationService.recalculateForComplianceEntry(aircraft.id);

    expect(result.status).toBe('NOT_DUE');
    expect(result.recurrence.terminating_action_recorded).toBe(true);
    expect(result.next_due.source).toBe('TERMINATING_ACTION');
  });

  it('returns NOT_APPLICABLE for applicability exclusion', () => {
    const result = ComplianceDueRecalculationService.buildNotApplicableResult({
      itemType: 'AD',
      reference: 'AD-N/A',
      title: 'Excluded AD',
      reason: 'AD does not apply to this aircraft model.',
    });

    expect(result.status).toBe('NOT_APPLICABLE');
    expect(result.applicability.status).toBe('NOT_APPLICABLE');
  });

  it('returns UNKNOWN when required due data is missing', async () => {
    const { aircraft, model, suffix } = await createAircraftContext();
    const ad = await AirworthinessDirective.create({
      ad_number: `AD-U-${suffix}`,
      status: 'ACTIVE',
      is_active: true,
    });
    await createProjectedCompliance({
      modelId: model.id,
      sourceType: 'AD',
      sourceId: ad.id,
      code: ad.ad_number,
      title: 'AD unknown due',
    });

    const [result] = await ComplianceDueRecalculationService.recalculateManually(aircraft.id);

    expect(result.status).toBe('UNKNOWN');
    expect(result.unknown_reason).toContain('No aircraft compliance record');
  });

  it('returns the required explanation contract fields', async () => {
    const { aircraft, model, suffix } = await createAircraftContext({ hours: 100, cycles: 12 });
    const ad = await AirworthinessDirective.create({
      ad_number: `AD-X-${suffix}`,
      status: 'ACTIVE',
      is_active: true,
    });
    const item = await createProjectedCompliance({
      modelId: model.id,
      sourceType: 'AD',
      sourceId: ad.id,
      code: ad.ad_number,
      title: 'AD contract due',
    });
    await createAircraftCompliance({
      aircraftId: aircraft.id,
      complianceItemId: item.id,
      lastCompliedHours: 40,
      nextDueHours: 105,
    });

    const [result] = await ComplianceDueRecalculationService.recalculateForUtilisationEvent(aircraft.id);

    expect(result.item_type).toBe('AD');
    expect(result.reference).toBe(ad.ad_number);
    expect(result.applicability.source).toBe('compliance_items');
    expect(result.current_aircraft.hours).toBe(100);
    expect(result.current_aircraft.cycles).toBe(12);
    expect(result.last_compliance.hours).toBe(40);
    expect(result.next_due.hours).toBe(105);
    expect(result.remaining_value).toBe(5);
    expect(result.status).toBe('DUE_SOON');
    expect(result.governing_limit?.tracking_basis).toBe('AIRCRAFT_HOURS');
    expect(result.unknown_reason).toBeNull();
    expect(result.due_status.item_type).toBe('AD');
  });
});
