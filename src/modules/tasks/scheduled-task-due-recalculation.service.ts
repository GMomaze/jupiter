import { QueryTypes } from 'sequelize';
import {
  Aircraft,
  MaintenanceRequirement,
  MaintenanceTemplate,
  MaintenanceTemplateItem,
  TaskCard,
  TaskTemplate,
  sequelize,
} from '../../models/index.js';
import {
  DueLimitEvaluation,
  DueStatusResult,
  DueStatusService,
} from '../due-status/due-status.service.js';

export type ScheduledTaskSourceType =
  | 'TASK_TEMPLATE'
  | 'MAINTENANCE_TEMPLATE'
  | 'MAINTENANCE_TEMPLATE_ITEM'
  | 'TASK_CARD'
  | 'MAINTENANCE_REQUIREMENT';

export type ScheduledTaskIntervalType = 'HOURS' | 'CYCLES' | 'CALENDAR' | 'MIXED' | 'NONE';

export type ScheduledTaskBaselineInput = {
  source_type: ScheduledTaskSourceType;
  source_id: string;
  last_complied_hours?: number | string | null;
  last_complied_cycles?: number | string | null;
  last_complied_date?: Date | string | null;
  source_reference?: string | null;
};

export type ScheduledTaskDueResult = {
  task_identity: {
    task_template_id: string | null;
    maintenance_template_id: string | null;
    maintenance_template_item_id: string | null;
    task_card_id: string | null;
    reference: string;
    title: string;
  };
  source_program: {
    source_type: ScheduledTaskSourceType;
    source_id: string | null;
    template_type: string | null;
  };
  applicability: {
    status: 'APPLICABLE' | 'NOT_APPLICABLE' | 'UNKNOWN';
    source: string | null;
    reason: string | null;
  };
  interval: {
    interval_hours: number | null;
    interval_cycles: number | null;
    interval_months: number | null;
    interval_days: number | null;
    interval_type: ScheduledTaskIntervalType;
  };
  current_aircraft: {
    hours: number | null;
    cycles: number | null;
    date: string;
  };
  last_compliance: {
    hours: number | null;
    cycles: number | null;
    date: string | null;
    source: string | null;
  };
  next_due: {
    hours: number | null;
    cycles: number | null;
    date: string | null;
    source: string | null;
  };
  due_status: DueStatusResult;
  status: DueStatusResult['status'];
  governing_limit: DueLimitEvaluation | null;
  remaining_value: number | string | null;
  unknown_reason: string | null;
  due_detail: DueStatusResult;
  explanation: string;
  calculated_at: string;
};

type RecalculationOptions = {
  baselines?: ScheduledTaskBaselineInput[];
};

type AircraftSnapshot = {
  id: string;
  model_id: string | null;
  total_time_hours: number | null;
  total_time_cycles: number | null;
};

type ScheduledTaskSource = {
  source_type: ScheduledTaskSourceType;
  source_id: string;
  reference: string;
  title: string;
  description: string | null;
  template_type: string | null;
  task_template_id: string | null;
  maintenance_template_id: string | null;
  maintenance_template_item_id: string | null;
  task_card_id: string | null;
  aircraft_id: string | null;
  model_id: string | null;
  scope: string | null;
  component_id: string | null;
  status: string | null;
  interval_hours: number | null;
  interval_months: number | null;
  interval_cycles: number | null;
};

type CompletionEvidence = {
  hours: number | null;
  cycles: number | null;
  date: string | null;
  source: string | null;
};

type CompletionRow = {
  mechanic_completed_at: Date | string | null;
  engineer_certified_at: Date | string | null;
  task_status: string | null;
  execution_completed_at: Date | string | null;
  execution_certified_at: Date | string | null;
  execution_status: string | null;
};

export class ScheduledTaskDueRecalculationService {
  static async recalculateForUtilisationEvent(aircraftId: string, options: RecalculationOptions = {}) {
    return this.recalculateForAircraft(aircraftId, 'UTILISATION_EVENT', options);
  }

  static async recalculateForTaskCompletion(aircraftId: string, options: RecalculationOptions = {}) {
    return this.recalculateForAircraft(aircraftId, 'TASK_COMPLETION', options);
  }

  static async recalculateForBaselineImport(
    aircraftId: string,
    baselines: ScheduledTaskBaselineInput[] = []
  ) {
    return this.recalculateForAircraft(aircraftId, 'BASELINE_IMPORT', { baselines });
  }

  static async recalculateForApplicabilityChange(
    aircraftId: string,
    options: RecalculationOptions = {}
  ) {
    return this.recalculateForAircraft(aircraftId, 'APPLICABILITY_CHANGE', options);
  }

  static async recalculateManually(aircraftId: string, options: RecalculationOptions = {}) {
    return this.recalculateForAircraft(aircraftId, 'MANUAL_RECALCULATION', options);
  }

  static buildNotApplicableResult(params: {
    sourceType: ScheduledTaskSourceType;
    sourceId?: string | null;
    reference: string;
    title?: string | null;
    reason: string;
  }): ScheduledTaskDueResult {
    const dueStatus = DueStatusService.evaluateNotApplicable({
      itemType: 'SCHEDULED_TASK',
      itemId: params.sourceId || null,
      itemReference: params.reference,
      trackingBasis: 'APPLICABILITY',
      reason: params.reason,
    });

    return this.resultFromDueStatus({
      source: this.emptySource(params),
      aircraft: this.emptyAircraft(),
      applicability: {
        status: 'NOT_APPLICABLE',
        source: params.sourceType,
        reason: params.reason,
      },
      lastCompliance: this.emptyCompletion('APPLICABILITY'),
      nextDue: this.emptyNextDue('APPLICABILITY'),
      dueStatus,
      explanationPrefix: params.reason,
    });
  }

  static async recalculateForAircraft(
    aircraftId: string,
    recalculationSource = 'MANUAL_RECALCULATION',
    options: RecalculationOptions = {}
  ): Promise<ScheduledTaskDueResult[]> {
    const aircraft = await this.getAircraftSnapshot(aircraftId);
    const baselineMap = this.baselineMap(options.baselines || []);
    const sources = await this.getScheduledTaskSources(aircraftId);

    return Promise.all(
      sources.map((source) =>
        this.calculateSourceResult({
          aircraft,
          source,
          baseline: baselineMap.get(this.sourceKey(source)) || null,
          recalculationSource,
        })
      )
    );
  }

  private static async calculateSourceResult(params: {
    aircraft: AircraftSnapshot;
    source: ScheduledTaskSource;
    baseline: ScheduledTaskBaselineInput | null;
    recalculationSource: string;
  }): Promise<ScheduledTaskDueResult> {
    const applicability = this.applicabilityFor(params.source, params.aircraft);

    if (applicability.status === 'NOT_APPLICABLE') {
      const dueStatus = DueStatusService.evaluateNotApplicable({
        itemType: 'SCHEDULED_TASK',
        itemId: params.source.source_id,
        itemReference: params.source.reference,
        trackingBasis: 'APPLICABILITY',
        reason: applicability.reason || 'Scheduled task is not applicable.',
      });

      return this.resultFromDueStatus({
        source: params.source,
        aircraft: params.aircraft,
        applicability,
        lastCompliance: this.emptyCompletion('APPLICABILITY'),
        nextDue: this.emptyNextDue('APPLICABILITY'),
        dueStatus,
        explanationPrefix: applicability.reason || 'Scheduled task is not applicable.',
      });
    }

    const completion = await this.completionEvidenceFor(params.aircraft.id, params.source);
    const lastCompliance = this.lastCompliance(params.baseline, completion);
    const dueStatus = this.evaluateDueStatus({
      aircraft: params.aircraft,
      source: params.source,
      lastCompliance,
    });
    const nextDue = this.nextDueFor(params.source, lastCompliance);

    return this.resultFromDueStatus({
      source: params.source,
      aircraft: params.aircraft,
      applicability,
      lastCompliance,
      nextDue,
      dueStatus,
      explanationPrefix: `Recalculated from ${params.recalculationSource}.`,
    });
  }

  private static evaluateDueStatus(params: {
    aircraft: AircraftSnapshot;
    source: ScheduledTaskSource;
    lastCompliance: CompletionEvidence;
  }) {
    const dueResults: DueStatusResult[] = [];
    const hasHourInterval = params.source.interval_hours !== null;
    const hasCalendarInterval = params.source.interval_months !== null;
    const hasCycleInterval = params.source.interval_cycles !== null;

    if (hasHourInterval) {
      const dueHours =
        params.lastCompliance.hours === null
          ? null
          : this.roundHours(params.lastCompliance.hours + params.source.interval_hours!);

      dueResults.push(DueStatusService.evaluateHours({
        itemType: 'SCHEDULED_TASK',
        itemId: params.source.source_id,
        itemReference: params.source.reference,
        limitType: 'HOUR_INTERVAL',
        trackingBasis: 'AIRCRAFT_HOURS',
        currentValue: params.aircraft.total_time_hours,
        dueValue: dueHours,
        unknownReason:
          params.lastCompliance.hours === null
            ? 'Last complied aircraft hours or imported hour baseline is missing.'
            : params.aircraft.total_time_hours === null
              ? 'Current aircraft hours are missing.'
              : null,
      }));
    }

    if (hasCycleInterval) {
      const dueCycles =
        params.lastCompliance.cycles === null
          ? null
          : params.lastCompliance.cycles + params.source.interval_cycles!;

      dueResults.push(DueStatusService.evaluateCycles({
        itemType: 'SCHEDULED_TASK',
        itemId: params.source.source_id,
        itemReference: params.source.reference,
        limitType: 'CYCLE_INTERVAL',
        trackingBasis: 'AIRCRAFT_CYCLES',
        currentValue: params.aircraft.total_time_cycles,
        dueValue: dueCycles,
        unknownReason:
          params.lastCompliance.cycles === null
            ? 'Last complied aircraft cycles or imported cycle baseline is missing.'
            : params.aircraft.total_time_cycles === null
              ? 'Current aircraft cycles are missing.'
              : null,
      }));
    }

    if (hasCalendarInterval) {
      const dueDate =
        params.lastCompliance.date === null
          ? null
          : this.addMonthsToDate(params.lastCompliance.date, params.source.interval_months!);
      const remainingDays = dueDate ? this.remainingDaysUntil(dueDate, this.today()) : null;

      dueResults.push(DueStatusService.evaluateCalendarDays({
        itemType: 'SCHEDULED_TASK',
        itemId: params.source.source_id,
        itemReference: params.source.reference,
        limitType: 'CALENDAR_INTERVAL',
        trackingBasis: 'CALENDAR',
        currentValue: this.today(),
        dueValue: dueDate,
        remainingValue: remainingDays,
        unknownReason:
          params.lastCompliance.date === null
            ? 'Last complied date or imported calendar baseline is missing.'
            : remainingDays === null
              ? 'Calendar due date could not be calculated.'
              : null,
      }));
    }

    if (dueResults.length === 0) {
      if (this.isCompletedStatus(params.source.status) || params.lastCompliance.date) {
        return DueStatusService.evaluateHours({
          itemType: 'SCHEDULED_TASK',
          itemId: params.source.source_id,
          itemReference: params.source.reference,
          limitType: 'ONE_TIME_COMPLETED',
          trackingBasis: 'MANUAL',
          currentValue: 0,
          dueValue: 1,
          remainingValue: 1,
          threshold: 0,
        });
      }

      return DueStatusService.evaluateUnknown({
        itemType: 'SCHEDULED_TASK',
        itemId: params.source.source_id,
        itemReference: params.source.reference,
        reason: 'No supported hour, cycle, or calendar interval exists for this scheduled task.',
      });
    }

    if (dueResults.length === 1) {
      return dueResults[0]!;
    }

    return DueStatusService.evaluateMixed({
      itemType: 'SCHEDULED_TASK',
      itemId: params.source.source_id,
      itemReference: params.source.reference,
      limits: dueResults.flatMap((result) => result.evaluated_limits),
    });
  }

  private static resultFromDueStatus(params: {
    source: ScheduledTaskSource;
    aircraft: AircraftSnapshot;
    applicability: ScheduledTaskDueResult['applicability'];
    lastCompliance: CompletionEvidence;
    nextDue: ScheduledTaskDueResult['next_due'];
    dueStatus: DueStatusResult;
    explanationPrefix: string;
  }): ScheduledTaskDueResult {
    return {
      task_identity: {
        task_template_id: params.source.task_template_id,
        maintenance_template_id: params.source.maintenance_template_id,
        maintenance_template_item_id: params.source.maintenance_template_item_id,
        task_card_id: params.source.task_card_id,
        reference: params.source.reference,
        title: params.source.title,
      },
      source_program: {
        source_type: params.source.source_type,
        source_id: params.source.source_id,
        template_type: params.source.template_type,
      },
      applicability: params.applicability,
      interval: {
        interval_hours: params.source.interval_hours,
        interval_cycles: params.source.interval_cycles,
        interval_months: params.source.interval_months,
        interval_days: null,
        interval_type: this.intervalType(params.source),
      },
      current_aircraft: {
        hours: params.aircraft.total_time_hours,
        cycles: params.aircraft.total_time_cycles,
        date: this.today(),
      },
      last_compliance: {
        hours: params.lastCompliance.hours,
        cycles: params.lastCompliance.cycles,
        date: params.lastCompliance.date,
        source: params.lastCompliance.source,
      },
      next_due: params.nextDue,
      due_status: params.dueStatus,
      status: params.dueStatus.status,
      governing_limit: params.dueStatus.governing_limit,
      remaining_value: params.dueStatus.remaining_value,
      unknown_reason: params.dueStatus.unknown_reason,
      due_detail: params.dueStatus,
      explanation: `${params.explanationPrefix} ${params.dueStatus.explanation}`,
      calculated_at: params.dueStatus.calculated_at,
    };
  }

  private static nextDueFor(
    source: ScheduledTaskSource,
    lastCompliance: CompletionEvidence
  ): ScheduledTaskDueResult['next_due'] {
    return {
      hours:
        source.interval_hours !== null && lastCompliance.hours !== null
          ? this.roundHours(lastCompliance.hours + source.interval_hours)
          : null,
      cycles:
        source.interval_cycles !== null && lastCompliance.cycles !== null
          ? lastCompliance.cycles + source.interval_cycles
          : null,
      date:
        source.interval_months !== null && lastCompliance.date !== null
          ? this.addMonthsToDate(lastCompliance.date, source.interval_months)
          : null,
      source: lastCompliance.source,
    };
  }

  private static lastCompliance(
    baseline: ScheduledTaskBaselineInput | null,
    completion: CompletionEvidence
  ): CompletionEvidence {
    if (!baseline) {
      return completion;
    }

    return {
      hours: this.numberOrNull(baseline.last_complied_hours),
      cycles: this.numberOrNull(baseline.last_complied_cycles),
      date: this.dateOnlyOrNull(baseline.last_complied_date),
      source: baseline.source_reference || 'IMPORTED_BASELINE',
    };
  }

  private static async getAircraftSnapshot(aircraftId: string): Promise<AircraftSnapshot> {
    const aircraft = await Aircraft.findByPk(aircraftId, {
      attributes: ['id', 'model_id', 'total_time_hours', 'total_time_cycles'],
    });

    if (!aircraft) {
      throw new Error('INVALID_AIRCRAFT');
    }

    return {
      id: aircraft.id,
      model_id: aircraft.model_id || null,
      total_time_hours: this.numberOrNull(aircraft.total_time_hours),
      total_time_cycles: this.numberOrNull(aircraft.total_time_cycles),
    };
  }

  private static async getScheduledTaskSources(aircraftId: string): Promise<ScheduledTaskSource[]> {
    const aircraft = await Aircraft.findByPk(aircraftId, {
      attributes: ['id', 'model_id'],
    });

    if (!aircraft) {
      throw new Error('INVALID_AIRCRAFT');
    }

    const taskTemplates = await TaskTemplate.findAll({ where: { is_active: true } });
    const maintenanceTemplates = await MaintenanceTemplate.findAll({ where: { is_active: true } });
    const maintenanceRequirements = await MaintenanceRequirement.findAll();
    const taskCards = await TaskCard.findAll({ where: { aircraft_id: aircraftId } });
    const maintenanceTemplateItems = await this.getMaintenanceTemplateItemSources();

    return [
      ...taskTemplates.map((template) => this.sourceFromTaskTemplate(template)),
      ...maintenanceTemplates.map((template) => this.sourceFromMaintenanceTemplate(template)),
      ...maintenanceTemplateItems,
      ...taskCards.map((taskCard) => this.sourceFromTaskCard(taskCard)),
      ...maintenanceRequirements.map((requirement) =>
        this.sourceFromMaintenanceRequirement(requirement)
      ),
    ];
  }

  private static async getMaintenanceTemplateItemSources() {
    const rows = await MaintenanceTemplateItem.findAll();
    const sources: ScheduledTaskSource[] = [];

    for (const item of rows) {
      if (item.item_type !== 'STANDARD_TASK') {
        continue;
      }

      const template = await MaintenanceTemplate.findByPk(item.template_id);
      const taskTemplate = await TaskTemplate.findByPk(item.item_id);

      if (!template || !taskTemplate || !template.is_active || !taskTemplate.is_active) {
        continue;
      }

      sources.push({
        source_type: 'MAINTENANCE_TEMPLATE_ITEM',
        source_id: item.id,
        reference: `${template.name}:${taskTemplate.task_card_number}`,
        title: taskTemplate.title,
        description: taskTemplate.description,
        template_type: template.template_type,
        task_template_id: taskTemplate.id,
        maintenance_template_id: template.id,
        maintenance_template_item_id: item.id,
        task_card_id: null,
        aircraft_id: taskTemplate.aircraft_id,
        model_id: template.model_id,
        scope: taskTemplate.scope,
        component_id: null,
        status: null,
        interval_hours: this.numberOrNull(taskTemplate.interval_hours ?? template.interval_hours),
        interval_months: this.numberOrNull(
          taskTemplate.interval_months ?? template.interval_months
        ),
        interval_cycles: null,
      });
    }

    return sources;
  }

  private static sourceFromTaskTemplate(template: TaskTemplate): ScheduledTaskSource {
    return {
      source_type: 'TASK_TEMPLATE',
      source_id: template.id,
      reference: template.task_card_number,
      title: template.title,
      description: template.description,
      template_type: template.source_type,
      task_template_id: template.id,
      maintenance_template_id: null,
      maintenance_template_item_id: null,
      task_card_id: null,
      aircraft_id: template.aircraft_id,
      model_id: template.aircraft_model_id,
      scope: template.scope,
      component_id: null,
      status: null,
      interval_hours: this.numberOrNull(template.interval_hours),
      interval_months: this.numberOrNull(template.interval_months),
      interval_cycles: null,
    };
  }

  private static sourceFromMaintenanceTemplate(template: MaintenanceTemplate): ScheduledTaskSource {
    return {
      source_type: 'MAINTENANCE_TEMPLATE',
      source_id: template.id,
      reference: template.name,
      title: template.name,
      description: template.description,
      template_type: template.template_type,
      task_template_id: null,
      maintenance_template_id: template.id,
      maintenance_template_item_id: null,
      task_card_id: null,
      aircraft_id: null,
      model_id: template.model_id,
      scope: 'MODEL',
      component_id: null,
      status: null,
      interval_hours: this.numberOrNull(template.interval_hours),
      interval_months: this.numberOrNull(template.interval_months),
      interval_cycles: null,
    };
  }

  private static sourceFromTaskCard(taskCard: TaskCard): ScheduledTaskSource {
    return {
      source_type: 'TASK_CARD',
      source_id: taskCard.id,
      reference: taskCard.task_card_number,
      title: taskCard.title,
      description: taskCard.description,
      template_type: null,
      task_template_id: taskCard.template_source_id,
      maintenance_template_id: null,
      maintenance_template_item_id: null,
      task_card_id: taskCard.id,
      aircraft_id: taskCard.aircraft_id,
      model_id: null,
      scope: 'AIRCRAFT',
      component_id: taskCard.component_id,
      status: taskCard.status,
      interval_hours: null,
      interval_months: null,
      interval_cycles: null,
    };
  }

  private static sourceFromMaintenanceRequirement(
    requirement: MaintenanceRequirement
  ): ScheduledTaskSource {
    return {
      source_type: 'MAINTENANCE_REQUIREMENT',
      source_id: requirement.id,
      reference: requirement.title,
      title: requirement.title,
      description: requirement.description,
      template_type: 'LEGACY',
      task_template_id: null,
      maintenance_template_id: null,
      maintenance_template_item_id: null,
      task_card_id: null,
      aircraft_id: null,
      model_id: requirement.model_id,
      scope: 'MODEL',
      component_id: null,
      status: null,
      interval_hours: this.numberOrNull(requirement.interval_hours),
      interval_months: this.numberOrNull(requirement.interval_months),
      interval_cycles: null,
    };
  }

  private static applicabilityFor(
    source: ScheduledTaskSource,
    aircraft: AircraftSnapshot
  ): ScheduledTaskDueResult['applicability'] {
    if (source.source_type === 'TASK_CARD') {
      return {
        status: source.aircraft_id === aircraft.id ? 'APPLICABLE' : 'NOT_APPLICABLE',
        source: 'task_cards',
        reason:
          source.aircraft_id === aircraft.id
            ? 'Task card belongs to this aircraft.'
            : 'Task card belongs to another aircraft.',
      };
    }

    const normalizedScope = String(source.scope || '').trim().toUpperCase();

    if (normalizedScope === 'GLOBAL' || normalizedScope === 'MPI') {
      return {
        status: 'APPLICABLE',
        source: source.source_type,
        reason: `${normalizedScope} scheduled task applies to this aircraft.`,
      };
    }

    if (normalizedScope === 'MODEL') {
      const applies = Boolean(source.model_id && source.model_id === aircraft.model_id);
      return {
        status: applies ? 'APPLICABLE' : 'NOT_APPLICABLE',
        source: source.source_type,
        reason: applies
          ? 'Scheduled task model matches aircraft model.'
          : 'Scheduled task model does not match aircraft model.',
      };
    }

    if (normalizedScope === 'AIRCRAFT') {
      const applies = Boolean(source.aircraft_id && source.aircraft_id === aircraft.id);
      return {
        status: applies ? 'APPLICABLE' : 'NOT_APPLICABLE',
        source: source.source_type,
        reason: applies
          ? 'Scheduled task is assigned to this aircraft.'
          : 'Scheduled task is assigned to another aircraft.',
      };
    }

    return {
      status: 'UNKNOWN',
      source: source.source_type,
      reason: 'Scheduled task applicability scope is unknown.',
    };
  }

  private static async completionEvidenceFor(
    aircraftId: string,
    source: ScheduledTaskSource
  ): Promise<CompletionEvidence> {
    if (source.source_type === 'TASK_CARD') {
      return {
        hours: null,
        cycles: null,
        date: await this.latestCompletionDateForTaskCard(source.source_id),
        source: 'task_cards',
      };
    }

    if (source.task_template_id) {
      return {
        hours: null,
        cycles: null,
        date: await this.latestCompletionDateForTaskTemplate(aircraftId, source.task_template_id),
        source: 'task_cards',
      };
    }

    return this.emptyCompletion(null);
  }

  private static async latestCompletionDateForTaskTemplate(
    aircraftId: string,
    taskTemplateId: string
  ) {
    const rows = await sequelize.query<CompletionRow>(
      `
      SELECT
        tc.mechanic_completed_at,
        tc.engineer_certified_at,
        tc.status AS task_status,
        we.completed_at AS execution_completed_at,
        we.certified_at AS execution_certified_at,
        we.status AS execution_status
      FROM task_cards tc
      LEFT JOIN workpack_executions we
        ON we.task_id = tc.id
      WHERE tc.aircraft_id = :aircraftId
        AND tc.template_source_id = :taskTemplateId
      ORDER BY COALESCE(
        we.certified_at,
        we.completed_at,
        tc.engineer_certified_at,
        tc.mechanic_completed_at
      ) DESC NULLS LAST
      LIMIT 1
      `,
      {
        replacements: { aircraftId, taskTemplateId },
        type: QueryTypes.SELECT,
      }
    ).catch(() => [] as CompletionRow[]);

    return this.completionDateFromRow(rows[0] || null);
  }

  private static async latestCompletionDateForTaskCard(taskCardId: string) {
    const rows = await sequelize.query<CompletionRow>(
      `
      SELECT
        tc.mechanic_completed_at,
        tc.engineer_certified_at,
        tc.status AS task_status,
        we.completed_at AS execution_completed_at,
        we.certified_at AS execution_certified_at,
        we.status AS execution_status
      FROM task_cards tc
      LEFT JOIN workpack_executions we
        ON we.task_id = tc.id
      WHERE tc.id = :taskCardId
      ORDER BY COALESCE(
        we.certified_at,
        we.completed_at,
        tc.engineer_certified_at,
        tc.mechanic_completed_at
      ) DESC NULLS LAST
      LIMIT 1
      `,
      {
        replacements: { taskCardId },
        type: QueryTypes.SELECT,
      }
    ).catch(() => [] as CompletionRow[]);

    return this.completionDateFromRow(rows[0] || null);
  }

  private static completionDateFromRow(row: CompletionRow | null) {
    if (!row) {
      return null;
    }

    return (
      this.dateOnlyOrNull(row.execution_certified_at) ||
      this.dateOnlyOrNull(row.execution_completed_at) ||
      this.dateOnlyOrNull(row.engineer_certified_at) ||
      this.dateOnlyOrNull(row.mechanic_completed_at)
    );
  }

  private static baselineMap(baselines: ScheduledTaskBaselineInput[]) {
    return new Map(baselines.map((baseline) => [this.baselineKey(baseline), baseline]));
  }

  private static sourceKey(source: ScheduledTaskSource) {
    return `${source.source_type}:${source.source_id}`;
  }

  private static baselineKey(baseline: ScheduledTaskBaselineInput) {
    return `${baseline.source_type}:${baseline.source_id}`;
  }

  private static intervalType(source: ScheduledTaskSource): ScheduledTaskIntervalType {
    const intervals = [
      source.interval_hours !== null,
      source.interval_cycles !== null,
      source.interval_months !== null,
    ].filter(Boolean).length;

    if (intervals > 1) return 'MIXED';
    if (source.interval_hours !== null) return 'HOURS';
    if (source.interval_cycles !== null) return 'CYCLES';
    if (source.interval_months !== null) return 'CALENDAR';
    return 'NONE';
  }

  private static isCompletedStatus(status: string | null) {
    const normalized = String(status || '').trim().toUpperCase();
    return ['COMPLETED', 'CERTIFIED', 'CERTIFIED_BY_ENGINEER', 'LOCKED', 'CLOSED'].includes(
      normalized
    );
  }

  private static emptySource(params: {
    sourceType: ScheduledTaskSourceType;
    sourceId?: string | null;
    reference: string;
    title?: string | null;
  }): ScheduledTaskSource {
    return {
      source_type: params.sourceType,
      source_id: params.sourceId || '',
      reference: params.reference,
      title: params.title || params.reference,
      description: null,
      template_type: null,
      task_template_id: null,
      maintenance_template_id: null,
      maintenance_template_item_id: null,
      task_card_id: params.sourceType === 'TASK_CARD' ? params.sourceId || null : null,
      aircraft_id: null,
      model_id: null,
      scope: null,
      component_id: null,
      status: null,
      interval_hours: null,
      interval_months: null,
      interval_cycles: null,
    };
  }

  private static emptyAircraft(): AircraftSnapshot {
    return {
      id: '',
      model_id: null,
      total_time_hours: null,
      total_time_cycles: null,
    };
  }

  private static emptyCompletion(source: string | null): CompletionEvidence {
    return {
      hours: null,
      cycles: null,
      date: null,
      source,
    };
  }

  private static emptyNextDue(source: string | null): ScheduledTaskDueResult['next_due'] {
    return {
      hours: null,
      cycles: null,
      date: null,
      source,
    };
  }

  private static today() {
    return new Date().toISOString().slice(0, 10);
  }

  private static dateOnlyOrNull(value: unknown) {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    const parsed = new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }

  private static addMonthsToDate(dateValue: string, months: number) {
    const date = new Date(`${dateValue}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    date.setUTCMonth(date.getUTCMonth() + months);
    return date.toISOString().slice(0, 10);
  }

  private static remainingDaysUntil(dueDateValue: string, currentDateValue: string) {
    const dueDate = new Date(`${dueDateValue}T00:00:00.000Z`);
    const currentDate = new Date(`${currentDateValue}T00:00:00.000Z`);

    if (Number.isNaN(dueDate.getTime()) || Number.isNaN(currentDate.getTime())) {
      return null;
    }

    return Math.ceil((this.startOfUtcDay(dueDate) - this.startOfUtcDay(currentDate)) / 86400000);
  }

  private static startOfUtcDay(value: Date) {
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }

  private static numberOrNull(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private static roundHours(value: number) {
    return Number(value.toFixed(2));
  }
}
