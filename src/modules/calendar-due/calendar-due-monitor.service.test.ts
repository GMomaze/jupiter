import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  Aircraft,
  AircraftCategory,
  AircraftComponentInstallation,
  AirworthinessDirective,
  AssetType,
  ComplianceAssignment,
  ComplianceItem,
  ComponentLifeLimit,
  ComponentModel,
  Manufacturer,
  MaintenanceTemplate,
  MaintenanceTemplateItem,
  SerializedComponent,
  SerializedComponentLifeState,
  SidModelApplicability,
  SupplementalInspectionDocument,
  TaskCard,
  TaskTemplate,
  UtilisationEvent,
  WorkpackTask,
  sequelize,
} from '../../models/index.js';
import { CalendarDueMonitorService } from './calendar-due-monitor.service.js';

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
    code: `CAL_MFR_${suffix}`,
    name: `Calendar Due Manufacturer ${suffix}`,
    is_active: true,
  });
  const assetType = await AssetType.create({
    code: `CAL_ASSET_${suffix}`,
    label: `Calendar Due Asset ${suffix}`,
    is_installable_on_aircraft: true,
    is_required_for_aircraft: false,
    required_quantity: 0,
    is_active: true,
    system_locked: false,
  });
  const category = await AircraftCategory.create({
    code: `CAL_CAT_${suffix}`,
    label: `Calendar Due Category ${suffix}`,
    is_active: true,
    system_locked: false,
  });
  const model = await ComponentModel.create({
    model_name: `Calendar Due Model ${suffix}`,
    model_code: `CAL_MODEL_${suffix}`,
    manufacturer_id: manufacturer.id,
    asset_type_id: assetType.id,
    is_active: true,
  });
  const aircraft = await Aircraft.create({
    registration: `ZS-CAL-${testRunSuffix}-${registrationSequence}`,
    serial_number: `CAL-AIR-${suffix}`,
    model_id: model.id,
    category_id: category.id,
    status: 'ACTIVE',
    total_time_hours: options?.hours ?? 100,
    total_time_cycles: options?.cycles ?? 50,
    version: 0,
  });

  return { aircraft, model, manufacturer, assetType, suffix };
}

async function createComponentCalendarLimit(params: {
  aircraftId: string;
  componentModelId: string;
  suffix: string;
  limitType: string;
  basis: string;
  limitMonths: number | null;
  referenceDate?: string | null;
  installedAt?: string;
}) {
  const serializedComponent = await SerializedComponent.create({
    component_model_id: params.componentModelId,
    serial_number: `CAL-SC-${params.suffix}-${randomUUID().slice(0, 4)}`,
    status: 'INSTALLED',
  });
  const limit = await ComponentLifeLimit.create({
    component_model_id: params.componentModelId,
    limit_type: params.limitType,
    basis: params.basis,
    limit_hours: null,
    limit_cycles: null,
    limit_months: params.limitMonths,
    description: params.limitType,
    is_active: true,
  });
  await SerializedComponentLifeState.create({
    serialized_component_id: serializedComponent.id,
    tsn_hours: null,
    tso_hours: null,
    csn_cycles: null,
    cso_cycles: null,
    overhaul_reference_date: null,
    calendar_reference_date: params.referenceDate ?? null,
  });
  const installation = await AircraftComponentInstallation.create({
    aircraft_id: params.aircraftId,
    serialized_component_id: serializedComponent.id,
    installation_context: 'MAINTENANCE_INSTALL',
    installed_at: params.installedAt ?? params.referenceDate ?? today(),
    tracking_basis: 'CALENDAR',
    install_aircraft_hours: null,
    install_aircraft_cycles: null,
    install_tsn: null,
    install_tso: null,
    install_csn: null,
    install_cso: null,
    position: 'CAL',
  });

  return { serializedComponent, limit, installation };
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
  nextDueAt?: string | null;
}) {
  await sequelize.query(
    `
    INSERT INTO aircraft_compliance (
      aircraft_id,
      compliance_item_id,
      status,
      next_due_at,
      created_at,
      updated_at
    ) VALUES (
      :aircraftId,
      :complianceItemId,
      'DUE',
      :nextDueAt,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    `,
    {
      replacements: {
        aircraftId: params.aircraftId,
        complianceItemId: params.complianceItemId,
        nextDueAt: params.nextDueAt ?? null,
      },
    }
  );
}

async function createTaskTemplate(params: {
  reference: string;
  title: string;
  intervalMonths: number;
}) {
  return TaskTemplate.create({
    scope: 'GLOBAL',
    task_card_number: params.reference,
    sort_order: 1,
    title: params.title,
    description: `${params.title} description`,
    source_type: 'STANDARD_TASK',
    interval_hours: null,
    interval_months: params.intervalMonths,
    model_applicability: null,
    aircraft_applicability: null,
    aircraft_model_id: null,
    aircraft_id: null,
    is_active: true,
    is_required_for_wood: false,
    is_required_for_fabric: false,
    is_required_for_bungees: false,
    is_required_for_woodprop: false,
    is_required_for_retractable: false,
  });
}

async function createCompletedTaskCard(params: {
  aircraftId: string;
  taskTemplateId: string;
  reference: string;
  title: string;
  completedAt: string;
}) {
  return TaskCard.create({
    task_card_number: params.reference,
    title: params.title,
    description: `${params.title} work card`,
    status: 'CERTIFIED_BY_ENGINEER',
    work_performed: 'Completed for calendar due monitor test.',
    template_source_id: params.taskTemplateId,
    service_bulletin_id: null,
    compliance_item_id: null,
    assigned_to: null,
    mechanic_completed_by: null,
    mechanic_completed_at: new Date(`${params.completedAt}T00:00:00.000Z`),
    engineer_certified_by: null,
    engineer_certified_at: new Date(`${params.completedAt}T00:00:00.000Z`),
    aircraft_id: params.aircraftId,
    component_id: null,
    version: 0,
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonths(months: number) {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

describe('CalendarDueMonitorService', () => {
  it('returns component calendar life results', async () => {
    const { aircraft, model, suffix } = await createAircraftContext();
    await createComponentCalendarLimit({
      aircraftId: aircraft.id,
      componentModelId: model.id,
      suffix,
      limitType: `CALENDAR LIFE ${suffix}`,
      basis: 'CALENDAR',
      limitMonths: 12,
      referenceDate: today(),
    });

    const report = await CalendarDueMonitorService.recalculateForAircraft(aircraft.id);
    const result = report.results.find((item) => item.item_type === 'COMPONENT_CALENDAR_LIFE');

    expect(result?.source_service).toBe('ComponentLimitMonitoringService');
    expect(result?.due_date).toBeTruthy();
    expect(result?.status).toBe('NOT_DUE');
  });

  it('returns hard-life date results', async () => {
    const { aircraft, model, suffix } = await createAircraftContext();
    await createComponentCalendarLimit({
      aircraftId: aircraft.id,
      componentModelId: model.id,
      suffix,
      limitType: 'HARD LIFE',
      basis: 'CALENDAR',
      limitMonths: 0,
      referenceDate: today(),
    });

    const report = await CalendarDueMonitorService.recalculateForAircraft(aircraft.id);
    const result = report.results.find((item) => item.item_type === 'COMPONENT_HARD_LIFE');

    expect(result?.status).toBe('DUE');
    expect(result?.remaining_days).toBe(0);
  });

  it('returns AD date due results', async () => {
    const { aircraft, model, suffix } = await createAircraftContext();
    const ad = await AirworthinessDirective.create({
      ad_number: `CAL-AD-${suffix}`,
      status: 'ACTIVE',
      is_active: true,
    });
    const item = await createProjectedCompliance({
      modelId: model.id,
      sourceType: 'AD',
      sourceId: ad.id,
      code: ad.ad_number,
      title: 'Calendar AD due',
    });
    await createAircraftCompliance({
      aircraftId: aircraft.id,
      complianceItemId: item.id,
      nextDueAt: addDays(-1),
    });

    const report = await CalendarDueMonitorService.recalculateForComplianceUpdate(aircraft.id);
    const result = report.results.find((entry) => entry.reference === ad.ad_number);

    expect(result?.item_type).toBe('AD');
    expect(result?.status).toBe('OVERDUE');
    expect(result?.source_service).toBe('ComplianceDueRecalculationService');
  });

  it('returns SB date due results', async () => {
    const { aircraft, model, suffix } = await createAircraftContext();
    const bulletinId = randomUUID();
    const item = await createProjectedCompliance({
      modelId: model.id,
      sourceType: 'SB',
      sourceId: bulletinId,
      code: `CAL-SB-${suffix}`,
      title: 'Calendar SB due',
    });
    await createAircraftCompliance({
      aircraftId: aircraft.id,
      complianceItemId: item.id,
      nextDueAt: addDays(5),
    });

    const report = await CalendarDueMonitorService.recalculateForComplianceUpdate(aircraft.id);
    const result = report.results.find((entry) => entry.reference === `CAL-SB-${suffix}`);

    expect(result?.item_type).toBe('SB');
    expect(result?.status).toBe('DUE_SOON');
    expect(result?.remaining_days).toBe(5);
  });

  it('returns SID date due results', async () => {
    const { aircraft, model, suffix } = await createAircraftContext();
    const sid = await SupplementalInspectionDocument.create({
      manufacturer: 'CESSNA',
      reference: `CAL-SID-${suffix}`,
      title: 'Calendar SID due',
      initial_interval_hours: null,
      initial_interval_months: 0,
      repeat_interval_hours: null,
      repeat_interval_months: null,
      is_active: true,
    });
    await SidModelApplicability.create({
      sid_id: sid.id,
      model_id: model.id,
      is_active: true,
    });

    const report = await CalendarDueMonitorService.recalculateForApplicabilityChange(aircraft.id);
    const result = report.results.find((entry) => entry.reference === sid.reference);

    expect(result?.item_type).toBe('SID');
    expect(result?.status).toBe('DUE');
    expect(result?.due_date).toBe(today());
  });

  it('returns scheduled task calendar due results', async () => {
    const { aircraft, suffix } = await createAircraftContext();
    const task = await createTaskTemplate({
      reference: `CAL-TASK-${suffix}`,
      title: 'Calendar scheduled task',
      intervalMonths: 1,
    });
    await createCompletedTaskCard({
      aircraftId: aircraft.id,
      taskTemplateId: task.id,
      reference: `CAL-CARD-${suffix}`,
      title: 'Completed calendar task',
      completedAt: addDays(-40),
    });

    const report = await CalendarDueMonitorService.recalculateManually({
      aircraftId: aircraft.id,
    });
    const result = report.results.find((entry) => entry.reference === task.task_card_number);

    expect(result?.item_type).toBe('SCHEDULED_TASK');
    expect(result?.status).toBe('OVERDUE');
    expect(result?.source_service).toBe('ScheduledTaskDueRecalculationService');
  });

  it('returns UNKNOWN when due date is missing', async () => {
    const { aircraft, model, suffix } = await createAircraftContext();
    const ad = await AirworthinessDirective.create({
      ad_number: `CAL-UNK-${suffix}`,
      status: 'ACTIVE',
      is_active: true,
    });
    await createProjectedCompliance({
      modelId: model.id,
      sourceType: 'AD',
      sourceId: ad.id,
      code: ad.ad_number,
      title: 'Calendar unknown AD',
    });

    const report = await CalendarDueMonitorService.recalculateManually({
      aircraftId: aircraft.id,
    });
    const result = report.results.find((entry) => entry.reference === ad.ad_number);

    expect(result?.status).toBe('UNKNOWN');
    expect(result?.unknown_reason).toContain('No aircraft compliance record');
  });

  it('manual recalculation returns a report summary and result contract', async () => {
    const { aircraft, suffix } = await createAircraftContext();
    const task = await createTaskTemplate({
      reference: `CAL-MAN-${suffix}`,
      title: 'Manual calendar task',
      intervalMonths: 1,
    });
    await createCompletedTaskCard({
      aircraftId: aircraft.id,
      taskTemplateId: task.id,
      reference: `CAL-MAN-CARD-${suffix}`,
      title: 'Manual completed calendar task',
      completedAt: addDays(-40),
    });

    const report = await CalendarDueMonitorService.recalculateManually({
      aircraftId: aircraft.id,
    });
    const result = report.results.find((entry) => entry.reference === task.task_card_number);

    expect(report.scope).toBe(`AIRCRAFT:${aircraft.id}`);
    expect(report.current_date).toBe(today());
    expect(report.summary.overdue).toBeGreaterThanOrEqual(1);
    expect(result?.reference).toBe(task.task_card_number);
    expect(result?.current_date).toBe(today());
    expect(result?.due_date).toBeTruthy();
    expect(result?.remaining_days).toBeLessThan(0);
    expect(result?.governing_limit?.tracking_basis).toBe('CALENDAR');
    expect(result?.unknown_reason).toBeNull();
    expect(result?.source_domain).toBe('TASK_TEMPLATE');
  });

  it('does not mutate workpacks or utilisation events', async () => {
    const { aircraft, suffix } = await createAircraftContext();
    const task = await createTaskTemplate({
      reference: `CAL-BND-${suffix}`,
      title: 'Boundary calendar task',
      intervalMonths: 1,
    });
    await createCompletedTaskCard({
      aircraftId: aircraft.id,
      taskTemplateId: task.id,
      reference: `CAL-BND-CARD-${suffix}`,
      title: 'Boundary completed calendar task',
      completedAt: addDays(-40),
    });
    const workpackTaskCountBefore = await WorkpackTask.count();
    const utilisationEventCountBefore = await UtilisationEvent.count();

    await CalendarDueMonitorService.recalculateForUtilisationUpdate(aircraft.id);
    await CalendarDueMonitorService.recalculateForFutureScheduler({ aircraftId: aircraft.id });

    expect(await WorkpackTask.count()).toBe(workpackTaskCountBefore);
    expect(await UtilisationEvent.count()).toBe(utilisationEventCountBefore);
  });
});
