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

export type ServiceBulletinSyncOptions = {
  method?: ServiceBulletinSyncMethod;
  veryonRootPath?: string | null;
  piperPdfPath?: string | null;
};

export class ServiceBulletinSyncService {
  private static isRunning = false;
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

    return 'ALL';
  }

  private static async collectExternalBulletins(
    models: any[],
    options: ServiceBulletinSyncOptions = {}
  ): Promise<ExternalServiceBulletin[]> {
    const method = this.normalizeMethod(options.method);

    if (method === 'VERYON') {
      return VeryonAdapter.buildForModels(models, {
        rootPath: options.veryonRootPath ?? null,
      });
    }

    if (method === 'ATP') {
      return ATPAdapter.buildForModels(models);
    }

    if (method === 'PIPER_PDF') {
      return PiperPdfAdapter.buildForModels(models, {
        pdfPath: options.piperPdfPath ?? null,
      });
    }

    const [veryonBulletins, atpBulletins, piperPdfBulletins] = await Promise.all([
      VeryonAdapter.buildForModels(models, {
        rootPath: options.veryonRootPath ?? null,
      }),
      Promise.resolve(ATPAdapter.buildForModels(models)),
      PiperPdfAdapter.buildForModels(models, {
        pdfPath: options.piperPdfPath ?? null,
      }),
    ]);

    return [...veryonBulletins, ...atpBulletins, ...piperPdfBulletins];
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
    triggerType: 'MANUAL' | 'CRON' = 'MANUAL',
    options: ServiceBulletinSyncOptions = {}
  ) {
    if (this.isRunning) {
      throw new Error('Service bulletin sync is already running.');
    }

    this.isRunning = true;
    const syncRun = await ServiceBulletinSyncRun.create({
      trigger_type: triggerType,
      status: 'RUNNING',
      started_at: new Date(),
    });

    try {
      const models = await ServiceBulletinService.getCreateOptions();
      const externalBulletins = await this.collectExternalBulletins(
        models as any[],
        options
      );

      const totals = await sequelize.transaction(async (transaction) => {
        let created = 0;
        let updated = 0;

        for (const bulletin of externalBulletins) {
          const result = await this.upsertOne(bulletin, transaction);
          created += result.created;
          updated += result.updated;
        }

        return {
          synced: externalBulletins.length,
          created,
          updated,
          // ✅ Expose detailed unmatched info
          unmatchedModels: VeryonAdapter.unmatchedModels || [],
        };
      });

      await syncRun.update({
        status: 'SUCCESS',
        synced_count: totals.synced,
        created_count: totals.created,
        updated_count: totals.updated,
        error_message: null,
        finished_at: new Date(),
      });

      return totals;
    } catch (error) {
      await syncRun.update({
        status: 'FAILED',
        error_message:
          error instanceof Error ? error.message : 'Unknown sync failure.',
        finished_at: new Date(),
      });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  static startCronJob() {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const enabled = (process.env.SB_SYNC_CRON_ENABLED || 'false').toLowerCase();
    if (enabled === 'false' || enabled === '0' || enabled === 'no') {
      console.log('Service bulletin sync cron disabled.');
      return;
    }

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
          const result = await this.syncAll('CRON');
          console.log(
            `Initial service bulletin sync complete: ${result.synced} synced, ${result.created} created, ${result.updated} updated.`
          );
        } catch (error) {
          console.error('Initial service bulletin sync failed:', error);
        }
      }, 1000).unref();
    }

    setInterval(async () => {
      try {
        const result = await this.syncAll('CRON');
        console.log(
          `Service bulletin sync complete: ${result.synced} synced, ${result.created} created, ${result.updated} updated.`
        );
      } catch (error) {
        console.error('Service bulletin sync failed:', error);
      }
    }, intervalMs).unref();
  }
}
