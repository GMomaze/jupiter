import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { parse } from 'csv-parse/sync';
import { QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import { AssetType, ComponentModel, Manufacturer } from '../../models/index.js';

type PiperModelMasterStatus =
  | 'NEW'
  | 'EXISTING_CODE_MATCH'
  | 'LEGACY_NAME_MATCH'
  | 'DUPLICATE_CONFLICT'
  | 'REVIEW_REQUIRED'
  | 'INVALID';

type PiperModelMasterValues = {
  manufacturer: string;
  asset_type: string;
  manufacturer_code: string;
  asset_type_code: string;
  model_code: string;
  model_name: string;
  family: string;
  series: string;
  notes: string;
  is_active: boolean;
};

type PiperModelMasterPreviewRow = {
  rowNumber: number;
  status: PiperModelMasterStatus;
  reason: string;
  values: PiperModelMasterValues;
  manufacturer_id: string | null;
  asset_type_id: string | null;
  manufacturer_display: string | null;
  asset_type_display: string | null;
};

type PiperModelMasterPreview = {
  totalRows: number;
  rows: PiperModelMasterPreviewRow[];
  counts: Record<PiperModelMasterStatus, number>;
};

type PiperModelMasterSessionState =
  NonNullable<Request['session']['piperModelMasterImportState']>;

const IMPORT_STATE_MAX_AGE_MS = 30 * 60 * 1000;
const IMPORT_HEADERS = [
  'manufacturer_code',
  'asset_type_code',
  'model_code',
  'model_name',
  'family',
  'series',
  'notes',
  'is_active',
] as const;
const MODEL_IMPORT_TEMPLATE_CSV = [
  'manufacturer_code,asset_type_code,model_code,model_name',
  'PIPER,AIRFRAME,PA-28-181,Archer II',
  'CESSNA,AIRFRAME,172M,Skyhawk',
  'BEECHCRAFT,AIRFRAME,35,Bonanza',
].join('\n');

function normalizeHeader(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeCode(value: unknown) {
  return normalizeText(value).toUpperCase();
}

function normalizeBoolean(value: unknown) {
  const normalized = normalizeText(value).toLowerCase();

  if (!normalized) return true;
  if (['true', '1', 'yes', 'y', 'active'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'inactive'].includes(normalized)) return false;

  return true;
}

function buildCounts(rows: PiperModelMasterPreviewRow[]) {
  return rows.reduce(
    (counts, row) => {
      counts[row.status] += 1;
      return counts;
    },
    {
      NEW: 0,
      EXISTING_CODE_MATCH: 0,
      LEGACY_NAME_MATCH: 0,
      DUPLICATE_CONFLICT: 0,
      REVIEW_REQUIRED: 0,
      INVALID: 0,
    } satisfies Record<PiperModelMasterStatus, number>
  );
}

function getCsvRows(buffer: Buffer) {
  return parse(buffer, {
    columns: (headers: string[]) => headers.map(normalizeHeader),
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  }) as Record<string, unknown>[];
}

function getValidImportState(req: Request) {
  const state = req.session?.piperModelMasterImportState;

  if (!state) return null;

  if (Date.now() - state.createdAt > IMPORT_STATE_MAX_AGE_MS) {
    delete req.session.piperModelMasterImportState;
    return null;
  }

  return state;
}

function getCsrfToken(req: Request) {
  return typeof req.csrfToken === 'function' ? req.csrfToken() : null;
}

async function loadReferenceMaps() {
  const [manufacturers, assetTypes] = await Promise.all([
    Manufacturer.findAll({ attributes: ['id', 'code', 'name', 'is_active'] }),
    AssetType.findAll({ attributes: ['id', 'code', 'label'] }),
  ]);

  const manufacturersByCode = new Map<string, any[]>();
  const manufacturersByExactName = new Map<string, any[]>();
  const manufacturersByNormalizedName = new Map<string, any[]>();
  const assetTypesByCode = new Map<string, any[]>();
  const assetTypesByExactName = new Map<string, any[]>();
  const assetTypesByNormalizedName = new Map<string, any[]>();

  const addMapValue = (map: Map<string, any[]>, key: string, value: any) => {
    if (!key) return;
    const existing = map.get(key) || [];
    existing.push(value);
    map.set(key, existing);
  };

  const normalizeReferenceName = (value: unknown) =>
    normalizeText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  manufacturers.forEach((manufacturer: any) => {
    const code = normalizeCode(manufacturer.code);
    const exactName = normalizeText(manufacturer.name).toLowerCase();
    const normalizedName = normalizeReferenceName(manufacturer.name);
    addMapValue(manufacturersByCode, code, manufacturer);
    addMapValue(manufacturersByExactName, exactName, manufacturer);
    addMapValue(manufacturersByNormalizedName, normalizedName, manufacturer);
  });

  assetTypes.forEach((assetType: any) => {
    const code = normalizeCode(assetType.code);
    const exactName = normalizeText(assetType.label).toLowerCase();
    const normalizedName = normalizeReferenceName(assetType.label);
    addMapValue(assetTypesByCode, code, assetType);
    addMapValue(assetTypesByExactName, exactName, assetType);
    addMapValue(assetTypesByNormalizedName, normalizedName, assetType);
  });

  return {
    manufacturersByCode,
    manufacturersByExactName,
    manufacturersByNormalizedName,
    assetTypesByCode,
    assetTypesByExactName,
    assetTypesByNormalizedName,
  };
}

function resolveReference(
  rawValue: string,
  maps: {
    byCode: Map<string, any[]>;
    byExactName: Map<string, any[]>;
    byNormalizedName: Map<string, any[]>;
  }
) {
  const value = normalizeText(rawValue);

  if (!value) {
    return {
      record: null,
      ambiguous: false,
      matchedOn: null as string | null,
    };
  }

  const normalizedName = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const matchStages = [
    { matchedOn: 'code', rows: maps.byCode.get(normalizeCode(value)) || [] },
    { matchedOn: 'name', rows: maps.byExactName.get(value.toLowerCase()) || [] },
    { matchedOn: 'normalized name', rows: maps.byNormalizedName.get(normalizedName) || [] },
  ];

  for (const stage of matchStages) {
    if (stage.rows.length > 1) {
      return {
        record: null,
        ambiguous: true,
        matchedOn: stage.matchedOn,
      };
    }

    if (stage.rows.length === 1) {
      return {
        record: stage.rows[0],
        ambiguous: false,
        matchedOn: stage.matchedOn,
      };
    }
  }

  return {
    record: null,
    ambiguous: false,
    matchedOn: null as string | null,
  };
}

async function findExistingModelMatch(
  manufacturerId: string,
  assetTypeId: string,
  modelCode: string
) {
  const rows = await sequelize.query<{
    id: string;
    model_code: string | null;
    model_name: string;
  }>(
    `
    SELECT id::text AS id, model_code, model_name
    FROM component_models
    WHERE manufacturer_id = :manufacturerId
      AND asset_type_id = :assetTypeId
      AND (
        UPPER(BTRIM(model_code)) = :modelCode
        OR UPPER(BTRIM(model_name)) = :modelCode
        OR UPPER(BTRIM(model_name)) LIKE :legacyPrefix
      )
    ORDER BY created_at ASC NULLS LAST, model_name ASC
    `,
    {
      replacements: {
        manufacturerId,
        assetTypeId,
        modelCode,
        legacyPrefix: `${modelCode} %`,
      },
      type: QueryTypes.SELECT,
    }
  );

  const codeMatches = rows.filter((row) => normalizeCode(row.model_code) === modelCode);
  const legacyMatches = rows.filter((row) => {
    const modelName = normalizeCode(row.model_name);
    return modelName === modelCode || modelName.startsWith(`${modelCode} `);
  });

  if (codeMatches.length > 1 || (!codeMatches.length && legacyMatches.length > 1)) {
    return { status: 'DUPLICATE_CONFLICT' as const, matchCount: rows.length };
  }

  if (codeMatches.length === 1) {
    return { status: 'EXISTING_CODE_MATCH' as const, matchCount: 1 };
  }

  if (legacyMatches.length === 1) {
    return { status: 'LEGACY_NAME_MATCH' as const, matchCount: 1 };
  }

  return { status: 'NEW' as const, matchCount: 0 };
}

async function buildPreview(buffer: Buffer) {
  const csvRows = getCsvRows(buffer);
  const {
    manufacturersByCode,
    manufacturersByExactName,
    manufacturersByNormalizedName,
    assetTypesByCode,
    assetTypesByExactName,
    assetTypesByNormalizedName,
  } = await loadReferenceMaps();
  const seenImportKeys = new Set<string>();
  const previewRows: PiperModelMasterPreviewRow[] = [];

  for (const [index, csvRow] of csvRows.entries()) {
    const manufacturerInput = normalizeText(
      csvRow.manufacturer_code ||
        csvRow.manufacturer ||
        csvRow.manufacturer_name
    );
    const assetTypeInput = normalizeText(
      csvRow.asset_type_code ||
        csvRow.asset_type ||
        csvRow.asset_type_name
    );
    const values: PiperModelMasterValues = {
      manufacturer: manufacturerInput,
      asset_type: assetTypeInput,
      manufacturer_code: normalizeCode(csvRow.manufacturer_code),
      asset_type_code: normalizeCode(csvRow.asset_type_code),
      model_code: normalizeCode(csvRow.model_code),
      model_name: normalizeText(csvRow.model_name),
      family: normalizeText(csvRow.family),
      series: normalizeText(csvRow.series),
      notes: normalizeText(csvRow.notes),
      is_active: normalizeBoolean(csvRow.is_active),
    };
    const rowNumber = index + 2;
    const errors: string[] = [];
    const reviewReasons: string[] = [];
    const manufacturerResolution = resolveReference(manufacturerInput, {
      byCode: manufacturersByCode,
      byExactName: manufacturersByExactName,
      byNormalizedName: manufacturersByNormalizedName,
    });
    const assetTypeResolution = resolveReference(assetTypeInput, {
      byCode: assetTypesByCode,
      byExactName: assetTypesByExactName,
      byNormalizedName: assetTypesByNormalizedName,
    });
    const manufacturer = manufacturerResolution.record as any;
    const assetType = assetTypeResolution.record as any;

    if (!manufacturerInput) reviewReasons.push('Manufacturer is required.');
    if (!assetTypeInput) reviewReasons.push('Asset type is required.');
    if (!values.model_code) errors.push('model_code is required.');
    if (values.model_code.length > 100) errors.push('model_code exceeds 100 characters.');
    if (values.model_name.length > 255) errors.push('model_name exceeds 255 characters.');
    if (manufacturerInput && manufacturerResolution.ambiguous) {
      reviewReasons.push(`Manufacturer ${manufacturerInput} matched multiple records.`);
    } else if (manufacturerInput && !manufacturer) {
      reviewReasons.push(`Manufacturer ${manufacturerInput} was not found.`);
    }
    if (assetTypeInput && assetTypeResolution.ambiguous) {
      reviewReasons.push(`Asset type ${assetTypeInput} matched multiple records.`);
    } else if (assetTypeInput && !assetType) {
      reviewReasons.push(`Asset type ${assetTypeInput} was not found.`);
    }
    if (
      values.model_code &&
      values.model_name &&
      normalizeCode(values.model_name).startsWith(`${values.model_code} `)
    ) {
      errors.push('model_name appears to contain a combined code/name value.');
    }

    if (errors.length) {
      previewRows.push({
        rowNumber,
        status: 'INVALID',
        reason: errors.join(' '),
        values,
        manufacturer_id: manufacturer?.id || null,
        asset_type_id: assetType?.id || null,
        manufacturer_display: manufacturer
          ? `${manufacturer.name}${manufacturer.code ? ` (${manufacturer.code})` : ''}`
          : null,
        asset_type_display: assetType
          ? `${assetType.label}${assetType.code ? ` (${assetType.code})` : ''}`
          : null,
      });
      continue;
    }

    if (reviewReasons.length) {
      previewRows.push({
        rowNumber,
        status: 'REVIEW_REQUIRED',
        reason: reviewReasons.join(' '),
        values,
        manufacturer_id: manufacturer?.id || null,
        asset_type_id: assetType?.id || null,
        manufacturer_display: manufacturer
          ? `${manufacturer.name}${manufacturer.code ? ` (${manufacturer.code})` : ''}`
          : null,
        asset_type_display: assetType
          ? `${assetType.label}${assetType.code ? ` (${assetType.code})` : ''}`
          : null,
      });
      continue;
    }

    const importKey = [
      manufacturer.id,
      assetType.id,
      values.model_code,
    ].join('\u001f');

    if (seenImportKeys.has(importKey)) {
      previewRows.push({
        rowNumber,
        status: 'DUPLICATE_CONFLICT',
        reason: 'Duplicate model_code appears in this import file.',
        values,
        manufacturer_id: manufacturer.id,
        asset_type_id: assetType.id,
        manufacturer_display: `${manufacturer.name}${manufacturer.code ? ` (${manufacturer.code})` : ''}`,
        asset_type_display: `${assetType.label}${assetType.code ? ` (${assetType.code})` : ''}`,
      });
      continue;
    }

    seenImportKeys.add(importKey);

    const match = await findExistingModelMatch(
      manufacturer.id,
      assetType.id,
      values.model_code
    );

    const reasonByStatus: Record<PiperModelMasterStatus, string> = {
      NEW: 'Ready to create component_models row.',
      EXISTING_CODE_MATCH: 'Existing component model already has this model_code.',
      LEGACY_NAME_MATCH:
        'Existing component model appears to contain this code in model_name; skipped for manual review.',
      DUPLICATE_CONFLICT:
        'Multiple existing component models match this code/name identity.',
      REVIEW_REQUIRED: '',
      INVALID: '',
    };

    previewRows.push({
      rowNumber,
      status: match.status,
      reason: reasonByStatus[match.status],
      values,
      manufacturer_id: manufacturer.id,
      asset_type_id: assetType.id,
      manufacturer_display: `${manufacturer.name}${manufacturer.code ? ` (${manufacturer.code})` : ''}`,
      asset_type_display: `${assetType.label}${assetType.code ? ` (${assetType.code})` : ''}`,
    });
  }

  return {
    totalRows: previewRows.length,
    rows: previewRows,
    counts: buildCounts(previewRows),
  } satisfies PiperModelMasterPreview;
}

async function commitPreview(preview: PiperModelMasterPreview) {
  return sequelize.transaction(async (transaction) => {
    const rows = [];
    let created = 0;
    let skipped = 0;

    for (const row of preview.rows) {
      if (row.status !== 'NEW') {
        skipped += 1;
        rows.push({
          rowNumber: row.rowNumber,
          status: `SKIPPED - ${row.status}`,
          model_code: row.values.model_code,
          model_name: row.values.model_name,
          reason: row.reason,
        });
        continue;
      }

      const duplicate = await findExistingModelMatch(
        row.manufacturer_id as string,
        row.asset_type_id as string,
        row.values.model_code
      );

      if (duplicate.status !== 'NEW') {
        skipped += 1;
        rows.push({
          rowNumber: row.rowNumber,
          status: `SKIPPED - ${duplicate.status}`,
          model_code: row.values.model_code,
          model_name: row.values.model_name,
          reason: 'Model became non-new before commit.',
        });
        continue;
      }

      const noteParts = [
        row.values.notes,
        row.values.family ? `Family: ${row.values.family}` : '',
        row.values.series ? `Series: ${row.values.series}` : '',
        'Source: Generic Model Import',
      ].filter(Boolean);

      await ComponentModel.create(
        {
          manufacturer_id: row.manufacturer_id,
          asset_type_id: row.asset_type_id,
          model_code: row.values.model_code,
          model_name: row.values.model_name || row.values.model_code,
          maintenance_notes: noteParts.join('\n') || null,
          is_active: row.values.is_active,
          is_life_limited: false,
        },
        { transaction }
      );

      created += 1;
      rows.push({
        rowNumber: row.rowNumber,
        status: 'CREATED',
        model_code: row.values.model_code,
        model_name: row.values.model_name || row.values.model_code,
        reason: 'Created component_models row.',
      });
    }

    return {
      totalRows: preview.totalRows,
      created,
      skipped,
      rows,
    };
  });
}

export class PiperModelMasterImportController {
  static renderImportForm(_req: Request, res: Response) {
    res.render('library/models/import', {
      title: 'Generic Model Import',
    });
  }

  static downloadTemplate(_req: Request, res: Response) {
    res
      .type('text/csv')
      .attachment('generic-model-import-template.csv')
      .send(`${MODEL_IMPORT_TEMPLATE_CSV}\n`);
  }

  static async previewImport(req: Request, res: Response) {
    const file = (req as Request & { file?: Express.Multer.File }).file;

    if (!file) {
      return res.status(400).render('library/models/import', {
        title: 'Generic Model Import',
        csrfToken: getCsrfToken(req),
        messages: {
          ...(res.locals.messages || {}),
          error: ['No model import CSV file uploaded.'],
        },
      });
    }

    try {
      const preview = await buildPreview(file.buffer);
      const importState: PiperModelMasterSessionState = {
        token: randomUUID(),
        createdAt: Date.now(),
        fileName: file.originalname || 'model import CSV',
        preview,
      };

      req.session.piperModelMasterImportState = importState;

      return res.render('library/models/preview', {
        title: 'Generic Model Import Preview',
        csrfToken: getCsrfToken(req),
        fileName: importState.fileName,
        importToken: importState.token,
        preview,
      });
    } catch (error: any) {
      return res.status(400).render('library/models/import', {
        title: 'Generic Model Import',
        csrfToken: getCsrfToken(req),
        messages: {
          ...(res.locals.messages || {}),
          error: [error?.message || 'Unable to parse model import CSV.'],
        },
      });
    }
  }

  static async commitImport(req: Request, res: Response) {
    const importToken = normalizeText(req.body?.import_token);
    const importState = getValidImportState(req);

    if (!importState || !importToken || importState.token !== importToken) {
      return res.status(400).render('library/models/import', {
        title: 'Generic Model Import',
        messages: {
          ...(res.locals.messages || {}),
          error: ['Model import preview context is missing. Upload the file again.'],
        },
      });
    }

    const result = await commitPreview(importState.preview as PiperModelMasterPreview);
    delete req.session.piperModelMasterImportState;

    return res.render('library/models/result', {
      title: 'Generic Model Import Result',
      fileName: importState.fileName,
      result,
    });
  }
}

export const piperModelMasterImportTestHooks = {
  buildPreview,
  commitPreview,
};
