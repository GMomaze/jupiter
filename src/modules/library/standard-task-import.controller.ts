import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { parse } from 'csv-parse/sync';
import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import { TaskTemplate } from '../../models/core/TaskTemplate.js';

const TARGET_FIELDS = [
  { key: 'title', required: true },
  { key: 'description', required: true },
  { key: 'source_type', required: true },
  { key: 'interval_hours', required: false },
  { key: 'interval_months', required: false },
  { key: 'model_applicability', required: false },
  { key: 'aircraft_applicability', required: false },
  { key: 'is_active', required: false },
] as const;

type TargetField = (typeof TARGET_FIELDS)[number]['key'];

type PreviewRowValues = {
  title: string;
  description: string;
  source_type: string;
  interval_hours: number | null;
  interval_months: number | null;
  model_applicability: string;
  aircraft_applicability: string;
  is_active: boolean | null;
};

type PreviewRow = {
  rowNumber: number;
  status: 'VALID' | 'INVALID';
  values: PreviewRowValues;
  errors: string[];
};

type PreviewResult = {
  totalRows: number;
  validRowCount: number;
  invalidRowCount: number;
  unknownColumns: string[];
  unmappedOptionalFields: TargetField[];
  mapping: Record<TargetField, string>;
  rows: PreviewRow[];
};

type CommitRowResult = {
  rowNumber: number;
  status: 'INSERTED' | 'SKIPPED - INVALID' | 'SKIPPED - DUPLICATE';
  reason: string;
  values: PreviewRowValues;
};

type CommitResult = {
  totalRowsProcessed: number;
  totalValidRows: number;
  totalInserted: number;
  totalSkippedInvalid: number;
  totalSkippedDuplicate: number;
  rows: CommitRowResult[];
};

type CsvHeaderDetection = {
  headers: string[];
  suggestedMapping: Record<TargetField, string>;
  unknownColumns: string[];
};

const REQUIRED_TARGET_FIELDS = TARGET_FIELDS.filter((field) => field.required).map(
  (field) => field.key
);
const OPTIONAL_TARGET_FIELDS = TARGET_FIELDS.filter((field) => !field.required).map(
  (field) => field.key
);
const ALL_TARGET_FIELD_KEYS = TARGET_FIELDS.map((field) => field.key);
const BOOLEAN_TRUE_VALUES = new Set(['true', '1', 'yes', 'y', 'on']);
const BOOLEAN_FALSE_VALUES = new Set(['false', '0', 'no', 'n', 'off']);

function normalizeHeader(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^"|"$/g, '')
    .replace(/\s+/g, '_');
}

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function createEmptyPreviewValues(): PreviewRowValues {
  return {
    title: '',
    description: '',
    source_type: '',
    interval_hours: null,
    interval_months: null,
    model_applicability: '',
    aircraft_applicability: '',
    is_active: null,
  };
}

function parseOptionalNumber(
  value: unknown,
  fieldLabel: string,
  errors: string[]
) {
  const normalized = normalizeString(value);

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    errors.push(`${fieldLabel} must be numeric if provided.`);
    return null;
  }

  return parsed;
}

function parseOptionalBoolean(value: unknown, errors: string[]) {
  const normalized = normalizeString(value).toLowerCase();

  if (!normalized) {
    return null;
  }

  if (BOOLEAN_TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (BOOLEAN_FALSE_VALUES.has(normalized)) {
    return false;
  }

  errors.push('is_active must resolve to boolean if provided.');
  return null;
}

function parseCsvMatrix(buffer: Buffer) {
  return parse(buffer, {
    bom: true,
    trim: true,
    relax_column_count: true,
    skip_empty_lines: false,
  }) as string[][];
}

function mapMatrixToRecords(headers: string[], rows: string[][]) {
  return rows.map((row) => {
    const record: Record<string, unknown> = {};

    headers.forEach((header, index) => {
      record[header] = row[index] ?? '';
    });

    return record;
  });
}

function isEmptyRecord(record: Record<string, unknown>) {
  return Object.values(record).every((value) => !normalizeString(value));
}

function normalizeMappingInput(value: unknown) {
  const normalized = normalizeHeader(value);
  return normalized || '';
}

function createEmptyMapping() {
  return Object.fromEntries(
    ALL_TARGET_FIELD_KEYS.map((key) => [key, ''])
  ) as Record<TargetField, string>;
}

function decodeCsvPayload(payload: string) {
  return Buffer.from(payload, 'base64');
}

function encodeCsvPayload(buffer: Buffer) {
  return buffer.toString('base64');
}

function getTargetFieldLabel(field: TargetField) {
  return field.replace(/_/g, ' ');
}

function normalizeStoredText(value: string) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function normalizeStoredSourceType(value: string) {
  const normalized = normalizeString(value).toUpperCase();
  return normalized || null;
}

function buildDuplicateKey(values: PreviewRowValues) {
  return [
    normalizeString(values.title),
    normalizeString(values.source_type).toUpperCase(),
    normalizeString(values.model_applicability),
    normalizeString(values.aircraft_applicability),
  ].join('\u001f');
}

function buildGeneratedTaskCardNumber(rowNumber: number) {
  return `STD-IMPORT-${Date.now()}-${rowNumber}-${randomUUID()
    .slice(0, 8)
    .toUpperCase()}`;
}

async function hasExistingTaskTemplateDuplicate(
  values: PreviewRowValues,
  transaction: any
) {
  const matches = await sequelize.query<{ id: string }>(
    `
    SELECT id
    FROM task_templates
    WHERE title = :title
      AND COALESCE(source_type, '') = :source_type
      AND COALESCE(model_applicability, '') = :model_applicability
      AND COALESCE(aircraft_applicability, '') = :aircraft_applicability
    LIMIT 1
    `,
    {
      replacements: {
        title: normalizeString(values.title),
        source_type: normalizeStoredSourceType(values.source_type) || '',
        model_applicability: normalizeStoredText(values.model_applicability) || '',
        aircraft_applicability:
          normalizeStoredText(values.aircraft_applicability) || '',
      },
      type: QueryTypes.SELECT,
      transaction,
    }
  );

  return matches.length > 0;
}

async function commitStandardTaskPreview(preview: PreviewResult) {
  const duplicateKeysInBatch = new Set<string>();

  return sequelize.transaction(async (transaction) => {
    const rows: CommitRowResult[] = [];
    let totalInserted = 0;
    let totalSkippedDuplicate = 0;

    for (const row of preview.rows) {
      if (row.status === 'INVALID') {
        rows.push({
          rowNumber: row.rowNumber,
          status: 'SKIPPED - INVALID',
          reason: row.errors.join(' '),
          values: row.values,
        });
        continue;
      }

      const duplicateKey = buildDuplicateKey(row.values);

      if (duplicateKeysInBatch.has(duplicateKey)) {
        totalSkippedDuplicate += 1;
        rows.push({
          rowNumber: row.rowNumber,
          status: 'SKIPPED - DUPLICATE',
          reason: 'Duplicate detected in this import batch.',
          values: row.values,
        });
        continue;
      }

      if (await hasExistingTaskTemplateDuplicate(row.values, transaction)) {
        totalSkippedDuplicate += 1;
        rows.push({
          rowNumber: row.rowNumber,
          status: 'SKIPPED - DUPLICATE',
          reason: 'Duplicate already exists in task_templates.',
          values: row.values,
        });
        duplicateKeysInBatch.add(duplicateKey);
        continue;
      }

      await TaskTemplate.create(
        {
          task_card_number: buildGeneratedTaskCardNumber(row.rowNumber),
          scope: 'GLOBAL',
          sort_order: 0,
          title: normalizeString(row.values.title),
          description: normalizeString(row.values.description),
          source_type: normalizeStoredSourceType(row.values.source_type),
          interval_hours: row.values.interval_hours,
          interval_months: row.values.interval_months,
          model_applicability: normalizeStoredText(
            row.values.model_applicability
          ),
          aircraft_applicability: normalizeStoredText(
            row.values.aircraft_applicability
          ),
          is_active: row.values.is_active ?? true,
        } as any,
        { transaction }
      );

      duplicateKeysInBatch.add(duplicateKey);
      totalInserted += 1;
      rows.push({
        rowNumber: row.rowNumber,
        status: 'INSERTED',
        reason: 'Inserted into task_templates.',
        values: row.values,
      });
    }

    return {
      totalRowsProcessed: preview.totalRows,
      totalValidRows: preview.validRowCount,
      totalInserted,
      totalSkippedInvalid: preview.invalidRowCount,
      totalSkippedDuplicate,
      rows,
    } satisfies CommitResult;
  });
}

function validateMapping(
  mapping: Record<TargetField, string>,
  headers: string[]
) {
  const errors: string[] = [];
  const seenHeaders = new Map<string, TargetField>();

  REQUIRED_TARGET_FIELDS.forEach((field) => {
    if (!mapping[field]) {
      errors.push(`${getTargetFieldLabel(field)} must be mapped before preview.`);
    }
  });

  ALL_TARGET_FIELD_KEYS.forEach((field) => {
    const header = mapping[field];
    if (!header) {
      return;
    }

    if (!headers.includes(header)) {
      errors.push(
        `${getTargetFieldLabel(field)} is mapped to an unknown CSV header.`
      );
      return;
    }

    const existingField = seenHeaders.get(header);
    if (existingField) {
      errors.push(
        `CSV column "${header}" cannot be mapped to both ${getTargetFieldLabel(existingField)} and ${getTargetFieldLabel(field)}.`
      );
      return;
    }

    seenHeaders.set(header, field);
  });

  return errors;
}

export function detectStandardTaskCsvHeaders(buffer: Buffer): CsvHeaderDetection {
  const matrix = parseCsvMatrix(buffer);
  const rawHeaders = matrix[0] || [];
  const headers = rawHeaders
    .map(normalizeHeader)
    .filter((header, index, values) => header && values.indexOf(header) === index);

  const suggestedMapping = createEmptyMapping();

  ALL_TARGET_FIELD_KEYS.forEach((field) => {
    if (headers.includes(field)) {
      suggestedMapping[field] = field;
    }
  });

  const mappedHeaders = new Set(Object.values(suggestedMapping).filter(Boolean));
  const unknownColumns = headers.filter((header) => !mappedHeaders.has(header));

  return {
    headers,
    suggestedMapping,
    unknownColumns,
  };
}

export function previewMappedStandardTaskCsv(
  buffer: Buffer,
  mappingInput: Partial<Record<TargetField, string>>
): PreviewResult {
  const { headers } = detectStandardTaskCsvHeaders(buffer);
  const mapping = createEmptyMapping();

  ALL_TARGET_FIELD_KEYS.forEach((field) => {
    mapping[field] = normalizeMappingInput(mappingInput[field]);
  });

  const mappingErrors = validateMapping(mapping, headers);
  const matrix = parseCsvMatrix(buffer);
  const records = mapMatrixToRecords(headers, matrix.slice(1));
  const rows: PreviewRow[] = [];

  records.forEach((record, index) => {
    if (isEmptyRecord(record)) {
      return;
    }

    const errors = [...mappingErrors];
    const values = createEmptyPreviewValues();

    ALL_TARGET_FIELD_KEYS.forEach((field) => {
      const header = mapping[field];
      const rawValue = header ? record[header] : '';

      switch (field) {
        case 'title':
        case 'description':
        case 'source_type':
        case 'model_applicability':
        case 'aircraft_applicability':
          values[field] = normalizeString(rawValue);
          break;
        case 'interval_hours':
          values.interval_hours = parseOptionalNumber(
            rawValue,
            'interval_hours',
            errors
          );
          break;
        case 'interval_months':
          values.interval_months = parseOptionalNumber(
            rawValue,
            'interval_months',
            errors
          );
          break;
        case 'is_active':
          values.is_active = parseOptionalBoolean(rawValue, errors);
          break;
      }
    });

    if (!values.title) {
      errors.push('title is required.');
    }

    if (!values.description) {
      errors.push('description is required.');
    }

    if (!values.source_type) {
      errors.push('source_type is required.');
    }

    rows.push({
      rowNumber: index + 2,
      status: errors.length > 0 ? 'INVALID' : 'VALID',
      values,
      errors,
    });
  });

  const mappedHeaders = new Set(Object.values(mapping).filter(Boolean));
  const invalidRowCount = rows.filter((row) => row.status === 'INVALID').length;

  return {
    totalRows: rows.length,
    validRowCount: rows.length - invalidRowCount,
    invalidRowCount,
    unknownColumns: headers.filter((header) => !mappedHeaders.has(header)),
    unmappedOptionalFields: OPTIONAL_TARGET_FIELDS.filter(
      (field) => !mapping[field]
    ),
    mapping,
    rows,
  };
}

export class StandardTaskImportController {
  static renderImportForm(_req: Request, res: Response) {
    res.render('library/tasks/import', {
      title: 'Standard Task Import Preview',
    });
  }

  static renderMappingPage(req: Request, res: Response) {
    const file = (req as Request & { file?: Express.Multer.File }).file;

    if (!file) {
      return res.status(400).render('library/tasks/import', {
        title: 'Standard Task Import Preview',
        messages: {
          ...(res.locals.messages || {}),
          error: ['No CSV file uploaded.'],
        },
      });
    }

    try {
      const detection = detectStandardTaskCsvHeaders(file.buffer);

      return res.render('library/tasks/map-columns', {
        title: 'Map Standard Task Columns',
        fileName: file.originalname,
        csvPayload: encodeCsvPayload(file.buffer),
        headers: detection.headers,
        mapping: detection.suggestedMapping,
        targetFields: TARGET_FIELDS,
        unknownColumns: detection.unknownColumns,
        mappingErrors: [],
      });
    } catch (error: any) {
      return res.status(400).render('library/tasks/import', {
        title: 'Standard Task Import Preview',
        messages: {
          ...(res.locals.messages || {}),
          error: [error?.message || 'Unable to read CSV headers.'],
        },
      });
    }
  }

  static previewImport(req: Request, res: Response) {
    const payload = normalizeString(req.body?.csv_payload);

    if (!payload) {
      return res.status(400).render('library/tasks/import', {
        title: 'Standard Task Import Preview',
        messages: {
          ...(res.locals.messages || {}),
          error: ['CSV upload context is missing. Upload the file again.'],
        },
      });
    }

    try {
      const buffer = decodeCsvPayload(payload);
      const detection = detectStandardTaskCsvHeaders(buffer);
      const mapping = createEmptyMapping();

      ALL_TARGET_FIELD_KEYS.forEach((field) => {
        mapping[field] = normalizeMappingInput(req.body?.[field]);
      });

      const mappingErrors = validateMapping(mapping, detection.headers);

      if (mappingErrors.length > 0) {
        return res.status(400).render('library/tasks/map-columns', {
          title: 'Map Standard Task Columns',
          fileName: normalizeString(req.body?.file_name) || 'Uploaded CSV',
          csvPayload: payload,
          headers: detection.headers,
          mapping,
          targetFields: TARGET_FIELDS,
          unknownColumns: detection.unknownColumns,
          mappingErrors,
        });
      }

      const preview = previewMappedStandardTaskCsv(buffer, mapping);

      return res.render('library/tasks/preview', {
        title: 'Standard Task Import Preview',
        fileName: normalizeString(req.body?.file_name) || 'Uploaded CSV',
        preview,
        csvPayload: payload,
      });
    } catch (error: any) {
      return res.status(400).render('library/tasks/import', {
        title: 'Standard Task Import Preview',
        messages: {
          ...(res.locals.messages || {}),
          error: [error?.message || 'Unable to parse CSV preview.'],
        },
      });
    }
  }

  static async commitImport(req: Request, res: Response) {
    const payload = normalizeString(req.body?.csv_payload);

    if (!payload) {
      return res.status(400).render('library/tasks/import', {
        title: 'Standard Task Import Preview',
        messages: {
          ...(res.locals.messages || {}),
          error: ['CSV upload context is missing. Upload the file again.'],
        },
      });
    }

    try {
      const buffer = decodeCsvPayload(payload);
      const mapping = createEmptyMapping();

      ALL_TARGET_FIELD_KEYS.forEach((field) => {
        mapping[field] = normalizeMappingInput(req.body?.[field]);
      });

      const preview = previewMappedStandardTaskCsv(buffer, mapping);
      const result = await commitStandardTaskPreview(preview);

      return res.render('library/tasks/result', {
        title: 'Standard Task Import Result',
        fileName: normalizeString(req.body?.file_name) || 'Uploaded CSV',
        result,
      });
    } catch (error: any) {
      return res.status(400).render('library/tasks/import', {
        title: 'Standard Task Import Preview',
        messages: {
          ...(res.locals.messages || {}),
          error: [error?.message || 'Unable to commit Standard Task import.'],
        },
      });
    }
  }
}
