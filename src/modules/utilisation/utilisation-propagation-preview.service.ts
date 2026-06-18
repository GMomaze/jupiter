import { Aircraft } from '../../models/index.js';
import { AircraftComponentService } from '../aircraft/aircraft-component.service.js';
import {
  ComponentLifeCalculationResult,
  ComponentLifeCalculationService,
  LifeDimension,
} from '../aircraft/component-life-calculation.service.js';

type PreviewSourceType =
  | 'MANUAL_ENTRY'
  | 'JOURNEY_LOG'
  | 'TECH_LOG'
  | 'FLIGHT_FOLIO'
  | 'INITIAL_BASELINE'
  | 'CORRECTION'
  | 'IMPORT';

type PreviewParams = {
  aircraftId: string;
  proposedTotalTimeHours: number | string;
  proposedTotalTimeCycles: number | string;
  effectiveDate: string;
  sourceType: string;
  sourceReference?: string | null;
  reason?: string | null;
};

type PreviewWarning = {
  code: string;
  message: string;
};

type AffectedDueItemPreview = {
  source_type:
    | 'AD'
    | 'SB'
    | 'SID'
    | 'SCHEDULED_TASK'
    | 'COMPONENT_TBO'
    | 'COMPONENT_RETIREMENT';
  source_id: string | null;
  source_reference: string | null;
  title: string | null;
  current_visibility_state: string;
  projected_visibility_state: 'NOT_CALCULATED_IN_PHASE_5';
  current_due_status: string | null;
  projected_due_status: 'NOT_CALCULATED_IN_PHASE_5';
  reason: string;
  related_component_installation_id: string | null;
  warnings: PreviewWarning[];
};

type AffectedComponentPreview = {
  installation_id: string;
  serialized_component_id: string;
  component_identity: {
    serial_number: string | null;
    part_number: string | null;
    model_code: string | null;
    model_name: string | null;
    manufacturer_name: string | null;
    asset_type_code: string | null;
  };
  position: string | null;
  installed_at: string;
  tracking_basis: string | null;
  current_life: ComponentLifeCalculationResult;
  projected_life: ComponentLifeCalculationResult;
  impact: {
    delta_tsn_hours: number | null;
    delta_tso_hours: number | null;
    delta_csn_cycles: number | null;
    delta_cso_cycles: number | null;
    impacted_dimensions: LifeDimension[];
    impact_summary: string;
  };
  warnings: PreviewWarning[];
};

export type UtilisationPropagationPreview = {
  aircraft: {
    id: string;
    registration: string;
    current_total_time_hours: number;
    current_total_time_cycles: number;
    proposed_total_time_hours: number;
    proposed_total_time_cycles: number;
    delta_hours: number;
    delta_cycles: number;
  };
  entry: {
    source_type: PreviewSourceType | string;
    source_reference: string | null;
    effective_date: string;
    reason: string;
    classification: 'NORMAL' | 'CORRECTION';
    correction_warning: {
      decreases_hours: boolean;
      decreases_cycles: boolean;
      message: string;
      required_fields: Array<'reason' | 'source_reference'>;
      downstream_warning: string;
    } | null;
  };
  validation_warnings: PreviewWarning[];
  affected_components: AffectedComponentPreview[];
  affected_due_items: AffectedDueItemPreview[];
  summary: {
    active_serialized_component_count: number;
    calculated_component_count: number;
    unknown_component_count: number;
    missing_baseline_warning_count: number;
    correction: boolean;
    warnings: string[];
  };
  boundary_notice: string;
};

export class UtilisationPropagationPreviewService {
  private static readonly validSourceTypes = new Set<string>([
    'MANUAL_ENTRY',
    'JOURNEY_LOG',
    'TECH_LOG',
    'FLIGHT_FOLIO',
    'INITIAL_BASELINE',
    'CORRECTION',
    'IMPORT',
  ]);

  static async preview(params: PreviewParams): Promise<UtilisationPropagationPreview> {
    const aircraftId = String(params.aircraftId || '').trim();

    if (!aircraftId) {
      throw new Error('AIRCRAFT_NOT_FOUND');
    }

    const aircraft = await Aircraft.findByPk(aircraftId, {
      attributes: ['id', 'registration', 'total_time_hours', 'total_time_cycles'],
    });

    if (!aircraft) {
      throw new Error('AIRCRAFT_NOT_FOUND');
    }

    const currentHours = this.normalizeHours(aircraft.total_time_hours);
    const currentCycles = this.normalizeCycles(aircraft.total_time_cycles);
    const validationWarnings: PreviewWarning[] = [];
    const proposedHours = this.parsePreviewHours(
      params.proposedTotalTimeHours,
      currentHours,
      validationWarnings
    );
    const proposedCycles = this.parsePreviewCycles(
      params.proposedTotalTimeCycles,
      currentCycles,
      validationWarnings
    );
    const deltaHours = Number((proposedHours - currentHours).toFixed(2));
    const deltaCycles = proposedCycles - currentCycles;
    const sourceType = String(params.sourceType || '').trim().toUpperCase();
    const sourceReference = String(params.sourceReference || '').trim() || null;
    const effectiveDate = String(params.effectiveDate || '').trim();
    const reason = String(params.reason || '').trim();
    const isCorrection = deltaHours < 0 || deltaCycles < 0;

    this.validatePreviewMetadata({
      sourceType,
      sourceReference,
      effectiveDate,
      reason,
      deltaHours,
      deltaCycles,
      validationWarnings,
    });

    const activeInstallations =
      await AircraftComponentService.getActiveSerializedInstallationsForAircraft(aircraftId);
    const affectedComponents = await Promise.all(
      activeInstallations.map((installation: any) =>
        this.buildAffectedComponentPreview(installation, proposedHours, proposedCycles)
      )
    );
    const unknownComponents = affectedComponents.filter(
      (component) => component.projected_life.status === 'UNKNOWN'
    );
    const missingBaselineWarnings = affectedComponents.reduce(
      (count, component) =>
        count +
        component.warnings.filter((warning) => warning.code === 'UNKNOWN_COMPONENT_LIFE').length,
      0
    );
    const summaryWarnings = [
      ...validationWarnings.map((warning) => warning.message),
      ...affectedComponents.flatMap((component) =>
        component.warnings.map((warning) => warning.message)
      ),
    ];

    return {
      aircraft: {
        id: aircraft.id,
        registration: aircraft.registration,
        current_total_time_hours: currentHours,
        current_total_time_cycles: currentCycles,
        proposed_total_time_hours: proposedHours,
        proposed_total_time_cycles: proposedCycles,
        delta_hours: deltaHours,
        delta_cycles: deltaCycles,
      },
      entry: {
        source_type: sourceType,
        source_reference: sourceReference,
        effective_date: effectiveDate,
        reason,
        classification: isCorrection ? 'CORRECTION' : 'NORMAL',
        correction_warning: isCorrection
          ? {
              decreases_hours: deltaHours < 0,
              decreases_cycles: deltaCycles < 0,
              message: 'This utilisation entry decreases aircraft totals and will be treated as a correction.',
              required_fields: ['reason', 'source_reference'],
              downstream_warning:
                'Downstream component values may reduce or become UNKNOWN if proposed aircraft meters fall below installation baselines.',
            }
          : null,
      },
      validation_warnings: validationWarnings,
      affected_components: affectedComponents,
      affected_due_items: this.buildDuePlaceholders(),
      summary: {
        active_serialized_component_count: affectedComponents.length,
        calculated_component_count: affectedComponents.length - unknownComponents.length,
        unknown_component_count: unknownComponents.length,
        missing_baseline_warning_count: missingBaselineWarnings,
        correction: isCorrection,
        warnings: Array.from(new Set(summaryWarnings)),
      },
      boundary_notice:
        'Preview is read-only. Phase 5 does not create utilisation events, update aircraft snapshots, write audit records, recalculate due status, or refresh workpacks.',
    };
  }

  private static async buildAffectedComponentPreview(
    installation: any,
    proposedHours: number,
    proposedCycles: number
  ): Promise<AffectedComponentPreview> {
    const serializedComponent = installation.SerializedComponent || {};
    const componentModel = serializedComponent.ComponentModel || {};
    const manufacturer = componentModel.Manufacturer || {};
    const assetType = componentModel.AssetType || {};
    const [currentLife, projectedLife] = await Promise.all([
      ComponentLifeCalculationService.calculateForInstallation(installation.id),
      ComponentLifeCalculationService.calculateForInstallationWithAircraftSnapshot(installation.id, {
        total_time_hours: proposedHours,
        total_time_cycles: proposedCycles,
      }),
    ]);
    const impact = this.buildImpact(currentLife, projectedLife);
    const warnings = this.buildComponentWarnings(projectedLife);

    return {
      installation_id: installation.id,
      serialized_component_id: installation.serialized_component_id,
      component_identity: {
        serial_number: serializedComponent.serial_number || null,
        part_number: serializedComponent.part_number || null,
        model_code: componentModel.model_code || null,
        model_name: componentModel.model_name || null,
        manufacturer_name: manufacturer.name || null,
        asset_type_code: assetType.code || null,
      },
      position: installation.position || null,
      installed_at: installation.installed_at,
      tracking_basis: installation.tracking_basis || null,
      current_life: currentLife,
      projected_life: projectedLife,
      impact,
      warnings,
    };
  }

  private static buildImpact(
    currentLife: ComponentLifeCalculationResult,
    projectedLife: ComponentLifeCalculationResult
  ) {
    const dimensions: LifeDimension[] = ['tsn_hours', 'tso_hours', 'csn_cycles', 'cso_cycles'];
    const deltaByDimension = Object.fromEntries(
      dimensions.map((dimension) => [
        dimension,
        this.deltaOrNull(currentLife.values[dimension], projectedLife.values[dimension]),
      ])
    ) as Record<LifeDimension, number | null>;
    const impactedDimensions = dimensions.filter((dimension) => {
      const delta = deltaByDimension[dimension];
      return delta !== null && delta !== 0;
    });

    return {
      delta_tsn_hours: deltaByDimension.tsn_hours,
      delta_tso_hours: deltaByDimension.tso_hours,
      delta_csn_cycles: deltaByDimension.csn_cycles,
      delta_cso_cycles: deltaByDimension.cso_cycles,
      impacted_dimensions: impactedDimensions,
      impact_summary:
        impactedDimensions.length > 0
          ? `Projected utilisation changes ${impactedDimensions.join(', ')}.`
          : 'No calculable component life movement from this proposed utilisation.',
    };
  }

  private static buildComponentWarnings(
    projectedLife: ComponentLifeCalculationResult
  ): PreviewWarning[] {
    const warnings: PreviewWarning[] = [];
    const reasons = Array.from(
      new Set(
        Object.values(projectedLife.dimensions).flatMap((dimension) => dimension.missing_reasons)
      )
    );

    if (reasons.length > 0) {
      warnings.push({
        code: 'UNKNOWN_COMPONENT_LIFE',
        message: reasons.join(' '),
      });
    }

    return warnings;
  }

  private static buildDuePlaceholders(): AffectedDueItemPreview[] {
    const reason =
      'Projected due/compliance impact is not calculated in Phase 5. Later due phases will provide authoritative recalculation.';

    return [
      'AD',
      'SB',
      'SID',
      'SCHEDULED_TASK',
      'COMPONENT_TBO',
      'COMPONENT_RETIREMENT',
    ].map((sourceType) => ({
      source_type: sourceType as AffectedDueItemPreview['source_type'],
      source_id: null,
      source_reference: null,
      title: null,
      current_visibility_state: 'AVAILABLE_WHERE_EXISTING',
      projected_visibility_state: 'NOT_CALCULATED_IN_PHASE_5',
      current_due_status: null,
      projected_due_status: 'NOT_CALCULATED_IN_PHASE_5',
      reason,
      related_component_installation_id: null,
      warnings: [{ code: 'NOT_CALCULATED_IN_PHASE_5', message: reason }],
    }));
  }

  private static validatePreviewMetadata(params: {
    sourceType: string;
    sourceReference: string | null;
    effectiveDate: string;
    reason: string;
    deltaHours: number;
    deltaCycles: number;
    validationWarnings: PreviewWarning[];
  }) {
    if (!this.validSourceTypes.has(params.sourceType)) {
      params.validationWarnings.push({
        code: 'INVALID_UTILISATION_SOURCE_TYPE',
        message: 'Source type must be an approved utilisation source type.',
      });
    }

    if (!params.effectiveDate || Number.isNaN(new Date(params.effectiveDate).getTime())) {
      params.validationWarnings.push({
        code: 'INVALID_EFFECTIVE_DATE',
        message: 'Effective date must be valid before confirmation.',
      });
    }

    if (!params.reason) {
      params.validationWarnings.push({
        code: 'UTILISATION_REASON_REQUIRED',
        message: 'Reason is required before confirmation.',
      });
    }

    if (params.deltaHours === 0 && params.deltaCycles === 0) {
      params.validationWarnings.push({
        code: 'UTILISATION_EVENT_REQUIRES_CHANGE',
        message: 'Preview has no utilisation change; confirmation will be blocked.',
      });
    }

    if ((params.deltaHours < 0 || params.deltaCycles < 0) && !params.sourceReference) {
      params.validationWarnings.push({
        code: 'CORRECTION_SOURCE_REFERENCE_REQUIRED',
        message: 'Source reference is required for correction decreases.',
      });
    }
  }

  private static parsePreviewHours(
    value: unknown,
    fallback: number,
    validationWarnings: PreviewWarning[]
  ) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0) {
      validationWarnings.push({
        code: 'INVALID_TOTAL_TIME_HOURS',
        message: 'Proposed aircraft hours must be a non-negative number.',
      });
      return fallback;
    }

    return Number(parsed.toFixed(2));
  }

  private static parsePreviewCycles(
    value: unknown,
    fallback: number,
    validationWarnings: PreviewWarning[]
  ) {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 0) {
      validationWarnings.push({
        code: 'INVALID_TOTAL_TIME_CYCLES',
        message: 'Proposed aircraft cycles must be a non-negative integer.',
      });
      return fallback;
    }

    return parsed;
  }

  private static normalizeHours(value: unknown) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) && parsed >= 0 ? Number(parsed.toFixed(2)) : 0;
  }

  private static normalizeCycles(value: unknown) {
    const parsed = Number(value ?? 0);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  }

  private static deltaOrNull(currentValue: number | null, projectedValue: number | null) {
    if (currentValue === null || projectedValue === null) {
      return null;
    }

    return Number((projectedValue - currentValue).toFixed(2));
  }
}
