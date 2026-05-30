import { randomUUID } from 'crypto';
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

type SbImportSessionState = NonNullable<Request['session']['sbImportState']>;
type SbBoundedFieldKey =
  | 'manufacturer'
  | 'reference'
  | 'title'
  | 'revision'
  | 'status'
  | 'category'
  | 'applicability_make'
  | 'applicability_model'
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
  { key: 'applicability_model', label: 'Applicability Model', maxLength: 255 },
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

async function hasExistingSbDuplicate(
  manufacturer: string,
  reference: string,
  revision: string | null,
  transaction: any
) {
  const match = await ServiceBulletin.findOne({
    where: {
      manufacturer: normalizeString(manufacturer),
      sb_number: normalizeString(reference),
      revision,
    } as any,
    transaction,
  });

  return Boolean(match);
}

async function insertServiceBulletinRow(
  row: SbPreviewRow,
  preview: SbPreviewResult,
  revision: string | null,
  transaction: any
) {
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
  const piperMetadata =
    row.values.piper_metadata && typeof row.values.piper_metadata === 'object'
      ? row.values.piper_metadata
      : {};
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

  await sequelize.query(
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
    }
  );
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

      if (
        await hasExistingSbDuplicate(
          row.values.manufacturer,
          row.values.reference,
          revision,
          transaction
        )
      ) {
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
        await insertServiceBulletinRow(row, preview, revision, transaction);
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

  static previewImport(req: Request, res: Response) {
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
        previewSbImportFile(file.buffer, file.originalname, selectedAdapter)
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
