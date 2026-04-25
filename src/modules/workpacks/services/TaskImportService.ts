import { parse } from 'csv-parse/sync';
import { TaskTemplate, sequelize } from '../../../models/index.js';

export class TaskImportService {
  private static taskTemplateColumnsPromise: Promise<Set<string>> | null = null;

  private static async getTaskTemplateColumns(): Promise<Set<string>> {
    if (!this.taskTemplateColumnsPromise) {
      this.taskTemplateColumnsPromise = sequelize
        .getQueryInterface()
        .describeTable('task_templates')
        .then((definition) => new Set(Object.keys(definition)))
        .catch(() => new Set<string>());
    }

    return this.taskTemplateColumnsPromise;
  }

  /**
   * Imports standard MPI tasks from a CSV buffer.
   * Updates existing global templates by task number and creates missing ones.
   */
  static async importStandardMpiTasks(buffer: Buffer): Promise<number> {
    const records = parse(buffer, {
      // Normalizes headers by trimming spaces and converting to lowercase
      columns: (header) => header.map((h: string) => h.trim().toLowerCase().replace(/^"|"$/g, '')),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    }) as Array<Record<string, unknown>>;

    let importedCount = 0;
    const availableColumns = await this.getTaskTemplateColumns();

    for (const record of records) {
      // 1. Mandatory field check
      if (!record.task_card_number || !record.title) {
        console.warn(`[Import] Skipping row: Missing title or task_card_number.`);
        continue;
      }

      const cleanDescription = String(record.description || '').trim();

      const isTrue = (val: any) => {
        const v = String(val || '').trim().toUpperCase();
        return v === 'TRUE' || v === 'Y' || v === 'YES';
      };

      const taskCardNumber = String(record.task_card_number).trim();
      const payload = {
        scope: 'GLOBAL' as const,
        task_card_number: taskCardNumber,
        sort_order: parseFloat(String(record.sort_order || '0')) || 0,
        title: String(record.title).trim(),
        description: cleanDescription,
        is_active: true,
        ...(availableColumns.has('is_required_for_wood')
          ? { is_required_for_wood: isTrue(record.is_required_for_wood) }
          : {}),
        ...(availableColumns.has('is_required_for_fabric')
          ? { is_required_for_fabric: isTrue(record.is_required_for_fabric) }
          : {}),
        ...(availableColumns.has('is_required_for_bungees')
          ? { is_required_for_bungees: isTrue(record.is_required_for_bungees) }
          : {}),
        ...(availableColumns.has('is_required_for_woodprop')
          ? { is_required_for_woodprop: isTrue(record.is_required_for_woodprop) }
          : {}),
        ...(availableColumns.has('is_required_for_retractable')
          ? { is_required_for_retractable: isTrue(record.is_required_for_retractable) }
          : {}),
      };

      const existingTask = await TaskTemplate.findOne({
        where: {
          scope: 'GLOBAL',
          task_card_number: taskCardNumber,
        },
      });

      if (existingTask) {
        await existingTask.update(payload);
      } else {
        await TaskTemplate.create(payload);
      }

      console.log(`[Import] Upserted task template ${taskCardNumber}`);

      // 3. Count processed rows
      importedCount++;
    }

    return importedCount;
  }
}
