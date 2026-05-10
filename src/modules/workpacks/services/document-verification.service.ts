import { CrsDataService } from './crs-data.service.js';
import { CrmaDataService } from './crma-data.service.js';

export class DocumentVerificationError extends Error {
  issues: string[];

  constructor(message: string, issues: string[]) {
    super(message);
    this.name = 'DocumentVerificationError';
    this.issues = issues;
  }
}

export class DocumentVerificationService {
  private static requireValue(
    issues: string[],
    value: unknown,
    message: string
  ) {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        issues.push(message);
      }
      return;
    }

    if (typeof value === 'string') {
      if (!value.trim()) {
        issues.push(message);
      }
      return;
    }

    if (value === null || value === undefined) {
      issues.push(message);
    }
  }

  static async verifyCrsDocument(workpackId: string) {
    const validation = await CrsDataService.validateCrsGeneration(workpackId);
    if (!validation.valid) {
      return {
        valid: false,
        issues: (validation.issues || []).map((issue) => issue.message).filter(Boolean),
        data: null,
      };
    }

    const data = await CrsDataService.getCrsDataForWorkpack(workpackId);
    const issues: string[] = [];

    this.requireValue(issues, data.workpack.work_order_number, 'CRS is missing the workpack reference.');
    this.requireValue(issues, data.aircraft.registration, 'CRS is missing aircraft registration.');
    this.requireValue(issues, data.aircraft.model, 'CRS is missing aircraft model.');
    this.requireValue(issues, data.certification.engineer_name, 'CRS is missing certifying engineer details.');
    this.requireValue(issues, data.certification.certified_at, 'CRS is missing certification date.');

    if (!Array.isArray(data.work_summary) || data.work_summary.length === 0) {
      issues.push('CRS requires at least one certified task in the work performed summary.');
    }

    for (const item of data.work_summary || []) {
      this.requireValue(
        issues,
        item.title,
        `CRS task ${item.task_card_number || item.task_id} is missing its title.`
      );

      if (!String(item.work_performed || '').trim()) {
        issues.push(
          `CRS task ${item.task_card_number || item.task_id} is missing work performed text.`
        );
      }
    }

    if (issues.length > 0) {
      return { valid: false, issues, data: null };
    }

    return { valid: true, issues: [], data };
  }

  static async verifyCrmaDocument(workpackId: string, taskIds: string[] = []) {
    const data = await CrmaDataService.getCrmaDataForWorkpack(workpackId, taskIds);
    const issues: string[] = [];

    this.requireValue(issues, data.workpack.work_order_number, 'CRMA is missing the workpack reference.');
    this.requireValue(issues, data.aircraft.registration, 'CRMA is missing aircraft registration.');
    this.requireValue(issues, data.aircraft.model, 'CRMA is missing aircraft model.');

    if (!Array.isArray(data.tasks) || data.tasks.length === 0) {
      issues.push('CRMA requires at least one certified task in scope.');
    }

    for (const item of data.tasks || []) {
      if (!['CERTIFIED_BY_ENGINEER', 'LOCKED'].includes(String(item.status || '').trim())) {
        issues.push(
          `CRMA task ${item.task_card_number || item.task_id} is not CERTIFIED_BY_ENGINEER or LOCKED.`
        );
      }

      this.requireValue(
        issues,
        item.title,
        `CRMA task ${item.task_card_number || item.task_id} is missing its title.`
      );
      this.requireValue(
        issues,
        item.engineer_name,
        `CRMA task ${item.task_card_number || item.task_id} is missing certifying engineer details.`
      );
      this.requireValue(
        issues,
        item.certified_at,
        `CRMA task ${item.task_card_number || item.task_id} is missing certification timestamp.`
      );

      if (!String(item.work_performed || '').trim()) {
        issues.push(
          `CRMA task ${item.task_card_number || item.task_id} is missing work performed text.`
        );
      }
    }

    this.requireValue(
      issues,
      data.certification.latest_certified_at,
      'CRMA is missing certification timing for the selected scope.'
    );

    if ((data.missing_task_ids || []).length > 0) {
      issues.push('One or more requested CRMA task IDs are missing from the selected workpack scope.');
    }

    if ((data.ineligible_task_ids || []).length > 0) {
      issues.push('One or more requested CRMA tasks are not CERTIFIED_BY_ENGINEER or LOCKED.');
    }

    if (issues.length > 0) {
      return { valid: false, issues, data: null };
    }

    return { valid: true, issues: [], data };
  }

  static assertVerified<T extends { valid: boolean; issues: string[]; data: any }>(result: T) {
    if (!result.valid || !result.data) {
      throw new DocumentVerificationError('DOCUMENT_VERIFICATION_FAILED', result.issues || []);
    }

    return result.data;
  }
}
