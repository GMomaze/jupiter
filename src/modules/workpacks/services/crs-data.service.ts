import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../models/index.js';
import { ComplianceService } from '../../compliance/compliance.service.js';

type WorkpackCrsRow = {
  workpack_id: string;
  work_order_number: string;
  opened_at: Date | string | null;
  certified_at: Date | string | null;
  certified_by: string | null;
  registration: string;
  serial_number: string | null;
  aircraft_model: string | null;
  certifier_name: string | null;
};

type WorkSummaryRow = {
  task_id: string;
  task_card_number: string | null;
  title: string;
  work_performed: string | null;
  status: string;
  engineer_certified_at: Date | string | null;
};

type MeasurementRow = {
  task_id: string;
  field_key: string | null;
  field_label: string | null;
  position: number | null;
  value: string | null;
};

type WorkpackValidationRow = {
  workpack_id: string;
  status_code: string | null;
  certified_by: string | null;
  certified_at: Date | string | null;
  registration: string | null;
  serial_number: string | null;
  aircraft_model: string | null;
};

type ValidationStatusCountRow = {
  status: string;
  count: string | number;
};

type ValidationComplianceRow = {
  item_type: 'AD' | 'SB';
  code: string;
  title: string;
};

type ValidationSnagCountRow = {
  count: string | number;
};

type CrsValidationIssue = {
  code: string;
  message: string;
};

export class CrsDataService {
  private static readonly organization = {
    name: 'WHIP-AIR Aviation',
    amo_number: 'AMO 1386',
    contact_details: {
      address_lines: ['Hangar 1', 'Diemerskraal,', 'R45,', 'Wellington.'],
      phone: '083 458 4854',
      email: 'admin@whip-air.com',
    },
  };

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

  private static toCount(value: string | number | null | undefined) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private static pluralize(count: number, singular: string, plural?: string) {
    return `${count} ${count === 1 ? singular : plural || `${singular}s`}`;
  }

  private static summarizeTaskStatus(status: string, count: number) {
    switch (status) {
      case 'OPEN':
        return `${this.pluralize(count, 'task')} ${count === 1 ? 'is' : 'are'} still OPEN`;
      case 'IN_PROGRESS':
        return `${this.pluralize(count, 'task')} ${count === 1 ? 'is' : 'are'} still IN_PROGRESS`;
      case 'COMPLETED_BY_MECHANIC':
        return `${this.pluralize(count, 'task')} ${count === 1 ? 'is' : 'are'} still awaiting engineer certification`;
      default:
        return `${this.pluralize(count, 'task')} ${count === 1 ? 'is' : 'are'} not release-ready (${status})`;
    }
  }

  static async getCrsDataForWorkpack(workpackId: string, transaction?: any) {
    const workpackRows = await sequelize.query<WorkpackCrsRow>(
      `
      SELECT
        w.id AS workpack_id,
        w.work_order_number,
        w.created_at AS opened_at,
        w.certified_at,
        w.certified_by,
        a.registration,
        a.serial_number,
        cm.model_name AS aircraft_model,
        u.full_name AS certifier_name
      FROM workpacks w
      JOIN aircraft a
        ON a.id = w.aircraft_id
      LEFT JOIN component_models cm
        ON cm.id = a.model_id
      LEFT JOIN users u
        ON u.id = w.certified_by
      WHERE w.id = :workpackId
      LIMIT 1
      `,
      {
        replacements: { workpackId },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    const workpack = workpackRows[0];

    if (!workpack) {
      throw new Error('WORKPACK_NOT_FOUND');
    }

    const workSummaryRows = await sequelize.query<WorkSummaryRow>(
      `
      SELECT
        t.id AS task_id,
        t.task_card_number,
        t.title,
        t.work_performed,
        t.status,
        t.engineer_certified_at
      FROM task_cards t
      JOIN workpack_tasks wt
        ON wt.task_id = t.id
      WHERE wt.workpack_id = :workpackId
        AND t.status IN ('CERTIFIED_BY_ENGINEER', 'LOCKED')
      ORDER BY t.task_card_number ASC NULLS LAST, t.created_at ASC
      `,
      {
        replacements: { workpackId },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    const measurementRows = await sequelize.query<MeasurementRow>(
      `
      SELECT
        we.task_id,
        wm.field_key,
        wm.field_label,
        wm.position,
        wm.value
      FROM workpack_executions we
      JOIN workpack_measurements wm
        ON wm.execution_id = we.id
      WHERE we.workpack_id = :workpackId
        AND we.attempt_no = (
          SELECT MAX(we2.attempt_no)
          FROM workpack_executions we2
          WHERE we2.workpack_id = we.workpack_id
            AND we2.task_id = we.task_id
        )
      ORDER BY we.task_id ASC, wm.position ASC, wm.created_at ASC
      `,
      {
        replacements: { workpackId },
        type: QueryTypes.SELECT,
        transaction,
      }
    ).catch(() => []);

    const compliance = await ComplianceService.getComplianceSummaryForWorkpack(
      workpackId,
      transaction
    );

    const measurementsByTaskId = new Map<string, Array<{
      field_key: string | null;
      field_label: string | null;
      position: number | null;
      value: string | null;
    }>>();

    for (const row of measurementRows) {
      const existing = measurementsByTaskId.get(row.task_id) || [];
      existing.push({
        field_key: row.field_key,
        field_label: row.field_label,
        position: row.position,
        value: row.value,
      });
      measurementsByTaskId.set(row.task_id, existing);
    }

    return {
      aircraft: {
        registration: workpack.registration,
        serial_number: workpack.serial_number,
        model: workpack.aircraft_model,
      },
      workpack: {
        id: workpack.workpack_id,
        work_order_number: workpack.work_order_number,
        opened_at: this.toDate(workpack.opened_at),
        closed_at: this.toDate(workpack.certified_at),
        certified_at: this.toDate(workpack.certified_at),
      },
      work_summary: workSummaryRows.map((row) => ({
        task_id: row.task_id,
        task_card_number: row.task_card_number,
        title: row.title,
        work_performed: this.cleanText(row.work_performed),
        status: row.status,
        certified_at: this.toDate(row.engineer_certified_at),
        measurements: measurementsByTaskId.get(row.task_id) || [],
      })),
      compliance,
      certification: {
        engineer_name: workpack.certifier_name,
        licence_number: workpack.certified_by,
        certified_at: this.toDate(workpack.certified_at),
        organisation: this.organization,
      },
    };
  }

  static async validateCrsGeneration(workpackId: string, transaction?: any) {
    const errors: string[] = [];
    const issues: CrsValidationIssue[] = [];

    const validationRows = await sequelize.query<WorkpackValidationRow>(
      `
      SELECT
        w.id AS workpack_id,
        s.code AS status_code,
        w.certified_by,
        w.certified_at,
        a.registration,
        a.serial_number,
        cm.model_name AS aircraft_model
      FROM workpacks w
      LEFT JOIN rf_workpack_status s
        ON s.id = w.status_id
      LEFT JOIN aircraft a
        ON a.id = w.aircraft_id
      LEFT JOIN component_models cm
        ON cm.id = a.model_id
      WHERE w.id = :workpackId
      LIMIT 1
      `,
      {
        replacements: { workpackId },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    const workpack = validationRows[0];

    if (!workpack) {
      return {
        valid: false,
        errors: ['WORKPACK_NOT_FOUND'],
        issues: [
          {
            code: 'WORKPACK_NOT_FOUND',
            message: 'Workpack was not found',
          },
        ],
      };
    }

    if (workpack.status_code !== 'CERTIFIED') {
      errors.push('WORKPACK_STATUS_NOT_CERTIFIED');
      issues.push({
        code: 'WORKPACK_STATUS_NOT_CERTIFIED',
        message: 'Workpack is not CERTIFIED',
      });
    }

    if (!workpack.certified_by) {
      errors.push('WORKPACK_CERTIFIED_BY_MISSING');
      issues.push({
        code: 'WORKPACK_CERTIFIED_BY_MISSING',
        message: 'Certification record is missing certified_by',
      });
    }

    if (!this.toDate(workpack.certified_at)) {
      errors.push('WORKPACK_CERTIFIED_AT_MISSING');
      issues.push({
        code: 'WORKPACK_CERTIFIED_AT_MISSING',
        message: 'Certification record is missing certified_at',
      });
    }

    if (!String(workpack.registration || '').trim()) {
      errors.push('WORKPACK_AIRCRAFT_REGISTRATION_MISSING');
      issues.push({
        code: 'WORKPACK_AIRCRAFT_REGISTRATION_MISSING',
        message: 'Aircraft registration is missing',
      });
    }

    if (!String(workpack.aircraft_model || '').trim()) {
      errors.push('WORKPACK_AIRCRAFT_MODEL_MISSING');
      issues.push({
        code: 'WORKPACK_AIRCRAFT_MODEL_MISSING',
        message: 'Aircraft type/model is missing',
      });
    }

    const invalidTaskRows = await sequelize.query<ValidationStatusCountRow>(
      `
      SELECT
        t.status,
        COUNT(*) AS count
      FROM task_cards t
      JOIN workpack_tasks wt
        ON wt.task_id = t.id
      WHERE wt.workpack_id = :workpackId
        AND t.status NOT IN ('CERTIFIED_BY_ENGINEER', 'LOCKED')
      GROUP BY t.status
      ORDER BY t.status ASC
      `,
      {
        replacements: { workpackId },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    if (invalidTaskRows.length > 0) {
      errors.push('WORKPACK_HAS_UNCERTIFIED_TASKS');
      invalidTaskRows.forEach((row) => {
        issues.push({
          code: 'WORKPACK_HAS_UNCERTIFIED_TASKS',
          message: this.summarizeTaskStatus(row.status, this.toCount(row.count)),
        });
      });
    }

    const incompleteComplianceRows = await sequelize.query<ValidationComplianceRow>(
      `
      SELECT
        ci.item_type,
        ci.code,
        ci.title
      FROM workpack_compliance
      JOIN compliance_items ci
        ON ci.id = workpack_compliance.compliance_item_id
      WHERE workpack_id = :workpackId
        AND status != 'COMPLETED'
      ORDER BY ci.item_type ASC, ci.code ASC
      `,
      {
        replacements: { workpackId },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    if (incompleteComplianceRows.length > 0) {
      errors.push('WORKPACK_HAS_INCOMPLETE_COMPLIANCE');
      incompleteComplianceRows.forEach((row) => {
        issues.push({
          code: 'WORKPACK_HAS_INCOMPLETE_COMPLIANCE',
          message: `Compliance item ${row.item_type} ${row.code} is not COMPLETED`,
        });
      });
    }

    const openSnagRows = await sequelize.query<ValidationSnagCountRow>(
      `
      SELECT COUNT(*) AS count
      FROM workpack_snags
      WHERE workpack_id = :workpackId
        AND status != 'CLOSED'
      `,
      {
        replacements: { workpackId },
        type: QueryTypes.SELECT,
        transaction,
      }
    );

    const openSnagCount = this.toCount(openSnagRows[0]?.count);

    if (openSnagCount > 0) {
      errors.push('WORKPACK_HAS_OPEN_SNAGS');
      issues.push({
        code: 'WORKPACK_HAS_OPEN_SNAGS',
        message: `${this.pluralize(openSnagCount, 'snag')} ${openSnagCount === 1 ? 'is' : 'are'} not CLOSED`,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      issues,
    };
  }

  static async assertCrsGenerationAllowed(workpackId: string, transaction?: any) {
    const validation = await this.validateCrsGeneration(workpackId, transaction);

    if (!validation.valid) {
      throw new Error(validation.errors[0] || 'WORKPACK_CRS_VALIDATION_FAILED');
    }
  }
}
