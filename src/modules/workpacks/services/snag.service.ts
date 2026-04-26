import { sequelize, WorkpackSnag } from '../../../models/index.js';

type CreateSnagParams = {
  workpack_id: string;
  aircraft_id: string;
  description: string;
  user_id: string;
};

export class SnagService {
  private static normalizeDescription(description: string) {
    return String(description || '').trim();
  }

  private static async getNextSnagNo(
    workpackId: string,
    transaction: any
  ) {
    const latestSnag = await WorkpackSnag.findOne({
      where: { workpack_id: workpackId },
      order: [['snag_no', 'DESC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    return (latestSnag?.snag_no || 0) + 1;
  }

  static async createSnag(
    params: CreateSnagParams,
    db: any = sequelize
  ) {
    const description = this.normalizeDescription(params.description);

    if (!description) {
      throw new Error('SNAG_DESCRIPTION_REQUIRED');
    }

    return db.transaction(async (transaction: any) => {
      const nextSnagNo = await this.getNextSnagNo(params.workpack_id, transaction);

      return WorkpackSnag.create(
        {
          workpack_id: params.workpack_id,
          snag_no: nextSnagNo,
          description,
          status: 'OPEN',
          created_by: params.user_id || null,
          created_at: new Date(),
          version: 1,
        },
        { transaction }
      );
    });
  }

  static async startSnag(
    snagId: string,
    userId?: string,
    db: any = sequelize
  ) {
    return db.transaction(async (transaction: any) => {
      const snag = await WorkpackSnag.findByPk(snagId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!snag) {
        throw new Error('SNAG_NOT_FOUND');
      }

      if (snag.status !== 'OPEN') {
        throw new Error('SNAG_START_BLOCKED');
      }

      snag.status = 'IN_PROGRESS';
      snag.assigned_to = userId ?? null;
      snag.started_by = userId ?? null;
      snag.started_at = new Date();
      snag.version = (snag.version || 0) + 1;

      await snag.save({ transaction });

      return snag;
    });
  }

  static async resolveSnag(
    snagId: string,
    userId?: string,
    db: any = sequelize
  ) {
    return db.transaction(async (transaction: any) => {
      const snag = await WorkpackSnag.findByPk(snagId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!snag) {
        throw new Error('SNAG_NOT_FOUND');
      }

      if (snag.status !== 'IN_PROGRESS') {
        throw new Error('SNAG_RESOLVE_BLOCKED');
      }

      snag.status = 'RESOLVED';
      snag.resolved_by = userId ?? null;
      snag.resolved_at = new Date();
      snag.version = (snag.version || 0) + 1;

      await snag.save({ transaction });

      return snag;
    });
  }

  static async closeSnag(
    snagId: string,
    userId?: string,
    db: any = sequelize
  ) {
    return db.transaction(async (transaction: any) => {
      const snag = await WorkpackSnag.findByPk(snagId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!snag) {
        throw new Error('SNAG_NOT_FOUND');
      }

      if (snag.status !== 'RESOLVED') {
        throw new Error('SNAG_CLOSE_BLOCKED');
      }

      snag.status = 'CLOSED';
      snag.closed_by = userId ?? null;
      snag.closed_at = new Date();
      snag.version = (snag.version || 0) + 1;

      await snag.save({ transaction });

      return snag;
    });
  }
}
