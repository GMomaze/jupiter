import {
  AircraftComponentInstallation,
  ComponentLifeLimit,
  ComponentModel,
  SerializedComponent,
  SerializedComponentLifeState,
} from '../../models/index.js';
import {
  DueBasis,
  DueStatusResult,
  DueStatusService,
  DueUnit,
} from '../due-status/due-status.service.js';
import {
  ComponentLifeCalculationResult,
  ComponentLifeCalculationService,
  LifeDimension,
  LifeDimensionResult,
} from './component-life-calculation.service.js';

export type ComponentLimitType =
  | 'TBO_HOURS'
  | 'TBO_CYCLES'
  | 'RETIREMENT_HOURS'
  | 'RETIREMENT_CYCLES'
  | 'CALENDAR_LIFE'
  | 'HARD_LIFE'
  | 'MANUAL_AUTHORISED'
  | 'UNKNOWN';

export type ComponentLimitSeverity = 'NORMAL' | 'WARNING' | 'SEVERE';

export type ComponentLimitMonitoringResult = {
  component: {
    serialized_component_id: string;
    component_model_id: string | null;
    serial_number: string | null;
    model_name: string | null;
    position: string | null;
    aircraft_id: string | null;
    installation_id: string | null;
  };
  limit_type: ComponentLimitType;
  raw_limit_type: string | null;
  tracking_basis: string | null;
  current_value: number | string | null;
  limit_value: number | string | null;
  remaining_value: number | string | null;
  due_status: DueStatusResult['status'];
  severity: ComponentLimitSeverity;
  source_baseline: Record<string, number | string | null>;
  unknown_reason: string | null;
  due_status_result: DueStatusResult;
  explanation: string;
};

type LimitDimension = {
  dimension: LifeDimension | 'calendar_days';
  dueBasis: DueBasis;
  unit: Exclude<DueUnit, 'NONE'>;
  limitValue: number | string | null;
  currentValue: number | string | null;
  remainingValue: number | null;
  sourceBaseline: Record<string, number | string | null>;
  unknownReason: string | null;
};

export class ComponentLimitMonitoringService {
  static async monitorAircraft(aircraftId: string): Promise<ComponentLimitMonitoringResult[]> {
    const installations = await AircraftComponentInstallation.findAll({
      where: {
        aircraft_id: aircraftId,
        removed_at: null,
      },
      include: [this.serializedComponentInclude()],
      order: [['installed_at', 'DESC']],
    });

    const results = await Promise.all(
      installations.map((installation) => this.monitorInstallationRecord(installation))
    );

    return results.flat();
  }

  static async monitorInstallation(
    installationId: string
  ): Promise<ComponentLimitMonitoringResult[]> {
    const installation = await AircraftComponentInstallation.findByPk(installationId, {
      include: [this.serializedComponentInclude()],
    });

    if (!installation) {
      throw new Error('INSTALLATION_NOT_FOUND');
    }

    return this.monitorInstallationRecord(installation);
  }

  private static async monitorInstallationRecord(
    installation: AircraftComponentInstallation
  ): Promise<ComponentLimitMonitoringResult[]> {
    const serializedComponent = (installation as any).SerializedComponent || null;
    const componentModel = serializedComponent?.ComponentModel || null;
    const limits = (componentModel?.LifeLimits || []).filter((limit: any) => limit?.is_active !== false);

    if (limits.length === 0) {
      return [
        this.resultFromUnknown({
          installation,
          serializedComponent,
          componentModel,
          limit: null,
          limitType: 'UNKNOWN',
          reason: 'No active component life limits defined.',
        }),
      ];
    }

    const lifeCalculation = await ComponentLifeCalculationService.calculateForInstallation(
      installation.id
    );

    return limits.map((limit: ComponentLifeLimit) =>
      this.evaluateLimit({
        installation,
        serializedComponent,
        componentModel,
        lifeState: serializedComponent?.LifeState || null,
        lifeCalculation,
        limit,
      })
    );
  }

  private static evaluateLimit(params: {
    installation: AircraftComponentInstallation;
    serializedComponent: SerializedComponent | null;
    componentModel: ComponentModel | null;
    lifeState: SerializedComponentLifeState | null;
    lifeCalculation: ComponentLifeCalculationResult;
    limit: ComponentLifeLimit;
  }): ComponentLimitMonitoringResult {
    const limitType = this.classifyLimit(params.limit, params.lifeCalculation.tracking_basis);
    const dimensions = this.dimensionsForLimit(limitType, params);

    if (dimensions.length === 0) {
      return this.resultFromUnknown({
        installation: params.installation,
        serializedComponent: params.serializedComponent,
        componentModel: params.componentModel,
        limit: params.limit,
        limitType,
        reason: 'Component life limit could not be mapped to a supported monitored dimension.',
      });
    }

    const dueResults = dimensions.map((dimension) =>
      this.evaluateDimension(params.limit, limitType, dimension)
    );
    const dueStatusResult = dueResults.length === 1
      ? dueResults[0]!
      : DueStatusService.evaluateMixed({
        itemType: this.itemTypeForLimit(limitType),
        itemId: params.limit.id,
        itemReference: params.limit.limit_type,
        limits: dueResults.flatMap((result) => result.evaluated_limits),
      });
    const governing = dueStatusResult.governing_limit;

    return {
      component: this.componentIdentity(
        params.installation,
        params.serializedComponent,
        params.componentModel
      ),
      limit_type: limitType,
      raw_limit_type: params.limit.limit_type || null,
      tracking_basis: params.lifeCalculation.tracking_basis,
      current_value: dueStatusResult.current_value,
      limit_value: dueStatusResult.due_value,
      remaining_value: dueStatusResult.remaining_value,
      due_status: dueStatusResult.status,
      severity: this.severityFor(limitType, dueStatusResult.status),
      source_baseline: this.sourceBaselineForDimension(dimensions, governing?.tracking_basis || null),
      unknown_reason: dueStatusResult.unknown_reason,
      due_status_result: dueStatusResult,
      explanation: this.buildExplanation(limitType, dueStatusResult),
    };
  }

  private static evaluateDimension(
    limit: ComponentLifeLimit,
    limitType: ComponentLimitType,
    dimension: LimitDimension
  ) {
    const params = {
      itemType: this.itemTypeForLimit(limitType),
      itemId: limit.id,
      itemReference: limit.limit_type,
      limitId: limit.id,
      limitType,
      trackingBasis: dimension.dueBasis,
      currentValue: dimension.currentValue,
      dueValue: dimension.limitValue,
      remainingValue: dimension.remainingValue,
      unknownReason: dimension.unknownReason,
    };

    if (dimension.unit === 'HOURS') {
      return DueStatusService.evaluateHours(params);
    }

    if (dimension.unit === 'CYCLES') {
      return DueStatusService.evaluateCycles(params);
    }

    return DueStatusService.evaluateCalendarDays(params);
  }

  private static dimensionsForLimit(
    limitType: ComponentLimitType,
    params: {
      installation: AircraftComponentInstallation;
      lifeState: SerializedComponentLifeState | null;
      lifeCalculation: ComponentLifeCalculationResult;
      limit: ComponentLifeLimit;
    }
  ): LimitDimension[] {
    const dimensions: LimitDimension[] = [];
    const limitHours = this.numberOrNull(params.limit.limit_hours);
    const limitCycles = this.integerOrNull(params.limit.limit_cycles);
    const limitMonths = this.integerOrNull(params.limit.limit_months);

    if (
      limitType === 'TBO_HOURS' ||
      limitType === 'RETIREMENT_HOURS' ||
      limitType === 'HARD_LIFE' ||
      limitType === 'MANUAL_AUTHORISED'
    ) {
      const dimensionName =
        limitType === 'TBO_HOURS' || this.isSinceOverhaulLimit(params.limit)
          ? 'tso_hours'
          : 'tsn_hours';
      if (limitHours !== null) {
        dimensions.push(this.lifeDimension({
          result: params.lifeCalculation.dimensions[dimensionName],
          dimension: dimensionName,
          dueBasis: dimensionName === 'tso_hours' ? 'COMPONENT_TSO' : 'COMPONENT_TSN',
          unit: 'HOURS',
          limitValue: limitHours,
        }));
      }
    }

    if (
      limitType === 'TBO_CYCLES' ||
      limitType === 'RETIREMENT_CYCLES' ||
      limitType === 'HARD_LIFE' ||
      limitType === 'MANUAL_AUTHORISED'
    ) {
      const dimensionName =
        limitType === 'TBO_CYCLES' || this.isSinceOverhaulLimit(params.limit)
          ? 'cso_cycles'
          : 'csn_cycles';
      if (limitCycles !== null) {
        dimensions.push(this.lifeDimension({
          result: params.lifeCalculation.dimensions[dimensionName],
          dimension: dimensionName,
          dueBasis: dimensionName === 'cso_cycles' ? 'COMPONENT_CSO' : 'COMPONENT_CSN',
          unit: 'CYCLES',
          limitValue: limitCycles,
        }));
      }
    }

    if (limitType === 'CALENDAR_LIFE' || limitType === 'HARD_LIFE') {
      if (limitMonths !== null) {
        dimensions.push(this.calendarDimension({
          installation: params.installation,
          lifeState: params.lifeState,
          limit: params.limit,
          limitMonths,
        }));
      }
    }

    return dimensions;
  }

  private static lifeDimension(params: {
    result: LifeDimensionResult;
    dimension: LifeDimension;
    dueBasis: DueBasis;
    unit: 'HOURS' | 'CYCLES';
    limitValue: number;
  }): LimitDimension {
    const currentValue = params.result.value;
    const remainingValue = currentValue === null
      ? null
      : Number((params.limitValue - currentValue).toFixed(params.unit === 'HOURS' ? 2 : 0));

    return {
      dimension: params.dimension,
      dueBasis: params.dueBasis,
      unit: params.unit,
      limitValue: params.limitValue,
      currentValue,
      remainingValue,
      sourceBaseline: params.result.baseline_used,
      unknownReason:
        params.result.status === 'UNKNOWN'
          ? params.result.missing_reasons.join(' ') || params.result.explanation
          : null,
    };
  }

  private static calendarDimension(params: {
    installation: AircraftComponentInstallation;
    lifeState: SerializedComponentLifeState | null;
    limit: ComponentLifeLimit;
    limitMonths: number;
  }): LimitDimension {
    const referenceDate = this.calendarReferenceDate(params);
    const dueDate = referenceDate ? this.addMonthsToDate(referenceDate, params.limitMonths) : null;
    const remainingDays = dueDate ? this.remainingDaysUntil(dueDate, new Date()) : null;
    const unknownReason = !referenceDate
      ? 'Calendar reference date is missing.'
      : !dueDate
        ? 'Calendar due date could not be calculated.'
        : null;

    return {
      dimension: 'calendar_days',
      dueBasis: 'CALENDAR',
      unit: 'DAYS',
      limitValue: dueDate,
      currentValue: new Date().toISOString().slice(0, 10),
      remainingValue: remainingDays,
      sourceBaseline: {
        reference_date: referenceDate,
        limit_months: params.limitMonths,
      },
      unknownReason,
    };
  }

  private static classifyLimit(
    limit: ComponentLifeLimit,
    trackingBasis: string | null
  ): ComponentLimitType {
    const searchable = [
      limit.limit_type,
      limit.basis,
      limit.description,
    ].map((value) => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_')).join(' ');

    if (/\b(MANUAL_AUTHORISED|MANUAL_AUTHORIZED|MANUAL)\b/.test(searchable) ||
      trackingBasis === 'MANUAL_AUTHORISED') {
      return 'MANUAL_AUTHORISED';
    }

    if (/\b(HARD_LIFE|RETIREMENT|LIFE_LIMIT|SCRAP|EXPIRY)\b/.test(searchable)) {
      return 'HARD_LIFE';
    }

    if (/\b(CALENDAR|MONTHS|DATE|ELAPSED|TIME_LIMIT_DATE)\b/.test(searchable)) {
      return 'CALENDAR_LIFE';
    }

    if (/\b(TBO|OVERHAUL|SINCE_OVERHAUL|TSO|CSO|SMOH|SOH)\b/.test(searchable)) {
      return this.numberOrNull(limit.limit_hours) !== null ? 'TBO_HOURS' : 'TBO_CYCLES';
    }

    if (this.numberOrNull(limit.limit_hours) !== null) {
      return 'RETIREMENT_HOURS';
    }

    if (this.integerOrNull(limit.limit_cycles) !== null) {
      return 'RETIREMENT_CYCLES';
    }

    if (this.integerOrNull(limit.limit_months) !== null) {
      return 'CALENDAR_LIFE';
    }

    return 'UNKNOWN';
  }

  private static itemTypeForLimit(limitType: ComponentLimitType) {
    if (limitType === 'TBO_HOURS' || limitType === 'TBO_CYCLES') {
      return 'COMPONENT_TBO' as const;
    }

    if (
      limitType === 'RETIREMENT_HOURS' ||
      limitType === 'RETIREMENT_CYCLES' ||
      limitType === 'HARD_LIFE'
    ) {
      return 'COMPONENT_RETIREMENT' as const;
    }

    return 'COMPONENT_LIFE_LIMIT' as const;
  }

  private static severityFor(
    limitType: ComponentLimitType,
    status: DueStatusResult['status']
  ): ComponentLimitSeverity {
    if (
      (limitType === 'HARD_LIFE' ||
        limitType === 'RETIREMENT_HOURS' ||
        limitType === 'RETIREMENT_CYCLES') &&
      (status === 'DUE' || status === 'OVERDUE')
    ) {
      return 'SEVERE';
    }

    if (status === 'NOT_DUE' || status === 'NOT_APPLICABLE') {
      return 'NORMAL';
    }

    return 'WARNING';
  }

  private static resultFromUnknown(params: {
    installation: AircraftComponentInstallation;
    serializedComponent: SerializedComponent | null;
    componentModel: ComponentModel | null;
    limit: ComponentLifeLimit | null;
    limitType: ComponentLimitType;
    reason: string;
  }): ComponentLimitMonitoringResult {
    const dueStatusResult = DueStatusService.evaluateUnknown({
      itemType: this.itemTypeForLimit(params.limitType),
      itemId: params.limit?.id || null,
      itemReference: params.limit?.limit_type || null,
      limitId: params.limit?.id || null,
      limitType: params.limitType,
      reason: params.reason,
    });

    return {
      component: this.componentIdentity(
        params.installation,
        params.serializedComponent,
        params.componentModel
      ),
      limit_type: params.limitType,
      raw_limit_type: params.limit?.limit_type || null,
      tracking_basis: params.installation.tracking_basis || null,
      current_value: null,
      limit_value: null,
      remaining_value: null,
      due_status: dueStatusResult.status,
      severity: 'WARNING',
      source_baseline: {},
      unknown_reason: dueStatusResult.unknown_reason,
      due_status_result: dueStatusResult,
      explanation: dueStatusResult.explanation,
    };
  }

  private static sourceBaselineForDimension(
    dimensions: LimitDimension[],
    governingBasis: DueBasis | null
  ) {
    const dimension = dimensions.find((candidate) => candidate.dueBasis === governingBasis) ||
      dimensions[0];
    return dimension?.sourceBaseline || {};
  }

  private static componentIdentity(
    installation: AircraftComponentInstallation,
    serializedComponent: SerializedComponent | null,
    componentModel: ComponentModel | null
  ) {
    return {
      serialized_component_id: installation.serialized_component_id,
      component_model_id: serializedComponent?.component_model_id || null,
      serial_number: serializedComponent?.serial_number || null,
      model_name: componentModel?.model_name || null,
      position: installation.position || null,
      aircraft_id: installation.aircraft_id || null,
      installation_id: installation.id || null,
    };
  }

  private static buildExplanation(
    limitType: ComponentLimitType,
    dueStatusResult: DueStatusResult
  ) {
    return `${limitType} is ${dueStatusResult.status}. ${dueStatusResult.explanation}`;
  }

  private static serializedComponentInclude() {
    return {
      model: SerializedComponent,
      as: 'SerializedComponent',
      required: true,
      include: [
        {
          model: ComponentModel,
          as: 'ComponentModel',
          required: false,
          include: [
            {
              model: ComponentLifeLimit,
              as: 'LifeLimits',
              required: false,
            },
          ],
        },
        {
          model: SerializedComponentLifeState,
          as: 'LifeState',
          required: false,
        },
      ],
    };
  }

  private static calendarReferenceDate(params: {
    installation: AircraftComponentInstallation;
    lifeState: SerializedComponentLifeState | null;
    limit: ComponentLifeLimit;
  }) {
    if (this.isSinceOverhaulLimit(params.limit)) {
      return params.lifeState?.overhaul_reference_date || null;
    }

    return params.lifeState?.calendar_reference_date ||
      params.installation.installed_at ||
      null;
  }

  private static isSinceOverhaulLimit(limit: ComponentLifeLimit) {
    const searchable = [limit.limit_type, limit.basis, limit.description]
      .map((value) => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_'))
      .join(' ');

    return /\b(TBO|OVERHAUL|SINCE_OVERHAUL|TSO|CSO|SMOH|SOH)\b/.test(searchable);
  }

  private static addMonthsToDate(dateValue: string, months: number) {
    const date = new Date(`${dateValue}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    date.setUTCMonth(date.getUTCMonth() + months);
    return date.toISOString().slice(0, 10);
  }

  private static remainingDaysUntil(dateValue: string, today: Date) {
    const dueDate = new Date(`${dateValue}T00:00:00.000Z`);

    if (Number.isNaN(dueDate.getTime())) {
      return null;
    }

    return Math.ceil((this.startOfUtcDay(dueDate) - this.startOfUtcDay(today)) / 86400000);
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

  private static integerOrNull(value: unknown) {
    const parsed = this.numberOrNull(value);
    return parsed === null || !Number.isInteger(parsed) ? null : parsed;
  }
}
