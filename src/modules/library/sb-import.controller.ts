import { createHash, randomUUID } from 'crypto';
import { Request, Response } from 'express';
import {
  previewSbImportFile,
  SB_ADAPTER_OPTIONS,
  SbPreviewResult,
  SbPreviewRow,
  SbPreviewValues,
} from './sb-import.adapters.js';
import sequelize from '../../config/database.js';
import { ServiceBulletin } from '../../models/ServiceBulletin.js';
import { QueryTypes } from 'sequelize';
import { formatModelDisplay } from '../../utils/model-display.js';

function normalizeString(value: unknown) {
  return String(value ?? '').trim();
}

type SbCommitRowResult = {
  rowNumber: number;
  status: 'INSERTED' | 'SKIPPED - INVALID' | 'SKIPPED - DUPLICATE';
  reason: string;
  manufacturer: string;
  reference: string;
};

type SbCommitResult = {
  totalRowsProcessed: number;
  totalValidRows: number;
  totalInsertedSbs: number;
  totalSkippedInvalid: number;
  totalSkippedDuplicate: number;
  rows: SbCommitRowResult[];
};

type MatchedModelReference = {
  id: string;
  model_name: string;
  model_code: string | null;
  display_name: string;
  matched_on: 'model_code' | 'model_name';
};

type SbModelAllocationClassification =
  | 'EXACT_MODEL_CODE'
  | 'SHORTHAND_GROUP'
  | 'BROAD_APPLICABILITY'
  | 'AMBIGUOUS_PHRASE'
  | 'UNPARSED_TEXT';

type SbModelAllocationStatus = 'MATCHED' | 'NEEDS_REVIEW';

type SbImportSessionState = NonNullable<Request['session']['sbImportState']>;
type SbBoundedFieldKey =
  | 'manufacturer'
  | 'reference'
  | 'title'
  | 'revision'
  | 'status'
  | 'category'
  | 'applicability_make'
  | 'applicability_product_type'
  | 'compliance_requirement'
  | 'source_format';

const SB_IMPORT_STATE_MAX_AGE_MS = 30 * 60 * 1000;
const SB_BOUNDED_FIELD_LIMITS: Array<{
  key: SbBoundedFieldKey;
  label: string;
  maxLength: number;
}> = [
  { key: 'manufacturer', label: 'Manufacturer', maxLength: 255 },
  { key: 'reference', label: 'Reference', maxLength: 255 },
  { key: 'title', label: 'Title', maxLength: 255 },
  { key: 'revision', label: 'Revision', maxLength: 255 },
  { key: 'status', label: 'Status', maxLength: 255 },
  { key: 'category', label: 'Category', maxLength: 255 },
  { key: 'applicability_make', label: 'Applicability Make', maxLength: 255 },
  {
    key: 'applicability_product_type',
    label: 'Applicability Product Type',
    maxLength: 255,
  },
  {
    key: 'compliance_requirement',
    label: 'Compliance Requirement',
    maxLength: 255,
  },
  { key: 'source_format', label: 'Source Format', maxLength: 255 },
];

class SbImportRowError extends Error {
  constructor(
    readonly rowNumber: number,
    readonly reference: string,
    readonly manufacturer: string,
    readonly fieldLabel: string | null,
    reason: string,
    readonly recommendedAction: string
  ) {
    const referencePart = reference ? ` — ${reference}` : '';
    const manufacturerPart = manufacturer ? ` (${manufacturer})` : '';
    const fieldPrefix = fieldLabel ? `${fieldLabel} ` : 'Import row ';
    super(
      `Row ${rowNumber}${referencePart}${manufacturerPart} — ${fieldPrefix}${reason} ${recommendedAction}`.trim()
    );
    this.name = 'SbImportRowError';
  }
}

function normalizeOptionalText(value: string) {
  const normalized = normalizeString(value);
  return normalized || null;
}

function buildDuplicateKey(manufacturer: string, reference: string, revision: string) {
  return [
    normalizeString(manufacturer).toUpperCase(),
    normalizeString(reference).toUpperCase(),
    normalizeString(revision).toUpperCase(),
  ].join('\u001f');
}

function getPiperMetadata(values: SbPreviewValues) {
  return values.piper_metadata && typeof values.piper_metadata === 'object'
    ? values.piper_metadata
    : {};
}

function splitModelApplicabilityTokens(value: unknown) {
  return Array.from(
    new Set(
      normalizeString(value)
        .split(/[;,|]+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

function normalizeAllocationToken(value: unknown) {
  return normalizeString(value).replace(/\s+/g, ' ').toUpperCase();
}

function isBroadApplicabilityPhrase(token: string) {
  return /\ball\b/i.test(token) || /\bmanufactured\s+thr(?:u|ough)\b/i.test(token);
}

function isAmbiguousApplicabilityPhrase(token: string) {
  return /\bseries\b/i.test(token);
}

function isShorthandModelGroup(token: string) {
  return /\/|(?:^|[-\s])\/?-?\d/.test(token) && /[A-Z]/i.test(token);
}

function isModelLookingToken(token: string) {
  return /^[A-Z0-9]+(?:-[A-Z0-9]+)*(?:\s+[A-Z0-9]+)*$/i.test(token);
}

function classifyModelApplicabilityToken(
  token: string,
  matchedModel: MatchedModelReference | null
): SbModelAllocationClassification {
  if (isBroadApplicabilityPhrase(token)) {
    return 'BROAD_APPLICABILITY';
  }

  if (matchedModel || isModelLookingToken(token)) {
    return 'EXACT_MODEL_CODE';
  }

  if (isShorthandModelGroup(token)) {
    return 'SHORTHAND_GROUP';
  }

  if (isAmbiguousApplicabilityPhrase(token)) {
    return 'AMBIGUOUS_PHRASE';
  }

  return 'UNPARSED_TEXT';
}

function buildAllocationSourceHash(
  sourceAdapter: string,
  rawModelsAffectedText: string,
  normalizedToken: string
) {
  return createHash('sha256')
    .update([sourceAdapter, rawModelsAffectedText, normalizedToken].join('\u001f'))
    .digest('hex');
}

async function resolveComponentModelsByIdentity(modelTokens: string[]) {
  if (modelTokens.length === 0) {
    return new Map<string, MatchedModelReference>();
  }

  const normalizedTokens = modelTokens.map((modelName) => modelName.toUpperCase());
  const rows = await sequelize.query<{
    id: string;
    model_name: string;
    model_code: string | null;
  }>(
    `
    SELECT id::text AS id, model_name, model_code
    FROM component_models
    WHERE UPPER(BTRIM(model_code)) IN (:modelTokens)
       OR UPPER(BTRIM(model_name)) IN (:modelTokens)
    ORDER BY
      CASE WHEN UPPER(BTRIM(model_code)) IN (:modelTokens) THEN 0 ELSE 1 END,
      model_code ASC NULLS LAST,
      model_name ASC
    `,
    {
      replacements: {
        modelTokens: normalizedTokens,
      },
      type: QueryTypes.SELECT,
    }
  );

  const modelsByToken = new Map<string, MatchedModelReference>();

  rows.forEach((row) => {
    const candidateKeys = [
      { key: normalizeString(row.model_code).toUpperCase(), matched_on: 'model_code' as const },
      { key: normalizeString(row.model_name).toUpperCase(), matched_on: 'model_name' as const },
    ].filter((candidate) => candidate.key && normalizedTokens.includes(candidate.key));

    candidateKeys.forEach((candidate) => {
      if (modelsByToken.has(candidate.key)) {
        return;
      }

      modelsByToken.set(candidate.key, {
        id: row.id,
        model_name: row.model_name,
        model_code: row.model_code,
        display_name: formatModelDisplay(row),
        matched_on: candidate.matched_on,
      });
    });
  });

  return modelsByToken;
}

async function enrichPiperModelApplicability(preview: SbPreviewResult) {
  if (preview.adapterUsed !== 'PIPER') {
    return preview;
  }

  const tokensByRow = preview.rows.map((row) =>
    splitModelApplicabilityTokens(row.values.applicability_model)
  );
  const uniqueTokens = Array.from(new Set(tokensByRow.flat()));
  const modelsByIdentity = await resolveComponentModelsByIdentity(uniqueTokens);

  preview.rows.forEach((row, index) => {
    const tokens = tokensByRow[index] || [];
    const matchedModels: MatchedModelReference[] = [];
    const unmatchedModels: string[] = [];

    tokens.forEach((token) => {
      const matched = modelsByIdentity.get(token.toUpperCase());
      if (matched) {
        matchedModels.push(matched);
        return;
      }

      unmatchedModels.push(token);
    });

    row.values.piper_metadata = {
      ...getPiperMetadata(row.values),
      models_affected: row.values.applicability_model || null,
      matched_models: matchedModels,
      unmatched_models: unmatchedModels,
    };
  });

  return preview;
}

function getCsrfToken(req: Request) {
  return typeof req.csrfToken === 'function' ? req.csrfToken() : null;
}

function createSbImportSessionState(
  fileName: string,
  preview: SbPreviewResult
): SbImportSessionState {
  return {
    token: randomUUID(),
    createdAt: Date.now(),
    fileName: normalizeString(fileName) || 'Uploaded SB file',
    preview,
  };
}

function getValidSbImportSessionState(req: Request) {
  const state = req.session?.sbImportState;

  if (!state) {
    return null;
  }

  if (Date.now() - state.createdAt > SB_IMPORT_STATE_MAX_AGE_MS) {
    delete req.session.sbImportState;
    return null;
  }

  return state;
}

function buildMaxLengthMessage(fieldLabel: string, maxLength: number) {
  return `${fieldLabel} exceeds maximum length of ${maxLength} characters.`;
}

function buildSchemaGuidance(fieldLabel: string) {
  return `Shorten the ${fieldLabel.toLowerCase()} value or update the schema if longer SB data is operationally valid.`;
}

function getBoundedFieldOverflow(values: SbPreviewValues) {
  for (const field of SB_BOUNDED_FIELD_LIMITS) {
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

function buildRowErrorFromDatabaseError(row: SbPreviewRow, error: any) {
  const overflow = getBoundedFieldOverflow(row.values);
  if (overflow) {
    return new SbImportRowError(
      row.rowNumber,
      normalizeString(row.values.reference),
      normalizeString(row.values.manufacturer),
      overflow.fieldLabel,
      `exceeds maximum length of ${overflow.maxLength} characters (${overflow.actualLength} provided).`,
      buildSchemaGuidance(overflow.fieldLabel)
    );
  }

  const rawMessage =
    error?.original?.message || error?.parent?.message || error?.message || 'Database write failed.';

  return new SbImportRowError(
    row.rowNumber,
    normalizeString(row.values.reference),
    normalizeString(row.values.manufacturer),
    null,
    `failed during database commit: ${rawMessage}`,
    'Review this row for unsupported values and retry the import.'
  );
}

function renderSbPreviewPage(
  req: Request,
  res: Response,
  state: SbImportSessionState,
  messages?: { success?: string[]; error?: string[] }
) {
  return res.render('library/sbs/preview', {
    title: 'SB Import Preview',
    csrfToken: getCsrfToken(req),
    fileName: state.fileName,
    importToken: state.token,
    preview: state.preview,
    messages,
  });
}

async function findExistingSbDuplicate(
  manufacturer: string,
  reference: string,
  revision: string | null,
  transaction: any
) {
  return ServiceBulletin.findOne({
    where: {
      manufacturer: normalizeString(manufacturer),
      sb_number: normalizeString(reference),
      revision,
    } as any,
    transaction,
  });
}

async function attachMatchedModelsToServiceBulletin(
  serviceBulletinId: string,
  values: SbPreviewValues,
  transaction: any
) {
  const metadata = getPiperMetadata(values);
  const matchedModels = Array.isArray(metadata.matched_models)
    ? (metadata.matched_models as MatchedModelReference[])
    : [];
  const uniqueModelIds = Array.from(
    new Set(
      matchedModels
        .map((model) => normalizeString(model?.id))
        .filter(Boolean)
    )
  );

  for (const modelId of uniqueModelIds) {
    await sequelize.query(
      `
      INSERT INTO service_bulletin_models (
        service_bulletin_id,
        model_id
      ) VALUES (
        :serviceBulletinId,
        :modelId
      )
      ON CONFLICT (service_bulletin_id, model_id) DO NOTHING
      `,
      {
        replacements: {
          serviceBulletinId,
          modelId,
        },
        transaction,
      }
    );
  }
}

async function writeModelApplicabilityAllocations(
  serviceBulletinId: string,
  row: SbPreviewRow,
  preview: SbPreviewResult,
  transaction: any
) {
  if (preview.adapterUsed !== 'PIPER') {
    return;
  }

  const metadata = getPiperMetadata(row.values);
  const rawModelsAffectedText = normalizeString(
    metadata.models_affected || row.values.applicability_model
  );

  if (!rawModelsAffectedText) {
    return;
  }

  const parsedTokens = splitModelApplicabilityTokens(rawModelsAffectedText);
  if (parsedTokens.length === 0) {
    return;
  }

  const matchedModels = Array.isArray(metadata.matched_models)
    ? (metadata.matched_models as MatchedModelReference[])
    : [];
  const unmatchedTokens = Array.isArray(metadata.unmatched_models)
    ? (metadata.unmatched_models as string[])
    : [];
  const shorthandExpansions = Array.isArray(metadata.shorthand_expansions)
    ? metadata.shorthand_expansions
    : [];
  const matchedModelsByToken = new Map(
    matchedModels.flatMap((model) =>
      [model.model_code, model.model_name]
        .map((value) => normalizeAllocationToken(value))
        .filter(Boolean)
        .map((key) => [key, model] as const)
    )
  );
  const sourceAdapter = normalizeString(row.values.source_format) || preview.adapterUsed;

  for (const parsedToken of parsedTokens) {
    const normalizedToken = normalizeAllocationToken(parsedToken);
    const matchedModel = matchedModelsByToken.get(normalizedToken) || null;
    const status: SbModelAllocationStatus = matchedModel ? 'MATCHED' : 'NEEDS_REVIEW';
    const classification = classifyModelApplicabilityToken(parsedToken, matchedModel);
    const sourceHash = buildAllocationSourceHash(
      sourceAdapter,
      rawModelsAffectedText,
      normalizedToken
    );

    await sequelize.query(
      `
      INSERT INTO sb_model_applicability_allocations (
        service_bulletin_id,
        raw_models_affected_text,
        parsed_token,
        normalized_token,
        classification,
        status,
        matched_model_id,
        source_row,
        source_column,
        source_adapter,
        source_hash,
        parsed_tokens,
        matched_models,
        unmatched_tokens,
        shorthand_expansions,
        metadata
      ) VALUES (
        :serviceBulletinId,
        :rawModelsAffectedText,
        :parsedToken,
        :normalizedToken,
        :classification,
        :status,
        :matchedModelId,
        :sourceRow,
        :sourceColumn,
        :sourceAdapter,
        :sourceHash,
        CAST(:parsedTokens AS jsonb),
        CAST(:matchedModels AS jsonb),
        CAST(:unmatchedTokens AS jsonb),
        CAST(:shorthandExpansions AS jsonb),
        CAST(:metadata AS jsonb)
      )
      ON CONFLICT (service_bulletin_id, source_hash) DO UPDATE SET
        raw_models_affected_text = EXCLUDED.raw_models_affected_text,
        parsed_token = EXCLUDED.parsed_token,
        normalized_token = EXCLUDED.normalized_token,
        classification = EXCLUDED.classification,
        matched_model_id = EXCLUDED.matched_model_id,
        source_row = EXCLUDED.source_row,
        source_column = EXCLUDED.source_column,
        source_adapter = EXCLUDED.source_adapter,
        parsed_tokens = EXCLUDED.parsed_tokens,
        matched_models = EXCLUDED.matched_models,
        unmatched_tokens = EXCLUDED.unmatched_tokens,
        shorthand_expansions = EXCLUDED.shorthand_expansions,
        metadata = EXCLUDED.metadata,
        updated_at = CURRENT_TIMESTAMP
      `,
      {
        replacements: {
          serviceBulletinId,
          rawModelsAffectedText,
          parsedToken,
          normalizedToken,
          classification,
          status,
          matchedModelId: matchedModel?.id || null,
          sourceRow: Number(metadata.source_row || row.rowNumber) || null,
          sourceColumn: 'Models Affected',
          sourceAdapter,
          sourceHash,
          parsedTokens: JSON.stringify(parsedTokens),
          matchedModels: JSON.stringify(matchedModels),
          unmatchedTokens: JSON.stringify(unmatchedTokens),
          shorthandExpansions: JSON.stringify(shorthandExpansions),
          metadata: JSON.stringify({
            source_file: preview.fileName,
            adapter_used: preview.adapterUsed,
            original_status_text: metadata.original_status_text || null,
          }),
        },
        transaction,
      }
    );
  }
}

async function insertServiceBulletinRow(
  row: SbPreviewRow,
  preview: SbPreviewResult,
  revision: string | null,
  transaction: any
): Promise<string> {
  const manufacturer = normalizeString(row.values.manufacturer);
  const reference = normalizeString(row.values.reference);
  const title = normalizeString(row.values.title);
  const issueDate = normalizeOptionalText(row.values.issue_date);
  const status = normalizeOptionalText(row.values.status) || 'ACTIVE';
  const category = normalizeOptionalText(row.values.category);
  const applicabilityMake = normalizeOptionalText(row.values.applicability_make);
  const applicabilityModel = normalizeOptionalText(row.values.applicability_model);
  const applicabilityProductType = normalizeOptionalText(
    row.values.applicability_product_type
  );
  const applicabilityNotes = normalizeOptionalText(row.values.applicability_notes);
  const summary = normalizeOptionalText(row.values.summary);
  const complianceRequirement =
    normalizeOptionalText(row.values.compliance_requirement) || 'MANUAL';
  const sourceFile = normalizeOptionalText(row.values.source_file);
  const sourceFormat =
    normalizeOptionalText(row.values.source_format) || preview.adapterUsed;
  const rawSourceText = normalizeOptionalText(row.values.raw_source_text);
  const isActive = row.values.is_active ?? true;
  const piperMetadata = getPiperMetadata(row.values);
  const sourceRefs = JSON.stringify([
    {
      provider: sourceFormat,
      reference,
      metadata: {
        source_file: sourceFile,
        adapter_used: preview.adapterUsed,
        ...piperMetadata,
      },
    },
  ]);

  const insertedRows = await sequelize.query<{ id: string }>(
    `
      INSERT INTO public.service_bulletins (
        sb_number,
        title,
        description,
        issued_on,
        compliance_type,
        source_primary,
        source_refs,
        status,
        revision,
        document_url,
        manufacturer,
        reference,
        issue_date,
        category,
        applicability_make,
        applicability_model,
        applicability_product_type,
        applicability_notes,
        summary,
        compliance_requirement,
        source_file,
        source_format,
        raw_source_text,
        is_active
      ) VALUES (
        :reference,
        :title,
        :summary,
        :issueDate,
        :complianceRequirement,
        :sourceFormat,
        CAST(:sourceRefs AS jsonb),
        :status,
        :revision,
        :sourceFile,
        :manufacturer,
        :reference,
        :issueDate,
        :category,
        :applicabilityMake,
        :applicabilityModel,
        :applicabilityProductType,
        :applicabilityNotes,
        :summary,
        :complianceRequirement,
        :sourceFile,
        :sourceFormat,
        :rawSourceText,
        :isActive
      )
      RETURNING id::text AS id
    `,
    {
      replacements: {
        manufacturer,
        reference,
        title,
        issueDate,
        status,
        revision,
        category,
        applicabilityMake,
        applicabilityModel,
        applicabilityProductType,
        applicabilityNotes,
        summary,
        complianceRequirement,
        sourceFile,
        sourceFormat,
        rawSourceText,
        isActive,
        sourceRefs,
      },
      transaction,
      type: QueryTypes.SELECT,
    }
  );

  const insertedId = insertedRows[0]?.id;
  if (!insertedId) {
    throw new Error('Service Bulletin insert did not return an id.');
  }

  return insertedId;
}

async function commitSbPreview(preview: SbPreviewResult) {
  const duplicateKeysInBatch = new Set<string>();

  return sequelize.transaction(async (transaction) => {
    const rows: SbCommitRowResult[] = [];
    let totalInsertedSbs = 0;
    let totalSkippedDuplicate = 0;

    for (const row of preview.rows) {
      if (row.status === 'INVALID') {
        rows.push({
          rowNumber: row.rowNumber,
          status: 'SKIPPED - INVALID',
          reason: row.errors.join(' '),
          manufacturer: row.values.manufacturer,
          reference: row.values.reference,
        });
        continue;
      }

      const revision = normalizeOptionalText(row.values.revision);
      const duplicateKey = buildDuplicateKey(
        row.values.manufacturer,
        row.values.reference,
        revision || ''
      );

      if (duplicateKeysInBatch.has(duplicateKey)) {
        totalSkippedDuplicate += 1;
        rows.push({
          rowNumber: row.rowNumber,
          status: 'SKIPPED - DUPLICATE',
          reason: 'Duplicate detected in this import batch.',
          manufacturer: row.values.manufacturer,
          reference: row.values.reference,
        });
        continue;
      }

      const existingDuplicate = await findExistingSbDuplicate(
        row.values.manufacturer,
        row.values.reference,
        revision,
        transaction
      );

      if (existingDuplicate) {
        await attachMatchedModelsToServiceBulletin(
          existingDuplicate.id,
          row.values,
          transaction
        );
        await writeModelApplicabilityAllocations(
          existingDuplicate.id,
          row,
          preview,
          transaction
        );
        totalSkippedDuplicate += 1;
        duplicateKeysInBatch.add(duplicateKey);
        rows.push({
          rowNumber: row.rowNumber,
          status: 'SKIPPED - DUPLICATE',
          reason: 'Duplicate already exists in service_bulletins.',
          manufacturer: row.values.manufacturer,
          reference: row.values.reference,
        });
        continue;
      }

      try {
        const serviceBulletinId = await insertServiceBulletinRow(
          row,
          preview,
          revision,
          transaction
        );
        await attachMatchedModelsToServiceBulletin(
          serviceBulletinId,
          row.values,
          transaction
        );
        await writeModelApplicabilityAllocations(
          serviceBulletinId,
          row,
          preview,
          transaction
        );
      } catch (error: any) {
        throw buildRowErrorFromDatabaseError(row, error);
      }

      duplicateKeysInBatch.add(duplicateKey);
      totalInsertedSbs += 1;
      rows.push({
        rowNumber: row.rowNumber,
        status: 'INSERTED',
        reason: 'Inserted into service_bulletins.',
        manufacturer: row.values.manufacturer,
        reference: row.values.reference,
      });
    }

    return {
      totalRowsProcessed: preview.totalRows,
      totalValidRows: preview.validRowCount,
      totalInsertedSbs,
      totalSkippedInvalid: preview.invalidRowCount,
      totalSkippedDuplicate,
      rows,
    } satisfies SbCommitResult;
  });
}

function applyBoundedFieldValidation(preview: SbPreviewResult) {
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

export class SbImportController {
  static renderImportForm(_req: Request, res: Response) {
    res.render('library/sbs/import', {
      title: 'SB Import Preview',
      adapterOptions: SB_ADAPTER_OPTIONS,
      selectedAdapter: 'PIPER',
    });
  }

  static async previewImport(req: Request, res: Response) {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    const selectedAdapter = normalizeString(req.body?.adapter).toUpperCase() || 'PIPER';
    const csrfToken = getCsrfToken(req);

    if (!file) {
      return res.status(400).render('library/sbs/import', {
        title: 'SB Import Preview',
        csrfToken,
        adapterOptions: SB_ADAPTER_OPTIONS,
        selectedAdapter,
        messages: {
          ...(res.locals.messages || {}),
          error: ['No SB CSV file uploaded.'],
        },
      });
    }

    try {
      const preview = applyBoundedFieldValidation(
        await enrichPiperModelApplicability(
          previewSbImportFile(file.buffer, file.originalname, selectedAdapter)
        )
      );
      const importState = createSbImportSessionState(file.originalname, preview);

      req.session.sbImportState = importState;

      return renderSbPreviewPage(req, res, importState);
    } catch (error: any) {
      return res.status(400).render('library/sbs/import', {
        title: 'SB Import Preview',
        csrfToken,
        adapterOptions: SB_ADAPTER_OPTIONS,
        selectedAdapter,
        messages: {
          ...(res.locals.messages || {}),
          error: [error?.message || 'Unable to parse SB import preview.'],
        },
      });
    }
  }

  static async commitImport(req: Request, res: Response) {
    const importToken = normalizeString(req.body?.import_token);
    const importState = getValidSbImportSessionState(req);

    if (!importState || !importToken || importState.token !== importToken) {
      return res.status(400).render('library/sbs/import', {
        title: 'SB Import Preview',
        adapterOptions: SB_ADAPTER_OPTIONS,
        selectedAdapter: 'PIPER',
        messages: {
          ...(res.locals.messages || {}),
          error: ['SB preview context is missing. Upload the file again.'],
        },
      });
    }

    try {
      const result = await commitSbPreview(importState.preview);
      delete req.session.sbImportState;

      return res.render('library/sbs/result', {
        title: 'SB Import Result',
        fileName: importState.fileName,
        adapterUsed: importState.preview.adapterUsed,
        result,
      });
    } catch (error: any) {
      if (req.session?.sbImportState) {
        res.status(400);
        return renderSbPreviewPage(req, res, req.session.sbImportState, {
          ...(res.locals.messages || {}),
          error: [error?.message || 'Unable to commit SB import.'],
        });
      }

      return res.status(400).render('library/sbs/import', {
        title: 'SB Import Preview',
        adapterOptions: SB_ADAPTER_OPTIONS,
        selectedAdapter: 'PIPER',
        messages: {
          ...(res.locals.messages || {}),
          error: [error?.message || 'Unable to commit SB import.'],
        },
      });
    }
  }
}
