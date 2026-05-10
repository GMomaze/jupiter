import { Request, Response } from 'express';
import {
  previewSbImportFile,
  SB_ADAPTER_OPTIONS,
  SbPreviewResult,
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

function encodePreviewPayload(preview: SbPreviewResult) {
  return Buffer.from(JSON.stringify(preview), 'utf8').toString('base64');
}

function decodePreviewPayload(payload: string) {
  return JSON.parse(Buffer.from(payload, 'base64').toString('utf8')) as SbPreviewResult;
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

      await ServiceBulletin.create(
        {
          manufacturer: normalizeString(row.values.manufacturer),
          sb_number: normalizeString(row.values.reference),
          title: normalizeString(row.values.title),
          issued_on: normalizeOptionalText(row.values.issue_date),
          revision,
          status: normalizeOptionalText(row.values.status) || 'ACTIVE',
          category: normalizeOptionalText(row.values.category),
          applicability_make: normalizeOptionalText(row.values.applicability_make),
          applicability_model: normalizeOptionalText(row.values.applicability_model),
          applicability_product_type: normalizeOptionalText(
            row.values.applicability_product_type
          ),
          applicability_notes: normalizeOptionalText(row.values.applicability_notes),
          description: normalizeOptionalText(row.values.summary),
          compliance_type:
            normalizeOptionalText(row.values.compliance_requirement) || 'MANUAL',
          document_url: normalizeOptionalText(row.values.source_file),
          source_primary: normalizeOptionalText(row.values.source_format) || preview.adapterUsed,
          raw_source_text: normalizeOptionalText(row.values.raw_source_text),
          is_active: row.values.is_active ?? true,
          source_refs: [
            {
              provider:
                normalizeOptionalText(row.values.source_format) || preview.adapterUsed,
              reference: normalizeString(row.values.reference),
              metadata: {
                source_file: normalizeOptionalText(row.values.source_file),
                adapter_used: preview.adapterUsed,
              },
            },
          ],
        } as any,
        { transaction }
      );

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

    if (!file) {
      return res.status(400).render('library/sbs/import', {
        title: 'SB Import Preview',
        adapterOptions: SB_ADAPTER_OPTIONS,
        selectedAdapter,
        messages: {
          ...(res.locals.messages || {}),
          error: ['No SB CSV file uploaded.'],
        },
      });
    }

    try {
      const preview = previewSbImportFile(
        file.buffer,
        file.originalname,
        selectedAdapter
      );

      return res.render('library/sbs/preview', {
        title: 'SB Import Preview',
        fileName: file.originalname,
        preview,
        previewPayload: encodePreviewPayload(preview),
      });
    } catch (error: any) {
      return res.status(400).render('library/sbs/import', {
        title: 'SB Import Preview',
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
    const payload = normalizeString(req.body?.preview_payload);

    if (!payload) {
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
      const preview = decodePreviewPayload(payload);
      const result = await commitSbPreview(preview);

      return res.render('library/sbs/result', {
        title: 'SB Import Result',
        fileName: normalizeString(req.body?.file_name) || preview.fileName,
        adapterUsed: preview.adapterUsed,
        result,
      });
    } catch (error: any) {
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
