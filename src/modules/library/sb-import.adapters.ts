import { parse } from 'csv-parse/sync';

export const SB_ADAPTER_OPTIONS = [
  {
    key: 'PIPER',
    label: 'Piper',
    description: 'Piper-style CSV with title, reference, and date columns.',
    enabled: true,
  },
  {
    key: 'GENERIC',
    label: 'Generic',
    description: 'Flexible CSV header mapping for manual or mixed source files.',
    enabled: true,
  },
  {
    key: 'CESSNA',
    label: 'Cessna',
    description: 'Placeholder only for a future Cessna-specific adapter.',
    enabled: false,
  },
] as const;

export type SbAdapterKey = (typeof SB_ADAPTER_OPTIONS)[number]['key'];

export type SbPreviewValues = {
  manufacturer: string;
  reference: string;
  title: string;
  issue_date: string;
  revision: string;
  status: string;
  category: string;
  applicability_make: string;
  applicability_model: string;
  applicability_product_type: string;
  applicability_notes: string;
  summary: string;
  compliance_requirement: string;
  source_file: string;
  source_format: string;
  raw_source_text: string;
  is_active: boolean | null;
};

export type SbPreviewRow = {
  rowNumber: number;
  status: 'VALID' | 'INVALID';
  values: SbPreviewValues;
  errors: string[];
};

export type SbPreviewResult = {
  adapterUsed: SbAdapterKey;
  fileName: string;
  totalRows: number;
  validRowCount: number;
  invalidRowCount: number;
  unknownColumns: string[];
  rows: SbPreviewRow[];
};

const BOOLEAN_TRUE_VALUES = new Set(['true', '1', 'yes', 'y', 'on']);
const BOOLEAN_FALSE_VALUES = new Set(['false', '0', 'no', 'n', 'off']);

const GENERIC_FIELD_ALIASES: Record<keyof SbPreviewValues, string[]> = {
  manufacturer: ['manufacturer', 'maker', 'oem'],
  reference: ['reference', 'sb_number', 'sb', 'bulletin', 'bulletin_number', 'ref', 'number'],
  title: ['title', 'subject', 'heading', 'name'],
  issue_date: ['issue_date', 'date', 'issued_on', 'issue', 'publish_date'],
  revision: ['revision', 'rev'],
  status: ['status', 'state'],
  category: ['category', 'type'],
  applicability_make: ['applicability_make', 'make'],
  applicability_model: ['applicability_model', 'model'],
  applicability_product_type: ['applicability_product_type', 'product_type', 'product'],
  applicability_notes: ['applicability_notes', 'applicability', 'notes', 'app_notes'],
  summary: ['summary', 'description', 'details'],
  compliance_requirement: [
    'compliance_requirement',
    'compliance',
    'compliance_type',
    'recommendation',
    'requirement',
  ],
  source_file: ['source_file', 'file', 'document', 'document_url'],
  source_format: ['source_format', 'format', 'source'],
  raw_source_text: ['raw_source_text', 'raw', 'raw_text', 'source_text'],
  is_active: ['is_active', 'active', 'enabled'],
};

function normalizeHeader(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

function parseCsvMatrix(buffer: Buffer) {
  return parse(buffer, {
    bom: true,
    trim: false,
    relax_column_count: true,
    skip_empty_lines: false,
  }) as string[][];
}

function isEmptyRow(values: unknown[]) {
  return values.every((value) => !normalizeString(value));
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

function formatDateParts(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function normalizeDate(value: unknown, errors: string[], fieldLabel: string) {
  const rawValue = normalizeString(value);

  if (!rawValue) {
    return '';
  }

  let match = rawValue.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) {
    return formatDateParts(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  match = rawValue.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) {
    const year = match[3].length === 2 ? Number(`20${match[3]}`) : Number(match[3]);
    return formatDateParts(year, Number(match[1]), Number(match[2]));
  }

  const parsed = new Date(rawValue);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateParts(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth() + 1,
      parsed.getUTCDate()
    );
  }

  errors.push(`${fieldLabel} must be a valid date if provided.`);
  return '';
}

function createEmptyValues(fileName: string, adapterUsed: SbAdapterKey): SbPreviewValues {
  return {
    manufacturer: '',
    reference: '',
    title: '',
    issue_date: '',
    revision: '',
    status: '',
    category: '',
    applicability_make: '',
    applicability_model: '',
    applicability_product_type: '',
    applicability_notes: '',
    summary: '',
    compliance_requirement: '',
    source_file: fileName,
    source_format: adapterUsed,
    raw_source_text: '',
    is_active: true,
  };
}

function buildRawSourceText(headers: string[], row: string[]) {
  return headers
    .map((header, index) => {
      const value = normalizeString(row[index]);
      return value ? `${header}: ${value}` : '';
    })
    .filter(Boolean)
    .join(' | ');
}

function validateRow(values: SbPreviewValues) {
  const errors: string[] = [];

  if (!values.manufacturer) {
    errors.push('manufacturer is required.');
  }

  if (!values.reference) {
    errors.push('reference is required.');
  }

  if (!values.title) {
    errors.push('title is required.');
  }

  return errors;
}

function previewPiperCsv(fileName: string, matrix: string[][]): SbPreviewResult {
  const rawHeaders = matrix[0] || [];
  const headers = rawHeaders.map(normalizeHeader);
  const recognizedHeaders = new Set(['title', 'reference', 'date']);
  const unknownColumns = rawHeaders.filter((header) => !recognizedHeaders.has(normalizeHeader(header)));
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const rows: SbPreviewRow[] = [];

  matrix.slice(1).forEach((rawRow, index) => {
    const denseRow = Array.from({ length: rawHeaders.length }, (_, columnIndex) => rawRow[columnIndex] ?? '');
    if (isEmptyRow(denseRow)) {
      return;
    }

    const values = createEmptyValues(fileName, 'PIPER');
    values.manufacturer = 'Piper';
    values.reference = normalizeString(denseRow[headerIndex.get('reference') ?? -1]);
    values.title = normalizeString(denseRow[headerIndex.get('title') ?? -1]);
    values.issue_date = normalizeDate(
      denseRow[headerIndex.get('date') ?? -1],
      [],
      'issue_date'
    );
    values.raw_source_text = buildRawSourceText(rawHeaders, denseRow);

    const errors = validateRow(values);
    if (normalizeString(denseRow[headerIndex.get('date') ?? -1]) && !values.issue_date) {
      errors.push('issue_date must be a valid date if provided.');
    }

    rows.push({
      rowNumber: index + 2,
      status: errors.length ? 'INVALID' : 'VALID',
      values,
      errors,
    });
  });

  const invalidRowCount = rows.filter((row) => row.status === 'INVALID').length;

  return {
    adapterUsed: 'PIPER',
    fileName,
    totalRows: rows.length,
    validRowCount: rows.length - invalidRowCount,
    invalidRowCount,
    unknownColumns,
    rows,
  };
}

function previewGenericCsv(fileName: string, matrix: string[][]): SbPreviewResult {
  const rawHeaders = matrix[0] || [];
  const headers = rawHeaders.map(normalizeHeader);
  const rows: SbPreviewRow[] = [];
  const usedHeaders = new Set<string>();

  matrix.slice(1).forEach((rawRow, index) => {
    const denseRow = Array.from({ length: rawHeaders.length }, (_, columnIndex) => rawRow[columnIndex] ?? '');
    if (isEmptyRow(denseRow)) {
      return;
    }

    const values = createEmptyValues(fileName, 'GENERIC');
    const errors: string[] = [];

    (Object.keys(GENERIC_FIELD_ALIASES) as Array<keyof SbPreviewValues>).forEach((field) => {
      const aliases = GENERIC_FIELD_ALIASES[field];
      const headerIndex = headers.findIndex((header) => aliases.includes(header));

      if (headerIndex === -1) {
        return;
      }

      usedHeaders.add(headers[headerIndex]);
      const rawValue = denseRow[headerIndex];

      if (field === 'issue_date') {
        values.issue_date = normalizeDate(rawValue, errors, 'issue_date');
        return;
      }

      if (field === 'is_active') {
        values.is_active = parseOptionalBoolean(rawValue, errors);
        return;
      }

      values[field] = normalizeString(rawValue) as never;
    });

    values.raw_source_text = values.raw_source_text || buildRawSourceText(rawHeaders, denseRow);
    values.source_file = fileName;
    values.source_format = 'GENERIC';
    values.is_active = values.is_active ?? true;

    errors.push(...validateRow(values));

    rows.push({
      rowNumber: index + 2,
      status: errors.length ? 'INVALID' : 'VALID',
      values,
      errors,
    });
  });

  const invalidRowCount = rows.filter((row) => row.status === 'INVALID').length;

  return {
    adapterUsed: 'GENERIC',
    fileName,
    totalRows: rows.length,
    validRowCount: rows.length - invalidRowCount,
    invalidRowCount,
    unknownColumns: rawHeaders.filter((header) => !usedHeaders.has(normalizeHeader(header))),
    rows,
  };
}

export function previewSbImportFile(
  buffer: Buffer,
  fileName: string,
  adapter: string
): SbPreviewResult {
  const normalizedAdapter = normalizeString(adapter).toUpperCase() as SbAdapterKey;

  if (normalizedAdapter === 'CESSNA') {
    throw new Error('Cessna adapter is not implemented yet.');
  }

  if (normalizedAdapter !== 'PIPER' && normalizedAdapter !== 'GENERIC') {
    throw new Error('A valid SB adapter must be selected.');
  }

  const matrix = parseCsvMatrix(buffer);
  if (!matrix.length || !(matrix[0] || []).length) {
    throw new Error('Uploaded SB CSV is empty.');
  }

  if (normalizedAdapter === 'PIPER') {
    return previewPiperCsv(fileName, matrix);
  }

  return previewGenericCsv(fileName, matrix);
}
