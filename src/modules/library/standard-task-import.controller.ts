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

type StandardTaskImportSessionState = NonNullable<
  Request['session']['standardTaskImportState']
>;

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
const STANDARD_TASK_IMPORT_STATE_MAX_AGE_MS = 30 * 60 * 1000;
const STANDARD_TASK_BOUNDED_FIELD_LIMITS = [
  { key: 'title', label: 'title', maxLength: 255 },
  { key: 'source_type', label: 'source_type', maxLength: 255 },
] as const;

class StandardTaskImportRowError extends Error {
  constructor(
    rowNumber: number,
    title: string,
    sourceType: string,
    fieldLabel: string | null,
    detail: string,
    guidance: string
  ) {
    const fieldContext = fieldLabel ? ` ${fieldLabel}` : '';
    super(
      `Row ${rowNumber} (${title || 'untitled'} / ${
        sourceType || 'unknown source_type'
      })${fieldContext} ${detail} ${guidance}`
    );
    this.name = 'StandardTaskImportRowError';
  }
}

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

function getCsrfToken(req: Request) {
  return typeof req.csrfToken === 'function' ? req.csrfToken() : null;
}

function createStandardTaskImportSessionState(
  fileName: string,
  buffer: Buffer,
  detection: CsvHeaderDetection
): StandardTaskImportSessionState {
  return {
    token: randomUUID(),
    createdAt: Date.now(),
    fileName: normalizeString(fileName) || 'Uploaded CSV',
    csvPayload: encodeCsvPayload(buffer),
    headers: detection.headers,
    suggestedMapping: detection.suggestedMapping,
    unknownColumns: detection.unknownColumns,
  };
}

function getValidStandardTaskImportSessionState(req: Request) {
  const state = req.session?.standardTaskImportState;

  if (!state) {
    return null;
  }

  if (Date.now() - state.createdAt > STANDARD_TASK_IMPORT_STATE_MAX_AGE_MS) {
    delete req.session.standardTaskImportState;
    return null;
  }

  return state;
}

function getStandardTaskImportBuffer(state: StandardTaskImportSessionState) {
  return Buffer.from(state.csvPayload, 'base64');
}

function buildMaxLengthMessage(fieldLabel: string, maxLength: number) {
  return `${fieldLabel} exceeds maximum length of ${maxLength} characters.`;
}

function buildSchemaGuidance(fieldLabel: string) {
  return `Shorten the ${fieldLabel} value or update the schema if longer Standard Task data is operationally valid.`;
}

function getBoundedFieldOverflow(values: PreviewRowValues) {
  for (const field of STANDARD_TASK_BOUNDED_FIELD_LIMITS) {
    const valueLength = normalizeString(values[field.key]).length;
    if (valueLength > field.maxLength) {
      return {
        fieldLabel: field.label,
        maxLength: field.maxLength,
        actualLength: valueLength,
      };
    }
  }

  return null;
}

function buildRowErrorFromDatabaseError(row: PreviewRow, error: any) {
  const overflow = getBoundedFieldOverflow(row.values);
  if (overflow) {
    return new StandardTaskImportRowError(
      row.rowNumber,
      normalizeString(row.values.title),
      normalizeString(row.values.source_type),
      overflow.fieldLabel,
      `exceeds maximum length of ${overflow.maxLength} characters (${overflow.actualLength} provided).`,
      buildSchemaGuidance(overflow.fieldLabel)
    );
  }

  const rawMessage =
    error?.original?.message || error?.parent?.message || error?.message || 'Database write failed.';

  return new StandardTaskImportRowError(
    row.rowNumber,
    normalizeString(row.values.title),
    normalizeString(row.values.source_type),
    null,
    `failed during database commit: ${rawMessage}`,
    'Review this row for unsupported values and retry the import.'
  );
}

function applyBoundedFieldValidation(preview: PreviewResult) {
  preview.rows.forEach((row) => {
    const overflow = getBoundedFieldOverflow(row.values);
    if (!overflow) {
      return;
    }

    row.errors.push(
      `${buildMaxLengthMessage(overflow.fieldLabel, overflow.maxLength)} ${buildSchemaGuidance(
        overflow.fieldLabel
      )}`
    );
    row.status = 'INVALID';
  });

  const invalidRowCount = preview.rows.filter((row) => row.status === 'INVALID').length;
  preview.invalidRowCount = invalidRowCount;
  preview.validRowCount = preview.rows.length - invalidRowCount;

  return preview;
}

function renderStandardTaskMappingPage(
  req: Request,
  res: Response,
  state: StandardTaskImportSessionState,
  mapping: Record<TargetField, string>,
  mappingErrors: string[] = []
) {
  return res.render('library/tasks/map-columns', {
    title: 'Map Standard Task Columns',
    csrfToken: getCsrfToken(req),
    fileName: state.fileName,
    importToken: state.token,
    headers: state.headers,
    mapping,
    targetFields: TARGET_FIELDS,
    unknownColumns: state.unknownColumns,
    mappingErrors,
  });
}

function renderStandardTaskPreviewPage(
  req: Request,
  res: Response,
  state: StandardTaskImportSessionState,
  messages?: { success?: string[]; error?: string[] }
) {
  return res.render('library/tasks/preview', {
    title: 'Standard Task Import Preview',
    csrfToken: getCsrfToken(req),
    fileName: state.fileName,
    importToken: state.token,
    preview: state.preview,
    messages,
  });
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

      try {
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
      } catch (error: any) {
        throw buildRowErrorFromDatabaseError(row, error);
      }

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
    const csrfToken = getCsrfToken(req);

    if (!file) {
      return res.status(400).render('library/tasks/import', {
        title: 'Standard Task Import Preview',
        csrfToken,
        messages: {
          ...(res.locals.messages || {}),
          error: ['No CSV file uploaded.'],
        },
      });
    }

    try {
      const detection = detectStandardTaskCsvHeaders(file.buffer);
      const importState = createStandardTaskImportSessionState(
        file.originalname,
        file.buffer,
        detection
      );

      req.session.standardTaskImportState = importState;

      return renderStandardTaskMappingPage(
        req,
        res,
        importState,
        detection.suggestedMapping
      );
    } catch (error: any) {
      return res.status(400).render('library/tasks/import', {
        title: 'Standard Task Import Preview',
        csrfToken,
        messages: {
          ...(res.locals.messages || {}),
          error: [error?.message || 'Unable to read CSV headers.'],
        },
      });
    }
  }

  static previewImport(req: Request, res: Response) {
    const importToken = normalizeString(req.body?.import_token);
    const importState = getValidStandardTaskImportSessionState(req);

    if (!importState || !importToken || importState.token !== importToken) {
      return res.status(400).render('library/tasks/import', {
        title: 'Standard Task Import Preview',
        messages: {
          ...(res.locals.messages || {}),
          error: ['CSV upload context is missing. Upload the file again.'],
        },
      });
    }

    try {
      const buffer = getStandardTaskImportBuffer(importState);
      const detection = detectStandardTaskCsvHeaders(buffer);
      const mapping = createEmptyMapping();

      ALL_TARGET_FIELD_KEYS.forEach((field) => {
        mapping[field] = normalizeMappingInput(req.body?.[field]);
      });

      const mappingErrors = validateMapping(mapping, detection.headers);

      if (mappingErrors.length > 0) {
        res.status(400);
        return renderStandardTaskMappingPage(
          req,
          res,
          importState,
          mapping,
          mappingErrors
        );
      }

      const preview = applyBoundedFieldValidation(
        previewMappedStandardTaskCsv(buffer, mapping)
      );
      req.session.standardTaskImportState = {
        ...importState,
        selectedMapping: mapping,
        preview,
      };

      return renderStandardTaskPreviewPage(
        req,
        res,
        req.session.standardTaskImportState
      );
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
    const importToken = normalizeString(req.body?.import_token);
    const importState = getValidStandardTaskImportSessionState(req);

    if (
      !importState ||
      !importToken ||
      importState.token !== importToken ||
      !importState.preview
    ) {
      return res.status(400).render('library/tasks/import', {
        title: 'Standard Task Import Preview',
        messages: {
          ...(res.locals.messages || {}),
          error: ['CSV upload context is missing. Upload the file again.'],
        },
      });
    }

    try {
      const result = await commitStandardTaskPreview(importState.preview);
      delete req.session.standardTaskImportState;

      return res.render('library/tasks/result', {
        title: 'Standard Task Import Result',
        fileName: importState.fileName,
        result,
      });
    } catch (error: any) {
      if (req.session?.standardTaskImportState?.preview) {
        res.status(400);
        return renderStandardTaskPreviewPage(
          req,
          res,
          req.session.standardTaskImportState,
          {
            ...(res.locals.messages || {}),
            error: [error?.message || 'Unable to commit Standard Task import.'],
          }
        );
      }

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
