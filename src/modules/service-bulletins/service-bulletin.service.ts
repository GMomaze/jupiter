import {
  ServiceBulletin,
  ServiceBulletinSyncRun,
  ComponentModel,
  Manufacturer,
  AssetType,
  ServiceBulletinModel,
} from '../../models/index.js';
import type { PlatformMutationEvidence } from '../platform-authority/authoritative-platform-mutation.js';
import { executeAuthoritativePlatformMutation, requirePlatformMutationOperations } from '../platform-authority/authoritative-platform-mutation.js';

export class ServiceBulletinService {
  static readonly providers = ['VERYON', 'ATP'] as const;
  private static hasLoggedSyncRunSchemaGap = false;

  private static compliancePriority(value: string | null | undefined) {
    const normalized = (value || 'REQUIRED').toUpperCase();

    if (normalized === 'MANDATORY') return 0;
    if (normalized === 'REQUIRED') return 1;
    if (normalized === 'OPTIONAL') return 2;
    return 3;
  }

  private static normalizeComplianceType(value: string | null | undefined) {
    const normalized = String(value ?? '').trim().toUpperCase();

    if (normalized.includes('MANDATORY') || normalized.includes('ALERT') || normalized.includes('EMERGENCY')) {
      return 'MANDATORY';
    }

    if (normalized.includes('OPTIONAL')) {
      return 'OPTIONAL';
    }

    return 'REQUIRED';
  }

  private static sortBulletins<T extends { compliance_type?: string | null; sb_number: string }>(
    bulletins: T[]
  ) {
    return [...bulletins].sort(
      (left, right) =>
        this.compliancePriority(left.compliance_type) -
          this.compliancePriority(right.compliance_type) ||
        left.sb_number.localeCompare(right.sb_number)
    );
  }

  static async getAll() {
    const bulletins = await ServiceBulletin.findAll({
      include: [
        {
          model: ComponentModel,
          as: 'ApplicableModels',
          through: { attributes: [] },
          attributes: ['id', 'model_name'],
        },
      ],
      order: [['sb_number', 'ASC']],
    });

    return this.sortBulletins(bulletins as any[]);
  }

  static toApiPayload(bulletins: any[]) {
    return this.sortBulletins(
      bulletins.map((bulletin) => ({
      id: bulletin.id,
      sb_number: bulletin.sb_number,
      title: bulletin.title,
      model: (bulletin.ApplicableModels || []).map((model: any) => model.model_name).join(', ') || null,
      source: bulletin.source_primary || null,
      source_refs: bulletin.source_refs || [],
      issued_on: bulletin.issued_on || null,
      compliance_type: bulletin.compliance_type || null,
      status: bulletin.status,
      revision: bulletin.revision || null,
      document_url: bulletin.document_url || null,
      }))
    );
  }

  static async getCreateOptions(transaction?: import('sequelize').Transaction) {
    return ComponentModel.findAll({
      attributes: ['id', 'model_name', 'manufacturer_id', 'asset_type_id', 'is_active'],
      include: [
        {
          model: Manufacturer,
          attributes: ['id', 'name', 'code'],
          required: false,
        },
        {
          model: AssetType,
          attributes: ['id', 'code', 'label'],
          required: false,
        },
      ],
      where: { is_active: true },
      order: [['model_name', 'ASC']],
      ...(transaction ? { transaction } : {}),
    });
  }

  static async getProviderOptions() {
    return this.getCreateOptions();
  }

  static async getSyncStatus() {
    let lastRun;
    let runningRun;

    try {
      [lastRun, runningRun] = await Promise.all([
        ServiceBulletinSyncRun.findOne({
          order: [['started_at', 'DESC']],
        }),
        ServiceBulletinSyncRun.findOne({
          where: { status: 'RUNNING' },
          order: [['started_at', 'DESC']],
        }),
      ]);
    } catch (error: any) {
      const sql = String(error?.sql || error?.parent?.sql || '');
      const code = error?.parent?.code || error?.original?.code;
      const isSyncRunSchemaGap =
        code === '42P01' ||
        code === '42703' ||
        sql.includes('service_bulletin_sync_runs');

      if (!isSyncRunSchemaGap) {
        throw error;
      }

      if (!this.hasLoggedSyncRunSchemaGap) {
        console.warn('[ServiceBulletinService] service_bulletin_sync_runs missing or behind schema, returning idle sync status');
        this.hasLoggedSyncRunSchemaGap = true;
      }

      return {
        lastSyncTime: null,
        syncStatus: 'IDLE',
        lastRun: null,
      };
    }

    this.hasLoggedSyncRunSchemaGap = false;

    const activeRun = runningRun || lastRun;

    return {
      lastSyncTime: lastRun?.finished_at || lastRun?.started_at || null,
      syncStatus: activeRun?.status || 'IDLE',
      lastRun: lastRun
        ? {
            trigger_type: lastRun.trigger_type,
            status: lastRun.status,
            synced_count: lastRun.synced_count,
            created_count: lastRun.created_count,
            updated_count: lastRun.updated_count,
            error_message: lastRun.error_message,
            started_at: lastRun.started_at,
            finished_at: lastRun.finished_at,
          }
        : null,
    };
  }

  static async create(evidence: PlatformMutationEvidence, data: {
    sb_number: string;
    title?: string;
    model_id: string;
    compliance_type?: string;
    revision?: string;
    document_url?: string;
    description?: string;
    issued_on?: string;
  }) {
    return executeAuthoritativePlatformMutation(requirePlatformMutationOperations(evidence, ['REGULATORY_MASTER_CREATE', 'REGULATORY_RELATIONSHIP_MUTATE']), async (transaction, audit) => {
    const normalizedSbNumber = data.sb_number.trim().toUpperCase();
    const model = await ComponentModel.findByPk(data.model_id, {
      attributes: ['id', 'manufacturer_id'],
      transaction,
    });

    const existing = model
      ? await ServiceBulletin.findOne({
          where: { sb_number: normalizedSbNumber },
          include: [
            {
              model: ComponentModel,
              as: 'ApplicableModels',
              where: { manufacturer_id: model.manufacturer_id },
              through: { attributes: [] },
              attributes: ['id'],
            },
          ],
          order: [['created_at', 'ASC']],
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
      : await ServiceBulletin.findOne({
          where: { sb_number: normalizedSbNumber },
          order: [['created_at', 'ASC']],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

    if (existing) {
      const existingLink = await ServiceBulletinModel.findOne({
        where: { service_bulletin_id: existing.id, model_id: data.model_id },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      audit.setBefore({ bulletin: existing.toJSON(), relationship: existingLink?.toJSON() ?? null });
      await ServiceBulletinModel.findOrCreate({
        where: {
          service_bulletin_id: existing.id,
          model_id: data.model_id,
        },
        defaults: {
          service_bulletin_id: existing.id,
          model_id: data.model_id,
        },
        transaction,
      });

      await existing.update({
        title: existing.title || data.title?.trim() || normalizedSbNumber,
        compliance_type:
          existing.compliance_type || this.normalizeComplianceType(data.compliance_type),
        revision: existing.revision || data.revision?.trim() || null,
        document_url: existing.document_url || data.document_url?.trim() || null,
        description: existing.description || data.description?.trim() || null,
        issued_on: existing.issued_on || data.issued_on || null,
      }, { transaction });

      return existing;
    }

    const created = await ServiceBulletin.create({
      sb_number: normalizedSbNumber,
      title: data.title?.trim() || normalizedSbNumber,
      compliance_type: this.normalizeComplianceType(data.compliance_type),
      source_primary: 'MANUAL',
      source_refs: [
        {
          provider: 'MANUAL',
          reference: normalizedSbNumber
        }
      ],
      status: 'ACTIVE',
      revision: data.revision?.trim() || null,
      document_url: data.document_url?.trim() || null,
      description: data.description?.trim() || null,
      issued_on: data.issued_on || null,
    }, { transaction });

    await ServiceBulletinModel.create({
      service_bulletin_id: created.id,
      model_id: data.model_id,
    }, { transaction });

    return created;
    }, row => ({ resourceId: row.id, after: row.toJSON() }));
  }
}
