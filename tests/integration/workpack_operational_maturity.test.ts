import { describe, expect, it } from 'vitest';
import { WorkpackOperationalMaturityService } from '../../src/modules/workpacks/services/workpack-operational-maturity.service.js';

describe('Workpack operational maturity', () => {
  it('builds downstream execution visibility for task and snag component context', () => {
    const componentExecutionContext = {
      summary: {
        installed_serialized_count: 1,
        due_count: 1,
        overdue_count: 0,
        unknown_due_count: 0,
        compliance_unknown_count: 1,
        compliance_unsupported_count: 0,
        referenced_record_count: 2,
        matched_reference_count: 2,
        unmatched_reference_count: 0,
        aircraft_readiness_indicator: 'ATTENTION_REQUIRED',
        aircraft_readiness_explanation: 'A due serialized component is visible.',
      },
      items: [
        {
          installation_id: 'installation-1',
          serialized_component_id: 'serialized-1',
          component_model_id: 'model-1',
          serial_number: 'SER-001',
          part_number: 'PN-001',
          position: 'LH GEN',
          installed_at: '2026-05-01',
          install_tsn: 120,
          install_tso: 6,
          latest_removal_at: '2025-09-01',
          latest_removal_position: 'RH GEN',
          asset_type_code: 'GEN',
          model_name: 'Starter Generator',
          model_code: 'SG-1',
          manufacturer_name: 'Test Manufacturer',
          due_state: 'DUE',
          due_explanation: 'This serialized component is currently due.',
          is_due_determinable: true,
          compliance_counts: {
            applicable: 2,
            not_applicable: 1,
            unknown: 1,
            unsupported: 0,
          },
          compliance_explanation: 'Compliance visibility includes one unknown item.',
          maintenance_event_count: 3,
          document_count: 2,
          installation_traceability: 'Installed 2026-05-01 at position LH GEN | Latest removal 2025-09-01 from RH GEN',
          workpack_reference_count: 2,
          workpack_references: [
            {
              source_type: 'TASK',
              source_id: 'task-1',
              source_label: 'WP-T001',
              match_basis: 'POSITION',
            },
            {
              source_type: 'SNAG',
              source_id: 'snag-1',
              source_label: 'Snag 1',
              match_basis: 'POSITION',
            },
          ],
        },
      ],
      references: [],
      unmatched_references: [],
      reference_lookup: {
        task_by_id: {
          'task-1': {
            source_type: 'TASK',
            source_id: 'task-1',
            source_label: 'WP-T001',
            match_basis: 'POSITION',
            legacy_component_id: 'legacy-1',
            legacy_component_serial_number: 'LEG-001',
            legacy_component_position: 'LH GEN',
            serialized_component_id: 'serialized-1',
            serialized_component_serial_number: 'SER-001',
            serialized_component_position: 'LH GEN',
            explanation: 'Matched by current installed position.',
          },
        },
        snag_by_id: {
          'snag-1': {
            source_type: 'SNAG',
            source_id: 'snag-1',
            source_label: 'Snag 1',
            match_basis: 'POSITION',
            legacy_component_id: 'legacy-1',
            legacy_component_serial_number: 'LEG-001',
            legacy_component_position: 'LH GEN',
            serialized_component_id: 'serialized-1',
            serialized_component_serial_number: 'SER-001',
            serialized_component_position: 'LH GEN',
            explanation: 'Matched by current installed position.',
          },
        },
      },
      explanation:
        'Workpack component integration is a derived execution-context layer based on active serialized installations, workpack component references, due visibility, component compliance visibility, installation traceability, and aircraft technical-status context only.',
    };

    const result = WorkpackOperationalMaturityService.build({
      tasks: [
        {
          id: 'task-1',
          task_card_number: 'WP-T001',
          title: 'Inspect starter generator',
        },
      ],
      snags: [
        {
          id: 'snag-1',
          snag_no: 1,
          defect_text: 'Generator vibration noted',
        },
      ],
      componentExecutionContext: componentExecutionContext as any,
    });

    expect(result.summary.task_serialized_match_count).toBe(1);
    expect(result.summary.snag_serialized_match_count).toBe(1);
    expect(result.summary.due_attention_count).toBe(1);
    expect(result.summary.compliance_attention_count).toBe(1);
    expect(result.summary.operational_boundary_notice).toContain('explicit authoritative workflows');
    expect(result.task_visibility_cards[0]?.reference_label).toContain('Serialized reference');
    expect(result.task_visibility_cards[0]?.due_state).toBe('DUE');
    expect(result.task_visibility_cards[0]?.install_remove_context).toContain('Install/remove authority remains outside task and snag actions');
    expect(result.snag_visibility_cards[0]?.drilldown?.serial_number).toBe('SER-001');
    expect(result.explanation).toContain('downstream execution-support layer');
  });
});
