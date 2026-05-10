import { createRequire } from 'module';
import { Request, Response } from 'express';
import { parse } from 'csv-parse/sync';
import sequelize from '../../config/database.js';
import { AirworthinessDirective } from '../../models/AirworthinessDirective.js';
import { AdRelationship } from '../../models/AdRelationship.js';

const require = createRequire(import.meta.url);
const yauzl = require('yauzl') as any;

const AD_FIELDS = [
  { label: 'AD Number', key: 'ad_number', required: true },
  { label: 'Subject Heading', key: 'subject_heading', required: false },
  { label: 'Subject', key: 'subject', required: false },
  { label: 'Status', key: 'status', required: true },
  { label: 'CFR Part Reference', key: 'cfr_part_reference', required: false },
  { label: 'Effective Date', key: 'effective_date', required: true },
  { label: 'Service/Office', key: 'service_office', required: false },
  {
    label: 'Office of Primary Responsibility',
    key: 'office_of_primary_responsibility',
    required: false,
  },
  { label: 'Docket Number', key: 'docket_number', required: false },
  { label: 'Citation', key: 'citation', required: false },
  {
    label: 'Citation Publish Date',
    key: 'citation_publish_date',
    required: false,
  },
  { label: 'Make', key: 'make', required: false },
  { label: 'Model', key: 'model', required: false },
  { label: 'Product Type', key: 'product_type', required: false },
  { label: 'Product Subtype', key: 'product_subtype', required: false },
  { label: 'Affected AD', key: 'affected_ad', required: false },
  { label: 'Superseded AD', key: 'superseded_ad', required: false },
  { label: 'Affected By', key: 'affected_by', required: false },
  { label: 'Superseded By', key: 'superseded_by', required: false },
  { label: 'Comments', key: 'comments', required: false },
  { label: 'Summary', key: 'summary', required: false },
] as const;

type AdFieldKey = (typeof AD_FIELDS)[number]['key'];

type AdPreviewValues = {
  ad_number: string;
  subject_heading: string;
  subject: string;
  status: string;
  cfr_part_reference: string;
  effective_date: string;
  service_office: string;
  office_of_primary_responsibility: string;
  docket_number: string;
  citation: string;
  citation_publish_date: string;
  make: string;
  model: string;
  product_type: string;
  product_subtype: string;
  affected_ad: string[];
  superseded_ad: string[];
  affected_by: string[];
  superseded_by: string[];
  comments: string;
  summary: string;
};

type AdPreviewRow = {
  rowNumber: number;
  status: 'VALID' | 'INVALID';
  values: AdPreviewValues;
  errors: string[];
  warnings: string[];
};

type AdPreviewResult = {
  fileType: 'CSV' | 'XLSX';
  totalRows: number;
  validRowCount: number;
  invalidRowCount: number;
  unknownColumns: string[];
  duplicateWarnings: string[];
  rows: AdPreviewRow[];
};

type AdCommitRowResult = {
  rowNumber: number;
  status: 'INSERTED' | 'SKIPPED - INVALID' | 'SKIPPED - DUPLICATE';
  reason: string;
  adNumber: string;
  relationshipRowsInserted: number;
};

type AdCommitResult = {
  totalRowsProcessed: number;
  totalValidRows: number;
  totalInsertedAds: number;
  totalRelationshipRowsInserted: number;
  totalSkippedInvalid: number;
  totalSkippedDuplicate: number;
  rows: AdCommitRowResult[];
};

const FIELD_BY_NORMALIZED_HEADER = new Map(
  AD_FIELDS.map((field) => [normalizeHeader(field.label), field])
);

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

function encodePreviewPayload(preview: AdPreviewResult) {
  return Buffer.from(JSON.stringify(preview), 'utf8').toString('base64');
}

function decodePreviewPayload(payload: string): AdPreviewResult {
  return JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) as AdPreviewResult;
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function columnLettersToIndex(value: string) {
  let total = 0;

  for (const character of value.toUpperCase()) {
    total = total * 26 + (character.charCodeAt(0) - 64);
  }

  return total - 1;
}

function excelSerialToDate(serial: number) {
  if (!Number.isFinite(serial)) {
    return null;
  }

  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);

  if (Number.isNaN(dateInfo.getTime())) {
    return null;
  }

  return formatDateParts(
    dateInfo.getUTCFullYear(),
    dateInfo.getUTCMonth() + 1,
    dateInfo.getUTCDate()
  );
}

function formatDateParts(year: number, month: number, day: number) {
  const monthText = String(month).padStart(2, '0');
  const dayText = String(day).padStart(2, '0');
  return `${year}-${monthText}-${dayText}`;
}

function normalizeDate(value: unknown, errors: string[], fieldLabel: string, required: boolean) {
  const rawValue = normalizeString(value);

  if (!rawValue) {
    if (required) {
      errors.push(`${fieldLabel} is required.`);
    }
    return '';
  }

  if (/^\d+(\.\d+)?$/.test(rawValue)) {
    const fromSerial = excelSerialToDate(Number(rawValue));
    if (fromSerial) {
      return fromSerial;
    }
  }

  let match = rawValue.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) {
    return formatDateParts(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  match = rawValue.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    return formatDateParts(Number(match[3]), Number(match[1]), Number(match[2]));
  }

  const parsed = new Date(rawValue);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateParts(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth() + 1,
      parsed.getUTCDate()
    );
  }

  errors.push(`${fieldLabel} must be a valid date${required ? '.' : ' if provided.'}`);
  return '';
}

function splitRelationshipValues(value: unknown) {
  return normalizeString(value)
    .split(/[,\n;|]+/)
    .map((item) => normalizeString(item))
    .filter(Boolean);
}

function normalizeOptionalText(value: string) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function buildAdDuplicateKey(values: AdPreviewValues) {
  return `${normalizeString(values.ad_number).toUpperCase()}\u001f`;
}

async function hasExistingAdDuplicate(values: AdPreviewValues, transaction: any) {
  const match = await AirworthinessDirective.findOne({
    where: {
      ad_number: normalizeString(values.ad_number),
      revision: null,
    },
    transaction,
  });

  return Boolean(match);
}

function buildRelationshipRows(adId: string, values: AdPreviewValues) {
  const rows = [
    ...(values.affected_ad || []).map((relatedAdNumber) => ({
      ad_id: adId,
      related_ad_number: normalizeString(relatedAdNumber),
      relationship_type: 'AFFECTS',
    })),
    ...(values.superseded_ad || []).map((relatedAdNumber) => ({
      ad_id: adId,
      related_ad_number: normalizeString(relatedAdNumber),
      relationship_type: 'SUPERSEDES',
    })),
    ...(values.affected_by || []).map((relatedAdNumber) => ({
      ad_id: adId,
      related_ad_number: normalizeString(relatedAdNumber),
      relationship_type: 'AFFECTED_BY',
    })),
    ...(values.superseded_by || []).map((relatedAdNumber) => ({
      ad_id: adId,
      related_ad_number: normalizeString(relatedAdNumber),
      relationship_type: 'SUPERSEDED_BY',
    })),
  ];

  return rows.filter((row) => row.related_ad_number);
}

async function commitAdPreview(preview: AdPreviewResult) {
  const duplicateKeysInBatch = new Set<string>();

  return sequelize.transaction(async (transaction) => {
    const rows: AdCommitRowResult[] = [];
    let totalInsertedAds = 0;
    let totalRelationshipRowsInserted = 0;
    let totalSkippedDuplicate = 0;

    for (const row of preview.rows) {
      if (row.status === 'INVALID') {
        rows.push({
          rowNumber: row.rowNumber,
          status: 'SKIPPED - INVALID',
          reason: row.errors.join(' '),
          adNumber: row.values.ad_number,
          relationshipRowsInserted: 0,
        });
        continue;
      }

      const duplicateKey = buildAdDuplicateKey(row.values);

      if (duplicateKeysInBatch.has(duplicateKey)) {
        totalSkippedDuplicate += 1;
        rows.push({
          rowNumber: row.rowNumber,
          status: 'SKIPPED - DUPLICATE',
          reason: 'Duplicate AD detected in this import batch.',
          adNumber: row.values.ad_number,
          relationshipRowsInserted: 0,
        });
        continue;
      }

      if (await hasExistingAdDuplicate(row.values, transaction)) {
        totalSkippedDuplicate += 1;
        duplicateKeysInBatch.add(duplicateKey);
        rows.push({
          rowNumber: row.rowNumber,
          status: 'SKIPPED - DUPLICATE',
          reason: 'Duplicate AD already exists in airworthiness_directives.',
          adNumber: row.values.ad_number,
          relationshipRowsInserted: 0,
        });
        continue;
      }

      const directive = await AirworthinessDirective.create(
        {
          ad_number: normalizeString(row.values.ad_number),
          revision: null,
          subject_heading: normalizeOptionalText(row.values.subject_heading),
          subject: normalizeOptionalText(row.values.subject),
          summary: normalizeOptionalText(row.values.summary),
          comments: normalizeOptionalText(row.values.comments),
          status: normalizeOptionalText(row.values.status),
          cfr_part_reference: normalizeOptionalText(
            row.values.cfr_part_reference
          ),
          effective_date: normalizeOptionalText(row.values.effective_date),
          authority: null,
          service_office: normalizeOptionalText(row.values.service_office),
          primary_responsibility_office: normalizeOptionalText(
            row.values.office_of_primary_responsibility
          ),
          docket_number: normalizeOptionalText(row.values.docket_number),
          citation: normalizeOptionalText(row.values.citation),
          citation_publish_date: normalizeOptionalText(
            row.values.citation_publish_date
          ),
          make: normalizeOptionalText(row.values.make),
          model: normalizeOptionalText(row.values.model),
          product_type: normalizeOptionalText(row.values.product_type),
          product_subtype: normalizeOptionalText(row.values.product_subtype),
          is_recurring: null,
          interval_hours: null,
          interval_months: null,
          is_active: true,
        } as any,
        { transaction }
      );

      const relationshipRows = buildRelationshipRows(directive.id, row.values);
      if (relationshipRows.length > 0) {
        await AdRelationship.bulkCreate(relationshipRows as any[], {
          transaction,
        });
      }

      duplicateKeysInBatch.add(duplicateKey);
      totalInsertedAds += 1;
      totalRelationshipRowsInserted += relationshipRows.length;
      rows.push({
        rowNumber: row.rowNumber,
        status: 'INSERTED',
        reason: 'Inserted into airworthiness_directives.',
        adNumber: row.values.ad_number,
        relationshipRowsInserted: relationshipRows.length,
      });
    }

    return {
      totalRowsProcessed: preview.totalRows,
      totalValidRows: preview.validRowCount,
      totalInsertedAds,
      totalRelationshipRowsInserted,
      totalSkippedInvalid: preview.invalidRowCount,
      totalSkippedDuplicate,
      rows,
    } satisfies AdCommitResult;
  });
}

function createEmptyAdValues(): AdPreviewValues {
  return {
    ad_number: '',
    subject_heading: '',
    subject: '',
    status: '',
    cfr_part_reference: '',
    effective_date: '',
    service_office: '',
    office_of_primary_responsibility: '',
    docket_number: '',
    citation: '',
    citation_publish_date: '',
    make: '',
    model: '',
    product_type: '',
    product_subtype: '',
    affected_ad: [],
    superseded_ad: [],
    affected_by: [],
    superseded_by: [],
    comments: '',
    summary: '',
  };
}

function isEmptyRow(values: unknown[]) {
  return values.every((value) => !normalizeString(value));
}

function parseCsvMatrix(buffer: Buffer) {
  return parse(buffer, {
    bom: true,
    trim: false,
    relax_column_count: true,
    skip_empty_lines: false,
  }) as string[][];
}

async function openZipBuffer(buffer: Buffer) {
  return await new Promise<any>((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error: Error | null, zipFile: any) => {
      if (error || !zipFile) {
        reject(error || new Error('Unable to open XLSX archive.'));
        return;
      }
      resolve(zipFile);
    });
  });
}

async function readZipEntries(buffer: Buffer) {
  const zipFile = await openZipBuffer(buffer);
  const entries = new Map<string, Buffer>();

  await new Promise<void>((resolve, reject) => {
    zipFile.readEntry();

    zipFile.on('entry', (entry: any) => {
      zipFile.openReadStream(entry, (error: Error | null, stream: any) => {
        if (error || !stream) {
          reject(error || new Error(`Unable to read XLSX entry ${entry.fileName}.`));
          return;
        }

        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => {
          entries.set(entry.fileName, Buffer.concat(chunks));
          zipFile.readEntry();
        });
        stream.on('error', reject);
      });
    });

    zipFile.on('end', () => resolve());
    zipFile.on('error', reject);
  });

  return entries;
}

function extractSharedStrings(xml: string) {
  const strings: string[] = [];
  const stringMatches = xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g);

  for (const match of stringMatches) {
    const stringBody = match[1] ?? '';
    const text = Array.from(stringBody.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))
      .map((textMatch) => decodeXmlEntities(textMatch[1] ?? ''))
      .join('');
    strings.push(text);
  }

  return strings;
}

function extractSheetPath(entries: Map<string, Buffer>) {
  const workbookXml = entries.get('xl/workbook.xml');
  const workbookRelsXml = entries.get('xl/_rels/workbook.xml.rels');

  if (!workbookXml || !workbookRelsXml) {
    throw new Error('XLSX workbook metadata is incomplete.');
  }

  const workbookText = workbookXml.toString('utf8');
  const relsText = workbookRelsXml.toString('utf8');
  const firstSheet = workbookText.match(/<sheet\b[^>]*r:id="([^"]+)"/);

  if (!firstSheet) {
    throw new Error('No worksheet found in XLSX file.');
  }

  const relationPattern = new RegExp(
    `<Relationship\\b[^>]*Id="${firstSheet[1]}"[^>]*Target="([^"]+)"`,
    'i'
  );
  const relation = relsText.match(relationPattern);

  if (!relation) {
    throw new Error('Unable to resolve first worksheet in XLSX file.');
  }

  const relationTarget = relation[1] ?? '';
  return `xl/${relationTarget.replace(/^\/+/, '')}`;
}

function parseWorksheetMatrix(sheetXml: string, sharedStrings: string[]) {
  const rows = new Map<number, string[]>();
  const rowMatches = sheetXml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g);

  for (const rowMatch of rowMatches) {
    const rowNumber = Number(rowMatch[1]);
    const rowValues: string[] = [];

    const rowBody = rowMatch[2] ?? '';
    const cellMatches = rowBody.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g);
    for (const cellMatch of cellMatches) {
      const attributes = cellMatch[1];
      const cellBody = cellMatch[2];
      const refMatch = attributes.match(/\br="([A-Z]+)\d+"/i);
      if (!refMatch) {
        continue;
      }

      const columnIndex = columnLettersToIndex(refMatch[1] ?? '');
      const typeMatch = attributes.match(/\bt="([^"]+)"/i);
      const cellType = typeMatch?.[1] || '';
      let value = '';

      if (cellType === 's') {
        const sharedIndexMatch = cellBody.match(/<v>([\s\S]*?)<\/v>/);
        const sharedIndex = Number(sharedIndexMatch?.[1] || '-1');
        value = sharedStrings[sharedIndex] || '';
      } else if (cellType === 'inlineStr') {
        value = Array.from(cellBody.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))
          .map((textMatch) => decodeXmlEntities(textMatch[1] ?? ''))
          .join('');
      } else {
        const rawMatch = cellBody.match(/<v>([\s\S]*?)<\/v>/);
        value = rawMatch ? decodeXmlEntities(rawMatch[1] ?? '') : '';
      }

      rowValues[columnIndex] = value;
    }

    rows.set(rowNumber, rowValues);
  }

  if (!rows.size) {
    return [] as string[][];
  }

  const maxRowNumber = Math.max(...rows.keys());
  const matrix: string[][] = [];

  for (let rowIndex = 1; rowIndex <= maxRowNumber; rowIndex += 1) {
    matrix.push(rows.get(rowIndex) || []);
  }

  return matrix;
}

async function parseXlsxMatrix(buffer: Buffer) {
  const entries = await readZipEntries(buffer);
  const sharedStringsXml = entries.get('xl/sharedStrings.xml');
  const sharedStrings = sharedStringsXml
    ? extractSharedStrings(sharedStringsXml.toString('utf8'))
    : [];
  const sheetPath = extractSheetPath(entries);
  const sheetXml = entries.get(sheetPath);

  if (!sheetXml) {
    throw new Error('Unable to load first worksheet from XLSX file.');
  }

  return parseWorksheetMatrix(sheetXml.toString('utf8'), sharedStrings);
}

async function parseImportMatrix(
  buffer: Buffer,
  fileName: string,
  mimetype: string
): Promise<{ fileType: 'CSV' | 'XLSX'; matrix: string[][] }> {
  const normalizedName = normalizeString(fileName).toLowerCase();

  if (
    mimetype ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    normalizedName.endsWith('.xlsx')
  ) {
    return {
      fileType: 'XLSX',
      matrix: await parseXlsxMatrix(buffer),
    };
  }

  return {
    fileType: 'CSV',
    matrix: parseCsvMatrix(buffer),
  };
}

function previewAdMatrix(
  fileType: 'CSV' | 'XLSX',
  matrix: string[][]
): AdPreviewResult {
  const rawHeaders = matrix[0] || [];
  const fieldByColumnIndex = rawHeaders.map((header) =>
    FIELD_BY_NORMALIZED_HEADER.get(normalizeHeader(header))
  );
  const unknownColumns = rawHeaders.filter(
    (_header, index) => !fieldByColumnIndex[index]
  );
  const rows: AdPreviewRow[] = [];
  const adNumberCounts = new Map<string, number>();

  matrix.slice(1).forEach((rawRow, rowIndex) => {
    const denseRow = Array.from({ length: rawHeaders.length }, (_, index) => rawRow[index] ?? '');
    if (isEmptyRow(denseRow)) {
      return;
    }

    const values = createEmptyAdValues();
    const errors: string[] = [];
    const warnings: string[] = [];

    fieldByColumnIndex.forEach((field, columnIndex) => {
      if (!field) {
        return;
      }

      const rawValue = denseRow[columnIndex];
      const normalizedValue = normalizeString(rawValue);

      switch (field.key) {
        case 'effective_date':
          values.effective_date = normalizeDate(
            rawValue,
            errors,
            'Effective Date',
            true
          );
          break;
        case 'citation_publish_date':
          values.citation_publish_date = normalizeDate(
            rawValue,
            errors,
            'Citation Publish Date',
            false
          );
          break;
        case 'affected_ad':
        case 'superseded_ad':
        case 'affected_by':
        case 'superseded_by':
          values[field.key] = splitRelationshipValues(rawValue);
          break;
        default:
          values[field.key as Exclude<AdFieldKey, 'effective_date' | 'citation_publish_date' | 'affected_ad' | 'superseded_ad' | 'affected_by' | 'superseded_by'>] =
            normalizedValue;
          break;
      }
    });

    if (!values.ad_number) {
      errors.push('AD Number is required.');
    }

    if (!values.status) {
      errors.push('Status is required.');
    }

    if (values.ad_number) {
      const duplicateCount = (adNumberCounts.get(values.ad_number) || 0) + 1;
      adNumberCounts.set(values.ad_number, duplicateCount);
      if (duplicateCount > 1) {
        warnings.push(`Duplicate AD Number in file: ${values.ad_number}`);
      }
    }

    rows.push({
      rowNumber: rowIndex + 2,
      status: errors.length ? 'INVALID' : 'VALID',
      values,
      errors,
      warnings,
    });
  });

  const invalidRowCount = rows.filter((row) => row.status === 'INVALID').length;
  const duplicateWarnings = Array.from(adNumberCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([adNumber, count]) => `${adNumber} appears ${count} times in this file.`);

  return {
    fileType,
    totalRows: rows.length,
    validRowCount: rows.length - invalidRowCount,
    invalidRowCount,
    unknownColumns,
    duplicateWarnings,
    rows,
  };
}

export async function previewAdImportFile(
  buffer: Buffer,
  fileName: string,
  mimetype: string
) {
  const { fileType, matrix } = await parseImportMatrix(buffer, fileName, mimetype);
  return previewAdMatrix(fileType, matrix);
}

export class AdImportController {
  static renderImportForm(_req: Request, res: Response) {
    res.render('library/ads/import', {
      title: 'AD Import Preview',
    });
  }

  static async previewImport(req: Request, res: Response) {
    const file = (req as Request & { file?: Express.Multer.File }).file;

    if (!file) {
      return res.status(400).render('library/ads/import', {
        title: 'AD Import Preview',
        messages: {
          ...(res.locals.messages || {}),
          error: ['No AD file uploaded.'],
        },
      });
    }

    try {
      const preview = await previewAdImportFile(
        file.buffer,
        file.originalname,
        file.mimetype
      );

      return res.render('library/ads/preview', {
        title: 'AD Import Preview',
        fileName: file.originalname,
        preview,
        previewPayload: encodePreviewPayload(preview),
      });
    } catch (error: any) {
      return res.status(400).render('library/ads/import', {
        title: 'AD Import Preview',
        messages: {
          ...(res.locals.messages || {}),
          error: [error?.message || 'Unable to parse AD import preview.'],
        },
      });
    }
  }

  static async commitImport(req: Request, res: Response) {
    const payload = normalizeString(req.body?.preview_payload);

    if (!payload) {
      return res.status(400).render('library/ads/import', {
        title: 'AD Import Preview',
        messages: {
          ...(res.locals.messages || {}),
          error: ['AD preview context is missing. Upload the file again.'],
        },
      });
    }

    try {
      const preview = decodePreviewPayload(payload);
      const result = await commitAdPreview(preview);

      return res.render('library/ads/result', {
        title: 'AD Import Result',
        fileName: normalizeString(req.body?.file_name) || 'Uploaded AD file',
        result,
      });
    } catch (error: any) {
      return res.status(400).render('library/ads/import', {
        title: 'AD Import Preview',
        messages: {
          ...(res.locals.messages || {}),
          error: [error?.message || 'Unable to commit AD import.'],
        },
      });
    }
  }
}
