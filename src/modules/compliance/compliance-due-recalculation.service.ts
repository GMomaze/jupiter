import { QueryTypes } from 'sequelize';
import { Aircraft, ComplianceItem, sequelize } from '../../models/index.js';
import {
  DueBasis,
  DueLimitEvaluation,
  DueStatusResult,
  DueStatusService,
} from '../due-status/due-status.service.js';
import {
  ApplicabilityEngineService,
  ApplicabilityItem,
} from './applicability-engine.service.js';

export type ComplianceDueItemType = 'AD' | 'SB' | 'SID';

export type ComplianceDueResult = {
  item_type: ComplianceDueItemType;
  item_id: string | null;
  reference: string;
  title: string | null;
  applicability: {
    status: 'APPLICABLE' | 'NOT_APPLICABLE' | 'UNKNOWN';
    source: string | null;
    reason: string | null;
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
  recurrence: {
    is_recurring: boolean | null;
    interval_hours: number | null;
    interval_cycles: number | null;
    interval_months: number | null;
    terminating_action_recorded: boolean;
  };
  due_status: DueStatusResult;
  status: DueStatusResult['status'];
  governing_limit: DueLimitEvaluation | null;
  remaining_value: number | string | null;
  unknown_reason: string | null;
  explanation: string;
  calculated_at: string;
};

type AircraftSnapshot = {
  id: string;
  model_id: string | null;
  total_time_hours: number | null;
  total_time_cycles: number | null;
};

type AircraftComplianceRow = {
  compliance_item_id: string;
  item_type: ComplianceDueItemType;
  code: string;
  title: string | null;
  source_type: ComplianceDueItemType | null;
  source_id: string | null;
  compliance_basis: string | null;
  aircraft_compliance_id: string | null;
  status: string | null;
  last_complied_at: Date | string | null;
  next_due_at: Date | string | null;
  last_complied_hours: string | number | null;
  next_due_hours: string | number | null;
  compliance_method: string | null;
  notes: string | null;
  source_is_recurring: boolean | null;
  source_interval_hours: string | number | null;
  source_interval_months: string | number | null;
};

type SidStatusRow = {
  sid_id: string;
  status: string | null;
  last_done_hours: string | number | null;
  last_done_date: Date | string | null;
  next_due_hours: string | number | null;
  next_due_date: Date | string | null;
};

type SidIntervalRow = {
  id: string;
  initial_interval_hours: string | number | null;
  initial_interval_months: string | number | null;
  repeat_interval_hours: string | number | null;
  repeat_interval_months: string | number | null;
};

export class ComplianceDueRecalculationService {
  static async recalculateForUtilisationEvent(aircraftId: string) {
    return this.recalculateForAircraft(aircraftId, 'UTILISATION_EVENT');
  }

  static async recalculateForComplianceEntry(aircraftId: string) {
    return this.recalculateForAircraft(aircraftId, 'COMPLIANCE_ENTRY');
  }

  static async recalculateForApplicabilityChange(aircraftId: string) {
    return this.recalculateForAircraft(aircraftId, 'APPLICABILITY_CHANGE');
  }

  static async recalculateManually(aircraftId: string) {
    return this.recalculateForAircraft(aircraftId, 'MANUAL_RECALCULATION');
  }

  static async recalculateForAircraft(
    aircraftId: string,
    recalculationSource = 'MANUAL_RECALCULATION'
  ): Promise<ComplianceDueResult[]> {
    const aircraft = await this.getAircraftSnapshot(aircraftId);
    const applicability = await ApplicabilityEngineService.getApplicabilityForAircraft(aircraftId);
    const complianceRows = await this.getAircraftComplianceRows(aircraftId);
    const complianceBySource = new Map(
      complianceRows
        .filter((row) => row.source_type && row.source_id)
        .map((row) => [`${row.source_type}:${row.source_id}`, row])
    );
    const sidStatuses = await this.getSidStatuses(aircraftId);

    return Promise.all(
      applicability.items.map(async (item) => {
        if (item.source_type === 'SID') {
          return this.calculateSidResult({
            item,
            aircraft,
            sidStatus: sidStatuses.get(item.source_id) || null,
            recalculationSource,
          });
        }

        return this.calculateComplianceItemResult({
          item,
          aircraft,
          compliance: complianceBySource.get(`${item.source_type}:${item.source_id}`) || null,
          recalculationSource,
        });
      })
    );
  }

  static buildNotApplicableResult(params: {
    itemType: ComplianceDueItemType;
    itemId?: string | null;
    reference: string;
    title?: string | null;
    reason: string;
  }): ComplianceDueResult {
    const dueStatus = DueStatusService.evaluateNotApplicable({
      itemType: this.dueItemType(params.itemType),
      itemId: params.itemId || null,
      itemReference: params.reference,
      trackingBasis: 'APPLICABILITY',
      reason: params.reason,
    });

    return this.resultFromDueStatus({
      itemType: params.itemType,
      itemId: params.itemId || null,
      reference: params.reference,
      title: params.title || null,
      applicability: {
        status: 'NOT_APPLICABLE',
        source: null,
        reason: params.reason,
      },
      aircraft: {
        id: '',
        model_id: null,
        total_time_hours: null,
        total_time_cycles: null,
      },
      lastCompliance: this.emptyComplianceBasis(null),
      nextDue: this.emptyNextDue(null),
      recurrence: this.emptyRecurrence(),
      dueStatus,
      explanationPrefix: params.reason,
    });
  }

  private static async calculateComplianceItemResult(params: {
    item: ApplicabilityItem;
    aircraft: AircraftSnapshot;
    compliance: AircraftComplianceRow | null;
    recalculationSource: string;
  }): Promise<ComplianceDueResult> {
    const terminatingActionRecorded = this.hasTerminatingAction(params.compliance);

    if (terminatingActionRecorded) {
      const dueStatus = this.terminatingActionDueStatus(params.item);
      return this.resultFromDueStatus({
        itemType: params.item.source_type,
        itemId: params.item.source_id,
        reference: params.item.reference,
        title: params.item.title,
        applicability: this.applicabilityFor(params.item),
        aircraft: params.aircraft,
        lastCompliance: this.lastComplianceFromAircraftCompliance(params.compliance),
        nextDue: this.emptyNextDue('TERMINATING_ACTION'),
        recurrence: {
          ...this.recurrenceFromApplicability(params.item),
          terminating_action_recorded: true,
        },
        dueStatus,
        explanationPrefix: 'Terminating action recorded; recurring due calculation is stopped.',
      });
    }

    const nextDue = this.nextDueFromAircraftCompliance(params.compliance, params.item);
    const dueStatus = this.evaluateDueStatus({
      itemType: params.item.source_type,
      itemId: params.item.source_id,
      reference: params.item.reference,
      currentHours: params.aircraft.total_time_hours,
      currentCycles: params.aircraft.total_time_cycles,
      currentDate: this.today(),
      nextDue,
      unknownFallback: this.unknownReasonForCompliance(params.compliance, nextDue),
    });

    return this.resultFromDueStatus({
      itemType: params.item.source_type,
      itemId: params.item.source_id,
      reference: params.item.reference,
      title: params.item.title,
      applicability: this.applicabilityFor(params.item),
      aircraft: params.aircraft,
      lastCompliance: this.lastComplianceFromAircraftCompliance(params.compliance),
      nextDue,
      recurrence: this.recurrenceFromCompliance(params.item, params.compliance),
      dueStatus,
      explanationPrefix: `Recalculated from ${params.recalculationSource}.`,
    });
  }

  private static async calculateSidResult(params: {
    item: ApplicabilityItem;
    aircraft: AircraftSnapshot;
    sidStatus: SidStatusRow | null;
    recalculationSource: string;
  }): Promise<ComplianceDueResult> {
    const intervals = await this.getSidIntervals(params.item.source_id);
    const lastCompliance = {
      hours: this.numberOrNull(params.sidStatus?.last_done_hours),
      cycles: null,
      date: this.dateOnlyOrNull(params.sidStatus?.last_done_date),
      source: params.sidStatus ? 'aircraft_sid_status' : null,
    };
    const nextDue = this.nextDueFromSidStatus(params.sidStatus, intervals, lastCompliance);
    const dueStatus = this.evaluateDueStatus({
      itemType: 'SID',
      itemId: params.item.source_id,
      reference: params.item.reference,
      currentHours: params.aircraft.total_time_hours,
      currentCycles: params.aircraft.total_time_cycles,
      currentDate: this.today(),
      nextDue,
      unknownFallback: this.unknownReasonForSid(nextDue, intervals),
    });

    return this.resultFromDueStatus({
      itemType: 'SID',
      itemId: params.item.source_id,
      reference: params.item.reference,
      title: params.item.title,
      applicability: this.applicabilityFor(params.item),
      aircraft: params.aircraft,
      lastCompliance,
      nextDue,
      recurrence: {
        is_recurring: Boolean(intervals?.repeat_interval_hours || intervals?.repeat_interval_months),
        interval_hours: this.numberOrNull(intervals?.repeat_interval_hours),
        interval_cycles: null,
        interval_months: this.numberOrNull(intervals?.repeat_interval_months),
        terminating_action_recorded: false,
      },
      dueStatus,
      explanationPrefix: `Recalculated from ${params.recalculationSource}.`,
    });
  }

  private static evaluateDueStatus(params: {
    itemType: ComplianceDueItemType;
    itemId: string | null;
    reference: string;
    currentHours: number | null;
    currentCycles: number | null;
    currentDate: string;
    nextDue: ComplianceDueResult['next_due'];
    unknownFallback: string;
  }) {
    const dueResults: DueStatusResult[] = [];

    if (params.nextDue.hours !== null) {
      dueResults.push(DueStatusService.evaluateHours({
        itemType: this.dueItemType(params.itemType),
        itemId: params.itemId,
        itemReference: params.reference,
        trackingBasis: 'AIRCRAFT_HOURS',
        currentValue: params.currentHours,
        dueValue: params.nextDue.hours,
        unknownReason: params.currentHours === null ? 'Current aircraft hours are missing.' : null,
      }));
    }

    if (params.nextDue.cycles !== null) {
      dueResults.push(DueStatusService.evaluateCycles({
        itemType: this.dueItemType(params.itemType),
        itemId: params.itemId,
        itemReference: params.reference,
        trackingBasis: 'AIRCRAFT_CYCLES',
        currentValue: params.currentCycles,
        dueValue: params.nextDue.cycles,
        unknownReason: params.currentCycles === null ? 'Current aircraft cycles are missing.' : null,
      }));
    }

    if (params.nextDue.date !== null) {
      const remainingDays = this.remainingDaysUntil(params.nextDue.date, params.currentDate);
      dueResults.push(DueStatusService.evaluateCalendarDays({
        itemType: this.dueItemType(params.itemType),
        itemId: params.itemId,
        itemReference: params.reference,
        trackingBasis: 'CALENDAR',
        currentValue: params.currentDate,
        dueValue: params.nextDue.date,
        remainingValue: remainingDays,
        unknownReason: remainingDays === null ? 'Calendar due date could not be calculated.' : null,
      }));
    }

    if (dueResults.length === 0) {
      return DueStatusService.evaluateUnknown({
        itemType: this.dueItemType(params.itemType),
        itemId: params.itemId,
        itemReference: params.reference,
        reason: params.unknownFallback,
      });
    }

    if (dueResults.length === 1) {
      return dueResults[0]!;
    }

    return DueStatusService.evaluateMixed({
      itemType: this.dueItemType(params.itemType),
      itemId: params.itemId,
      itemReference: params.reference,
      limits: dueResults.flatMap((result) => result.evaluated_limits),
    });
  }

  private static resultFromDueStatus(params: {
    itemType: ComplianceDueItemType;
    itemId: string | null;
    reference: string;
    title: string | null;
    applicability: ComplianceDueResult['applicability'];
    aircraft: AircraftSnapshot;
    lastCompliance: ComplianceDueResult['last_compliance'];
    nextDue: ComplianceDueResult['next_due'];
    recurrence: ComplianceDueResult['recurrence'];
    dueStatus: DueStatusResult;
    explanationPrefix: string;
  }): ComplianceDueResult {
    return {
      item_type: params.itemType,
      item_id: params.itemId,
      reference: params.reference,
      title: params.title,
      applicability: params.applicability,
      current_aircraft: {
        hours: params.aircraft.total_time_hours,
        cycles: params.aircraft.total_time_cycles,
        date: this.today(),
      },
      last_compliance: params.lastCompliance,
      next_due: params.nextDue,
      recurrence: params.recurrence,
      due_status: params.dueStatus,
      status: params.dueStatus.status,
      governing_limit: params.dueStatus.governing_limit,
      remaining_value: params.dueStatus.remaining_value,
      unknown_reason: params.dueStatus.unknown_reason,
      explanation: `${params.explanationPrefix} ${params.dueStatus.explanation}`,
      calculated_at: params.dueStatus.calculated_at,
    };
  }

  private static nextDueFromAircraftCompliance(
    compliance: AircraftComplianceRow | null,
    item: ApplicabilityItem
  ): ComplianceDueResult['next_due'] {
    const intervalHours = item.interval_hours ?? this.numberOrNull(compliance?.source_interval_hours);
    const intervalMonths = item.interval_months ?? this.numberOrNull(compliance?.source_interval_months);
    const nextDue = {
      hours: this.numberOrNull(compliance?.next_due_hours),
      cycles: null,
      date: this.dateOnlyOrNull(compliance?.next_due_at),
      source: compliance ? 'aircraft_compliance' : null,
    };

    if (nextDue.hours === null && compliance?.last_complied_hours && intervalHours) {
      nextDue.hours = this.roundHours(
        this.numberOrNull(compliance.last_complied_hours)! + intervalHours
      );
      nextDue.source = 'aircraft_compliance_recurrence';
    }

    if (nextDue.date === null && compliance?.last_complied_at && intervalMonths) {
      nextDue.date = this.addMonthsToDate(
        this.dateOnlyOrNull(compliance.last_complied_at)!,
        intervalMonths
      );
      nextDue.source = 'aircraft_compliance_recurrence';
    }

    return nextDue;
  }

  private static nextDueFromSidStatus(
    sidStatus: SidStatusRow | null,
    intervals: SidIntervalRow | null,
    lastCompliance: ComplianceDueResult['last_compliance']
  ): ComplianceDueResult['next_due'] {
    const hasPriorCompliance = lastCompliance.hours !== null || lastCompliance.date !== null;
    const nextDue = {
      hours: this.numberOrNull(sidStatus?.next_due_hours),
      cycles: null,
      date: this.dateOnlyOrNull(sidStatus?.next_due_date),
      source: sidStatus ? 'aircraft_sid_status' : null,
    };

    if (nextDue.hours === null) {
      const intervalHours = hasPriorCompliance
        ? this.numberOrNull(intervals?.repeat_interval_hours)
        : this.numberOrNull(intervals?.initial_interval_hours);

      if (intervalHours !== null) {
        nextDue.hours = hasPriorCompliance && lastCompliance.hours !== null
          ? this.roundHours(lastCompliance.hours + intervalHours)
          : intervalHours;
        nextDue.source = hasPriorCompliance ? 'sid_repeat_interval' : 'sid_initial_interval';
      }
    }

    if (nextDue.date === null) {
      const intervalMonths = hasPriorCompliance
        ? this.numberOrNull(intervals?.repeat_interval_months)
        : this.numberOrNull(intervals?.initial_interval_months);
      const referenceDate = hasPriorCompliance ? lastCompliance.date : this.today();

      if (intervalMonths !== null && referenceDate) {
        nextDue.date = this.addMonthsToDate(referenceDate, intervalMonths);
        nextDue.source = hasPriorCompliance ? 'sid_repeat_interval' : 'sid_initial_interval';
      }
    }

    return nextDue;
  }

  private static lastComplianceFromAircraftCompliance(
    compliance: AircraftComplianceRow | null
  ): ComplianceDueResult['last_compliance'] {
    return {
      hours: this.numberOrNull(compliance?.last_complied_hours),
      cycles: null,
      date: this.dateOnlyOrNull(compliance?.last_complied_at),
      source: compliance ? 'aircraft_compliance' : null,
    };
  }

  private static recurrenceFromApplicability(
    item: ApplicabilityItem
  ): ComplianceDueResult['recurrence'] {
    return {
      is_recurring: Boolean(item.interval_hours || item.interval_months),
      interval_hours: item.interval_hours,
      interval_cycles: null,
      interval_months: item.interval_months,
      terminating_action_recorded: false,
    };
  }

  private static recurrenceFromCompliance(
    item: ApplicabilityItem,
    compliance: AircraftComplianceRow | null
  ): ComplianceDueResult['recurrence'] {
    const intervalHours = item.interval_hours ?? this.numberOrNull(compliance?.source_interval_hours);
    const intervalMonths = item.interval_months ?? this.numberOrNull(compliance?.source_interval_months);

    return {
      is_recurring: compliance?.source_is_recurring ?? Boolean(intervalHours || intervalMonths),
      interval_hours: intervalHours,
      interval_cycles: null,
      interval_months: intervalMonths,
      terminating_action_recorded: false,
    };
  }

  private static applicabilityFor(item: ApplicabilityItem): ComplianceDueResult['applicability'] {
    return {
      status: 'APPLICABLE',
      source: item.source_table,
      reason: item.applicability_reason,
    };
  }

  private static emptyComplianceBasis(source: string | null): ComplianceDueResult['last_compliance'] {
    return {
      hours: null,
      cycles: null,
      date: null,
      source,
    };
  }

  private static emptyNextDue(source: string | null): ComplianceDueResult['next_due'] {
    return {
      hours: null,
      cycles: null,
      date: null,
      source,
    };
  }

  private static emptyRecurrence(): ComplianceDueResult['recurrence'] {
    return {
      is_recurring: null,
      interval_hours: null,
      interval_cycles: null,
      interval_months: null,
      terminating_action_recorded: false,
    };
  }

  private static unknownReasonForCompliance(
    compliance: AircraftComplianceRow | null,
    nextDue: ComplianceDueResult['next_due']
  ) {
    if (!compliance?.aircraft_compliance_id) {
      return 'No aircraft compliance record or due basis exists for this applicable item.';
    }

    if (nextDue.hours === null && nextDue.cycles === null && nextDue.date === null) {
      return 'Aircraft compliance record has no next due hours, cycles, or date.';
    }

    return 'Compliance due status could not be calculated.';
  }

  private static unknownReasonForSid(
    nextDue: ComplianceDueResult['next_due'],
    intervals: SidIntervalRow | null
  ) {
    if (!intervals) {
      return 'SID interval source record was not found.';
    }

    if (nextDue.hours === null && nextDue.cycles === null && nextDue.date === null) {
      return 'SID has no next due hours/date or usable initial/repeat interval.';
    }

    return 'SID due status could not be calculated.';
  }

  private static terminatingActionDueStatus(item: ApplicabilityItem) {
    return DueStatusService.evaluateHours({
      itemType: this.dueItemType(item.source_type),
      itemId: item.source_id,
      itemReference: item.reference,
      limitType: 'TERMINATING_ACTION',
      trackingBasis: 'APPLICABILITY',
      currentValue: 0,
      dueValue: 1,
      remainingValue: 1,
      threshold: 0,
    });
  }

  private static hasTerminatingAction(compliance: AircraftComplianceRow | null) {
    const text = [
      compliance?.compliance_method,
      compliance?.notes,
    ].map((value) => String(value || '').toUpperCase()).join(' ');

    return /TERMINATING|TERMINATED|NO_FURTHER_ACTION/.test(text);
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

  private static async getAircraftComplianceRows(aircraftId: string) {
    return sequelize.query<AircraftComplianceRow>(
      `
      SELECT
        ci.id::text AS compliance_item_id,
        ci.item_type,
        ci.code,
        ci.title,
        COALESCE(ci.source_type, ci.item_type) AS source_type,
        ci.source_id::text AS source_id,
        ci.compliance_basis,
        ac.id::text AS aircraft_compliance_id,
        ac.status,
        ac.last_complied_at,
        ac.next_due_at,
        ac.last_complied_hours,
        ac.next_due_hours,
        ac.compliance_method,
        ac.notes,
        ad.is_recurring AS source_is_recurring,
        ad.interval_hours AS source_interval_hours,
        ad.interval_months AS source_interval_months
      FROM compliance_items ci
      LEFT JOIN aircraft_compliance ac
        ON ac.compliance_item_id = ci.id
       AND ac.aircraft_id = :aircraftId
      LEFT JOIN airworthiness_directives ad
        ON COALESCE(ci.source_type, ci.item_type) = 'AD'
       AND ad.id = ci.source_id
      WHERE ci.status = 'ACTIVE'
        AND COALESCE(ci.source_type, ci.item_type) IN ('AD', 'SB')
      `,
      {
        replacements: { aircraftId },
        type: QueryTypes.SELECT,
      }
    );
  }

  private static async getSidStatuses(aircraftId: string) {
    const rows = await sequelize.query<SidStatusRow>(
      `
      SELECT
        sid_id::text AS sid_id,
        status,
        last_done_hours,
        last_done_date,
        next_due_hours,
        next_due_date
      FROM aircraft_sid_status
      WHERE aircraft_id = :aircraftId
      `,
      {
        replacements: { aircraftId },
        type: QueryTypes.SELECT,
      }
    ).catch(() => [] as SidStatusRow[]);

    return new Map(rows.map((row) => [row.sid_id, row]));
  }

  private static async getSidIntervals(sidId: string) {
    const rows = await sequelize.query<SidIntervalRow>(
      `
      SELECT
        id::text AS id,
        initial_interval_hours,
        initial_interval_months,
        repeat_interval_hours,
        repeat_interval_months
      FROM supplemental_inspection_documents
      WHERE id = :sidId
      LIMIT 1
      `,
      {
        replacements: { sidId },
        type: QueryTypes.SELECT,
      }
    ).catch(() => [] as SidIntervalRow[]);

    return rows[0] || null;
  }

  private static dueItemType(itemType: ComplianceDueItemType) {
    return itemType;
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
