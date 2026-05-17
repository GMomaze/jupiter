import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../models/index.js';
import { ComplianceService } from '../../compliance/compliance.service.js';
import { MeasurementService } from './measurement.service.js';

type CoverWorkpackRow = {
  workpack_id: string;
  work_order_number: string;
  workpack_version: number | string | null;
  workpack_created_at: Date | string | null;
  workpack_updated_at: Date | string | null;
  planning_session_id: string | null;
  status_code: string | null;
  issued_at: Date | string | null;
  issued_by_name: string | null;
  certified_at: Date | string | null;
  qa_reviewed_at: Date | string | null;
  released_at: Date | string | null;
  aircraft_id: string;
  registration: string | null;
  serial_number: string | null;
  total_time_hours: string | number | null;
  total_time_cycles: string | number | null;
  manufacture_date: string | null;
  tcds_number: string | null;
  tcds_url: string | null;
  aircraft_model_id: string | null;
  aircraft_model_name: string | null;
  aircraft_manufacturer_name: string | null;
  aircraft_category_label: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_contact_person: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_alternate_phone: string | null;
  customer_account_reference: string | null;
  customer_billing_address_line_1: string | null;
  customer_billing_address_line_2: string | null;
  customer_billing_city: string | null;
  customer_billing_state_or_province: string | null;
  customer_billing_postal_code: string | null;
  customer_billing_country: string | null;
  customer_physical_address_line_1: string | null;
  customer_physical_address_line_2: string | null;
  customer_physical_city: string | null;
  customer_physical_state_or_province: string | null;
  customer_physical_postal_code: string | null;
  customer_physical_country: string | null;
  customer_relationship_type: string | null;
  planning_session_status: string | null;
  planning_maintenance_type: string | null;
  template_id: string | null;
  template_name: string | null;
  template_type: string | null;
  planner_user_id: string | null;
  planner_full_name: string | null;
  planner_email: string | null;
  planner_selected_from: string | null;
  planning_finalized_at: Date | string | null;
};

type TaskStatusSummaryRow = {
  total_tasks: string | number | null;
  open_tasks: string | number | null;
  in_progress_tasks: string | number | null;
  completed_by_mechanic_tasks: string | number | null;
  certified_by_engineer_tasks: string | number | null;
  locked_tasks: string | number | null;
  standard_task_count: string | number | null;
  ad_task_count: string | number | null;
  sb_task_count: string | number | null;
  sid_task_count: string | number | null;
};

type SnagSummaryRow = {
  total_snags: string | number | null;
  open_snags: string | number | null;
  in_progress_snags: string | number | null;
  resolved_snags: string | number | null;
  closed_snags: string | number | null;
};

type ComplianceScopeSummaryRow = {
  total_items: string | number | null;
  open_items: string | number | null;
  completed_items: string | number | null;
  ad_total_items: string | number | null;
  ad_completed_items: string | number | null;
  sb_total_items: string | number | null;
  sb_completed_items: string | number | null;
};

type TaskBodyTaskRow = {
  task_id: string;
  task_card_number: string | null;
  title: string;
  description: string | null;
  task_status: string | null;
  work_performed: string | null;
  template_source_id: string | null;
  service_bulletin_id: string | null;
  compliance_item_id: string | null;
  mechanic_completed_at: Date | string | null;
  engineer_certified_at: Date | string | null;
  mechanic_name: string | null;
  engineer_name: string | null;
  execution_id: string | null;
  execution_status: string | null;
  execution_attempt_no: number | string | null;
  execution_started_at: Date | string | null;
  execution_completed_at: Date | string | null;
  execution_certified_at: Date | string | null;
  compliance_item_type: string | null;
  compliance_code: string | null;
  compliance_title: string | null;
  compliance_authority: string | null;
  compliance_revision: string | null;
  compliance_basis: string | null;
};

type TaskMeasurementRow = {
  task_id: string;
  execution_id: string;
  field_key: string | null;
  field_label: string | null;
  position: number | string | null;
  value: string | null;
};

type TaskSignatureRow = {
  task_id: string;
  execution_id: string;
  role: string | null;
  signature_type: string | null;
  signer_name: string | null;
  signed_at: Date | string | null;
};

type WorkpackSnagRow = {
  snag_id: string;
  snag_no: number | string | null;
  description: string | null;
  defect_text: string | null;
  status: string | null;
  category: string | null;
  priority: string | null;
  resolution_notes: string | null;
  parts_used: string | null;
  time_spent_minutes: number | string | null;
  created_at: Date | string | null;
  started_at: Date | string | null;
  resolved_at: Date | string | null;
  closed_at: Date | string | null;
  component_serial_number: string | null;
  component_position_code: string | null;
  created_by_name: string | null;
  assigned_to_name: string | null;
  resolved_by_name: string | null;
  closed_by_name: string | null;
  started_by_name: string | null;
};

export interface PrintableWorkpackCoverPageSnapshot {
  snapshot: {
    section: 'COVER_PAGE';
    generated_at: Date;
    source_of_truth: 'JUPITER_DATABASE';
    artifact_role: 'DOWNSTREAM_PRINTABLE_WORKPACK';
    snapshot_strategy: 'READ_ONLY_RENDER_SNAPSHOT';
  };
  authority: {
    lifecycle_authority: 'JUPITER';
    certification_authority: 'JUPITER';
    audit_authority: 'JUPITER';
    workflow_mutation_permitted: false;
    rendering_included: false;
  };
  workpack: {
    id: string;
    work_order_number: string;
    status_code: string | null;
    planning_session_id: string | null;
    created_at: Date | null;
    updated_at: Date | null;
  };
  aircraft: {
    id: string;
    registration: string | null;
    serial_number: string | null;
    model_id: string | null;
    model_name: string | null;
    manufacturer_name: string | null;
    category_label: string | null;
    total_time_hours: number | null;
    total_time_cycles: number | null;
    manufacture_date: string | null;
    tcds_number: string | null;
    tcds_url: string | null;
  };
  customer: {
    id: string | null;
    name: string | null;
    relationship_type: string | null;
    contact_person: string | null;
    email: string | null;
    phone: string | null;
    alternate_phone: string | null;
    account_reference: string | null;
    billing_address: string[];
    physical_address: string[];
    visibility: 'OPERATIONAL_ONLY';
  };
  planner: {
    user_id: string | null;
    full_name: string | null;
    email: string | null;
    selected_from: 'FINALIZER' | 'CREATOR' | 'OWNER' | 'UNRESOLVED';
    planning_session_status: string | null;
    planning_maintenance_type: string | null;
    planning_finalized_at: Date | null;
    template: {
      id: string | null;
      name: string | null;
      type: string | null;
    };
  };
  operational_scope_summary: {
    maintenance_type: string | null;
    template_name: string | null;
    template_type: string | null;
    tasks: {
      total: number;
      open: number;
      in_progress: number;
      completed_by_mechanic: number;
      certified_by_engineer: number;
      locked: number;
      standard: number;
      ad: number;
      sb: number;
      sid: number;
    };
    compliance: {
      total: number;
      open: number;
      completed: number;
      ad_total: number;
      ad_completed: number;
      sb_total: number;
      sb_completed: number;
      completed_snapshot_items: number;
    };
    snags: {
      total: number;
      open: number;
      in_progress: number;
      resolved: number;
      closed: number;
    };
  };
  issue_revision: {
    revision_number: number;
    current_status_code: string | null;
    issued_at: Date | null;
    issued_by_name: string | null;
    certified_at: Date | null;
    qa_reviewed_at: Date | null;
    released_at: Date | null;
    last_updated_at: Date | null;
  };
}

export interface PrintableWorkpackTaskMeasurementSnapshot {
  field_key: string | null;
  field_label: string | null;
  position: number | null;
  value: string | null;
}

export interface PrintableWorkpackTaskSignatureSnapshot {
  role: string | null;
  signature_type: string | null;
  signer_name: string | null;
  signed_at: Date | null;
}

export interface PrintableWorkpackSnagSnapshot {
  snag: {
    id: string;
    snag_no: number | null;
    status_code: string | null;
    category: string | null;
    priority: string | null;
  };
  reference: {
    workpack_reference: string;
    aircraft_registration: string | null;
    aircraft_serial_number: string | null;
    aircraft_model: string | null;
    component_serial_number: string | null;
    component_position_code: string | null;
  };
  description: {
    defect_text: string | null;
    detail_text: string | null;
  };
  resolution: {
    stored_text: string | null;
    parts_used: string | null;
    time_spent_minutes: number | null;
    handwritten_reconciliation_required: true;
  };
  lifecycle: {
    created_at: Date | null;
    started_at: Date | null;
    resolved_at: Date | null;
    closed_at: Date | null;
  };
  responsibility: {
    created_by_name: string | null;
    assigned_to_name: string | null;
    started_by_name: string | null;
    resolved_by_name: string | null;
    closed_by_name: string | null;
  };
}

export interface PrintableWorkpackTaskBodyTaskSnapshot {
  task: {
    id: string;
    task_card_number: string | null;
    title: string;
    task_status_code: string | null;
    execution_status_code: string | null;
    execution_attempt_no: number | null;
    source_classification: 'STANDARD_TASK' | 'COMPLIANCE_ITEM' | 'UNCLASSIFIED';
  };
  task_reference: {
    workpack_reference: string;
    aircraft_registration: string | null;
    aircraft_serial_number: string | null;
    aircraft_model: string | null;
    task_reference: string | null;
  };
  compliance_reference: {
    item_type: string | null;
    code: string | null;
    title: string | null;
    authority: string | null;
    revision: string | null;
    compliance_basis: string | null;
    service_bulletin_reference: string | null;
  };
  task_instructions: {
    text: string | null;
  };
  work_performed: {
    stored_text: string | null;
    handwritten_reconciliation_required: true;
  };
  measurements: {
    items: PrintableWorkpackTaskMeasurementSnapshot[];
    handwritten_reconciliation_required: true;
  };
  findings_notes: {
    stored_text: string | null;
    handwritten_reconciliation_required: true;
  };
  mechanic_signoff_support: {
    recorded_name: string | null;
    recorded_at: Date | null;
    signatures: PrintableWorkpackTaskSignatureSnapshot[];
    evidence_only: true;
  };
  engineer_signoff_support: {
    recorded_name: string | null;
    recorded_at: Date | null;
    signatures: PrintableWorkpackTaskSignatureSnapshot[];
    evidence_only: true;
  };
}

export interface PrintableWorkpackTaskBodySnapshot {
  snapshot: {
    section: 'TASK_BODY';
    generated_at: Date;
    source_of_truth: 'JUPITER_DATABASE';
    artifact_role: 'DOWNSTREAM_PRINTABLE_WORKPACK';
    snapshot_strategy: 'READ_ONLY_RENDER_SNAPSHOT';
  };
  authority: {
    lifecycle_authority: 'JUPITER';
    certification_authority: 'JUPITER';
    audit_authority: 'JUPITER';
    workflow_mutation_permitted: false;
    rendering_included: false;
  };
  workpack: {
    id: string;
    work_order_number: string;
    status_code: string | null;
    aircraft_registration: string | null;
    aircraft_serial_number: string | null;
    aircraft_model: string | null;
  };
  tasks: PrintableWorkpackTaskBodyTaskSnapshot[];
  snags: PrintableWorkpackSnagSnapshot[];
}

export class PrintableWorkpackService {
  private static readonly plannerSelectionMap = {
    FINALIZER: 'FINALIZER',
    CREATOR: 'CREATOR',
    OWNER: 'OWNER',
  } as const;

  private static normalizeString(value: string | null | undefined) {
    const normalized = String(value || '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private static cleanText(value: string | null | undefined) {
    return String(value || '')
      .replace(/\[Captured Values\][\s\S]*?\[\/Captured Values\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static toDate(value: Date | string | null | undefined) {
    if (!value) {
      return null;
    }

    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private static toNumber(value: string | number | null | undefined) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private static toCount(value: string | number | null | undefined) {
    return this.toNumber(value) ?? 0;
  }

  private static buildAddress(lines: Array<string | null | undefined>) {
    return lines
      .map((line) => this.normalizeString(line))
      .filter((line): line is string => Boolean(line));
  }

  private static getPlannerSelectionSource(
    value: string | null | undefined
  ): PrintableWorkpackCoverPageSnapshot['planner']['selected_from'] {
    const normalized = String(value || '').trim().toUpperCase();

    if (normalized === this.plannerSelectionMap.FINALIZER) {
      return 'FINALIZER';
    }

    if (normalized === this.plannerSelectionMap.CREATOR) {
      return 'CREATOR';
    }

    if (normalized === this.plannerSelectionMap.OWNER) {
      return 'OWNER';
    }

    return 'UNRESOLVED';
  }

  static async getCoverPageDataForWorkpack(
    workpackId: string,
    transaction?: any
  ): Promise<PrintableWorkpackCoverPageSnapshot> {
    const normalizedWorkpackId = String(workpackId || '').trim();

    if (!normalizedWorkpackId) {
      throw new Error('WORKPACK_ID_REQUIRED');
    }

    const coverRows = await sequelize.query<CoverWorkpackRow>(
      `
      SELECT
        w.id AS workpack_id,
        w.work_order_number,
        w.version AS workpack_version,
        w.created_at AS workpack_created_at,
        w.updated_at AS workpack_updated_at,
        w.planning_session_id,
        ws.code AS status_code,
        issue_audit.issued_at,
        issue_audit.issued_by_name,
        w.certified_at,
        w.qa_reviewed_at,
        w.released_at,
        a.id AS aircraft_id,
        a.registration,
        a.serial_number,
        a.total_time_hours,
        a.total_time_cycles,
        a.manufacture_date,
        a.tcds_number,
        a.tcds_url,
        cm.id AS aircraft_model_id,
        cm.model_name AS aircraft_model_name,
        mf.name AS aircraft_manufacturer_name,
        ac.label AS aircraft_category_label,
        customer_link.customer_id,
        customer_link.customer_name,
        customer_link.customer_contact_person,
        customer_link.customer_email,
        customer_link.customer_phone,
        customer_link.customer_alternate_phone,
        customer_link.customer_account_reference,
        customer_link.customer_billing_address_line_1,
        customer_link.customer_billing_address_line_2,
        customer_link.customer_billing_city,
        customer_link.customer_billing_state_or_province,
        customer_link.customer_billing_postal_code,
        customer_link.customer_billing_country,
        customer_link.customer_physical_address_line_1,
        customer_link.customer_physical_address_line_2,
        customer_link.customer_physical_city,
        customer_link.customer_physical_state_or_province,
        customer_link.customer_physical_postal_code,
        customer_link.customer_physical_country,
        customer_link.customer_relationship_type,
        ps.status AS planning_session_status,
        ps.maintenance_type AS planning_maintenance_type,
        mt.id AS template_id,
        mt.name AS template_name,
        mt.template_type AS template_type,
        COALESCE(planner_finalizer.id, planner_creator.id, planner_owner.id) AS planner_user_id,
        COALESCE(planner_finalizer.full_name, planner_creator.full_name, planner_owner.full_name) AS planner_full_name,
        COALESCE(planner_finalizer.email, planner_creator.email, planner_owner.email) AS planner_email,
        CASE
          WHEN planner_finalizer.id IS NOT NULL THEN 'FINALIZER'
          WHEN planner_creator.id IS NOT NULL THEN 'CREATOR'
          WHEN planner_owner.id IS NOT NULL THEN 'OWNER'
          ELSE NULL
        END AS planner_selected_from,
        ps.finalized_at AS planning_finalized_at
      FROM workpacks w
      JOIN aircraft a
        ON a.id = w.aircraft_id
      LEFT JOIN rf_workpack_status ws
        ON ws.id = w.status_id
      LEFT JOIN component_models cm
        ON cm.id = a.model_id
      LEFT JOIN manufacturers mf
        ON mf.id = cm.manufacturer_id
      LEFT JOIN rf_aircraft_category ac
        ON ac.id = a.category_id
      LEFT JOIN planning_sessions ps
        ON ps.id = w.planning_session_id
      LEFT JOIN maintenance_templates mt
        ON mt.id = ps.template_id
      LEFT JOIN users planner_finalizer
        ON planner_finalizer.id = ps.finalized_by
      LEFT JOIN users planner_creator
        ON planner_creator.id = ps.created_by
      LEFT JOIN users planner_owner
        ON planner_owner.id = ps.user_id
      LEFT JOIN LATERAL (
        SELECT
          al.created_at AS issued_at,
          issue_actor.full_name AS issued_by_name
        FROM audit_log al
        LEFT JOIN users issue_actor
          ON issue_actor.id = al.actor_id
        WHERE al.table_name = 'workpacks'
          AND al.row_id = w.id
          AND al.action = 'STATUS_CHANGE'
          AND COALESCE(al.new_values ->> 'status', '') = 'ISSUED'
        ORDER BY al.created_at ASC, al.id ASC
        LIMIT 1
      ) issue_audit
        ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          c.id AS customer_id,
          c.name AS customer_name,
          c.contact_person AS customer_contact_person,
          c.email AS customer_email,
          c.phone AS customer_phone,
          c.alternate_phone AS customer_alternate_phone,
          c.account_reference AS customer_account_reference,
          c.billing_address_line_1 AS customer_billing_address_line_1,
          c.billing_address_line_2 AS customer_billing_address_line_2,
          c.billing_city AS customer_billing_city,
          c.billing_state_or_province AS customer_billing_state_or_province,
          c.billing_postal_code AS customer_billing_postal_code,
          c.billing_country AS customer_billing_country,
          c.physical_address_line_1 AS customer_physical_address_line_1,
          c.physical_address_line_2 AS customer_physical_address_line_2,
          c.physical_city AS customer_physical_city,
          c.physical_state_or_province AS customer_physical_state_or_province,
          c.physical_postal_code AS customer_physical_postal_code,
          c.physical_country AS customer_physical_country,
          cal.relationship_type AS customer_relationship_type
        FROM customer_aircraft_links cal
        JOIN customers c
          ON c.id = cal.customer_id
        WHERE cal.aircraft_id = w.aircraft_id
          AND cal.is_current = TRUE
        ORDER BY
          CASE cal.relationship_type
            WHEN 'OWNER' THEN 1
            WHEN 'OPERATOR' THEN 2
            WHEN 'CO_OWNER' THEN 3
            WHEN 'BILLING_CUSTOMER' THEN 4
            WHEN 'MANAGEMENT_COMPANY' THEN 5
            WHEN 'CONTACT_ONLY' THEN 6
            ELSE 7
          END,
          cal.start_date DESC,
          cal.created_at DESC
        LIMIT 1
      ) customer_link
        ON TRUE
      WHERE w.id = :workpackId
      LIMIT 1
      `,
      {
        replacements: { workpackId: normalizedWorkpackId },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    const workpack = coverRows[0];

    if (!workpack) {
      throw new Error('WORKPACK_NOT_FOUND');
    }

    const [taskSummaryRows, snagSummaryRows, complianceScopeRows, completedComplianceSummary] =
      await Promise.all([
        sequelize.query<TaskStatusSummaryRow>(
          `
          SELECT
            COUNT(*)::int AS total_tasks,
            COUNT(*) FILTER (WHERE t.status = 'OPEN')::int AS open_tasks,
            COUNT(*) FILTER (WHERE t.status = 'IN_PROGRESS')::int AS in_progress_tasks,
            COUNT(*) FILTER (WHERE t.status = 'COMPLETED_BY_MECHANIC')::int AS completed_by_mechanic_tasks,
            COUNT(*) FILTER (WHERE t.status = 'CERTIFIED_BY_ENGINEER')::int AS certified_by_engineer_tasks,
            COUNT(*) FILTER (WHERE t.status = 'LOCKED')::int AS locked_tasks,
            COUNT(*) FILTER (WHERE t.template_source_id IS NOT NULL)::int AS standard_task_count,
            COUNT(*) FILTER (
              WHERE t.compliance_item_id IS NOT NULL
                AND ci.item_type = 'AD'
            )::int AS ad_task_count,
            COUNT(*) FILTER (
              WHERE t.compliance_item_id IS NOT NULL
                AND ci.item_type = 'SB'
            )::int AS sb_task_count,
            0::int AS sid_task_count
          FROM workpack_tasks wt
          JOIN task_cards t
            ON t.id = wt.task_id
          LEFT JOIN compliance_items ci
            ON ci.id = t.compliance_item_id
          WHERE wt.workpack_id = :workpackId
          `,
          {
            replacements: { workpackId: normalizedWorkpackId },
            type: QueryTypes.SELECT,
            transaction,
          }
        ),
        sequelize.query<SnagSummaryRow>(
          `
          SELECT
            COUNT(*)::int AS total_snags,
            COUNT(*) FILTER (WHERE ws.status = 'OPEN')::int AS open_snags,
            COUNT(*) FILTER (WHERE ws.status = 'IN_PROGRESS')::int AS in_progress_snags,
            COUNT(*) FILTER (WHERE ws.status = 'RESOLVED')::int AS resolved_snags,
            COUNT(*) FILTER (WHERE ws.status = 'CLOSED')::int AS closed_snags
          FROM workpack_snags ws
          WHERE ws.workpack_id = :workpackId
          `,
          {
            replacements: { workpackId: normalizedWorkpackId },
            type: QueryTypes.SELECT,
            transaction,
          }
        ),
        sequelize.query<ComplianceScopeSummaryRow>(
          `
          SELECT
            COUNT(*)::int AS total_items,
            COUNT(*) FILTER (WHERE wc.status <> 'COMPLETED')::int AS open_items,
            COUNT(*) FILTER (WHERE wc.status = 'COMPLETED')::int AS completed_items,
            COUNT(*) FILTER (WHERE ci.item_type = 'AD')::int AS ad_total_items,
            COUNT(*) FILTER (
              WHERE ci.item_type = 'AD'
                AND wc.status = 'COMPLETED'
            )::int AS ad_completed_items,
            COUNT(*) FILTER (WHERE ci.item_type = 'SB')::int AS sb_total_items,
            COUNT(*) FILTER (
              WHERE ci.item_type = 'SB'
                AND wc.status = 'COMPLETED'
            )::int AS sb_completed_items
          FROM workpack_compliance wc
          JOIN compliance_items ci
            ON ci.id = wc.compliance_item_id
          WHERE wc.workpack_id = :workpackId
          `,
          {
            replacements: { workpackId: normalizedWorkpackId },
            type: QueryTypes.SELECT,
            transaction,
          }
        ).catch(() => []),
        ComplianceService.getComplianceSummaryForWorkpack(
          normalizedWorkpackId,
          transaction
        ).catch(() => ({
          workpack_id: normalizedWorkpackId,
          ad_items: [],
          sb_items: [],
        })),
      ]);

    const taskSummary = taskSummaryRows[0];
    const snagSummary = snagSummaryRows[0];
    const complianceScopeSummary = complianceScopeRows[0];
    const completedComplianceCount =
      (completedComplianceSummary.ad_items?.length || 0) +
      (completedComplianceSummary.sb_items?.length || 0);

    return {
      snapshot: {
        section: 'COVER_PAGE',
        generated_at: new Date(),
        source_of_truth: 'JUPITER_DATABASE',
        artifact_role: 'DOWNSTREAM_PRINTABLE_WORKPACK',
        snapshot_strategy: 'READ_ONLY_RENDER_SNAPSHOT',
      },
      authority: {
        lifecycle_authority: 'JUPITER',
        certification_authority: 'JUPITER',
        audit_authority: 'JUPITER',
        workflow_mutation_permitted: false,
        rendering_included: false,
      },
      workpack: {
        id: workpack.workpack_id,
        work_order_number: workpack.work_order_number,
        status_code: this.normalizeString(workpack.status_code),
        planning_session_id: this.normalizeString(workpack.planning_session_id),
        created_at: this.toDate(workpack.workpack_created_at),
        updated_at: this.toDate(workpack.workpack_updated_at),
      },
      aircraft: {
        id: workpack.aircraft_id,
        registration: this.normalizeString(workpack.registration),
        serial_number: this.normalizeString(workpack.serial_number),
        model_id: this.normalizeString(workpack.aircraft_model_id),
        model_name: this.normalizeString(workpack.aircraft_model_name),
        manufacturer_name: this.normalizeString(workpack.aircraft_manufacturer_name),
        category_label: this.normalizeString(workpack.aircraft_category_label),
        total_time_hours: this.toNumber(workpack.total_time_hours),
        total_time_cycles: this.toNumber(workpack.total_time_cycles),
        manufacture_date: this.normalizeString(workpack.manufacture_date),
        tcds_number: this.normalizeString(workpack.tcds_number),
        tcds_url: this.normalizeString(workpack.tcds_url),
      },
      customer: {
        id: this.normalizeString(workpack.customer_id),
        name: this.normalizeString(workpack.customer_name),
        relationship_type: this.normalizeString(workpack.customer_relationship_type),
        contact_person: this.normalizeString(workpack.customer_contact_person),
        email: this.normalizeString(workpack.customer_email),
        phone: this.normalizeString(workpack.customer_phone),
        alternate_phone: this.normalizeString(workpack.customer_alternate_phone),
        account_reference: this.normalizeString(workpack.customer_account_reference),
        billing_address: this.buildAddress([
          workpack.customer_billing_address_line_1,
          workpack.customer_billing_address_line_2,
          workpack.customer_billing_city,
          workpack.customer_billing_state_or_province,
          workpack.customer_billing_postal_code,
          workpack.customer_billing_country,
        ]),
        physical_address: this.buildAddress([
          workpack.customer_physical_address_line_1,
          workpack.customer_physical_address_line_2,
          workpack.customer_physical_city,
          workpack.customer_physical_state_or_province,
          workpack.customer_physical_postal_code,
          workpack.customer_physical_country,
        ]),
        visibility: 'OPERATIONAL_ONLY',
      },
      planner: {
        user_id: this.normalizeString(workpack.planner_user_id),
        full_name: this.normalizeString(workpack.planner_full_name),
        email: this.normalizeString(workpack.planner_email),
        selected_from: this.getPlannerSelectionSource(workpack.planner_selected_from),
        planning_session_status: this.normalizeString(workpack.planning_session_status),
        planning_maintenance_type: this.normalizeString(workpack.planning_maintenance_type),
        planning_finalized_at: this.toDate(workpack.planning_finalized_at),
        template: {
          id: this.normalizeString(workpack.template_id),
          name: this.normalizeString(workpack.template_name),
          type: this.normalizeString(workpack.template_type),
        },
      },
      operational_scope_summary: {
        maintenance_type: this.normalizeString(workpack.planning_maintenance_type),
        template_name: this.normalizeString(workpack.template_name),
        template_type: this.normalizeString(workpack.template_type),
        tasks: {
          total: this.toCount(taskSummary?.total_tasks),
          open: this.toCount(taskSummary?.open_tasks),
          in_progress: this.toCount(taskSummary?.in_progress_tasks),
          completed_by_mechanic: this.toCount(taskSummary?.completed_by_mechanic_tasks),
          certified_by_engineer: this.toCount(taskSummary?.certified_by_engineer_tasks),
          locked: this.toCount(taskSummary?.locked_tasks),
          standard: this.toCount(taskSummary?.standard_task_count),
          ad: this.toCount(taskSummary?.ad_task_count),
          sb: this.toCount(taskSummary?.sb_task_count),
          sid: this.toCount(taskSummary?.sid_task_count),
        },
        compliance: {
          total: this.toCount(complianceScopeSummary?.total_items),
          open: this.toCount(complianceScopeSummary?.open_items),
          completed: this.toCount(complianceScopeSummary?.completed_items),
          ad_total: this.toCount(complianceScopeSummary?.ad_total_items),
          ad_completed: this.toCount(complianceScopeSummary?.ad_completed_items),
          sb_total: this.toCount(complianceScopeSummary?.sb_total_items),
          sb_completed: this.toCount(complianceScopeSummary?.sb_completed_items),
          completed_snapshot_items: completedComplianceCount,
        },
        snags: {
          total: this.toCount(snagSummary?.total_snags),
          open: this.toCount(snagSummary?.open_snags),
          in_progress: this.toCount(snagSummary?.in_progress_snags),
          resolved: this.toCount(snagSummary?.resolved_snags),
          closed: this.toCount(snagSummary?.closed_snags),
        },
      },
      issue_revision: {
        revision_number: this.toCount(workpack.workpack_version),
        current_status_code: this.normalizeString(workpack.status_code),
        issued_at: this.toDate(workpack.issued_at),
        issued_by_name: this.normalizeString(workpack.issued_by_name),
        certified_at: this.toDate(workpack.certified_at),
        qa_reviewed_at: this.toDate(workpack.qa_reviewed_at),
        released_at: this.toDate(workpack.released_at),
        last_updated_at: this.toDate(workpack.workpack_updated_at),
      },
    };
  }

  static async getTaskBodyDataForWorkpack(
    workpackId: string,
    transaction?: any
  ): Promise<PrintableWorkpackTaskBodySnapshot> {
    const cover = await this.getCoverPageDataForWorkpack(workpackId, transaction);
    const normalizedWorkpackId = String(workpackId || '').trim();

    const taskRows = await sequelize.query<TaskBodyTaskRow>(
      `
      SELECT
        t.id AS task_id,
        t.task_card_number,
        t.title,
        t.description,
        t.status AS task_status,
        t.work_performed,
        t.template_source_id,
        t.service_bulletin_id,
        t.compliance_item_id,
        t.mechanic_completed_at,
        t.engineer_certified_at,
        mechanic.full_name AS mechanic_name,
        engineer.full_name AS engineer_name,
        latest_execution.execution_id,
        latest_execution.execution_status,
        latest_execution.execution_attempt_no,
        latest_execution.execution_started_at,
        latest_execution.execution_completed_at,
        latest_execution.execution_certified_at,
        ci.item_type AS compliance_item_type,
        ci.code AS compliance_code,
        ci.title AS compliance_title,
        ci.authority AS compliance_authority,
        ci.revision AS compliance_revision,
        ci.compliance_basis
      FROM workpack_tasks wt
      JOIN task_cards t
        ON t.id = wt.task_id
      LEFT JOIN users mechanic
        ON mechanic.id = t.mechanic_completed_by
      LEFT JOIN users engineer
        ON engineer.id = t.engineer_certified_by
      LEFT JOIN compliance_items ci
        ON ci.id = t.compliance_item_id
      LEFT JOIN LATERAL (
        SELECT
          we.id AS execution_id,
          we.status AS execution_status,
          we.attempt_no AS execution_attempt_no,
          we.started_at AS execution_started_at,
          we.completed_at AS execution_completed_at,
          we.certified_at AS execution_certified_at
        FROM workpack_executions we
        WHERE we.workpack_id = :workpackId
          AND we.task_id = t.id
        ORDER BY we.attempt_no DESC
        LIMIT 1
      ) latest_execution
        ON TRUE
      WHERE wt.workpack_id = :workpackId
      ORDER BY t.task_card_number ASC NULLS LAST, t.created_at ASC, t.id ASC
      `,
      {
        replacements: { workpackId: normalizedWorkpackId },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    const executionIds = taskRows
      .map((row) => this.normalizeString(row.execution_id))
      .filter((value): value is string => Boolean(value));

    const measurementRows =
      executionIds.length > 0
        ? await sequelize.query<TaskMeasurementRow>(
            `
            SELECT
              we.task_id,
              wm.execution_id,
              wm.field_key,
              wm.field_label,
              wm.position,
              wm.value
            FROM workpack_measurements wm
            JOIN workpack_executions we
              ON we.id = wm.execution_id
            WHERE wm.execution_id IN (:executionIds)
            ORDER BY we.task_id ASC, wm.position ASC, wm.id ASC
            `,
            {
              replacements: { executionIds },
              type: QueryTypes.SELECT,
              transaction,
            }
          ).catch(() => [])
        : [];

    const signatureRows =
      executionIds.length > 0
        ? await sequelize.query<TaskSignatureRow>(
            `
            SELECT
              we.task_id,
              ws.execution_id,
              ws.role,
              ws.signature_type,
              signer.full_name AS signer_name,
              ws.signed_at
            FROM workpack_signatures ws
            JOIN workpack_executions we
              ON we.id = ws.execution_id
            LEFT JOIN users signer
              ON signer.id = ws.user_id
            WHERE ws.execution_id IN (:executionIds)
            ORDER BY we.task_id ASC, ws.signed_at ASC, ws.id ASC
            `,
            {
              replacements: { executionIds },
              type: QueryTypes.SELECT,
              transaction,
            }
          ).catch(() => [])
        : [];

    const snagRows = await sequelize.query<WorkpackSnagRow>(
      `
      SELECT
        ws.id AS snag_id,
        ws.snag_no,
        ws.description,
        ws.defect_text,
        ws.status,
        ws.category,
        ws.priority,
        ws.resolution_notes,
        ws.parts_used,
        ws.time_spent_minutes,
        ws.created_at,
        ws.started_at,
        ws.resolved_at,
        ws.closed_at,
        component.serial_number AS component_serial_number,
        component.position_code AS component_position_code,
        created_by_user.full_name AS created_by_name,
        assigned_to_user.full_name AS assigned_to_name,
        resolved_by_user.full_name AS resolved_by_name,
        closed_by_user.full_name AS closed_by_name,
        started_by_user.full_name AS started_by_name
      FROM workpack_snags ws
      LEFT JOIN aircraft_components component
        ON component.id = ws.component_id
      LEFT JOIN users created_by_user
        ON created_by_user.id = ws.created_by
      LEFT JOIN users assigned_to_user
        ON assigned_to_user.id = ws.assigned_to
      LEFT JOIN users resolved_by_user
        ON resolved_by_user.id = ws.resolved_by
      LEFT JOIN users closed_by_user
        ON closed_by_user.id = ws.closed_by
      LEFT JOIN users started_by_user
        ON started_by_user.id = ws.started_by
      WHERE ws.workpack_id = :workpackId
      ORDER BY ws.snag_no ASC, ws.created_at ASC, ws.id ASC
      `,
      {
        replacements: { workpackId: normalizedWorkpackId },
        type: QueryTypes.SELECT,
        transaction,
      }
    ).catch(() => []);

    const measurementsByExecutionId = new Map<string, PrintableWorkpackTaskMeasurementSnapshot[]>();
    for (const row of measurementRows) {
      const executionId = this.normalizeString(row.execution_id);
      if (!executionId) {
        continue;
      }

      const existing = measurementsByExecutionId.get(executionId) || [];
      existing.push({
        field_key: this.normalizeString(row.field_key),
        field_label: this.normalizeString(row.field_label),
        position: this.toNumber(row.position),
        value: this.normalizeString(row.value),
      });
      measurementsByExecutionId.set(executionId, existing);
    }

    const signaturesByExecutionId = new Map<string, PrintableWorkpackTaskSignatureSnapshot[]>();
    for (const row of signatureRows) {
      const executionId = this.normalizeString(row.execution_id);
      if (!executionId) {
        continue;
      }

      const existing = signaturesByExecutionId.get(executionId) || [];
      existing.push({
        role: this.normalizeString(row.role),
        signature_type: this.normalizeString(row.signature_type),
        signer_name: this.normalizeString(row.signer_name),
        signed_at: this.toDate(row.signed_at),
      });
      signaturesByExecutionId.set(executionId, existing);
    }

    const tasks: PrintableWorkpackTaskBodyTaskSnapshot[] = taskRows.map((row) => {
      const executionId = this.normalizeString(row.execution_id);
      const structuredMeasurements =
        (executionId && measurementsByExecutionId.get(executionId)) ||
        MeasurementService.buildMeasurementSnapshot(row.description, row.work_performed).map(
          (measurement) => ({
            field_key: this.normalizeString(measurement.field_key),
            field_label: this.normalizeString(measurement.field_label),
            position: this.toNumber(measurement.position),
            value: this.normalizeString(measurement.value),
          })
        );
      const cleanWorkPerformed = this.normalizeString(
        MeasurementService.extractCleanWorkPerformedNote(row.work_performed)
      );
      const signatures = executionId ? signaturesByExecutionId.get(executionId) || [] : [];
      const mechanicSignatures = signatures.filter(
        (signature) => String(signature.role || '').trim().toUpperCase() === 'MECHANIC'
      );
      const engineerSignatures = signatures.filter(
        (signature) => String(signature.role || '').trim().toUpperCase() === 'ENGINEER'
      );

      return {
        task: {
          id: row.task_id,
          task_card_number: this.normalizeString(row.task_card_number),
          title: row.title,
          task_status_code: this.normalizeString(row.task_status),
          execution_status_code: this.normalizeString(row.execution_status),
          execution_attempt_no: this.toNumber(row.execution_attempt_no),
          source_classification: row.template_source_id
            ? 'STANDARD_TASK'
            : row.compliance_item_id
              ? 'COMPLIANCE_ITEM'
              : 'UNCLASSIFIED',
        },
        task_reference: {
          workpack_reference: cover.workpack.work_order_number,
          aircraft_registration: cover.aircraft.registration,
          aircraft_serial_number: cover.aircraft.serial_number,
          aircraft_model: cover.aircraft.model_name,
          task_reference: this.normalizeString(row.task_card_number) || row.task_id,
        },
        compliance_reference: {
          item_type: this.normalizeString(row.compliance_item_type),
          code: this.normalizeString(row.compliance_code),
          title: this.normalizeString(row.compliance_title),
          authority: this.normalizeString(row.compliance_authority),
          revision: this.normalizeString(row.compliance_revision),
          compliance_basis: this.normalizeString(row.compliance_basis),
          service_bulletin_reference: this.normalizeString(row.service_bulletin_id),
        },
        task_instructions: {
          text: this.normalizeString(this.cleanText(row.description)),
        },
        work_performed: {
          stored_text: cleanWorkPerformed,
          handwritten_reconciliation_required: true,
        },
        measurements: {
          items: structuredMeasurements,
          handwritten_reconciliation_required: true,
        },
        findings_notes: {
          stored_text: null,
          handwritten_reconciliation_required: true,
        },
        mechanic_signoff_support: {
          recorded_name: this.normalizeString(row.mechanic_name),
          recorded_at: this.toDate(row.mechanic_completed_at || row.execution_completed_at),
          signatures: mechanicSignatures,
          evidence_only: true,
        },
        engineer_signoff_support: {
          recorded_name: this.normalizeString(row.engineer_name),
          recorded_at: this.toDate(row.engineer_certified_at || row.execution_certified_at),
          signatures: engineerSignatures,
          evidence_only: true,
        },
      };
    });

    const snags: PrintableWorkpackSnagSnapshot[] = snagRows.map((row) => ({
      snag: {
        id: row.snag_id,
        snag_no: this.toNumber(row.snag_no),
        status_code: this.normalizeString(row.status),
        category: this.normalizeString(row.category),
        priority: this.normalizeString(row.priority),
      },
      reference: {
        workpack_reference: cover.workpack.work_order_number,
        aircraft_registration: cover.aircraft.registration,
        aircraft_serial_number: cover.aircraft.serial_number,
        aircraft_model: cover.aircraft.model_name,
        component_serial_number: this.normalizeString(row.component_serial_number),
        component_position_code: this.normalizeString(row.component_position_code),
      },
      description: {
        defect_text: this.normalizeString(this.cleanText(row.defect_text)),
        detail_text: this.normalizeString(this.cleanText(row.description)),
      },
      resolution: {
        stored_text: this.normalizeString(this.cleanText(row.resolution_notes)),
        parts_used: this.normalizeString(row.parts_used),
        time_spent_minutes: this.toNumber(row.time_spent_minutes),
        handwritten_reconciliation_required: true,
      },
      lifecycle: {
        created_at: this.toDate(row.created_at),
        started_at: this.toDate(row.started_at),
        resolved_at: this.toDate(row.resolved_at),
        closed_at: this.toDate(row.closed_at),
      },
      responsibility: {
        created_by_name: this.normalizeString(row.created_by_name),
        assigned_to_name: this.normalizeString(row.assigned_to_name),
        started_by_name: this.normalizeString(row.started_by_name),
        resolved_by_name: this.normalizeString(row.resolved_by_name),
        closed_by_name: this.normalizeString(row.closed_by_name),
      },
    }));

    return {
      snapshot: {
        section: 'TASK_BODY',
        generated_at: new Date(),
        source_of_truth: 'JUPITER_DATABASE',
        artifact_role: 'DOWNSTREAM_PRINTABLE_WORKPACK',
        snapshot_strategy: 'READ_ONLY_RENDER_SNAPSHOT',
      },
      authority: {
        lifecycle_authority: 'JUPITER',
        certification_authority: 'JUPITER',
        audit_authority: 'JUPITER',
        workflow_mutation_permitted: false,
        rendering_included: false,
      },
      workpack: {
        id: cover.workpack.id,
        work_order_number: cover.workpack.work_order_number,
        status_code: cover.workpack.status_code,
        aircraft_registration: cover.aircraft.registration,
        aircraft_serial_number: cover.aircraft.serial_number,
        aircraft_model: cover.aircraft.model_name,
      },
      tasks,
      snags,
    };
  }
}
