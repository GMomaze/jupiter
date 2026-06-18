import { Aircraft } from '../../models/index.js';
import {
  ComponentLimitMonitoringResult,
  ComponentLimitMonitoringService,
} from '../aircraft/component-limit-monitoring.service.js';
import {
  ComplianceDueRecalculationService,
  ComplianceDueResult,
} from '../compliance/compliance-due-recalculation.service.js';
import {
  DueLimitEvaluation,
  DueStatusResult,
  DueStatusService,
} from '../due-status/due-status.service.js';
import {
  ScheduledTaskDueRecalculationService,
  ScheduledTaskDueResult,
} from '../tasks/scheduled-task-due-recalculation.service.js';

export type CalendarDueMonitorItemType =
  | 'COMPONENT_CALENDAR_LIFE'
  | 'COMPONENT_HARD_LIFE'
  | 'AD'
  | 'SB'
  | 'SID'
  | 'SCHEDULED_TASK';

export type CalendarDueMonitorSourceService =
  | 'ComponentLimitMonitoringService'
  | 'ComplianceDueRecalculationService'
  | 'ScheduledTaskDueRecalculationService'
  | 'LibraryServiceCompatibility';

export type CalendarDueMonitorResult = {
  item_type: CalendarDueMonitorItemType;
  item_id: string | null;
  reference: string;
  aircraft_id: string | null;
  component_id: string | null;
  current_date: string;
  due_date: string | null;
  remaining_days: number | null;
  status: DueStatusResult['status'];
  governing_limit: DueLimitEvaluation | null;
  unknown_reason: string | null;
  source_service: CalendarDueMonitorSourceService;
  source_domain: string;
  explanation: string;
  calculated_at: string;
};

export type CalendarDueMonitorReport = {
  scope: string;
  current_date: string;
  results: CalendarDueMonitorResult[];
  summary: {
    not_due: number;
    due_soon: number;
    due: number;
    overdue: number;
    unknown: number;
    not_applicable: number;
  };
  warnings: string[];
  calculated_at: string;
};

export type CalendarDueMonitorParams = {
  aircraftId?: string;
  evaluationDate?: Date | string;
};

type TriggerSource =
  | 'MANUAL_RECALCULATION'
  | 'COMPLIANCE_UPDATE'
  | 'UTILISATION_UPDATE'
  | 'APPLICABILITY_CHANGE'
  | 'SCHEDULER_PLACEHOLDER';

export class CalendarDueMonitorService {
  static async recalculateManually(
    params: CalendarDueMonitorParams = {}
  ): Promise<CalendarDueMonitorReport> {
    return this.recalculate(params, 'MANUAL_RECALCULATION');
  }

  static async recalculateForComplianceUpdate(
    aircraftId: string,
    params: CalendarDueMonitorParams = {}
  ): Promise<CalendarDueMonitorReport> {
    return this.recalculate({ ...params, aircraftId }, 'COMPLIANCE_UPDATE');
  }

  static async recalculateForUtilisationUpdate(
    aircraftId: string,
    params: CalendarDueMonitorParams = {}
  ): Promise<CalendarDueMonitorReport> {
    return this.recalculate({ ...params, aircraftId }, 'UTILISATION_UPDATE');
  }

  static async recalculateForApplicabilityChange(
    aircraftId: string,
    params: CalendarDueMonitorParams = {}
  ): Promise<CalendarDueMonitorReport> {
    return this.recalculate({ ...params, aircraftId }, 'APPLICABILITY_CHANGE');
  }

  static async recalculateForFutureScheduler(
    params: CalendarDueMonitorParams = {}
  ): Promise<CalendarDueMonitorReport> {
    return this.recalculate(params, 'SCHEDULER_PLACEHOLDER', [
      'Scheduler/background execution is a placeholder only in Phase 10.',
    ]);
  }

  static async recalculateForAircraft(
    aircraftId: string,
    params: CalendarDueMonitorParams = {}
  ): Promise<CalendarDueMonitorReport> {
    return this.recalculate({ ...params, aircraftId }, 'MANUAL_RECALCULATION');
  }

  static async recalculateAll(
    params: CalendarDueMonitorParams = {}
  ): Promise<CalendarDueMonitorReport> {
    return this.recalculate(params, 'MANUAL_RECALCULATION');
  }

  private static async recalculate(
    params: CalendarDueMonitorParams,
    triggerSource: TriggerSource,
    initialWarnings: string[] = []
  ): Promise<CalendarDueMonitorReport> {
    const currentDate = this.dateOnly(params.evaluationDate || new Date());
    const aircraftIds = params.aircraftId
      ? [params.aircraftId]
      : await this.getAllAircraftIds();
    const resultSets = await Promise.all(
      aircraftIds.map((aircraftId) => this.recalculateAircraft(aircraftId, currentDate, triggerSource))
    );
    const results = resultSets.flat();
    const warnings = [...initialWarnings];

    if (aircraftIds.length === 0) {
      warnings.push('No aircraft were available for calendar due monitoring.');
    }

    return {
      scope: params.aircraftId ? `AIRCRAFT:${params.aircraftId}` : 'ALL_AIRCRAFT',
      current_date: currentDate,
      results,
      summary: this.summary(results),
      warnings,
      calculated_at: new Date().toISOString(),
    };
  }

  private static async recalculateAircraft(
    aircraftId: string,
    currentDate: string,
    triggerSource: TriggerSource
  ) {
    const [componentResults, complianceResults, scheduledTaskResults] = await Promise.all([
      ComponentLimitMonitoringService.monitorAircraft(aircraftId),
      this.complianceResultsForTrigger(aircraftId, triggerSource),
      this.scheduledTaskResultsForTrigger(aircraftId, triggerSource),
    ]);

    return [
      ...componentResults.flatMap((result) => this.fromComponentResult(result, currentDate)),
      ...complianceResults.flatMap((result) => this.fromComplianceResult(result, currentDate)),
      ...scheduledTaskResults.flatMap((result) => this.fromScheduledTaskResult(result, currentDate)),
    ];
  }

  private static complianceResultsForTrigger(aircraftId: string, triggerSource: TriggerSource) {
    if (triggerSource === 'COMPLIANCE_UPDATE') {
      return ComplianceDueRecalculationService.recalculateForComplianceEntry(aircraftId);
    }

    if (triggerSource === 'APPLICABILITY_CHANGE') {
      return ComplianceDueRecalculationService.recalculateForApplicabilityChange(aircraftId);
    }

    if (triggerSource === 'UTILISATION_UPDATE') {
      return ComplianceDueRecalculationService.recalculateForUtilisationEvent(aircraftId);
    }

    return ComplianceDueRecalculationService.recalculateManually(aircraftId);
  }

  private static scheduledTaskResultsForTrigger(aircraftId: string, triggerSource: TriggerSource) {
    if (triggerSource === 'APPLICABILITY_CHANGE') {
      return ScheduledTaskDueRecalculationService.recalculateForApplicabilityChange(aircraftId);
    }

    if (triggerSource === 'UTILISATION_UPDATE') {
      return ScheduledTaskDueRecalculationService.recalculateForUtilisationEvent(aircraftId);
    }

    if (triggerSource === 'COMPLIANCE_UPDATE') {
      return ScheduledTaskDueRecalculationService.recalculateManually(aircraftId);
    }

    return ScheduledTaskDueRecalculationService.recalculateManually(aircraftId);
  }

  private static fromComponentResult(
    result: ComponentLimitMonitoringResult,
    currentDate: string
  ): CalendarDueMonitorResult[] {
    if (result.limit_type !== 'CALENDAR_LIFE' && result.limit_type !== 'HARD_LIFE') {
      return [];
    }

    const dueStatus = this.reEvaluateCalendarDueStatus({
      dueStatus: result.due_status_result,
      currentDate,
      itemType: result.limit_type === 'HARD_LIFE'
        ? 'COMPONENT_HARD_LIFE'
        : 'COMPONENT_CALENDAR_LIFE',
      itemId: result.due_status_result.item_id,
      reference: result.raw_limit_type || result.limit_type,
      unknownReason: result.unknown_reason,
    });

    return [
      this.resultFromDueStatus({
        itemType: result.limit_type === 'HARD_LIFE'
          ? 'COMPONENT_HARD_LIFE'
          : 'COMPONENT_CALENDAR_LIFE',
        itemId: result.due_status_result.item_id,
        reference: result.raw_limit_type || result.limit_type,
        aircraftId: result.component.aircraft_id,
        componentId: result.component.serialized_component_id,
        sourceService: 'ComponentLimitMonitoringService',
        sourceDomain: result.limit_type,
        currentDate,
        dueStatus,
        fallbackUnknownReason: result.unknown_reason,
        explanationPrefix: result.explanation,
      }),
    ];
  }

  private static fromComplianceResult(
    result: ComplianceDueResult,
    currentDate: string
  ): CalendarDueMonitorResult[] {
    if (result.next_due.date === null && result.status !== 'UNKNOWN' && result.status !== 'NOT_APPLICABLE') {
      return [];
    }

    if (
      !this.hasCalendarLimit(result.due_status) &&
      result.next_due.date === null &&
      result.status !== 'UNKNOWN' &&
      result.status !== 'NOT_APPLICABLE'
    ) {
      return [];
    }

    const dueStatus = this.reEvaluateCalendarDueStatus({
      dueStatus: result.due_status,
      currentDate,
      itemType: result.item_type,
      itemId: result.item_id,
      reference: result.reference,
      explicitDueDate: result.next_due.date,
      unknownReason: result.unknown_reason,
    });

    return [
      this.resultFromDueStatus({
        itemType: result.item_type,
        itemId: result.item_id,
        reference: result.reference,
        aircraftId: null,
        componentId: null,
        sourceService: 'ComplianceDueRecalculationService',
        sourceDomain: result.item_type,
        currentDate,
        dueStatus,
        fallbackUnknownReason: result.unknown_reason,
        explanationPrefix: result.explanation,
      }),
    ];
  }

  private static fromScheduledTaskResult(
    result: ScheduledTaskDueResult,
    currentDate: string
  ): CalendarDueMonitorResult[] {
    if (result.next_due.date === null && result.status !== 'UNKNOWN' && result.status !== 'NOT_APPLICABLE') {
      return [];
    }

    if (
      !this.hasCalendarLimit(result.due_status) &&
      result.next_due.date === null &&
      result.status !== 'UNKNOWN' &&
      result.status !== 'NOT_APPLICABLE'
    ) {
      return [];
    }

    const dueStatus = this.reEvaluateCalendarDueStatus({
      dueStatus: result.due_status,
      currentDate,
      itemType: 'SCHEDULED_TASK',
      itemId: result.source_program.source_id,
      reference: result.task_identity.reference,
      explicitDueDate: result.next_due.date,
      unknownReason: result.unknown_reason,
    });

    return [
      this.resultFromDueStatus({
        itemType: 'SCHEDULED_TASK',
        itemId: result.source_program.source_id,
        reference: result.task_identity.reference,
        aircraftId: null,
        componentId: null,
        sourceService: 'ScheduledTaskDueRecalculationService',
        sourceDomain: result.source_program.source_type,
        currentDate,
        dueStatus,
        fallbackUnknownReason: result.unknown_reason,
        explanationPrefix: result.explanation,
      }),
    ];
  }

  private static reEvaluateCalendarDueStatus(params: {
    dueStatus: DueStatusResult;
    currentDate: string;
    itemType: CalendarDueMonitorItemType;
    itemId: string | null;
    reference: string;
    explicitDueDate?: string | null;
    unknownReason?: string | null;
  }) {
    const calendarLimit = this.calendarLimit(params.dueStatus);
    const dueDate = params.explicitDueDate || this.stringOrNull(calendarLimit?.due_value);

    if (params.dueStatus.status === 'NOT_APPLICABLE') {
      return DueStatusService.evaluateNotApplicable({
        itemType: this.dueItemType(params.itemType),
        itemId: params.itemId,
        itemReference: params.reference,
        trackingBasis: 'APPLICABILITY',
        reason: params.dueStatus.not_applicable_reason || 'Item is not applicable.',
      });
    }

    if (!dueDate) {
      return DueStatusService.evaluateUnknown({
        itemType: this.dueItemType(params.itemType),
        itemId: params.itemId,
        itemReference: params.reference,
        trackingBasis: 'CALENDAR',
        reason:
          params.unknownReason ||
          params.dueStatus.unknown_reason ||
          'Calendar due date is missing.',
      });
    }

    return DueStatusService.evaluateCalendarDays({
      itemType: this.dueItemType(params.itemType),
      itemId: params.itemId,
      itemReference: params.reference,
      limitId: calendarLimit?.limit_id || null,
      limitType: calendarLimit?.limit_type || 'CALENDAR',
      trackingBasis: 'CALENDAR',
      currentValue: params.currentDate,
      dueValue: dueDate,
      remainingValue: this.remainingDaysUntil(dueDate, params.currentDate),
      unknownReason: this.remainingDaysUntil(dueDate, params.currentDate) === null
        ? 'Calendar due date could not be calculated.'
        : null,
    });
  }

  private static resultFromDueStatus(params: {
    itemType: CalendarDueMonitorItemType;
    itemId: string | null;
    reference: string;
    aircraftId: string | null;
    componentId: string | null;
    sourceService: CalendarDueMonitorSourceService;
    sourceDomain: string;
    currentDate: string;
    dueStatus: DueStatusResult;
    fallbackUnknownReason: string | null;
    explanationPrefix: string;
  }): CalendarDueMonitorResult {
    const calendarLimit = this.calendarLimit(params.dueStatus);

    return {
      item_type: params.itemType,
      item_id: params.itemId,
      reference: params.reference,
      aircraft_id: params.aircraftId,
      component_id: params.componentId,
      current_date: params.currentDate,
      due_date: this.stringOrNull(calendarLimit?.due_value),
      remaining_days: this.numberOrNull(calendarLimit?.remaining_value),
      status: params.dueStatus.status,
      governing_limit: params.dueStatus.governing_limit,
      unknown_reason: params.dueStatus.unknown_reason || params.fallbackUnknownReason,
      source_service: params.sourceService,
      source_domain: params.sourceDomain,
      explanation: `${params.explanationPrefix} ${params.dueStatus.explanation}`,
      calculated_at: params.dueStatus.calculated_at,
    };
  }

  private static hasCalendarLimit(dueStatus: DueStatusResult) {
    return Boolean(this.calendarLimit(dueStatus));
  }

  private static calendarLimit(dueStatus: DueStatusResult) {
    return dueStatus.evaluated_limits.find((limit) => limit.tracking_basis === 'CALENDAR') ||
      (dueStatus.governing_limit?.tracking_basis === 'CALENDAR'
        ? dueStatus.governing_limit
        : null);
  }

  private static dueItemType(itemType: CalendarDueMonitorItemType): DueStatusResult['item_type'] {
    if (itemType === 'COMPONENT_HARD_LIFE') {
      return 'COMPONENT_RETIREMENT';
    }

    if (itemType === 'COMPONENT_CALENDAR_LIFE') {
      return 'COMPONENT_LIFE_LIMIT';
    }

    return itemType;
  }

  private static async getAllAircraftIds() {
    const aircraft = await Aircraft.findAll({
      attributes: ['id'],
      order: [['registration', 'ASC']],
    });

    return aircraft.map((row) => row.id);
  }

  private static summary(results: CalendarDueMonitorResult[]) {
    return {
      not_due: results.filter((result) => result.status === 'NOT_DUE').length,
      due_soon: results.filter((result) => result.status === 'DUE_SOON').length,
      due: results.filter((result) => result.status === 'DUE').length,
      overdue: results.filter((result) => result.status === 'OVERDUE').length,
      unknown: results.filter((result) => result.status === 'UNKNOWN').length,
      not_applicable: results.filter((result) => result.status === 'NOT_APPLICABLE').length,
    };
  }

  private static dateOnly(value: Date | string) {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('INVALID_EVALUATION_DATE');
    }

    return parsed.toISOString().slice(0, 10);
  }

  private static remainingDaysUntil(dateValue: string, currentDateValue: string) {
    const dueDate = new Date(`${dateValue}T00:00:00.000Z`);
    const currentDate = new Date(`${currentDateValue}T00:00:00.000Z`);

    if (Number.isNaN(dueDate.getTime()) || Number.isNaN(currentDate.getTime())) {
      return null;
    }

    return Math.ceil((this.startOfUtcDay(dueDate) - this.startOfUtcDay(currentDate)) / 86400000);
  }

  private static startOfUtcDay(value: Date) {
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }

  private static stringOrNull(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    return String(value);
  }

  private static numberOrNull(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
