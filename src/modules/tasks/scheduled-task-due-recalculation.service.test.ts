import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  Aircraft,
  AircraftCategory,
  AssetType,
  ComponentModel,
  Manufacturer,
  MaintenanceTemplate,
  MaintenanceTemplateItem,
  TaskCard,
  TaskTemplate,
  WorkpackTask,
} from '../../models/index.js';
import { ScheduledTaskDueRecalculationService } from './scheduled-task-due-recalculation.service.js';

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
    code: `SKD_MFR_${suffix}`,
    name: `Scheduled Due Manufacturer ${suffix}`,
    is_active: true,
  });
  const assetType = await AssetType.create({
    code: `SKD_ASSET_${suffix}`,
    label: `Scheduled Due Asset ${suffix}`,
    is_installable_on_aircraft: true,
    is_required_for_aircraft: false,
    required_quantity: 0,
    is_active: true,
    system_locked: false,
  });
  const category = await AircraftCategory.create({
    code: `SKD_CAT_${suffix}`,
    label: `Scheduled Due Category ${suffix}`,
    is_active: true,
    system_locked: false,
  });
  const model = await ComponentModel.create({
    model_name: `Scheduled Due Model ${suffix}`,
    model_code: `SKD_MODEL_${suffix}`,
    manufacturer_id: manufacturer.id,
    asset_type_id: assetType.id,
    is_active: true,
  });
  const aircraft = await Aircraft.create({
    registration: `ZS-SKD-${testRunSuffix}-${registrationSequence}`,
    serial_number: `SKD-AIR-${suffix}`,
    model_id: model.id,
    category_id: category.id,
    status: 'ACTIVE',
    total_time_hours: options?.hours ?? 100,
    total_time_cycles: options?.cycles ?? 50,
    version: 0,
  });

  return { aircraft, model, suffix };
}

async function createTaskTemplate(params: {
  reference: string;
  title: string;
  modelId?: string | null;
  aircraftId?: string | null;
  scope?: 'GLOBAL' | 'MODEL' | 'AIRCRAFT' | 'MPI';
  intervalHours?: number | null;
  intervalMonths?: number | null;
}) {
  return TaskTemplate.create({
    scope: params.scope || 'GLOBAL',
    task_card_number: params.reference,
    sort_order: 1,
    title: params.title,
    description: `${params.title} description`,
    source_type: 'STANDARD_TASK',
    interval_hours: params.intervalHours ?? null,
    interval_months: params.intervalMonths ?? null,
    model_applicability: null,
    aircraft_applicability: null,
    aircraft_model_id: params.modelId ?? null,
    aircraft_id: params.aircraftId ?? null,
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
  taskTemplateId?: string | null;
  reference: string;
  title: string;
  completedAt: string;
}) {
  return TaskCard.create({
    task_card_number: params.reference,
    title: params.title,
    description: `${params.title} work card`,
    status: 'CERTIFIED_BY_ENGINEER',
    work_performed: 'Completed for due recalculation test.',
    template_source_id: params.taskTemplateId ?? null,
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

describe('ScheduledTaskDueRecalculationService', () => {
  it('calculates hour-based task due from imported baseline', async () => {
    const { aircraft, suffix } = await createAircraftContext({ hours: 100 });
    const task = await createTaskTemplate({
      reference: `SKD-H-${suffix}`,
      title: 'Hour interval task',
      intervalHours: 25,
    });

    const results = await ScheduledTaskDueRecalculationService.recalculateForBaselineImport(
      aircraft.id,
      [{
        source_type: 'TASK_TEMPLATE',
        source_id: task.id,
        last_complied_hours: 80,
        source_reference: 'IMPORTED_BASELINE',
      }]
    );
    const result = results.find((row) => row.task_identity.reference === task.task_card_number);

    expect(result?.status).toBe('DUE_SOON');
    expect(result?.next_due.hours).toBe(105);
    expect(result?.remaining_value).toBe(5);
    expect(result?.governing_limit?.tracking_basis).toBe('AIRCRAFT_HOURS');
  });

  it('calculates calendar task due from existing completion date evidence', async () => {
    const { aircraft, suffix } = await createAircraftContext();
    const task = await createTaskTemplate({
      reference: `SKD-C-${suffix}`,
      title: 'Calendar interval task',
      intervalMonths: 1,
    });
    await createCompletedTaskCard({
      aircraftId: aircraft.id,
      taskTemplateId: task.id,
      reference: `CARD-C-${suffix}`,
      title: 'Completed calendar task',
      completedAt: addDays(-40),
    });

    const results = await ScheduledTaskDueRecalculationService.recalculateForTaskCompletion(
      aircraft.id
    );
    const result = results.find((row) => row.task_identity.reference === task.task_card_number);

    expect(result?.status).toBe('OVERDUE');
    expect(result?.last_compliance.date).toBeTruthy();
    expect(result?.governing_limit?.tracking_basis).toBe('CALENDAR');
  });

  it('uses DueStatusService mixed-limit selection for hour and date intervals', async () => {
    const { aircraft, suffix } = await createAircraftContext({ hours: 100 });
    const task = await createTaskTemplate({
      reference: `SKD-M-${suffix}`,
      title: 'Mixed interval task',
      intervalHours: 100,
      intervalMonths: 1,
    });

    const results = await ScheduledTaskDueRecalculationService.recalculateForBaselineImport(
      aircraft.id,
      [{
        source_type: 'TASK_TEMPLATE',
        source_id: task.id,
        last_complied_hours: 50,
        last_complied_date: addMonths(-1),
        source_reference: 'IMPORTED_BASELINE',
      }]
    );
    const result = results.find((row) => row.task_identity.reference === task.task_card_number);

    expect(result?.interval.interval_type).toBe('MIXED');
    expect(result?.status).toBe('DUE');
    expect(result?.governing_limit?.tracking_basis).toBe('CALENDAR');
  });

  it('returns UNKNOWN for cycle-only intent because scheduled task cycle fields are missing', async () => {
    const { aircraft, suffix } = await createAircraftContext();
    const task = await createTaskTemplate({
      reference: `SKD-CYC-${suffix}`,
      title: 'Cycle interval unavailable task',
    });

    const results = await ScheduledTaskDueRecalculationService.recalculateManually(aircraft.id);
    const result = results.find((row) => row.task_identity.reference === task.task_card_number);

    expect(result?.status).toBe('UNKNOWN');
    expect(result?.unknown_reason).toContain('No supported hour, cycle, or calendar interval');
    expect(result?.interval.interval_cycles).toBeNull();
  });

  it('returns UNKNOWN for recurring hour task when last complied hours are missing', async () => {
    const { aircraft, suffix } = await createAircraftContext({ hours: 100 });
    const task = await createTaskTemplate({
      reference: `SKD-U-${suffix}`,
      title: 'Unknown hour basis task',
      intervalHours: 25,
    });

    const results = await ScheduledTaskDueRecalculationService.recalculateForUtilisationEvent(
      aircraft.id
    );
    const result = results.find((row) => row.task_identity.reference === task.task_card_number);

    expect(result?.status).toBe('UNKNOWN');
    expect(result?.unknown_reason).toContain('Last complied aircraft hours');
  });

  it('treats completed no-interval task cards as one-time NOT_DUE', async () => {
    const { aircraft, suffix } = await createAircraftContext();
    const taskCard = await createCompletedTaskCard({
      aircraftId: aircraft.id,
      reference: `SKD-ONE-${suffix}`,
      title: 'One-time completed task',
      completedAt: addDays(-1),
    });

    const results = await ScheduledTaskDueRecalculationService.recalculateForTaskCompletion(
      aircraft.id
    );
    const result = results.find((row) => row.task_identity.task_card_id === taskCard.id);

    expect(result?.status).toBe('NOT_DUE');
    expect(result?.governing_limit?.limit_type).toBe('ONE_TIME_COMPLETED');
  });

  it('returns NOT_APPLICABLE for aircraft/model applicability exclusion', async () => {
    const { aircraft, suffix } = await createAircraftContext();
    const otherContext = await createAircraftContext();
    const task = await createTaskTemplate({
      reference: `SKD-NA-${suffix}`,
      title: 'Other model task',
      scope: 'MODEL',
      modelId: otherContext.model.id,
      intervalMonths: 1,
    });

    const results = await ScheduledTaskDueRecalculationService.recalculateForApplicabilityChange(
      aircraft.id
    );
    const result = results.find((row) => row.task_identity.reference === task.task_card_number);

    expect(result?.status).toBe('NOT_APPLICABLE');
    expect(result?.applicability.reason).toContain('does not match');
  });

  it('returns the required explanation contract fields', async () => {
    const { aircraft, model, suffix } = await createAircraftContext({ hours: 100, cycles: 12 });
    const template = await MaintenanceTemplate.create({
      name: `SKD-PROG-${suffix}`,
      description: 'Maintenance program due contract',
      template_type: 'MPI',
      model_id: model.id,
      interval_hours: 25,
      interval_months: null,
      is_active: true,
    });
    const task = await createTaskTemplate({
      reference: `SKD-X-${suffix}`,
      title: 'Contract task',
      scope: 'MODEL',
      modelId: model.id,
      intervalHours: 25,
    });
    const item = await MaintenanceTemplateItem.create({
      template_id: template.id,
      item_type: 'STANDARD_TASK',
      item_id: task.id,
      sequence_no: 1,
      is_required: true,
      notes: null,
    });

    const results = await ScheduledTaskDueRecalculationService.recalculateForBaselineImport(
      aircraft.id,
      [{
        source_type: 'MAINTENANCE_TEMPLATE_ITEM',
        source_id: item.id,
        last_complied_hours: 80,
        source_reference: 'IMPORTED_BASELINE',
      }]
    );
    const result = results.find((row) => row.task_identity.maintenance_template_item_id === item.id);

    expect(result?.task_identity.task_template_id).toBe(task.id);
    expect(result?.task_identity.maintenance_template_id).toBe(template.id);
    expect(result?.source_program.source_type).toBe('MAINTENANCE_TEMPLATE_ITEM');
    expect(result?.interval.interval_type).toBe('HOURS');
    expect(result?.current_aircraft.hours).toBe(100);
    expect(result?.current_aircraft.cycles).toBe(12);
    expect(result?.last_compliance.hours).toBe(80);
    expect(result?.next_due.hours).toBe(105);
    expect(result?.remaining_value).toBe(5);
    expect(result?.status).toBe('DUE_SOON');
    expect(result?.governing_limit?.tracking_basis).toBe('AIRCRAFT_HOURS');
    expect(result?.unknown_reason).toBeNull();
    expect(result?.due_detail.item_type).toBe('SCHEDULED_TASK');
  });

  it('does not create, close, refresh, mutate, or attach workpacks', async () => {
    const { aircraft, suffix } = await createAircraftContext({ hours: 100 });
    const task = await createTaskTemplate({
      reference: `SKD-WP-${suffix}`,
      title: 'Workpack boundary task',
      intervalHours: 25,
    });
    const before = await WorkpackTask.count();

    await ScheduledTaskDueRecalculationService.recalculateForBaselineImport(aircraft.id, [{
      source_type: 'TASK_TEMPLATE',
      source_id: task.id,
      last_complied_hours: 80,
    }]);

    const after = await WorkpackTask.count();
    expect(after).toBe(before);
  });
});
