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
  piper_metadata?: Record<string, unknown>;
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

type GenericSbFieldKey = Exclude<keyof SbPreviewValues, 'piper_metadata'>;

const GENERIC_FIELD_ALIASES: Record<GenericSbFieldKey, string[]> = {
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

const PIPER_FIELD_ALIASES = {
  publication_type: ['publication_type', 'pub_type', 'type', 'document_type', 'publication'],
  reference: [
    'reference',
    'sb_number',
    'sl_number',
    'publication_number',
    'pub_number',
    'number',
    'bulletin',
    'letter',
    'ref',
  ],
  title: ['title', 'subject', 'heading', 'description', 'publication_title'],
  issue_date: ['issue_date', 'date', 'issued_on', 'issue', 'publish_date'],
  revision: ['revision', 'rev'],
  status: ['status', 'publication_status', 'state', 'supersession_status'],
  classification: [
    'classification',
    'compliance',
    'compliance_requirement',
    'compliance_type',
    'requirement',
    'category',
  ],
  applicability_make: ['applicability_make', 'make'],
  applicability_model: [
    'applicability_model',
    'model',
    'models',
    'applicability',
    'model_applicability',
  ],
  applicability_product_type: ['applicability_product_type', 'product_type', 'product'],
  applicability_notes: ['applicability_notes', 'notes', 'app_notes'],
  summary: ['summary', 'details', 'remarks'],
  source_file: ['source_file', 'file', 'document', 'document_url'],
  source_format: ['source_format', 'format', 'source'],
  raw_source_text: ['raw_source_text', 'raw', 'raw_text', 'source_text'],
  is_active: ['is_active', 'active', 'enabled'],
  superseded_by_reference: [
    'superseded_by_reference',
    'superseded_by',
    'replaced_by',
    'replacement',
    'supersession',
  ],
  ata_code: ['ata_code', 'ata', 'chapter'],
  ad_references: ['ad_references', 'ad_reference', 'ad_refs', 'ad'],
  part_kit_references: [
    'part_kit_references',
    'part_kit_reference',
    'kit_references',
    'part_references',
    'kit',
    'kit_number',
    'part_number',
  ],
  piper_family: ['piper_family', 'family', 'aircraft_family', 'series_family'],
  piper_series: ['piper_series', 'series', 'aircraft_series'],
} as const;

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

function normalizeCompact(value: unknown) {
  return normalizeString(value).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function findAliasedValue(
  headers: string[],
  row: string[],
  aliases: readonly string[]
) {
  const index = headers.findIndex((header) => aliases.includes(header));
  return index === -1 ? '' : normalizeString(row[index]);
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
    const yearPart = match[3] ?? '';
    const monthPart = match[1] ?? '';
    const dayPart = match[2] ?? '';
    const year = yearPart.length === 2 ? Number(`20${yearPart}`) : Number(yearPart);
    return formatDateParts(year, Number(monthPart), Number(dayPart));
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

function splitPiperList(value: unknown) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return [] as string[];
  }

  return normalized
    .split(/[;,|]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizePiperPublicationType(rawType: string, reference: string) {
  const combined = `${rawType} ${reference}`.toUpperCase();

  if (/\bSL\b/.test(combined) || combined.includes('SERVICE LETTER')) {
    return 'SL';
  }

  if (/\bSB\b/.test(combined) || combined.includes('SERVICE BULLETIN')) {
    return 'SB';
  }

  return 'SB';
}

function extractSupersededByReference(...values: string[]) {
  for (const value of values) {
    const normalized = normalizeString(value);
    if (!normalized) {
      continue;
    }

    const explicit = normalized.match(/\b(?:superseded|replaced)\s+by\s+(.+)$/i);
    if (explicit?.[1]) {
      return explicit[1].replace(/[.;]+$/, '').trim();
    }
  }

  return '';
}

function normalizePiperPublicationStatus(rawStatus: string, supersededByReference: string) {
  const compact = normalizeCompact(rawStatus);

  if (compact.includes('NOT_USED') || compact.includes('NOTUSE')) {
    return 'NOT_USED';
  }

  if (compact.includes('CANCEL')) {
    return 'CANCELLED';
  }

  if (compact.includes('OBSOLETE')) {
    return 'OBSOLETE';
  }

  if (compact.includes('SUPERSED') || compact.includes('REPLACED') || supersededByReference) {
    return 'SUPERSEDED';
  }

  return 'ACTIVE';
}

function normalizePiperClassification(rawClassification: string) {
  const compact = normalizeCompact(rawClassification);

  if (compact.includes('EMERGENCY')) return 'EMERGENCY';
  if (compact.includes('ALERT')) return 'ALERT';
  if (compact.includes('MANDATORY')) return 'MANDATORY';
  if (compact.includes('REQUIRED')) return 'REQUIRED';
  if (compact.includes('OPTIONAL')) return 'OPTIONAL';
  if (compact.includes('RECOMMENDED')) return 'RECOMMENDED';

  return 'RECOMMENDED';
}

function mapPiperClassificationToComplianceRequirement(classification: string) {
  if (classification === 'MANDATORY' || classification === 'REQUIRED') {
    return 'MANDATORY';
  }

  if (classification === 'ALERT' || classification === 'EMERGENCY') {
    return 'MANDATORY';
  }

  if (classification === 'OPTIONAL') {
    return 'OPTIONAL';
  }

  return 'MANUAL';
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
  const recognizedHeaders = new Set<string>(Object.values(PIPER_FIELD_ALIASES).flat());
  const unknownColumns = rawHeaders.filter((header) => !recognizedHeaders.has(normalizeHeader(header)));
  const rows: SbPreviewRow[] = [];

  matrix.slice(1).forEach((rawRow, index) => {
    const denseRow = Array.from({ length: rawHeaders.length }, (_, columnIndex) => rawRow[columnIndex] ?? '');
    if (isEmptyRow(denseRow)) {
      return;
    }

    const values = createEmptyValues(fileName, 'PIPER');
    const errors: string[] = [];
    const publicationType = normalizePiperPublicationType(
      findAliasedValue(headers, denseRow, PIPER_FIELD_ALIASES.publication_type),
      findAliasedValue(headers, denseRow, PIPER_FIELD_ALIASES.reference)
    );
    const rawStatus = findAliasedValue(headers, denseRow, PIPER_FIELD_ALIASES.status);
    const rawSupersededBy = findAliasedValue(
      headers,
      denseRow,
      PIPER_FIELD_ALIASES.superseded_by_reference
    );
    const supersededByReference =
      normalizeString(rawSupersededBy) ||
      extractSupersededByReference(rawStatus, buildRawSourceText(rawHeaders, denseRow));
    const publicationStatus = normalizePiperPublicationStatus(rawStatus, supersededByReference);
    const classification = normalizePiperClassification(
      findAliasedValue(headers, denseRow, PIPER_FIELD_ALIASES.classification)
    );

    values.manufacturer = 'Piper';
    values.reference = findAliasedValue(headers, denseRow, PIPER_FIELD_ALIASES.reference);
    values.title = findAliasedValue(headers, denseRow, PIPER_FIELD_ALIASES.title);
    values.issue_date = normalizeDate(
      findAliasedValue(headers, denseRow, PIPER_FIELD_ALIASES.issue_date),
      errors,
      'issue_date'
    );
    values.revision = findAliasedValue(headers, denseRow, PIPER_FIELD_ALIASES.revision);
    values.status = publicationStatus;
    values.category = publicationType;
    values.applicability_make = findAliasedValue(headers, denseRow, PIPER_FIELD_ALIASES.applicability_make);
    values.applicability_model = findAliasedValue(headers, denseRow, PIPER_FIELD_ALIASES.applicability_model);
    values.applicability_product_type = findAliasedValue(
      headers,
      denseRow,
      PIPER_FIELD_ALIASES.applicability_product_type
    );
    values.applicability_notes = findAliasedValue(
      headers,
      denseRow,
      PIPER_FIELD_ALIASES.applicability_notes
    );
    values.summary = findAliasedValue(headers, denseRow, PIPER_FIELD_ALIASES.summary);
    values.compliance_requirement =
      mapPiperClassificationToComplianceRequirement(classification);
    values.source_file =
      findAliasedValue(headers, denseRow, PIPER_FIELD_ALIASES.source_file) || fileName;
    values.source_format = 'PIPER_SB_SL_INDEX';
    values.raw_source_text = buildRawSourceText(rawHeaders, denseRow);
    values.is_active = publicationStatus === 'ACTIVE';
    values.piper_metadata = {
      publication_type: publicationType,
      publication_status: publicationStatus,
      classification,
      superseded_by_reference: supersededByReference || null,
      ata_code: findAliasedValue(headers, denseRow, PIPER_FIELD_ALIASES.ata_code) || null,
      ad_references: splitPiperList(
        findAliasedValue(headers, denseRow, PIPER_FIELD_ALIASES.ad_references)
      ),
      part_kit_references: splitPiperList(
        findAliasedValue(headers, denseRow, PIPER_FIELD_ALIASES.part_kit_references)
      ),
      piper_family: findAliasedValue(headers, denseRow, PIPER_FIELD_ALIASES.piper_family) || null,
      piper_series: findAliasedValue(headers, denseRow, PIPER_FIELD_ALIASES.piper_series) || null,
      original_status_text: rawStatus || null,
      source_row: index + 2,
    };

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

    (Object.keys(GENERIC_FIELD_ALIASES) as GenericSbFieldKey[]).forEach((field) => {
      const aliases = GENERIC_FIELD_ALIASES[field];
      const headerIndex = headers.findIndex((header) => aliases.includes(header));

      if (headerIndex === -1) {
        return;
      }

      const matchedHeader = headers[headerIndex];
      if (!matchedHeader) {
        return;
      }

      usedHeaders.add(matchedHeader);
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
