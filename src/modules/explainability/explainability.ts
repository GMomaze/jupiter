import type { ComponentLifeCalculationResult } from '../aircraft/component-life-calculation.service.js';
import type { ComponentLimitMonitoringResult } from '../aircraft/component-limit-monitoring.service.js';
import type { CalendarDueMonitorResult } from '../calendar-due/calendar-due-monitor.service.js';
import type { ComplianceDueResult } from '../compliance/compliance-due-recalculation.service.js';
import type { DueStatusResult } from '../due-status/due-status.service.js';
import type { ScheduledTaskDueResult } from '../tasks/scheduled-task-due-recalculation.service.js';
import type { UtilisationPropagationPreview } from '../utilisation/utilisation-propagation-preview.service.js';

export type ExplainabilityAuthority =
  | 'UtilisationService'
  | 'UtilisationPropagationPreviewService'
  | 'ComponentLifeCalculationService'
  | 'DueStatusService'
  | 'ComponentLimitMonitoringService'
  | 'ComplianceDueRecalculationService'
  | 'ScheduledTaskDueRecalculationService'
  | 'CalendarDueMonitorService';

export type ExplainabilityMode =
  | 'MUTATION'
  | 'PREVIEW'
  | 'LIVE_CALCULATION'
  | 'READ_ONLY_RECALCULATION';

export type ExplainabilitySourceRecordRole =
  | 'AUTHORITY_EVENT'
  | 'SNAPSHOT'
  | 'BASELINE'
  | 'LIMIT'
  | 'COMPLIANCE_RECORD'
  | 'APPLICABILITY_RECORD'
  | 'TASK_RECORD'
  | 'WORKPACK_RECORD'
  | 'MANUAL_INPUT'
  | 'DERIVED_INPUT';

export type ExplainabilitySourceRecord = {
  table_name: string;
  row_id: string | null;
  role: ExplainabilitySourceRecordRole;
  description: string;
};

export type ExplainabilityAuditRecord = {
  table_name: string;
  row_id: string;
  action: string;
};

export type ExplainabilityCalculationBasis = {
  tracking_basis: string | null;
  basis_type: string | null;
  baseline: Record<string, unknown>;
  current_value_source: string | null;
};

export type ExplainabilityResult = {
  authority: ExplainabilityAuthority;
  mode: ExplainabilityMode;
  item_type: string;
  item_reference: string | null;
  item_id: string | null;
  aircraft_id: string | null;
  component_id: string | null;
  calculation_basis: ExplainabilityCalculationBasis;
  governing_limit: unknown;
  current_value: number | string | null;
  target_value: number | string | null;
  remaining_value: number | string | null;
  status: string | null;
  severity: string | null;
  explanation_text: string;
  unknown_reason: string | null;
  source_records: ExplainabilitySourceRecord[];
  audit_records: ExplainabilityAuditRecord[];
  calculated_at: string;
};

type UtilisationEventLike = {
  id: string;
  aircraft_id?: string | null;
  source_type: string;
  source_reference: string | null;
  effective_date: string | Date;
  previous_total_time_hours: number | string;
  new_total_time_hours: number | string;
  delta_hours: number | string;
  previous_total_time_cycles: number | string;
  new_total_time_cycles: number | string;
  delta_cycles: number | string;
  reason: string;
  correction_of_event_id?: string | null;
  created_at?: string | Date;
};

const emptyBasis = (): ExplainabilityCalculationBasis => ({
  tracking_basis: null,
  basis_type: null,
  baseline: {},
  current_value_source: null,
});

const nowIso = () => new Date().toISOString();

const asStringOrNull = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
};

const firstUnknownReason = (reasons?: string[] | null) => {
  if (!reasons || reasons.length === 0) return null;
  return reasons.find((reason) => Boolean(reason)) || null;
};

const mergeSourceRecords = (
  records: ExplainabilitySourceRecord[] | undefined
): ExplainabilitySourceRecord[] => records || [];

export class ExplainabilityMapper {
  static fromUtilisationEvent(
    event: UtilisationEventLike,
    options: {
      auditRecords?: ExplainabilityAuditRecord[];
      aircraftId?: string | null;
    } = {}
  ): ExplainabilityResult {
    const aircraftId = options.aircraftId ?? event.aircraft_id ?? null;

    return {
      authority: 'UtilisationService',
      mode: 'MUTATION',
      item_type: 'AIRCRAFT_UTILISATION_EVENT',
      item_reference: event.id,
      item_id: event.id,
      aircraft_id: aircraftId,
      component_id: null,
      calculation_basis: {
        tracking_basis: 'AIRCRAFT_UTILISATION',
        basis_type: event.source_type,
        baseline: {
          previous_total_time_hours: event.previous_total_time_hours,
          previous_total_time_cycles: event.previous_total_time_cycles,
          effective_date: event.effective_date,
          source_reference: event.source_reference,
        },
        current_value_source: 'utilisation_events',
      },
      governing_limit: null,
      current_value: `${event.new_total_time_hours}h/${event.new_total_time_cycles}cyc`,
      target_value: null,
      remaining_value: null,
      status: Number(event.delta_hours) < 0 || Number(event.delta_cycles) < 0 ? 'CORRECTION' : 'RECORDED',
      severity: null,
      explanation_text:
        `Aircraft utilisation changed by ${event.delta_hours} hours and ${event.delta_cycles} cycles. ` +
        `Reason: ${event.reason}`,
      unknown_reason: null,
      source_records: [
        {
          table_name: 'utilisation_events',
          row_id: event.id,
          role: 'AUTHORITY_EVENT',
          description: 'Immutable aircraft utilisation authority event.',
        },
      ],
      audit_records: options.auditRecords || [],
      calculated_at: asStringOrNull(event.created_at) || nowIso(),
    };
  }

  static fromUtilisationPreview(preview: UtilisationPropagationPreview): ExplainabilityResult {
    return {
      authority: 'UtilisationPropagationPreviewService',
      mode: 'PREVIEW',
      item_type: 'AIRCRAFT_UTILISATION_PREVIEW',
      item_reference: preview.aircraft.registration,
      item_id: preview.aircraft.id,
      aircraft_id: preview.aircraft.id,
      component_id: null,
      calculation_basis: {
        tracking_basis: 'AIRCRAFT_UTILISATION',
        basis_type: preview.entry.source_type,
        baseline: {
          current_total_time_hours: preview.aircraft.current_total_time_hours,
          current_total_time_cycles: preview.aircraft.current_total_time_cycles,
          source_reference: preview.entry.source_reference,
          effective_date: preview.entry.effective_date,
        },
        current_value_source: 'aircraft',
      },
      governing_limit: null,
      current_value: `${preview.aircraft.current_total_time_hours}h/${preview.aircraft.current_total_time_cycles}cyc`,
      target_value: `${preview.aircraft.proposed_total_time_hours}h/${preview.aircraft.proposed_total_time_cycles}cyc`,
      remaining_value: `${preview.aircraft.delta_hours}h/${preview.aircraft.delta_cycles}cyc`,
      status: preview.entry.classification,
      severity: preview.entry.classification === 'CORRECTION' ? 'WARNING' : null,
      explanation_text:
        `Preview only: proposed utilisation delta is ${preview.aircraft.delta_hours} hours and ` +
        `${preview.aircraft.delta_cycles} cycles. ${preview.boundary_notice}`,
      unknown_reason:
        preview.summary.unknown_component_count > 0
          ? `${preview.summary.unknown_component_count} component life result(s) are UNKNOWN.`
          : null,
      source_records: [
        {
          table_name: 'aircraft',
          row_id: preview.aircraft.id,
          role: 'SNAPSHOT',
          description: 'Current aircraft snapshot used for read-only preview.',
        },
      ],
      audit_records: [],
      calculated_at: nowIso(),
    };
  }

  static fromComponentLifeCalculation(
    result: ComponentLifeCalculationResult,
    options: {
      itemReference?: string | null;
      installationId?: string | null;
      aircraftId?: string | null;
      componentId?: string | null;
      sourceRecords?: ExplainabilitySourceRecord[];
    } = {}
  ): ExplainabilityResult {
    const unknownReason = firstUnknownReason(
      Object.values(result.dimensions).flatMap((dimension) => dimension.missing_reasons)
    );

    return {
      authority: 'ComponentLifeCalculationService',
      mode: 'LIVE_CALCULATION',
      item_type: 'COMPONENT_LIFE',
      item_reference: options.itemReference || options.installationId || null,
      item_id: options.installationId || null,
      aircraft_id: options.aircraftId || null,
      component_id: options.componentId || null,
      calculation_basis: {
        tracking_basis: result.tracking_basis,
        basis_type: 'COMPONENT_LIFE',
        baseline: Object.fromEntries(
          Object.entries(result.dimensions).map(([dimension, value]) => [dimension, value.baseline_used])
        ),
        current_value_source: 'ComponentLifeCalculationService',
      },
      governing_limit: null,
      current_value: JSON.stringify(result.values),
      target_value: null,
      remaining_value: null,
      status: result.status,
      severity: null,
      explanation_text: result.explanation,
      unknown_reason: unknownReason,
      source_records: mergeSourceRecords(options.sourceRecords),
      audit_records: [],
      calculated_at: nowIso(),
    };
  }

  static fromDueStatus(
    result: DueStatusResult,
    options: {
      authority?: ExplainabilityAuthority;
      mode?: ExplainabilityMode;
      itemType?: string;
      itemReference?: string | null;
      itemId?: string | null;
      aircraftId?: string | null;
      componentId?: string | null;
      sourceRecords?: ExplainabilitySourceRecord[];
    } = {}
  ): ExplainabilityResult {
    return {
      authority: options.authority || 'DueStatusService',
      mode: options.mode || 'LIVE_CALCULATION',
      item_type: options.itemType || result.item_type,
      item_reference: options.itemReference || null,
      item_id: options.itemId || result.item_id || null,
      aircraft_id: options.aircraftId || null,
      component_id: options.componentId || null,
      calculation_basis: {
        tracking_basis: result.tracking_basis,
        basis_type: 'DUE_STATUS',
        baseline: {},
        current_value_source: 'DueStatusService',
      },
      governing_limit: result.governing_limit,
      current_value: result.current_value,
      target_value: result.due_value,
      remaining_value: result.remaining_value,
      status: result.status,
      severity: null,
      explanation_text: result.explanation,
      unknown_reason: result.unknown_reason,
      source_records: mergeSourceRecords(options.sourceRecords),
      audit_records: [],
      calculated_at: nowIso(),
    };
  }

  static fromComponentLimitMonitoring(result: ComponentLimitMonitoringResult): ExplainabilityResult {
    return {
      authority: 'ComponentLimitMonitoringService',
      mode: 'LIVE_CALCULATION',
      item_type: 'COMPONENT_LIMIT',
      item_reference: result.component.serial_number || result.component.model_name,
      item_id: result.component.installation_id,
      aircraft_id: result.component.aircraft_id,
      component_id: result.component.serialized_component_id,
      calculation_basis: {
        tracking_basis: result.tracking_basis,
        basis_type: result.limit_type,
        baseline: result.source_baseline,
        current_value_source: 'ComponentLifeCalculationService',
      },
      governing_limit: result.due_status_result.governing_limit,
      current_value: result.current_value,
      target_value: result.limit_value,
      remaining_value: result.remaining_value,
      status: result.due_status,
      severity: result.severity,
      explanation_text: result.explanation,
      unknown_reason: result.unknown_reason,
      source_records: [
        {
          table_name: 'aircraft_component_installations',
          row_id: result.component.installation_id,
          role: 'BASELINE',
          description: 'Installed serialized component baseline used for component limit monitoring.',
        },
      ],
      audit_records: [],
      calculated_at: nowIso(),
    };
  }

  static fromComplianceDue(result: ComplianceDueResult): ExplainabilityResult {
    return {
      authority: 'ComplianceDueRecalculationService',
      mode: 'READ_ONLY_RECALCULATION',
      item_type: result.item_type,
      item_reference: result.reference,
      item_id: result.item_id,
      aircraft_id: null,
      component_id: null,
      calculation_basis: {
        tracking_basis: result.governing_limit?.tracking_basis || null,
        basis_type: 'COMPLIANCE_DUE',
        baseline: {
          last_compliance: result.last_compliance,
          next_due: result.next_due,
          recurrence: result.recurrence,
        },
        current_value_source: 'ComplianceDueRecalculationService',
      },
      governing_limit: result.governing_limit,
      current_value: JSON.stringify(result.current_aircraft),
      target_value: JSON.stringify(result.next_due),
      remaining_value: result.remaining_value,
      status: result.status,
      severity: null,
      explanation_text: result.explanation,
      unknown_reason: result.unknown_reason,
      source_records: [
        {
          table_name: 'compliance_items',
          row_id: result.item_id,
          role: 'COMPLIANCE_RECORD',
          description: 'Compliance item used for AD/SB/SID due recalculation.',
        },
      ],
      audit_records: [],
      calculated_at: result.calculated_at,
    };
  }

  static fromScheduledTaskDue(result: ScheduledTaskDueResult): ExplainabilityResult {
    return {
      authority: 'ScheduledTaskDueRecalculationService',
      mode: 'READ_ONLY_RECALCULATION',
      item_type: 'SCHEDULED_TASK',
      item_reference: result.task_identity.reference,
      item_id: result.source_program.source_id,
      aircraft_id: null,
      component_id: null,
      calculation_basis: {
        tracking_basis: result.governing_limit?.tracking_basis || null,
        basis_type: result.interval.interval_type,
        baseline: {
          last_compliance: result.last_compliance,
          next_due: result.next_due,
          interval: result.interval,
        },
        current_value_source: 'ScheduledTaskDueRecalculationService',
      },
      governing_limit: result.governing_limit,
      current_value: JSON.stringify(result.current_aircraft),
      target_value: JSON.stringify(result.next_due),
      remaining_value: result.remaining_value,
      status: result.status,
      severity: null,
      explanation_text: result.explanation,
      unknown_reason: result.unknown_reason,
      source_records: [
        {
          table_name: this.tableForScheduledTaskSource(result.source_program.source_type),
          row_id: result.source_program.source_id,
          role: 'TASK_RECORD',
          description: 'Scheduled task source used for due recalculation.',
        },
      ],
      audit_records: [],
      calculated_at: result.calculated_at,
    };
  }

  static fromCalendarDueMonitor(result: CalendarDueMonitorResult): ExplainabilityResult {
    return {
      authority: 'CalendarDueMonitorService',
      mode: 'READ_ONLY_RECALCULATION',
      item_type: result.item_type,
      item_reference: result.reference,
      item_id: result.item_id,
      aircraft_id: result.aircraft_id,
      component_id: result.component_id,
      calculation_basis: {
        tracking_basis: result.governing_limit?.tracking_basis || 'CALENDAR',
        basis_type: result.source_domain,
        baseline: {
          current_date: result.current_date,
          due_date: result.due_date,
        },
        current_value_source: result.source_service,
      },
      governing_limit: result.governing_limit,
      current_value: result.current_date,
      target_value: result.due_date,
      remaining_value: result.remaining_days,
      status: result.status,
      severity: null,
      explanation_text: result.explanation,
      unknown_reason: result.unknown_reason,
      source_records: [
        {
          table_name: result.source_domain,
          row_id: result.item_id,
          role: 'DERIVED_INPUT',
          description: `${result.source_service} calendar due source.`,
        },
      ],
      audit_records: [],
      calculated_at: result.calculated_at,
    };
  }

  private static tableForScheduledTaskSource(sourceType: string): string {
    const tableMap: Record<string, string> = {
      TASK_TEMPLATE: 'task_templates',
      MAINTENANCE_TEMPLATE: 'maintenance_templates',
      MAINTENANCE_TEMPLATE_ITEM: 'maintenance_template_items',
      TASK_CARD: 'task_cards',
      MAINTENANCE_REQUIREMENT: 'maintenance_requirements',
    };

    return tableMap[sourceType] || 'scheduled_task_source';
  }
}
