import {
  WorkpackComponentExecutionReference,
  WorkpackComponentIntegrationViewModel,
  WorkpackSerializedComponentContextItem,
} from './workpack-component-integration.service.js';

type ExecutionTone = 'slate' | 'emerald' | 'amber' | 'rose';

interface WorkpackExecutionTechnicalDrilldown {
  serialized_component_id: string;
  serial_number: string;
  position: string | null;
  asset_type_code: string;
  manufacturer_name: string | null;
  model_name: string;
  due_state: string;
  due_explanation: string;
  compliance_explanation: string;
  installation_traceability: string;
  maintenance_event_count: number;
  document_count: number;
  install_remove_context: string;
}

interface WorkpackExecutionTaskVisibilityCard {
  task_id: string;
  task_card_number: string;
  title: string;
  has_component_reference: boolean;
  has_serialized_match: boolean;
  tone: ExecutionTone;
  reference_label: string;
  reference_explanation: string;
  due_state: string | null;
  due_explanation: string | null;
  compliance_summary: string;
  install_remove_context: string;
  drilldown: WorkpackExecutionTechnicalDrilldown | null;
}

interface WorkpackExecutionSnagVisibilityCard {
  snag_id: string;
  snag_label: string;
  defect_text: string;
  has_component_reference: boolean;
  has_serialized_match: boolean;
  tone: ExecutionTone;
  reference_explanation: string;
  due_state: string | null;
  compliance_summary: string;
  install_remove_context: string;
  drilldown: WorkpackExecutionTechnicalDrilldown | null;
}

export interface WorkpackOperationalMaturityViewModel {
  summary: {
    task_component_reference_count: number;
    task_serialized_match_count: number;
    snag_component_reference_count: number;
    snag_serialized_match_count: number;
    due_attention_count: number;
    compliance_attention_count: number;
    unmatched_reference_count: number;
    headline: string;
    operational_boundary_notice: string;
  };
  task_visibility_cards: WorkpackExecutionTaskVisibilityCard[];
  snag_visibility_cards: WorkpackExecutionSnagVisibilityCard[];
  unmatched_references: WorkpackComponentExecutionReference[];
  drilldown_lookup: Record<string, WorkpackExecutionTechnicalDrilldown>;
  explanation: string;
}

function normalize(value: unknown) {
  return String(value || '').trim();
}

export class WorkpackOperationalMaturityService {
  static build(params: {
    tasks: any[];
    snags: any[];
    componentExecutionContext: WorkpackComponentIntegrationViewModel;
  }): WorkpackOperationalMaturityViewModel {
    const tasks = params.tasks || [];
    const snags = params.snags || [];
    const componentContext = params.componentExecutionContext;
    const taskReferenceLookup = componentContext?.reference_lookup?.task_by_id || {};
    const snagReferenceLookup = componentContext?.reference_lookup?.snag_by_id || {};
    const componentItems = componentContext?.items || [];
    const componentItemBySerializedId = new Map(
      componentItems.map((item) => [item.serialized_component_id, item] as const)
    );

    const drilldownLookup = componentItems.reduce((lookup, item) => {
      lookup[item.serialized_component_id] = this.buildDrilldown(item);
      return lookup;
    }, {} as Record<string, WorkpackExecutionTechnicalDrilldown>);

    const taskVisibilityCards = tasks.map((task) => {
      const reference = taskReferenceLookup[String(task?.id || '')] || null;
      const item = reference?.serialized_component_id
        ? componentItemBySerializedId.get(reference.serialized_component_id) || null
        : null;

      return {
        task_id: String(task?.id || ''),
        task_card_number: String(task?.task_card_number || '').trim(),
        title: String(task?.title || 'Task').trim() || 'Task',
        has_component_reference: Boolean(reference),
        has_serialized_match: Boolean(reference?.serialized_component_id),
        tone: this.getTone(item?.due_state || null, Boolean(reference), Boolean(reference?.serialized_component_id)),
        reference_label: reference?.serialized_component_id
          ? `Serialized reference: ${reference.serialized_component_serial_number || 'Unknown Serial'}`
          : reference
            ? 'Component reference present'
            : 'No component reference',
        reference_explanation: reference?.explanation || 'No component-linked execution reference is available for this task.',
        due_state: item?.due_state || null,
        due_explanation: item?.due_explanation || null,
        compliance_summary: item
          ? this.buildComplianceSummary(item)
          : 'No serialized compliance visibility derived for this task.',
        install_remove_context: item
          ? this.buildInstallRemoveContext(item)
          : 'Install/remove context is unavailable because no active serialized component could be matched safely.',
        drilldown: item ? drilldownLookup[item.serialized_component_id] || null : null,
      } satisfies WorkpackExecutionTaskVisibilityCard;
    });

    const snagVisibilityCards = snags.map((snag) => {
      const reference = snagReferenceLookup[String(snag?.id || '')] || null;
      const item = reference?.serialized_component_id
        ? componentItemBySerializedId.get(reference.serialized_component_id) || null
        : null;

      return {
        snag_id: String(snag?.id || ''),
        snag_label: normalize(snag?.snag_no) ? `Snag ${normalize(snag?.snag_no)}` : 'Snag',
        defect_text: String(snag?.defect_text || snag?.description || 'Snag').trim() || 'Snag',
        has_component_reference: Boolean(reference),
        has_serialized_match: Boolean(reference?.serialized_component_id),
        tone: this.getTone(item?.due_state || null, Boolean(reference), Boolean(reference?.serialized_component_id)),
        reference_explanation: reference?.explanation || 'No component-linked execution reference is available for this snag.',
        due_state: item?.due_state || null,
        compliance_summary: item
          ? this.buildComplianceSummary(item)
          : 'No serialized compliance visibility derived for this snag.',
        install_remove_context: item
          ? this.buildInstallRemoveContext(item)
          : 'Install/remove context is unavailable because no active serialized component could be matched safely.',
        drilldown: item ? drilldownLookup[item.serialized_component_id] || null : null,
      } satisfies WorkpackExecutionSnagVisibilityCard;
    });

    const unmatchedReferences = componentContext?.unmatched_references || [];
    const taskReferenceCount = taskVisibilityCards.filter((card) => card.has_component_reference).length;
    const taskSerializedMatchCount = taskVisibilityCards.filter((card) => card.has_serialized_match).length;
    const snagReferenceCount = snagVisibilityCards.filter((card) => card.has_component_reference).length;
    const snagSerializedMatchCount = snagVisibilityCards.filter((card) => card.has_serialized_match).length;

    return {
      summary: {
        task_component_reference_count: taskReferenceCount,
        task_serialized_match_count: taskSerializedMatchCount,
        snag_component_reference_count: snagReferenceCount,
        snag_serialized_match_count: snagSerializedMatchCount,
        due_attention_count:
          Number(componentContext?.summary?.due_count || 0) +
          Number(componentContext?.summary?.overdue_count || 0),
        compliance_attention_count:
          Number(componentContext?.summary?.compliance_unknown_count || 0) +
          Number(componentContext?.summary?.compliance_unsupported_count || 0),
        unmatched_reference_count: unmatchedReferences.length,
        headline: this.buildHeadline(componentContext, taskSerializedMatchCount, snagSerializedMatchCount),
        operational_boundary_notice:
          'Execution visibility only. Task, snag, install/remove, and workpack lifecycle actions remain explicit authoritative workflows.',
      },
      task_visibility_cards: taskVisibilityCards,
      snag_visibility_cards: snagVisibilityCards,
      unmatched_references: unmatchedReferences,
      drilldown_lookup: drilldownLookup,
      explanation:
        'Workpack operational maturity is a downstream execution-support layer built from workpack component integration, active serialized-component context, due visibility, compliance visibility, and snag linkage only.',
    };
  }

  private static buildDrilldown(
    item: WorkpackSerializedComponentContextItem
  ): WorkpackExecutionTechnicalDrilldown {
    return {
      serialized_component_id: item.serialized_component_id,
      serial_number: item.serial_number,
      position: item.position || null,
      asset_type_code: item.asset_type_code,
      manufacturer_name: item.manufacturer_name || null,
      model_name: item.model_name,
      due_state: item.due_state,
      due_explanation: item.due_explanation,
      compliance_explanation: item.compliance_explanation,
      installation_traceability: item.installation_traceability,
      maintenance_event_count: item.maintenance_event_count,
      document_count: item.document_count,
      install_remove_context: this.buildInstallRemoveContext(item),
    };
  }

  private static buildComplianceSummary(item: WorkpackSerializedComponentContextItem) {
    return [
      `Applicable ${item.compliance_counts.applicable}`,
      `Not Applicable ${item.compliance_counts.not_applicable}`,
      `Unknown ${item.compliance_counts.unknown}`,
      `Unsupported ${item.compliance_counts.unsupported}`,
    ].join(' | ');
  }

  private static buildInstallRemoveContext(item: WorkpackSerializedComponentContextItem) {
    const latestRemoval =
      item.latest_removal_at
        ? `Latest removal visibility: ${item.latest_removal_at}${item.latest_removal_position ? ` from ${item.latest_removal_position}` : ''}.`
        : 'No prior removal visibility captured for this serialized component.';

    return `Installed ${item.installed_at || 'date unavailable'}${item.position ? ` at ${item.position}` : ''}. ${latestRemoval} Install/remove authority remains outside task and snag actions.`;
  }

  private static getTone(
    dueState: string | null,
    hasReference: boolean,
    hasSerializedMatch: boolean
  ): ExecutionTone {
    if (dueState === 'OVERDUE') {
      return 'rose';
    }

    if (dueState === 'DUE' || dueState === 'DUE_SOON') {
      return 'amber';
    }

    if (hasReference && !hasSerializedMatch) {
      return 'slate';
    }

    return 'emerald';
  }

  private static buildHeadline(
    componentContext: WorkpackComponentIntegrationViewModel,
    taskSerializedMatchCount: number,
    snagSerializedMatchCount: number
  ) {
    if (Number(componentContext?.summary?.overdue_count || 0) > 0) {
      return 'Execution visibility includes overdue serialized-component context that should be reviewed before relying on downstream technical assumptions.';
    }

    if (Number(componentContext?.summary?.unmatched_reference_count || 0) > 0) {
      return 'Some task or snag component references could not be matched safely to active serialized-component context.';
    }

    if (taskSerializedMatchCount > 0 || snagSerializedMatchCount > 0) {
      return 'Execution context now links tasks and snags more clearly to active serialized-component visibility and supporting technical drilldown.';
    }

    return 'Execution visibility is available, but no direct serialized-component linkage could be derived from current workpack references.';
  }
}
