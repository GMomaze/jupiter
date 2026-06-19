import { describe, expect, it } from 'vitest';
import { DueStatusService } from '../due-status/due-status.service.js';
import {
  ExplainabilityMapper,
  ExplainabilityResult,
  ExplainabilitySourceRecord,
} from './explainability.js';

describe('ExplainabilityMapper', () => {
  const expectCommonShape = (result: ExplainabilityResult) => {
    expect(result).toEqual(
      expect.objectContaining({
        authority: expect.any(String),
        mode: expect.any(String),
        item_type: expect.any(String),
        calculation_basis: expect.any(Object),
        explanation_text: expect.any(String),
        source_records: expect.any(Array),
        audit_records: expect.any(Array),
        calculated_at: expect.any(String),
      })
    );
    expect(result).toHaveProperty('item_reference');
    expect(result).toHaveProperty('governing_limit');
    expect(result).toHaveProperty('current_value');
    expect(result).toHaveProperty('target_value');
    expect(result).toHaveProperty('remaining_value');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('unknown_reason');
  };

  it('maps utilisation events into the shared explainability shape', () => {
    const result = ExplainabilityMapper.fromUtilisationEvent(
      {
        id: 'event-1',
        aircraft_id: 'aircraft-1',
        source_type: 'JOURNEY_LOG',
        source_reference: 'JL-42',
        effective_date: '2026-06-18',
        previous_total_time_hours: 100,
        new_total_time_hours: 102.5,
        delta_hours: 2.5,
        previous_total_time_cycles: 40,
        new_total_time_cycles: 41,
        delta_cycles: 1,
        reason: 'Journey log uplift',
        correction_of_event_id: null,
        created_at: '2026-06-18T08:00:00.000Z',
      },
      {
        auditRecords: [
          {
            table_name: 'audit_log',
            row_id: 'audit-1',
            action: 'UTILISATION_EVENT_CREATED',
          },
        ],
      }
    );

    expectCommonShape(result);
    expect(result.authority).toBe('UtilisationService');
    expect(result.mode).toBe('MUTATION');
    expect(result.status).toBe('RECORDED');
    expect(result.source_records[0]).toEqual(
      expect.objectContaining({
        table_name: 'utilisation_events',
        row_id: 'event-1',
        role: 'AUTHORITY_EVENT',
      })
    );
    expect(result.audit_records[0]?.action).toBe('UTILISATION_EVENT_CREATED');
  });

  it('maps UNKNOWN due status with unknown reason and no audit records', () => {
    const dueStatus = DueStatusService.evaluateUnknown({
      itemType: 'COMPONENT_LIMIT',
      itemId: 'limit-1',
      trackingBasis: 'AIRCRAFT_HOURS',
      limitType: 'TBO_HOURS',
      reason: 'Install aircraft hours baseline is missing.',
    });

    const result = ExplainabilityMapper.fromDueStatus(dueStatus, {
      itemReference: 'PROP-001',
    });

    expectCommonShape(result);
    expect(result.status).toBe('UNKNOWN');
    expect(result.unknown_reason).toBe('Install aircraft hours baseline is missing.');
    expect(result.audit_records).toEqual([]);
  });

  it('maps due and overdue status without changing due-state decisions', () => {
    const dueSoon = ExplainabilityMapper.fromDueStatus(
      DueStatusService.evaluateHours({
        itemType: 'AD',
        itemId: 'ad-1',
        trackingBasis: 'AIRCRAFT_HOURS',
        currentValue: 95,
        dueValue: 100,
        limitType: 'AD hours limit',
      })
    );
    const overdue = ExplainabilityMapper.fromDueStatus(
      DueStatusService.evaluateCalendarDays({
        itemType: 'SB',
        itemId: 'sb-1',
        trackingBasis: 'CALENDAR',
        remainingValue: -3,
        limitType: 'SB calendar limit',
      })
    );

    expect(dueSoon.status).toBe('DUE_SOON');
    expect(dueSoon.remaining_value).toBe(5);
    expect(overdue.status).toBe('OVERDUE');
    expect(overdue.remaining_value).toBe(-3);
  });

  it('maps source records supplied with component life calculation output', () => {
    const sourceRecords: ExplainabilitySourceRecord[] = [
      {
        table_name: 'aircraft_component_installations',
        row_id: 'installation-1',
        role: 'BASELINE',
        description: 'Install baseline.',
      },
    ];
    const result = ExplainabilityMapper.fromComponentLifeCalculation(
      {
        installation_id: 'installation-1',
        tracking_basis: 'AIRCRAFT_HOURS',
        status: 'UNKNOWN',
        values: {
          tsn_hours: null,
          tso_hours: null,
          csn_cycles: null,
          cso_cycles: null,
        },
        dimensions: {
          tsn_hours: {
            status: 'UNKNOWN',
            value: null,
            tracking_basis: 'AIRCRAFT_HOURS',
            baseline_used: {},
            current_meter_value: null,
            delta_applied: null,
            missing_reasons: ['install_aircraft_hours is missing.'],
            explanation: 'TSN unknown: install_aircraft_hours is missing.',
          },
          tso_hours: {
            status: 'UNKNOWN',
            value: null,
            tracking_basis: 'AIRCRAFT_HOURS',
            baseline_used: {},
            current_meter_value: null,
            delta_applied: null,
            missing_reasons: [],
            explanation: 'TSO unknown.',
          },
          csn_cycles: {
            status: 'UNKNOWN',
            value: null,
            tracking_basis: 'AIRCRAFT_HOURS',
            baseline_used: {},
            current_meter_value: null,
            delta_applied: null,
            missing_reasons: [],
            explanation: 'CSN unknown.',
          },
          cso_cycles: {
            status: 'UNKNOWN',
            value: null,
            tracking_basis: 'AIRCRAFT_HOURS',
            baseline_used: {},
            current_meter_value: null,
            delta_applied: null,
            missing_reasons: [],
            explanation: 'CSO unknown.',
          },
        },
        explanation: 'Component life is UNKNOWN.',
      } as any,
      {
        installationId: 'installation-1',
        sourceRecords,
      }
    );

    expectCommonShape(result);
    expect(result.authority).toBe('ComponentLifeCalculationService');
    expect(result.unknown_reason).toBe('install_aircraft_hours is missing.');
    expect(result.source_records).toEqual(sourceRecords);
    expect(result.audit_records).toEqual([]);
  });

  it('maps preview output as preview-only and not audited', () => {
    const result = ExplainabilityMapper.fromUtilisationPreview({
      aircraft: {
        id: 'aircraft-1',
        registration: 'ZS-TST',
        current_total_time_hours: 100,
        current_total_time_cycles: 40,
        proposed_total_time_hours: 99,
        proposed_total_time_cycles: 39,
        delta_hours: -1,
        delta_cycles: -1,
      },
      entry: {
        source_type: 'CORRECTION',
        source_reference: 'CORR-1',
        effective_date: '2026-06-18',
        reason: 'Meter correction',
        classification: 'CORRECTION',
        correction_warning: {
          decreases_hours: true,
          decreases_cycles: true,
          message: 'Correction decreases aircraft utilisation.',
          required_fields: ['reason', 'source_reference'],
          downstream_warning: 'Downstream component values may reduce or become UNKNOWN.',
        },
      },
      validation_warnings: [],
      affected_components: [],
      affected_due_items: [],
      summary: {
        active_serialized_component_count: 0,
        calculated_component_count: 0,
        unknown_component_count: 0,
        missing_baseline_warning_count: 0,
        correction: true,
        warnings: [],
      },
      boundary_notice: 'Preview is read-only.',
    });

    expectCommonShape(result);
    expect(result.authority).toBe('UtilisationPropagationPreviewService');
    expect(result.mode).toBe('PREVIEW');
    expect(result.status).toBe('CORRECTION');
    expect(result.audit_records).toEqual([]);
  });

  it('maps calendar monitor output as read-only recalculation and not audited', () => {
    const dueStatus = DueStatusService.evaluateCalendarDays({
      itemType: 'AD',
      itemId: 'ad-1',
      trackingBasis: 'CALENDAR',
      remainingValue: -1,
      limitType: 'AD calendar limit',
    });
    const result = ExplainabilityMapper.fromCalendarDueMonitor({
      item_type: 'AD',
      item_id: 'ad-1',
      reference: 'AD-2026-01',
      aircraft_id: 'aircraft-1',
      component_id: null,
      current_date: '2026-06-18',
      due_date: '2026-06-17',
      remaining_days: -1,
      status: dueStatus.status,
      governing_limit: dueStatus.governing_limit,
      unknown_reason: dueStatus.unknown_reason,
      source_service: 'ComplianceDueRecalculationService',
      source_domain: 'AD',
      explanation: dueStatus.explanation,
      calculated_at: '2026-06-18T08:00:00.000Z',
    });

    expectCommonShape(result);
    expect(result.status).toBe('OVERDUE');
    expect(result.mode).toBe('READ_ONLY_RECALCULATION');
    expect(result.source_records[0]).toEqual(
      expect.objectContaining({
        table_name: 'AD',
        row_id: 'ad-1',
        role: 'DERIVED_INPUT',
      })
    );
    expect(result.audit_records).toEqual([]);
  });
});
