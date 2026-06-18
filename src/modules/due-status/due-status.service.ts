export type DueState =
  | 'NOT_DUE'
  | 'DUE_SOON'
  | 'DUE'
  | 'OVERDUE'
  | 'UNKNOWN'
  | 'NOT_APPLICABLE';

export type DueUnit = 'HOURS' | 'CYCLES' | 'DAYS' | 'MONTHS' | 'NONE';

export type DueBasis =
  | 'AIRCRAFT_HOURS'
  | 'AIRCRAFT_CYCLES'
  | 'COMPONENT_TSN'
  | 'COMPONENT_TSO'
  | 'COMPONENT_CSN'
  | 'COMPONENT_CSO'
  | 'CALENDAR'
  | 'MANUAL'
  | 'APPLICABILITY'
  | 'UNSUPPORTED';

export type DueLimitEvaluation = {
  limit_id: string | null;
  limit_type: string | null;
  tracking_basis: DueBasis;
  current_value: number | string | null;
  due_value: number | string | null;
  remaining_value: number | string | null;
  remaining_unit: DueUnit;
  threshold_used: number | null;
  status: DueState;
  unknown_reason: string | null;
  unknown_reasons: string[];
  explanation: string;
};

export type DueStatusResult = {
  item_type:
    | 'COMPONENT_LIFE_LIMIT'
    | 'COMPONENT_TBO'
    | 'COMPONENT_RETIREMENT'
    | 'AD'
    | 'SB'
    | 'SID'
    | 'SCHEDULED_TASK'
    | 'CALENDAR_ITEM';
  item_id: string | null;
  item_reference: string | null;
  status: DueState;
  tracking_basis: DueBasis;
  current_value: number | string | null;
  due_value: number | string | null;
  remaining_value: number | string | null;
  remaining_unit: DueUnit;
  threshold_used: number | null;
  threshold_unit: DueUnit;
  governing_limit: DueLimitEvaluation | null;
  governing_limits: DueLimitEvaluation[];
  evaluated_limits: DueLimitEvaluation[];
  is_partial: boolean;
  unknown_reason: string | null;
  unknown_reasons: string[];
  not_applicable_reason: string | null;
  explanation: string;
  calculated_at: string;
};

type EvaluateRemainingParams = {
  itemType?: DueStatusResult['item_type'];
  itemId?: string | null;
  itemReference?: string | null;
  limitId?: string | null;
  limitType?: string | null;
  trackingBasis: DueBasis;
  currentValue?: number | string | null;
  dueValue?: number | string | null;
  remainingValue?: number | string | null;
  remainingUnit: Exclude<DueUnit, 'NONE'>;
  threshold?: number | null;
  thresholdUnit?: DueUnit;
  unknownReason?: string | null;
  notApplicableReason?: string | null;
};

type EvaluateMixedParams = {
  itemType: DueStatusResult['item_type'];
  itemId?: string | null;
  itemReference?: string | null;
  limits: DueLimitEvaluation[];
};

const statusRank: Record<DueState, number> = {
  OVERDUE: 6,
  DUE: 5,
  DUE_SOON: 4,
  NOT_DUE: 3,
  UNKNOWN: 2,
  NOT_APPLICABLE: 1,
};

export class DueStatusService {
  static readonly defaultThresholds = {
    hours: 10,
    cycles: 10,
    calendarDays: 30,
  };

  static evaluateHours(params: Omit<EvaluateRemainingParams, 'remainingUnit' | 'thresholdUnit'>) {
    return this.evaluateRemaining({
      ...params,
      remainingUnit: 'HOURS',
      threshold: params.threshold ?? this.defaultThresholds.hours,
      thresholdUnit: 'HOURS',
    });
  }

  static evaluateCycles(params: Omit<EvaluateRemainingParams, 'remainingUnit' | 'thresholdUnit'>) {
    return this.evaluateRemaining({
      ...params,
      remainingUnit: 'CYCLES',
      threshold: params.threshold ?? this.defaultThresholds.cycles,
      thresholdUnit: 'CYCLES',
    });
  }

  static evaluateCalendarDays(
    params: Omit<EvaluateRemainingParams, 'remainingUnit' | 'thresholdUnit'>
  ) {
    return this.evaluateRemaining({
      ...params,
      remainingUnit: 'DAYS',
      threshold: params.threshold ?? this.defaultThresholds.calendarDays,
      thresholdUnit: 'DAYS',
    });
  }

  static evaluateNotApplicable(params: {
    itemType?: DueStatusResult['item_type'];
    itemId?: string | null;
    itemReference?: string | null;
    limitId?: string | null;
    limitType?: string | null;
    trackingBasis?: DueBasis;
    reason: string;
  }) {
    const limit = this.buildLimit({
      limit_id: params.limitId || null,
      limit_type: params.limitType || null,
      tracking_basis: params.trackingBasis || 'APPLICABILITY',
      current_value: null,
      due_value: null,
      remaining_value: null,
      remaining_unit: 'NONE',
      threshold_used: null,
      status: 'NOT_APPLICABLE',
      unknown_reason: null,
      unknown_reasons: [],
      explanation: params.reason,
    });

    return this.resultFromLimits({
      itemType: params.itemType || 'COMPONENT_LIFE_LIMIT',
      itemId: params.itemId || null,
      itemReference: params.itemReference || null,
      limits: [limit],
    });
  }

  static evaluateUnknown(params: {
    itemType?: DueStatusResult['item_type'];
    itemId?: string | null;
    itemReference?: string | null;
    limitId?: string | null;
    limitType?: string | null;
    trackingBasis?: DueBasis;
    reason: string;
  }) {
    const limit = this.buildLimit({
      limit_id: params.limitId || null,
      limit_type: params.limitType || null,
      tracking_basis: params.trackingBasis || 'UNSUPPORTED',
      current_value: null,
      due_value: null,
      remaining_value: null,
      remaining_unit: 'NONE',
      threshold_used: null,
      status: 'UNKNOWN',
      unknown_reason: params.reason,
      unknown_reasons: [params.reason],
      explanation: params.reason,
    });

    return this.resultFromLimits({
      itemType: params.itemType || 'COMPONENT_LIFE_LIMIT',
      itemId: params.itemId || null,
      itemReference: params.itemReference || null,
      limits: [limit],
    });
  }

  static evaluateMixed(params: EvaluateMixedParams): DueStatusResult {
    return this.resultFromLimits(params);
  }

  static statusForRemaining(remainingValue: number, threshold: number): DueState {
    if (remainingValue < 0) return 'OVERDUE';
    if (remainingValue === 0) return 'DUE';
    if (remainingValue <= threshold) return 'DUE_SOON';
    return 'NOT_DUE';
  }

  static mostRestrictiveStatus(statuses: Array<DueState | string | null | undefined>): DueState {
    const normalized = statuses
      .map((status) => this.normalizeState(status))
      .filter((status): status is DueState => Boolean(status));

    if (normalized.length === 0) {
      return 'UNKNOWN';
    }

    return normalized.reduce((worst, status) =>
      this.compareStates(status, worst) > 0 ? status : worst
    );
  }

  static compareStates(left: DueState | string, right: DueState | string) {
    const normalizedLeft = this.normalizeState(left) || 'UNKNOWN';
    const normalizedRight = this.normalizeState(right) || 'UNKNOWN';
    return statusRank[normalizedLeft] - statusRank[normalizedRight];
  }

  static normalizeState(status: DueState | string | null | undefined): DueState | null {
    const normalized = String(status || '').trim().toUpperCase();

    if (normalized === 'COMPLIANT') {
      return 'NOT_DUE';
    }

    if (
      normalized === 'NOT_DUE' ||
      normalized === 'DUE_SOON' ||
      normalized === 'DUE' ||
      normalized === 'OVERDUE' ||
      normalized === 'UNKNOWN' ||
      normalized === 'NOT_APPLICABLE'
    ) {
      return normalized as DueState;
    }

    return null;
  }

  private static evaluateRemaining(params: EvaluateRemainingParams): DueStatusResult {
    const threshold = this.numberOrNull(params.threshold);
    const remaining =
      params.remainingValue !== undefined
        ? this.numberOrNull(params.remainingValue)
        : this.calculateRemaining(params.currentValue, params.dueValue);
    const unknownReasons: string[] = [];

    if (params.unknownReason) {
      unknownReasons.push(params.unknownReason);
    }

    if (params.notApplicableReason) {
      return this.evaluateNotApplicable({
        itemType: params.itemType || 'COMPONENT_LIFE_LIMIT',
        itemId: params.itemId || null,
        itemReference: params.itemReference || null,
        limitId: params.limitId || null,
        limitType: params.limitType || null,
        trackingBasis: params.trackingBasis,
        reason: params.notApplicableReason,
      });
    }

    if (remaining === null) {
      unknownReasons.push('Current, due, or remaining value is missing.');
    }

    if (threshold === null) {
      unknownReasons.push('Due-soon threshold is missing.');
    }

    const status =
      unknownReasons.length > 0 ? 'UNKNOWN' : this.statusForRemaining(remaining!, threshold!);
    const limit = this.buildLimit({
      limit_id: params.limitId || null,
      limit_type: params.limitType || null,
      tracking_basis: params.trackingBasis,
      current_value: params.currentValue ?? null,
      due_value: params.dueValue ?? null,
      remaining_value: remaining,
      remaining_unit: params.remainingUnit,
      threshold_used: threshold,
      status,
      unknown_reason: unknownReasons[0] || null,
      unknown_reasons: unknownReasons,
      explanation: this.buildLimitExplanation({
        status,
        trackingBasis: params.trackingBasis,
        currentValue: params.currentValue ?? null,
        dueValue: params.dueValue ?? null,
        remainingValue: remaining,
        remainingUnit: params.remainingUnit,
        threshold,
        unknownReasons,
      }),
    });

    return this.resultFromLimits({
      itemType: params.itemType || 'COMPONENT_LIFE_LIMIT',
      itemId: params.itemId || null,
      itemReference: params.itemReference || null,
      limits: [limit],
    });
  }

  private static resultFromLimits(params: EvaluateMixedParams): DueStatusResult {
    const limits = params.limits || [];
    const nonApplicableLimits = limits.filter((limit) => limit.status !== 'NOT_APPLICABLE');
    const rankingLimits = nonApplicableLimits.length > 0 ? nonApplicableLimits : limits;
    const status = this.mostRestrictiveStatus(rankingLimits.map((limit) => limit.status));
    const governingLimits = rankingLimits
      .filter((limit) => limit.status === status)
      .sort((left, right) => this.compareLimitUrgency(left, right));
    const governingLimit = governingLimits[0] || null;
    const unknownReasons = Array.from(new Set(limits.flatMap((limit) => limit.unknown_reasons)));
    const hasComputableLimit = limits.some(
      (limit) => limit.status !== 'UNKNOWN' && limit.status !== 'NOT_APPLICABLE'
    );

    return {
      item_type: params.itemType,
      item_id: params.itemId || null,
      item_reference: params.itemReference || null,
      status,
      tracking_basis: governingLimit?.tracking_basis || 'UNSUPPORTED',
      current_value: governingLimit?.current_value ?? null,
      due_value: governingLimit?.due_value ?? null,
      remaining_value: governingLimit?.remaining_value ?? null,
      remaining_unit: governingLimit?.remaining_unit || 'NONE',
      threshold_used: governingLimit?.threshold_used ?? null,
      threshold_unit: governingLimit?.remaining_unit || 'NONE',
      governing_limit: governingLimit,
      governing_limits: governingLimits,
      evaluated_limits: limits,
      is_partial: unknownReasons.length > 0 && hasComputableLimit,
      unknown_reason: unknownReasons[0] || null,
      unknown_reasons: unknownReasons,
      not_applicable_reason:
        status === 'NOT_APPLICABLE' ? governingLimit?.explanation || 'Item is not applicable.' : null,
      explanation: this.buildResultExplanation(status, governingLimit, unknownReasons),
      calculated_at: new Date().toISOString(),
    };
  }

  private static buildLimit(params: DueLimitEvaluation): DueLimitEvaluation {
    return params;
  }

  private static buildLimitExplanation(params: {
    status: DueState;
    trackingBasis: DueBasis;
    currentValue: number | string | null;
    dueValue: number | string | null;
    remainingValue: number | null;
    remainingUnit: DueUnit;
    threshold: number | null;
    unknownReasons: string[];
  }) {
    if (params.unknownReasons.length > 0) {
      return `UNKNOWN ${params.trackingBasis}: ${params.unknownReasons.join(' ')}`;
    }

    return `${params.status} ${params.trackingBasis}: current ${params.currentValue}, due ${params.dueValue}, remaining ${params.remainingValue} ${params.remainingUnit}, threshold ${params.threshold}.`;
  }

  private static buildResultExplanation(
    status: DueState,
    governingLimit: DueLimitEvaluation | null,
    unknownReasons: string[]
  ) {
    if (status === 'UNKNOWN') {
      return unknownReasons.join(' ') || 'Due status is UNKNOWN.';
    }

    if (status === 'NOT_APPLICABLE') {
      return governingLimit?.explanation || 'Item is not applicable.';
    }

    const partial = unknownReasons.length > 0 ? ` Partial calculation: ${unknownReasons.join(' ')}` : '';
    return governingLimit
      ? `Governing limit ${governingLimit.limit_type || 'limit'} is ${status}.${partial}`
      : `Due status is ${status}.${partial}`;
  }

  private static calculateRemaining(currentValue: unknown, dueValue: unknown) {
    const current = this.numberOrNull(currentValue);
    const due = this.numberOrNull(dueValue);

    if (current === null || due === null) {
      return null;
    }

    return Number((due - current).toFixed(2));
  }

  private static numberOrNull(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private static compareLimitUrgency(left: DueLimitEvaluation, right: DueLimitEvaluation) {
    const rankDelta = this.compareStates(right.status, left.status);

    if (rankDelta !== 0) {
      return rankDelta;
    }

    const leftRemaining = typeof left.remaining_value === 'number'
      ? Math.abs(left.remaining_value)
      : Number.POSITIVE_INFINITY;
    const rightRemaining = typeof right.remaining_value === 'number'
      ? Math.abs(right.remaining_value)
      : Number.POSITIVE_INFINITY;

    return leftRemaining - rightRemaining;
  }
}
