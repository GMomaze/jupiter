import { describe, expect, it } from 'vitest';
import { DueStatusService } from './due-status.service.js';

describe('DueStatusService', () => {
  it('evaluates all hour due states across threshold transitions', () => {
    expect(
      DueStatusService.evaluateHours({
        trackingBasis: 'COMPONENT_TSN',
        currentValue: 120,
        dueValue: 100,
        limitType: 'Hours limit',
      }).status
    ).toBe('OVERDUE');

    expect(
      DueStatusService.evaluateHours({
        trackingBasis: 'COMPONENT_TSN',
        currentValue: 100,
        dueValue: 100,
        limitType: 'Hours limit',
      }).status
    ).toBe('DUE');

    expect(
      DueStatusService.evaluateHours({
        trackingBasis: 'COMPONENT_TSN',
        currentValue: 95,
        dueValue: 100,
        limitType: 'Hours limit',
      }).status
    ).toBe('DUE_SOON');

    expect(
      DueStatusService.evaluateHours({
        trackingBasis: 'COMPONENT_TSN',
        currentValue: 80,
        dueValue: 100,
        limitType: 'Hours limit',
      }).status
    ).toBe('NOT_DUE');
  });

  it('evaluates cycle and calendar thresholds', () => {
    const cycle = DueStatusService.evaluateCycles({
      trackingBasis: 'COMPONENT_CSN',
      currentValue: 91,
      dueValue: 100,
      limitType: 'Cycle limit',
    });
    const calendar = DueStatusService.evaluateCalendarDays({
      trackingBasis: 'CALENDAR',
      remainingValue: 30,
      limitType: 'Calendar limit',
    });

    expect(cycle.status).toBe('DUE_SOON');
    expect(cycle.remaining_value).toBe(9);
    expect(calendar.status).toBe('DUE_SOON');
    expect(calendar.threshold_used).toBe(30);
  });

  it('selects the most restrictive status for mixed limits', () => {
    const hourLimit = DueStatusService.evaluateHours({
      trackingBasis: 'COMPONENT_TSN',
      currentValue: 50,
      dueValue: 100,
      limitType: 'Hours limit',
    }).governing_limit!;
    const cycleLimit = DueStatusService.evaluateCycles({
      trackingBasis: 'COMPONENT_CSN',
      currentValue: 99,
      dueValue: 100,
      limitType: 'Cycle limit',
    }).governing_limit!;
    const calendarLimit = DueStatusService.evaluateCalendarDays({
      trackingBasis: 'CALENDAR',
      remainingValue: -2,
      limitType: 'Calendar limit',
    }).governing_limit!;

    const mixed = DueStatusService.evaluateMixed({
      itemType: 'COMPONENT_LIFE_LIMIT',
      itemId: 'mixed-1',
      itemReference: 'Mixed Limit',
      limits: [hourLimit, cycleLimit, calendarLimit],
    });

    expect(mixed.status).toBe('OVERDUE');
    expect(mixed.governing_limit?.limit_type).toBe('Calendar limit');
    expect(mixed.evaluated_limits).toHaveLength(3);
  });

  it('returns UNKNOWN with explanation fields when data is missing', () => {
    const result = DueStatusService.evaluateHours({
      itemType: 'COMPONENT_LIFE_LIMIT',
      itemId: 'unknown-1',
      itemReference: 'Unknown Limit',
      trackingBasis: 'COMPONENT_TSN',
      currentValue: null,
      dueValue: 100,
      limitType: 'Hours limit',
    });

    expect(result.status).toBe('UNKNOWN');
    expect(result.unknown_reason).toBe('Current, due, or remaining value is missing.');
    expect(result.governing_limit?.unknown_reasons).toContain(
      'Current, due, or remaining value is missing.'
    );
  });

  it('returns NOT_APPLICABLE separately from UNKNOWN', () => {
    const result = DueStatusService.evaluateNotApplicable({
      itemType: 'SB',
      itemId: 'sb-1',
      itemReference: 'SB-1',
      reason: 'Service bulletin does not apply to this model.',
    });

    expect(result.status).toBe('NOT_APPLICABLE');
    expect(result.not_applicable_reason).toBe('Service bulletin does not apply to this model.');
    expect(result.unknown_reason).toBeNull();
  });

  it('returns the required explanation contract fields', () => {
    const result = DueStatusService.evaluateHours({
      itemType: 'COMPONENT_TBO',
      itemId: 'component-1',
      itemReference: 'Component 1',
      trackingBasis: 'COMPONENT_TSO',
      currentValue: 90,
      dueValue: 100,
      limitType: 'TBO',
    });

    expect(result).toMatchObject({
      item_type: 'COMPONENT_TBO',
      item_id: 'component-1',
      item_reference: 'Component 1',
      tracking_basis: 'COMPONENT_TSO',
      current_value: 90,
      due_value: 100,
      remaining_value: 10,
      threshold_used: 10,
      status: 'DUE_SOON',
      unknown_reason: null,
    });
    expect(result.governing_limit).toBeTruthy();
    expect(result.explanation).toContain('Governing limit');
  });

  it('ranks NOT_DUE above UNKNOWN but below DUE_SOON for deterministic aggregation', () => {
    expect(DueStatusService.mostRestrictiveStatus(['UNKNOWN', 'NOT_DUE'])).toBe('NOT_DUE');
    expect(DueStatusService.mostRestrictiveStatus(['NOT_DUE', 'DUE_SOON'])).toBe('DUE_SOON');
    expect(DueStatusService.mostRestrictiveStatus(['NOT_APPLICABLE', 'UNKNOWN'])).toBe('UNKNOWN');
  });
});
