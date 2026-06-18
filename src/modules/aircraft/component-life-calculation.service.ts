import {
  Aircraft,
  AircraftComponentInstallation,
  SerializedComponent,
  SerializedComponentLifeState,
  SerializedComponentMaintenanceEvent,
} from '../../models/index.js';

export type LifeCalculationStatus = 'CALCULATED' | 'UNKNOWN';
export type LifeDimension = 'tsn_hours' | 'tso_hours' | 'csn_cycles' | 'cso_cycles';

export type LifeDimensionResult = {
  status: LifeCalculationStatus;
  value: number | null;
  tracking_basis: string | null;
  baseline_used: Record<string, number | string | null>;
  current_meter_value: number | null;
  delta_applied: number | null;
  missing_reasons: string[];
  explanation: string;
};

export type ComponentLifeCalculationResult = {
  installation_id: string;
  serialized_component_id: string;
  aircraft_id: string;
  tracking_basis: string | null;
  status: LifeCalculationStatus;
  values: Record<LifeDimension, number | null>;
  dimensions: Record<LifeDimension, LifeDimensionResult>;
  maintenance_event_count: number;
  explanation: string;
};

type ProposedAircraftSnapshot = {
  total_time_hours: number;
  total_time_cycles: number;
};

const dimensions: LifeDimension[] = ['tsn_hours', 'tso_hours', 'csn_cycles', 'cso_cycles'];

export class ComponentLifeCalculationService {
  static async calculateForInstallation(
    installationId: string
  ): Promise<ComponentLifeCalculationResult> {
    const normalizedInstallationId = String(installationId || '').trim();

    if (!normalizedInstallationId) {
      throw new Error('INSTALLATION_ID_REQUIRED');
    }

    const installation = await AircraftComponentInstallation.findByPk(normalizedInstallationId, {
      include: [
        {
          model: Aircraft,
          as: 'Aircraft',
          attributes: ['id', 'total_time_hours', 'total_time_cycles'],
          required: true,
        },
        {
          model: SerializedComponent,
          as: 'SerializedComponent',
          attributes: ['id'],
          required: true,
          include: [
            {
              model: SerializedComponentLifeState,
              as: 'LifeState',
              required: false,
            },
            {
              model: SerializedComponentMaintenanceEvent,
              as: 'MaintenanceEvents',
              required: false,
            },
          ],
        },
      ],
    });

    if (!installation) {
      throw new Error('INSTALLATION_NOT_FOUND');
    }

    const serializedComponent = (installation as any).SerializedComponent || null;
    const aircraft = (installation as any).Aircraft || null;
    const lifeState = serializedComponent?.LifeState || null;
    const maintenanceEvents = serializedComponent?.MaintenanceEvents || [];
    const trackingBasis = this.normalizeTrackingBasis(installation.tracking_basis);
    const result = this.calculateFromContext({
      installation,
      aircraft,
      lifeState,
      maintenanceEvents,
      trackingBasis,
    });

    return result;
  }

  static async calculateForInstallationWithAircraftSnapshot(
    installationId: string,
    aircraftSnapshot: ProposedAircraftSnapshot
  ): Promise<ComponentLifeCalculationResult> {
    const normalizedInstallationId = String(installationId || '').trim();

    if (!normalizedInstallationId) {
      throw new Error('INSTALLATION_ID_REQUIRED');
    }

    const installation = await AircraftComponentInstallation.findByPk(normalizedInstallationId, {
      include: [
        {
          model: SerializedComponent,
          as: 'SerializedComponent',
          attributes: ['id'],
          required: true,
          include: [
            {
              model: SerializedComponentLifeState,
              as: 'LifeState',
              required: false,
            },
            {
              model: SerializedComponentMaintenanceEvent,
              as: 'MaintenanceEvents',
              required: false,
            },
          ],
        },
      ],
    });

    if (!installation) {
      throw new Error('INSTALLATION_NOT_FOUND');
    }

    const serializedComponent = (installation as any).SerializedComponent || null;
    const lifeState = serializedComponent?.LifeState || null;
    const maintenanceEvents = serializedComponent?.MaintenanceEvents || [];
    const trackingBasis = this.normalizeTrackingBasis(installation.tracking_basis);

    return this.calculateFromContext({
      installation,
      aircraft: {
        total_time_hours: aircraftSnapshot.total_time_hours,
        total_time_cycles: aircraftSnapshot.total_time_cycles,
      } as Aircraft,
      lifeState,
      maintenanceEvents,
      trackingBasis,
    });
  }

  private static calculateFromContext(params: {
    installation: AircraftComponentInstallation;
    aircraft: Aircraft | null;
    lifeState: SerializedComponentLifeState | null;
    maintenanceEvents: SerializedComponentMaintenanceEvent[];
    trackingBasis: string | null;
  }): ComponentLifeCalculationResult {
    const dimensionResults = this.unknownDimensionSet(
      params.trackingBasis,
      'Tracking basis is unavailable.'
    );

    switch (params.trackingBasis) {
      case 'AIRCRAFT_HOURS':
        dimensionResults.tsn_hours = this.calculateAircraftHoursDimension({
          dimension: 'tsn_hours',
          trackingBasis: params.trackingBasis,
          baselineLifeValue: this.numericOrNull(params.installation.install_tsn),
          baselineLifeLabel: 'install_tsn',
          baselineMeterValue: this.numericOrNull(params.installation.install_aircraft_hours),
          baselineMeterLabel: 'install_aircraft_hours',
          currentMeterValue: this.numericOrNull(params.aircraft?.total_time_hours),
          currentMeterLabel: 'current_aircraft_hours',
        });
        dimensionResults.tso_hours = this.calculateAircraftHoursDimension({
          dimension: 'tso_hours',
          trackingBasis: params.trackingBasis,
          baselineLifeValue: this.numericOrNull(params.installation.install_tso),
          baselineLifeLabel: 'install_tso',
          baselineMeterValue: this.numericOrNull(params.installation.install_aircraft_hours),
          baselineMeterLabel: 'install_aircraft_hours',
          currentMeterValue: this.numericOrNull(params.aircraft?.total_time_hours),
          currentMeterLabel: 'current_aircraft_hours',
        });
        dimensionResults.csn_cycles = this.unknownDimension(
          'csn_cycles',
          params.trackingBasis,
          'AIRCRAFT_HOURS does not derive cycle life.'
        );
        dimensionResults.cso_cycles = this.unknownDimension(
          'cso_cycles',
          params.trackingBasis,
          'AIRCRAFT_HOURS does not derive cycle life.'
        );
        break;
      case 'AIRCRAFT_CYCLES':
        dimensionResults.tsn_hours = this.unknownDimension(
          'tsn_hours',
          params.trackingBasis,
          'AIRCRAFT_CYCLES does not derive hour life.'
        );
        dimensionResults.tso_hours = this.unknownDimension(
          'tso_hours',
          params.trackingBasis,
          'AIRCRAFT_CYCLES does not derive hour life.'
        );
        dimensionResults.csn_cycles = this.calculateAircraftCyclesDimension({
          dimension: 'csn_cycles',
          trackingBasis: params.trackingBasis,
          baselineLifeValue: this.integerOrNull(params.installation.install_csn),
          baselineLifeLabel: 'install_csn',
          baselineMeterValue: this.integerOrNull(params.installation.install_aircraft_cycles),
          baselineMeterLabel: 'install_aircraft_cycles',
          currentMeterValue: this.integerOrNull(params.aircraft?.total_time_cycles),
          currentMeterLabel: 'current_aircraft_cycles',
        });
        dimensionResults.cso_cycles = this.calculateAircraftCyclesDimension({
          dimension: 'cso_cycles',
          trackingBasis: params.trackingBasis,
          baselineLifeValue: this.integerOrNull(params.installation.install_cso),
          baselineLifeLabel: 'install_cso',
          baselineMeterValue: this.integerOrNull(params.installation.install_aircraft_cycles),
          baselineMeterLabel: 'install_aircraft_cycles',
          currentMeterValue: this.integerOrNull(params.aircraft?.total_time_cycles),
          currentMeterLabel: 'current_aircraft_cycles',
        });
        break;
      case 'CALENDAR':
        return this.resultFromDimensions({
          installation: params.installation,
          trackingBasis: params.trackingBasis,
          maintenanceEvents: params.maintenanceEvents,
          dimensions: this.unknownDimensionSet(
            params.trackingBasis,
            'CALENDAR does not derive hour or cycle life.'
          ),
        });
      case 'ENGINE_METER':
        return this.resultFromDimensions({
          installation: params.installation,
          trackingBasis: params.trackingBasis,
          maintenanceEvents: params.maintenanceEvents,
          dimensions: this.unknownDimensionSet(
            params.trackingBasis,
            'ENGINE_METER authority is not implemented.'
          ),
        });
      case 'PROPELLER_METER':
        return this.resultFromDimensions({
          installation: params.installation,
          trackingBasis: params.trackingBasis,
          maintenanceEvents: params.maintenanceEvents,
          dimensions: this.unknownDimensionSet(
            params.trackingBasis,
            'PROPELLER_METER authority is not implemented.'
          ),
        });
      case 'MANUAL_AUTHORISED':
        return this.resultFromDimensions({
          installation: params.installation,
          trackingBasis: params.trackingBasis,
          maintenanceEvents: params.maintenanceEvents,
          dimensions: this.manualAuthorisedDimensions(params.trackingBasis, params.lifeState),
        });
      default:
        break;
    }

    return this.resultFromDimensions({
      installation: params.installation,
      trackingBasis: params.trackingBasis,
      maintenanceEvents: params.maintenanceEvents,
      dimensions: dimensionResults,
    });
  }

  private static calculateAircraftHoursDimension(params: {
    dimension: LifeDimension;
    trackingBasis: string;
    baselineLifeValue: number | null;
    baselineLifeLabel: string;
    baselineMeterValue: number | null;
    baselineMeterLabel: string;
    currentMeterValue: number | null;
    currentMeterLabel: string;
  }): LifeDimensionResult {
    const missingReasons = this.requiredMissingReasons([
      [params.baselineLifeValue, params.baselineLifeLabel],
      [params.baselineMeterValue, params.baselineMeterLabel],
      [params.currentMeterValue, params.currentMeterLabel],
    ]);

    if (missingReasons.length > 0) {
      return this.unknownDimension(params.dimension, params.trackingBasis, missingReasons);
    }

    const delta = this.roundHours(params.currentMeterValue! - params.baselineMeterValue!);

    if (delta < 0) {
      return this.unknownDimension(
        params.dimension,
        params.trackingBasis,
        'Current aircraft hours are below the install aircraft hours baseline.'
      );
    }

    const value = this.roundHours(params.baselineLifeValue! + delta);

    return {
      status: 'CALCULATED',
      value,
      tracking_basis: params.trackingBasis,
      baseline_used: {
        [params.baselineLifeLabel]: params.baselineLifeValue,
        [params.baselineMeterLabel]: params.baselineMeterValue,
      },
      current_meter_value: params.currentMeterValue,
      delta_applied: delta,
      missing_reasons: [],
      explanation:
        `${params.dimension} = ${params.baselineLifeLabel} ${params.baselineLifeValue} + ` +
        `aircraft hour delta ${delta} = ${value}.`,
    };
  }

  private static calculateAircraftCyclesDimension(params: {
    dimension: LifeDimension;
    trackingBasis: string;
    baselineLifeValue: number | null;
    baselineLifeLabel: string;
    baselineMeterValue: number | null;
    baselineMeterLabel: string;
    currentMeterValue: number | null;
    currentMeterLabel: string;
  }): LifeDimensionResult {
    const missingReasons = this.requiredMissingReasons([
      [params.baselineLifeValue, params.baselineLifeLabel],
      [params.baselineMeterValue, params.baselineMeterLabel],
      [params.currentMeterValue, params.currentMeterLabel],
    ]);

    if (missingReasons.length > 0) {
      return this.unknownDimension(params.dimension, params.trackingBasis, missingReasons);
    }

    const delta = params.currentMeterValue! - params.baselineMeterValue!;

    if (delta < 0) {
      return this.unknownDimension(
        params.dimension,
        params.trackingBasis,
        'Current aircraft cycles are below the install aircraft cycles baseline.'
      );
    }

    const value = params.baselineLifeValue! + delta;

    return {
      status: 'CALCULATED',
      value,
      tracking_basis: params.trackingBasis,
      baseline_used: {
        [params.baselineLifeLabel]: params.baselineLifeValue,
        [params.baselineMeterLabel]: params.baselineMeterValue,
      },
      current_meter_value: params.currentMeterValue,
      delta_applied: delta,
      missing_reasons: [],
      explanation:
        `${params.dimension} = ${params.baselineLifeLabel} ${params.baselineLifeValue} + ` +
        `aircraft cycle delta ${delta} = ${value}.`,
    };
  }

  private static manualAuthorisedDimensions(
    trackingBasis: string,
    lifeState: SerializedComponentLifeState | null
  ): Record<LifeDimension, LifeDimensionResult> {
    return {
      tsn_hours: this.manualAuthorisedDimension(
        'tsn_hours',
        trackingBasis,
        this.numericOrNull(lifeState?.tsn_hours)
      ),
      tso_hours: this.manualAuthorisedDimension(
        'tso_hours',
        trackingBasis,
        this.numericOrNull(lifeState?.tso_hours)
      ),
      csn_cycles: this.manualAuthorisedDimension(
        'csn_cycles',
        trackingBasis,
        this.integerOrNull(lifeState?.csn_cycles)
      ),
      cso_cycles: this.manualAuthorisedDimension(
        'cso_cycles',
        trackingBasis,
        this.integerOrNull(lifeState?.cso_cycles)
      ),
    };
  }

  private static manualAuthorisedDimension(
    dimension: LifeDimension,
    trackingBasis: string,
    value: number | null
  ): LifeDimensionResult {
    if (value === null) {
      return this.unknownDimension(
        dimension,
        trackingBasis,
        `Manual authorised ${dimension} value is not recorded.`
      );
    }

    return {
      status: 'CALCULATED',
      value,
      tracking_basis: trackingBasis,
      baseline_used: {
        life_state_value: value,
      },
      current_meter_value: null,
      delta_applied: null,
      missing_reasons: [],
      explanation: `${dimension} is from the stored manual authorised life-state value ${value}.`,
    };
  }

  private static resultFromDimensions(params: {
    installation: AircraftComponentInstallation;
    trackingBasis: string | null;
    maintenanceEvents: SerializedComponentMaintenanceEvent[];
    dimensions: Record<LifeDimension, LifeDimensionResult>;
  }): ComponentLifeCalculationResult {
    const values = {
      tsn_hours: params.dimensions.tsn_hours.value,
      tso_hours: params.dimensions.tso_hours.value,
      csn_cycles: params.dimensions.csn_cycles.value,
      cso_cycles: params.dimensions.cso_cycles.value,
    };
    const hasCalculatedValue = dimensions.some(
      (dimension) => params.dimensions[dimension].status === 'CALCULATED'
    );

    return {
      installation_id: params.installation.id,
      serialized_component_id: params.installation.serialized_component_id,
      aircraft_id: params.installation.aircraft_id,
      tracking_basis: params.trackingBasis,
      status: hasCalculatedValue ? 'CALCULATED' : 'UNKNOWN',
      values,
      dimensions: params.dimensions,
      maintenance_event_count: params.maintenanceEvents.length,
      explanation: dimensions
        .map((dimension) => params.dimensions[dimension].explanation)
        .join(' '),
    };
  }

  private static unknownDimensionSet(
    trackingBasis: string | null,
    reason: string
  ): Record<LifeDimension, LifeDimensionResult> {
    return {
      tsn_hours: this.unknownDimension('tsn_hours', trackingBasis, reason),
      tso_hours: this.unknownDimension('tso_hours', trackingBasis, reason),
      csn_cycles: this.unknownDimension('csn_cycles', trackingBasis, reason),
      cso_cycles: this.unknownDimension('cso_cycles', trackingBasis, reason),
    };
  }

  private static unknownDimension(
    dimension: LifeDimension,
    trackingBasis: string | null,
    reason: string | string[]
  ): LifeDimensionResult {
    const missingReasons = Array.isArray(reason) ? reason : [reason];

    return {
      status: 'UNKNOWN',
      value: null,
      tracking_basis: trackingBasis,
      baseline_used: {},
      current_meter_value: null,
      delta_applied: null,
      missing_reasons: missingReasons,
      explanation: `${dimension} unknown: ${missingReasons.join(' ')}`,
    };
  }

  private static requiredMissingReasons(items: Array<[number | null, string]>) {
    return items
      .filter(([value]) => value === null)
      .map(([, label]) => `${label} is missing.`);
  }

  private static numericOrNull(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private static integerOrNull(value: unknown) {
    const parsed = this.numericOrNull(value);
    return parsed === null || !Number.isInteger(parsed) ? null : parsed;
  }

  private static normalizeTrackingBasis(value: unknown) {
    const trackingBasis = String(value || '').trim().toUpperCase();
    return trackingBasis || null;
  }

  private static roundHours(value: number) {
    return Number(value.toFixed(2));
  }
}
