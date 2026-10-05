import {
  sequelize,
  ComponentModel,
  ServiceBulletin,
  ServiceBulletinModel,
  ServiceBulletinSyncRun,
} from '../../models/index.js';
import { ServiceBulletinService } from './service-bulletin.service.js';
import { VeryonAdapter } from './adapters/VeryonAdapter.js';
import { ATPAdapter } from './adapters/ATPAdapter.js';
import { PiperPdfAdapter } from './adapters/PiperPdfAdapter.js';
import type {
  ExternalServiceBulletin,
  ServiceBulletinSyncMethod,
} from './adapters/types.js';
import { Op, type Transaction } from 'sequelize';
import { randomUUID } from 'node:crypto';
import { pool } from '../../config/database.js';
import { PlatformAuthorityRepository } from '../platform-authority/platform-authority.repository.js';
import { executeAuthoritativePlatformMutation, platformServiceMutationEvidence, requirePlatformMutationOperations, type PlatformMutationEvidence } from '../platform-authority/authoritative-platform-mutation.js';
import { requireSbSyncFileInputs, scheduledSbSyncFiles, type SbSyncFileInputs } from '../uploads/service-bulletin-sync-file-boundary.js';
import { emitOperationalEvent } from '../observability/operational-event.js';

export type ServiceBulletinSyncOptions = {
  method?: ServiceBulletinSyncMethod;
  files: SbSyncFileInputs;
};

export class ServiceBulletinSyncService {
  static readonly supportedMethods: ServiceBulletinSyncMethod[] = ['ALL', 'VERYON', 'ATP', 'PIPER_PDF'];

  private static normalizeMethod(method?: string | null): ServiceBulletinSyncMethod {
    const normalized = method?.trim().toUpperCase();

    if (
      normalized === 'VERYON' ||
      normalized === 'ATP' ||
      normalized === 'PIPER_PDF' ||
      normalized === 'ALL'
    ) {
      return normalized;
    }

    if (!normalized) return 'ALL';
    throw new Error('SB_SYNC_METHOD_INVALID');
  }

  private static async collectExternalBulletins(
    models: any[],
    options: ServiceBulletinSyncOptions
  ): Promise<ExternalServiceBulletin[]> {
    const method = this.normalizeMethod(options.method);
    const files = requireSbSyncFileInputs(options.files);

    if (method === 'VERYON') {
      if (!files.veryonCsvPath) throw new Error('VERYON_SYNC_FILE_REQUIRED');
      return VeryonAdapter.buildForModels(models, {
        rootPath: files.veryonCsvPath,
      });
    }

    if (method === 'ATP') {
      return ATPAdapter.buildForModels(models);
    }

    if (method === 'PIPER_PDF') {
      if (!files.piperPdfPath) throw new Error('PIPER_SYNC_FILE_REQUIRED');
      return PiperPdfAdapter.buildForModels(models, {
        pdfPath: files.piperPdfPath,
      });
    }

    const [veryonBulletins, atpBulletins, piperPdfBulletins] = await Promise.all([
      files.veryonCsvPath ? VeryonAdapter.buildForModels(models, {
        rootPath: files.veryonCsvPath,
      }) : Promise.resolve([]),
      Promise.resolve(ATPAdapter.buildForModels(models)),
      files.piperPdfPath ? PiperPdfAdapter.buildForModels(models, {
        pdfPath: files.piperPdfPath,
      }) : Promise.resolve([]),
    ]);

    return [...veryonBulletins, ...atpBulletins, ...piperPdfBulletins].map(bulletin => ({
      ...bulletin,
      document_url: bulletin.source === 'PIPER_PDF' ? null : bulletin.document_url ?? null,
      description: bulletin.source === 'PIPER_PDF' ? 'Imported from configured Piper PDF index.' : bulletin.description ?? null,
      source_refs: bulletin.source_refs.map(reference => ({ ...reference, ...(reference.metadata ? { metadata: Object.fromEntries(Object.entries(reference.metadata).filter(([key]) => key !== 'file' && key !== 'pdf_path')) } : {}) })),
    }));
  }

  private static async upsertOne(
    bulletin: ExternalServiceBulletin,
    transaction: any
  ) {
    const model = await ComponentModel.findByPk(bulletin.model_id, {
      attributes: ['id', 'manufacturer_id'],
      transaction
    });

    const existing = model
      ? await ServiceBulletin.findOne({
          where: {
            sb_number: bulletin.sb_number,
          },
          include: [
            {
              model: ComponentModel,
              as: 'ApplicableModels',
              where: { manufacturer_id: model.manufacturer_id },
              through: { attributes: [] },
              attributes: ['id'],
            },
          ],
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
      : await ServiceBulletin.findOne({
          where: {
            sb_number: bulletin.sb_number,
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

    const payload = {
      title: bulletin.title,
      compliance_type: bulletin.compliance_type,
      source_primary: bulletin.source_primary,
      source_refs: bulletin.source_refs,
      status: 'ACTIVE',
      revision: bulletin.revision ?? null,
      document_url: bulletin.document_url ?? null,
      description: bulletin.description ?? null,
      issued_on: bulletin.issued_on ?? null,
    };

    if (existing) {
      await ServiceBulletinModel.findOrCreate({
        where: {
          service_bulletin_id: existing.id,
          model_id: bulletin.model_id,
        },
        defaults: {
          service_bulletin_id: existing.id,
          model_id: bulletin.model_id,
        },
        transaction,
      });
      await existing.update(payload, { transaction });
      return { created: 0, updated: 1 };
    }

    const created = await ServiceBulletin.create(
      {
        sb_number: bulletin.sb_number,
        ...payload,
      },
      { transaction }
    );

    await ServiceBulletinModel.create(
      {
        service_bulletin_id: created.id,
        model_id: bulletin.model_id,
      },
      { transaction }
    );

    return { created: 1, updated: 0 };
  }

  static async syncAll(
    evidence: PlatformMutationEvidence,
    triggerType: 'MANUAL' | 'CRON',
    options: ServiceBulletinSyncOptions,
    suppliedTransaction?: Transaction,
  ) {
    const fixedEvidence = requirePlatformMutationOperations(evidence, ['SERVICE_BULLETIN_SYNC']);
    let auditAfter: unknown;
    return executeAuthoritativePlatformMutation(fixedEvidence, async (transaction, audit) => {
      const [lockRows] = await sequelize.query(`SELECT pg_try_advisory_xact_lock(hashtext('JUPITER_SERVICE_BULLETIN_SYNC')) acquired`, { transaction });
      if (!(lockRows as Array<{ acquired: boolean }>)[0]?.acquired) throw new Error('SERVICE_BULLETIN_SYNC_ALREADY_RUNNING');
      const syncRun = await ServiceBulletinSyncRun.create({ trigger_type: triggerType, status: 'RUNNING', started_at: new Date() }, { transaction });
      const models = await ServiceBulletinService.getCreateOptions(transaction);
      const externalBulletins = await this.collectExternalBulletins(
        models as any[],
        options
      );
      const numbers = [...new Set(externalBulletins.map(row => row.sb_number))];
      const beforeBulletins = numbers.length ? await ServiceBulletin.findAll({ where: { sb_number: { [Op.in]: numbers } }, transaction, lock: transaction.LOCK.UPDATE, order: [['id', 'ASC']] }) : [];
      const beforeLinks = beforeBulletins.length ? await ServiceBulletinModel.findAll({ where: { service_bulletin_id: { [Op.in]: beforeBulletins.map(row => row.id) } }, transaction, lock: transaction.LOCK.UPDATE, order: [['id', 'ASC']] }) : [];
      audit.setBefore({ run: null, bulletins: beforeBulletins.map(row => row.toJSON()), relationships: beforeLinks.map(row => row.toJSON()) });
        let created = 0;
        let updated = 0;

        for (const bulletin of externalBulletins) {
          const result = await this.upsertOne(bulletin, transaction);
          created += result.created;
          updated += result.updated;
        }

        const totals = {
          synced: externalBulletins.length,
          created,
          updated,
          // ✅ Expose detailed unmatched info
          unmatchedModels: VeryonAdapter.unmatchedModels || [],
        };
      await syncRun.update({
        status: 'SUCCESS',
        synced_count: totals.synced,
        created_count: totals.created,
        updated_count: totals.updated,
        error_message: null,
        finished_at: new Date(),
      }, { transaction });
      const afterBulletins = numbers.length ? await ServiceBulletin.findAll({ where: { sb_number: { [Op.in]: numbers } }, transaction, order: [['id', 'ASC']] }) : [];
      const afterLinks = afterBulletins.length ? await ServiceBulletinModel.findAll({ where: { service_bulletin_id: { [Op.in]: afterBulletins.map(row => row.id) } }, transaction, order: [['id', 'ASC']] }) : [];
      auditAfter = { run: syncRun.toJSON(), bulletins: afterBulletins.map(row => row.toJSON()), relationships: afterLinks.map(row => row.toJSON()) };
      return { ...totals, runId: syncRun.id };
    }, result => ({ resourceId: result.runId, after: auditAfter }), suppliedTransaction);
  }

  static async runScheduled() {
    if (process.env.SB_SYNC_SERVICE_CODE !== 'SB_SYNC_SCHEDULER') throw new Error('SB_SYNC_SCHEDULER_CONFIGURATION_REQUIRED');
    const repository = new PlatformAuthorityRepository(pool);
    const authority = await repository.resolveService('SB_SYNC_SCHEDULER');
    if (!authority) throw new Error('SB_SYNC_SCHEDULER_AUTHORITY_REQUIRED');
    await repository.authorizeCapability(authority, 'SERVICE_BULLETIN_SYNC_EXECUTE', ['SERVICE']);
    const method = this.normalizeMethod(process.env.SB_SYNC_METHOD);
    const files = await scheduledSbSyncFiles(method);
    const evidence = platformServiceMutationEvidence(authority, ['SERVICE_BULLETIN_SYNC'], { reason: 'Scheduled Service Bulletin synchronization', correlationId: randomUUID(), source: { kind: 'SCHEDULED_SERVICE', trigger: 'CRON', method }, resourceType: 'service_bulletin_sync_run' });
    return this.syncAll(evidence, 'CRON', { method, files });
  }

  static async startCronJob() {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const enabled = (process.env.SB_SYNC_CRON_ENABLED || 'false').toLowerCase();
    if (enabled === 'false' || enabled === '0' || enabled === 'no') {
      console.log('Service bulletin sync cron disabled.');
      return;
    }

    if (process.env.SB_SYNC_SERVICE_CODE !== 'SB_SYNC_SCHEDULER') throw new Error('SB_SYNC_SCHEDULER_CONFIGURATION_REQUIRED');
    const startupRepository = new PlatformAuthorityRepository(pool);
    const startupAuthority = await startupRepository.resolveService('SB_SYNC_SCHEDULER');
    if (!startupAuthority) throw new Error('SB_SYNC_SCHEDULER_AUTHORITY_REQUIRED');
    await startupRepository.authorizeCapability(startupAuthority, 'SERVICE_BULLETIN_SYNC_EXECUTE', ['SERVICE']);

    const minutes = Number(process.env.SB_SYNC_INTERVAL_MINUTES || 360);
    const intervalMs =
      Number.isFinite(minutes) && minutes > 0
        ? minutes * 60 * 1000
        : 6 * 60 * 60 * 1000;

    console.log(
      `Service bulletin sync cron scheduled every ${Math.round(intervalMs / 60000)} minutes.`
    );

    const runOnBoot = (process.env.SB_SYNC_RUN_ON_BOOT || 'false').toLowerCase();
    if (runOnBoot !== 'false' && runOnBoot !== '0' && runOnBoot !== 'no') {
      setTimeout(async () => {
        try {
          const result = await this.runScheduled();
          console.log(
            `Initial service bulletin sync complete: ${result.synced} synced, ${result.created} created, ${result.updated} updated.`
          );
        } catch (error) {
          emitOperationalEvent({code:'SCHEDULER_RUN_FAILED',severity:'ERROR',outcome:'FAILED',operation:'SB_SYNC_INITIAL',error});
        }
      }, 1000).unref();
    }

    setInterval(async () => {
      try {
        const result = await this.runScheduled();
        console.log(
          `Service bulletin sync complete: ${result.synced} synced, ${result.created} created, ${result.updated} updated.`
        );
      } catch (error) {
        emitOperationalEvent({code:'SCHEDULER_RUN_FAILED',severity:'ERROR',outcome:'FAILED',operation:'SB_SYNC_SCHEDULED',error});
      }
    }, intervalMs).unref();
  }
}
