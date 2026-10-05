import fs from 'node:fs/promises';
import path from 'node:path';
import type { PlatformMutationEvidence } from '../platform-authority/authoritative-platform-mutation.js';
import { DurableFileOperationService, FILE_CONTENT_TYPES, PLATFORM_FILE_ROOTS, type FileMediaType } from './durable-file-operation.js';
import { platformFileOperationRepository, type FileOperationRecord } from './platform-file-operation.repository.js';

const lifecycle = new DurableFileOperationService(platformFileOperationRepository, fs, PLATFORM_FILE_ROOTS);
const issuedInputs = new WeakSet<object>();
export type SbSyncFileInputs = Readonly<{ veryonCsvPath: string | null; piperPdfPath: string | null }>;

export function requireSbSyncFileInputs(value: SbSyncFileInputs): SbSyncFileInputs {
  if (!value || !issuedInputs.has(value)) throw new Error('SB_SYNC_FILE_INPUT_REQUIRED');
  return value;
}

async function trustedScheduledPath(rootValue: string | undefined, sourceValue: string | undefined) {
  if (!rootValue || !sourceValue) throw new Error('SB_SYNC_SCHEDULED_SOURCE_REQUIRED');
  const root = await fs.realpath(path.resolve(rootValue));
  const source = path.resolve(sourceValue);
  const relative = path.relative(root, source);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('SB_SYNC_SCHEDULED_SOURCE_OUTSIDE_ROOT');
  const metadata = await fs.lstat(source);
  if (metadata.isSymbolicLink() || (!metadata.isFile() && !metadata.isDirectory())) throw new Error('SB_SYNC_SCHEDULED_SOURCE_UNSAFE');
  const resolved = await fs.realpath(source);
  const resolvedRelative = path.relative(root, resolved);
  if (resolvedRelative === '..' || resolvedRelative.startsWith(`..${path.sep}`) || path.isAbsolute(resolvedRelative)) throw new Error('SB_SYNC_SCHEDULED_SOURCE_OUTSIDE_ROOT');
  return resolved;
}

export async function scheduledSbSyncFiles(method: string): Promise<SbSyncFileInputs> {
  const files = Object.freeze({
    veryonCsvPath: method === 'VERYON' || method === 'ALL'
      ? await trustedScheduledPath(process.env.SB_SYNC_VERYON_TRUSTED_ROOT, process.env.SB_SYNC_VERYON_SOURCE)
      : null,
    piperPdfPath: method === 'PIPER_PDF' || method === 'ALL'
      ? await trustedScheduledPath(process.env.SB_SYNC_PIPER_TRUSTED_ROOT, process.env.SB_SYNC_PIPER_SOURCE)
      : null,
  });
  issuedInputs.add(files);
  return files;
}

async function prepare(evidence: PlatformMutationEvidence, file: Express.Multer.File, media: FileMediaType) {
  if (file.mimetype !== media) throw new Error('SB_SYNC_DECLARED_MIME_INVALID');
  const quarantine = await lifecycle.quarantine('SB_IMPORT_QUARANTINE', file.buffer);
  let id: string | undefined;
  try {
    const destinationName = lifecycle.serverName(media);
    id = await platformFileOperationRepository.prepare({
      correlationId: evidence.correlationId,
      principalId: evidence.authority.principalId,
      operationKind: 'EPHEMERAL_IMPORT',
      quarantineRootKey: 'SB_IMPORT_QUARANTINE',
      destinationRootKey: 'SB_IMPORT_EPHEMERAL',
      quarantineName: quarantine.name,
      destinationName,
      originalName: path.basename(file.originalname),
      declaredMime: media,
    });
    if (!id) throw new Error('SB_SYNC_FILE_JOURNAL_REQUIRED');
    await lifecycle.validate(await platformFileOperationRepository.get(id), FILE_CONTENT_TYPES.serviceBulletinImport);
    return { id, destinationName };
  } catch (error) {
    if (id) await lifecycle.recover(await platformFileOperationRepository.get(id), async () => false);
    else await lifecycle.safeDelete('SB_IMPORT_QUARANTINE', quarantine.name);
    throw error;
  }
}

export async function runSbSyncFileMutation<T>(input: {
  evidence: PlatformMutationEvidence;
  veryonCsv?: Express.Multer.File | undefined;
  piperPdf?: Express.Multer.File | undefined;
  mutate: (files: SbSyncFileInputs) => Promise<T>;
}): Promise<T> {
  const operations: Array<{ id: string; destinationName: string }> = [];
  try {
    if (input.veryonCsv) operations.push(await prepare(input.evidence, input.veryonCsv, 'text/csv'));
    if (input.piperPdf) operations.push(await prepare(input.evidence, input.piperPdf, 'application/pdf'));
    for (const operation of operations) await lifecycle.promote(await platformFileOperationRepository.get(operation.id));
    const files = Object.freeze({
      veryonCsvPath: input.veryonCsv ? path.join(PLATFORM_FILE_ROOTS.SB_IMPORT_EPHEMERAL, operations[0]!.destinationName) : null,
      piperPdfPath: input.piperPdf ? path.join(PLATFORM_FILE_ROOTS.SB_IMPORT_EPHEMERAL, operations.at(-1)!.destinationName) : null,
    });
    issuedInputs.add(files);
    return await input.mutate(files);
  } finally {
    for (const operation of operations.reverse()) {
      const record: FileOperationRecord = await platformFileOperationRepository.get(operation.id);
      await lifecycle.recover(record, async () => false);
    }
  }
}
