import { parse } from 'csv-parse/sync';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../models/index.js';

export class TaskImportService {
  private static taskTemplateColumnsPromise: Promise<Set<string>> | null = null;
  private static readonly requiredHeaders = [
    'task_card_number',
    'title',
    'description',
    'is_required_for_wood',
    'is_required_for_fabric',
    'is_required_for_bungees',
    'is_required_for_woodprop',
  ] as const;

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

  private static parseBoolean(value: unknown, defaultValue: boolean) {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return defaultValue;
    }

    const normalized = raw.toLowerCase();
    if (['true', '1', 'y', 'yes'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'n', 'no'].includes(normalized)) {
      return false;
    }

    return defaultValue;
  }

  private static assertRequiredHeaders(records: Array<Record<string, unknown>>) {
    const headers = new Set<string>();
    records.forEach((record) => {
      Object.keys(record).forEach((key) => headers.add(key));
    });

    const missing = this.requiredHeaders.filter((header) => !headers.has(header));
    if (missing.length > 0) {
      throw new Error(`MPI checklist CSV is missing required columns: ${missing.join(', ')}`);
    }
  }

  /**
   * Imports standard MPI tasks from a CSV buffer.
   * Updates existing global templates by task number and creates missing ones.
   */
  static async importStandardMpiTasks(buffer: Buffer): Promise<number> {
    const records = parse(buffer, {
      columns: (header) => header.map((h: string) => h.trim().toLowerCase().replace(/^"|"$/g, '')),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    }) as Array<Record<string, unknown>>;

    this.assertRequiredHeaders(records);

    const availableColumns = await this.getTaskTemplateColumns();
    const requiredColumns = [
      'task_card_number',
      'title',
      'description',
      'is_required_for_wood',
      'is_required_for_fabric',
      'is_required_for_bungees',
      'is_required_for_woodprop',
    ];
    const missingColumns = requiredColumns.filter((column) => !availableColumns.has(column));

    if (missingColumns.length > 0) {
      throw new Error(`task_templates is missing required legacy MPI columns: ${missingColumns.join(', ')}`);
    }

    const transaction = await sequelize.transaction();

    try {
      let importedCount = 0;

      for (let index = 0; index < records.length; index++) {
        const record = records[index];
        const rowNumber = index + 2;
        const taskCardNumber = String(record.task_card_number || '').trim();
        const title = String(record.title || '').trim();
        const description = String(record.description || '').trim();
        const sortOrderRaw = String(record.sort_order || '').trim();

        if (!taskCardNumber) {
          throw new Error(`MPI checklist import failed at row ${rowNumber}: task_card_number is required.`);
        }

        if (!title) {
          throw new Error(`MPI checklist import failed at row ${rowNumber}: title is required.`);
        }

        const sortOrder = sortOrderRaw && !Number.isNaN(Number(sortOrderRaw))
          ? Number(sortOrderRaw)
          : importedCount + 1;

        const payload = {
          scope: 'GLOBAL',
          task_card_number: taskCardNumber,
          sort_order: sortOrder,
          title,
          description,
          is_active: true,
          is_required_for_wood: this.parseBoolean(record.is_required_for_wood, false),
          is_required_for_fabric: this.parseBoolean(record.is_required_for_fabric, false),
          is_required_for_bungees: this.parseBoolean(record.is_required_for_bungees, false),
          is_required_for_woodprop: this.parseBoolean(record.is_required_for_woodprop, false),
          is_required_for_retractable: false,
        };

        const existingTaskRows = await sequelize.query<{ id: string }>(
          `
          SELECT id
          FROM task_templates
          WHERE scope = 'GLOBAL'
            AND task_card_number = :taskCardNumber
          LIMIT 1
          `,
          {
            replacements: { taskCardNumber },
            type: QueryTypes.SELECT,
            transaction,
          }
        );

        const existingTask = existingTaskRows[0];

        if (existingTask) {
          await sequelize.query(
            `
            UPDATE task_templates
            SET
              scope = :scope,
              task_card_number = :task_card_number,
              sort_order = :sort_order,
              title = :title,
              description = :description,
              is_active = :is_active,
              is_required_for_wood = :is_required_for_wood,
              is_required_for_fabric = :is_required_for_fabric,
              is_required_for_bungees = :is_required_for_bungees,
              is_required_for_woodprop = :is_required_for_woodprop,
              is_required_for_retractable = :is_required_for_retractable,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = :id
            `,
            {
              replacements: {
                id: existingTask.id,
                ...payload,
              },
              transaction,
            }
          );
        } else {
          await sequelize.query(
            `
            INSERT INTO task_templates (
              id,
              task_card_number,
              sort_order,
              scope,
              title,
              description,
              is_active,
              is_required_for_wood,
              is_required_for_fabric,
              is_required_for_bungees,
              is_required_for_woodprop,
              is_required_for_retractable,
              created_at,
              updated_at
            )
            VALUES (
              gen_random_uuid(),
              :task_card_number,
              :sort_order,
              :scope,
              :title,
              :description,
              :is_active,
              :is_required_for_wood,
              :is_required_for_fabric,
              :is_required_for_bungees,
              :is_required_for_woodprop,
              :is_required_for_retractable,
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )
            `,
            {
              replacements: payload,
              transaction,
            }
          );
        }

        importedCount++;
      }

      await transaction.commit();
      return importedCount;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
