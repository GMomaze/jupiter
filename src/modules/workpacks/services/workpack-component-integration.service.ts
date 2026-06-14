import { Op } from 'sequelize';
import {
  AircraftComponent,
  AircraftComponentInstallation,
  AssetType,
  ComponentLifeLimit,
  ComponentModel,
  Manufacturer,
  SerializedComponent,
  SerializedComponentLifeState,
} from '../../../models/index.js';
import { LibraryService } from '../../library/library.service.js';

type SourceType = 'TASK' | 'SNAG';
type MatchBasis = 'POSITION' | 'SERIAL_NUMBER' | 'UNMATCHED_COMPONENT_REFERENCE';

export interface WorkpackComponentExecutionReference {
  source_type: SourceType;
  source_id: string;
  source_label: string;
  match_basis: MatchBasis;
  legacy_component_id: string | null;
  legacy_component_serial_number: string | null;
  legacy_component_position: string | null;
  serialized_component_id: string | null;
  serialized_component_serial_number: string | null;
  serialized_component_position: string | null;
  explanation: string;
}

export interface WorkpackSerializedComponentContextItem {
  installation_id: string;
  serialized_component_id: string;
  component_model_id: string;
  serial_number: string;
  part_number: string | null;
  position: string | null;
  installed_at: string | null;
  install_tsn: number | null;
  install_tso: number | null;
  latest_removal_at: string | null;
  latest_removal_position: string | null;
  asset_type_code: string;
  model_name: string;
  model_code: string | null;
  manufacturer_name: string | null;
  due_state: string;
  due_explanation: string;
  is_due_determinable: boolean;
  due_worst_limit: any | null;
  due_evaluated_limits: any[];
  due_has_unknown_limits: boolean;
  due_is_partial: boolean;
  due_missing_reasons: string[];
  compliance_counts: {
    applicable: number;
    not_applicable: number;
    unknown: number;
    unsupported: number;
  };
  compliance_explanation: string;
  maintenance_event_count: number;
  document_count: number;
  installation_traceability: string;
  workpack_reference_count: number;
  workpack_references: WorkpackComponentExecutionReference[];
}

export interface WorkpackComponentIntegrationViewModel {
  summary: {
    installed_serialized_count: number;
    due_count: number;
    overdue_count: number;
    unknown_due_count: number;
    compliance_unknown_count: number;
    compliance_unsupported_count: number;
    referenced_record_count: number;
    matched_reference_count: number;
    unmatched_reference_count: number;
    aircraft_readiness_indicator: string;
    aircraft_readiness_explanation: string;
  };
  items: WorkpackSerializedComponentContextItem[];
  references: WorkpackComponentExecutionReference[];
  unmatched_references: WorkpackComponentExecutionReference[];
  reference_lookup: {
    task_by_id: Record<string, WorkpackComponentExecutionReference>;
    snag_by_id: Record<string, WorkpackComponentExecutionReference>;
  };
  explanation: string;
}

type BuildParams = {
  aircraftId?: string | null;
  tasks?: any[];
  snags?: any[];
};

export class WorkpackComponentIntegrationService {
  static async buildForWorkpack(
    params: BuildParams
  ): Promise<WorkpackComponentIntegrationViewModel> {
    const aircraftId = this.normalize(params.aircraftId);
    const tasks = Array.isArray(params.tasks) ? params.tasks : [];
    const snags = Array.isArray(params.snags) ? params.snags : [];

    if (!aircraftId) {
      return this.buildEmptyResult(
        'No aircraft was available, so serialized-component execution context could not be derived safely.'
      );
    }

    const activeInstallations = await AircraftComponentInstallation.findAll({
      where: {
        aircraft_id: aircraftId,
        removed_at: null,
      },
      include: [
        {
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
                  model: Manufacturer,
                  required: false,
                },
                {
                  model: AssetType,
                  required: false,
                },
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
        },
      ],
      order: [['installed_at', 'DESC']],
    });

    const normalizedInstallations = activeInstallations.map((installation: any) =>
      typeof installation?.toJSON === 'function' ? installation.toJSON() : installation
    );

    const serializedIds = normalizedInstallations
      .map((installation: any) => this.normalize(installation?.serialized_component_id))
      .filter(Boolean);

    const latestRemovalBySerializedId = serializedIds.length > 0
      ? await this.getLatestRemovalBySerializedId(serializedIds)
      : new Map<string, { removed_at: string | null; position: string | null }>();

    const referencedLegacyComponentIds = Array.from(
      new Set(
        [...tasks, ...snags]
          .map((item) => this.normalize(item?.component_id || item?.Component?.id))
          .filter(Boolean)
      )
    );

    const legacyComponentLookup = await this.getLegacyComponentLookup(referencedLegacyComponentIds);

    const references = [
      ...tasks.map((task) => this.buildReference('TASK', task, legacyComponentLookup, normalizedInstallations)),
      ...snags.map((snag) => this.buildReference('SNAG', snag, legacyComponentLookup, normalizedInstallations)),
    ].filter((reference): reference is WorkpackComponentExecutionReference => Boolean(reference));

    const taskById: Record<string, WorkpackComponentExecutionReference> = {};
    const snagById: Record<string, WorkpackComponentExecutionReference> = {};

    for (const reference of references) {
      if (reference.source_type === 'TASK') {
        taskById[reference.source_id] = reference;
      } else {
        snagById[reference.source_id] = reference;
      }
    }

    const referencesBySerializedId = references.reduce((lookup, reference) => {
      const key = this.normalize(reference.serialized_component_id);

      if (!key) {
        return lookup;
      }

      lookup[key] = lookup[key] || [];
      lookup[key].push(reference);
      return lookup;
    }, {} as Record<string, WorkpackComponentExecutionReference[]>);

    const items = normalizedInstallations.map((installation: any) => {
      const serializedComponent = installation?.SerializedComponent || {};
      const componentModel = serializedComponent?.ComponentModel || {};
      const serializedId = this.normalize(installation?.serialized_component_id);
      const workpackReferences = referencesBySerializedId[serializedId] || [];
      const latestRemoval = latestRemovalBySerializedId.get(serializedId);
      const dueStatus = LibraryService.evaluateSerializedComponentLifeLimits(
        componentModel?.LifeLimits || [],
        serializedComponent?.LifeState || null
      );
      const dueState = this.normalize(dueStatus?.state) || 'UNKNOWN';
      const complianceCounts = {
        applicable: 0,
        not_applicable: 0,
        unknown: 0,
        unsupported: 0,
      };

      return {
        installation_id: this.normalize(installation?.id),
        serialized_component_id: serializedId,
        component_model_id: this.normalize(serializedComponent?.component_model_id),
        serial_number: this.normalize(serializedComponent?.serial_number),
        part_number: this.normalizeOrNull(serializedComponent?.part_number),
        position: this.normalizeOrNull(installation?.position),
        installed_at: this.normalizeOrNull(installation?.installed_at),
        install_tsn: this.normalizeDecimal(installation?.install_tsn),
        install_tso: this.normalizeDecimal(installation?.install_tso),
        latest_removal_at: latestRemoval?.removed_at || null,
        latest_removal_position: latestRemoval?.position || null,
        asset_type_code:
          this.normalize(componentModel?.AssetType?.code) || 'UNCLASSIFIED',
        model_name:
          this.normalize(componentModel?.model_name) || 'Unknown Model',
        model_code: this.normalizeOrNull(componentModel?.model_code),
        manufacturer_name: this.normalizeOrNull(componentModel?.Manufacturer?.name),
        due_state: dueState,
        due_explanation: this.normalize(dueStatus?.explanation) ||
          'Serialized-component due visibility could not be derived from current life-limit context.',
        is_due_determinable: dueState !== 'UNKNOWN',
        due_worst_limit: dueStatus?.worstLimit || null,
        due_evaluated_limits: Array.isArray(dueStatus?.evaluatedLimits)
          ? dueStatus.evaluatedLimits
          : [],
        due_has_unknown_limits: Boolean(dueStatus?.has_unknown_limits),
        due_is_partial: Boolean(dueStatus?.is_partial),
        due_missing_reasons: Array.isArray(dueStatus?.reasons) ? dueStatus.reasons : [],
        compliance_counts: complianceCounts,
        compliance_explanation:
          'No dedicated component compliance engine is linked in this workpack execution layer, so compliance visibility remains advisory and limited to current derived context.',
        maintenance_event_count: 0,
        document_count: 0,
        installation_traceability: this.buildInstallationTraceability(installation, latestRemoval),
        workpack_reference_count: workpackReferences.length,
        workpack_references: workpackReferences,
      } satisfies WorkpackSerializedComponentContextItem;
    });

    const unmatchedReferences = references.filter(
      (reference) => !this.normalize(reference.serialized_component_id)
    );

    const summary = this.buildSummary(items, references, unmatchedReferences);

    return {
      summary,
      items,
      references,
      unmatched_references: unmatchedReferences,
      reference_lookup: {
        task_by_id: taskById,
        snag_by_id: snagById,
      },
      explanation:
        'Workpack component integration is a derived execution-context layer based on active serialized installations, workpack component references, due visibility, component compliance visibility, installation traceability, and aircraft technical-status context only.',
    };
  }

  private static async getLatestRemovalBySerializedId(serializedIds: string[]) {
    const removals = await AircraftComponentInstallation.findAll({
      where: {
        serialized_component_id: {
          [Op.in]: serializedIds,
        },
        removed_at: {
          [Op.ne]: null,
        },
      },
      order: [['removed_at', 'DESC']],
    });

    const lookup = new Map<string, { removed_at: string | null; position: string | null }>();

    for (const row of removals as any[]) {
      const key = this.normalize((row as any)?.serialized_component_id);

      if (!key || lookup.has(key)) {
        continue;
      }

      lookup.set(key, {
        removed_at: this.normalizeOrNull((row as any)?.removed_at),
        position: this.normalizeOrNull((row as any)?.position),
      });
    }

    return lookup;
  }

  private static async getLegacyComponentLookup(componentIds: string[]) {
    if (componentIds.length === 0) {
      return new Map<string, any>();
    }

    const components = await AircraftComponent.findAll({
      where: {
        id: {
          [Op.in]: componentIds,
        },
      },
      attributes: ['id', 'serial_number', 'position_code', 'model_id'],
    });

    return new Map(
      (components as any[]).map((component: any) => {
        const normalized =
          typeof component?.toJSON === 'function' ? component.toJSON() : component;
        return [this.normalize(normalized?.id), normalized] as const;
      })
    );
  }

  private static buildReference(
    sourceType: SourceType,
    source: any,
    legacyComponentLookup: Map<string, any>,
    installations: any[]
  ): WorkpackComponentExecutionReference | null {
    const sourceId = this.normalize(source?.id);

    if (!sourceId) {
      return null;
    }

    const sourceLabel = sourceType === 'TASK'
      ? (this.normalize(source?.task_card_number) || `Task ${sourceId}`)
      : (this.normalize(source?.snag_no) ? `Snag ${this.normalize(source?.snag_no)}` : `Snag ${sourceId}`);

    const componentId = this.normalize(source?.component_id || source?.Component?.id);
    const legacyComponent = componentId
      ? legacyComponentLookup.get(componentId) || this.normalizeInlineLegacyComponent(source?.Component, componentId)
      : null;
    const legacySerial = this.normalize(legacyComponent?.serial_number);
    const legacyPosition = this.normalize(legacyComponent?.position_code);

    let matchedInstallation: any = null;
    let matchBasis: MatchBasis = 'UNMATCHED_COMPONENT_REFERENCE';
    let explanation = 'No component reference is available for this workpack record.';

    if (legacyPosition) {
      matchedInstallation =
        installations.find(
          (installation: any) => this.normalize(installation?.position) === legacyPosition
        ) || null;
      if (matchedInstallation) {
        matchBasis = 'POSITION';
        explanation = 'Matched by current installed position.';
      }
    }

    if (!matchedInstallation && legacySerial) {
      matchedInstallation =
        installations.find(
          (installation: any) =>
            this.normalize(installation?.SerializedComponent?.serial_number) === legacySerial
        ) || null;
      if (matchedInstallation) {
        matchBasis = 'SERIAL_NUMBER';
        explanation = 'Matched by serialized component serial number.';
      }
    }

    if (!matchedInstallation && componentId) {
      explanation =
        'A legacy component reference is present, but no active serialized component could be matched safely from current source data.';
    }

    return {
      source_type: sourceType,
      source_id: sourceId,
      source_label: sourceLabel,
      match_basis: matchBasis,
      legacy_component_id: componentId || null,
      legacy_component_serial_number: legacySerial || null,
      legacy_component_position: legacyPosition || null,
      serialized_component_id: this.normalizeOrNull(matchedInstallation?.serialized_component_id),
      serialized_component_serial_number: this.normalizeOrNull(
        matchedInstallation?.SerializedComponent?.serial_number
      ),
      serialized_component_position: this.normalizeOrNull(matchedInstallation?.position),
      explanation,
    };
  }

  private static normalizeInlineLegacyComponent(component: any, fallbackId: string) {
    if (!component) {
      return {
        id: fallbackId,
        serial_number: null,
        position_code: null,
      };
    }

    return {
      id: this.normalize(component?.id) || fallbackId,
      serial_number: this.normalizeOrNull(component?.serial_number),
      position_code: this.normalizeOrNull(component?.position_code),
    };
  }

  private static buildInstallationTraceability(
    installation: any,
    latestRemoval?: { removed_at: string | null; position: string | null } | null
  ) {
    const installedAt = this.normalizeOrNull(installation?.installed_at) || 'date unavailable';
    const position = this.normalizeOrNull(installation?.position);
    const latestRemovalText = latestRemoval?.removed_at
      ? `Latest removal ${latestRemoval.removed_at}${latestRemoval.position ? ` from ${latestRemoval.position}` : ''}`
      : 'No prior removal visibility captured';

    return `Installed ${installedAt}${position ? ` at position ${position}` : ''} | ${latestRemovalText}`;
  }

  private static buildSummary(
    items: WorkpackSerializedComponentContextItem[],
    references: WorkpackComponentExecutionReference[],
    unmatchedReferences: WorkpackComponentExecutionReference[]
  ) {
    const dueCount = items.filter((item) => item.due_state === 'DUE' || item.due_state === 'DUE_SOON').length;
    const overdueCount = items.filter((item) => item.due_state === 'OVERDUE').length;
    const unknownDueCount = items.filter((item) => !item.is_due_determinable || item.due_state === 'UNKNOWN').length;
    const complianceUnknownCount = items.reduce(
      (sum, item) => sum + Number(item.compliance_counts?.unknown || 0),
      0
    );
    const complianceUnsupportedCount = items.reduce(
      (sum, item) => sum + Number(item.compliance_counts?.unsupported || 0),
      0
    );
    const matchedReferenceCount = references.filter((reference) =>
      Boolean(this.normalize(reference.serialized_component_id))
    ).length;

    return {
      installed_serialized_count: items.length,
      due_count: dueCount,
      overdue_count: overdueCount,
      unknown_due_count: unknownDueCount,
      compliance_unknown_count: complianceUnknownCount,
      compliance_unsupported_count: complianceUnsupportedCount,
      referenced_record_count: references.filter((reference) =>
        Boolean(this.normalize(reference.legacy_component_id))
      ).length,
      matched_reference_count: matchedReferenceCount,
      unmatched_reference_count: unmatchedReferences.length,
      aircraft_readiness_indicator: this.getAircraftReadinessIndicator(
        items.length,
        overdueCount,
        dueCount,
        unmatchedReferences.length,
        unknownDueCount
      ),
      aircraft_readiness_explanation: this.getAircraftReadinessExplanation(
        items.length,
        overdueCount,
        dueCount,
        unmatchedReferences.length,
        unknownDueCount
      ),
    };
  }

  private static getAircraftReadinessIndicator(
    installedCount: number,
    overdueCount: number,
    dueCount: number,
    unmatchedCount: number,
    unknownDueCount: number
  ) {
    if (installedCount === 0) {
      return 'NO_ACTIVE_SERIALIZED_CONTEXT';
    }

    if (overdueCount > 0 || dueCount > 0 || unmatchedCount > 0) {
      return 'ATTENTION_REQUIRED';
    }

    if (unknownDueCount > 0) {
      return 'LIMITED_VISIBILITY';
    }

    return 'OPERATIONALLY_VISIBLE';
  }

  private static getAircraftReadinessExplanation(
    installedCount: number,
    overdueCount: number,
    dueCount: number,
    unmatchedCount: number,
    unknownDueCount: number
  ) {
    if (installedCount === 0) {
      return 'No active serialized components are currently visible for this workpack aircraft.';
    }

    if (overdueCount > 0) {
      return 'Overdue serialized-component visibility is present in the current execution context.';
    }

    if (dueCount > 0) {
      return 'A due serialized component is visible.';
    }

    if (unmatchedCount > 0) {
      return 'Some workpack component references could not be matched safely to active serialized-component visibility.';
    }

    if (unknownDueCount > 0) {
      return 'Serialized-component execution context is visible, but dedicated due visibility is not fully derivable in this layer.';
    }

    return 'Active serialized-component execution visibility is available for this workpack aircraft.';
  }

  private static buildEmptyResult(explanation: string): WorkpackComponentIntegrationViewModel {
    return {
      summary: {
        installed_serialized_count: 0,
        due_count: 0,
        overdue_count: 0,
        unknown_due_count: 0,
        compliance_unknown_count: 0,
        compliance_unsupported_count: 0,
        referenced_record_count: 0,
        matched_reference_count: 0,
        unmatched_reference_count: 0,
        aircraft_readiness_indicator: 'NO_ACTIVE_SERIALIZED_CONTEXT',
        aircraft_readiness_explanation:
          'No active serialized components are currently visible for this workpack aircraft.',
      },
      items: [],
      references: [],
      unmatched_references: [],
      reference_lookup: {
        task_by_id: {},
        snag_by_id: {},
      },
      explanation,
    };
  }

  private static normalize(value: unknown) {
    return String(value || '').trim();
  }

  private static normalizeOrNull(value: unknown) {
    const normalized = this.normalize(value);
    return normalized || null;
  }

  private static normalizeDecimal(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numeric = Number(value);
    return Number.isNaN(numeric) ? null : numeric;
  }
}
