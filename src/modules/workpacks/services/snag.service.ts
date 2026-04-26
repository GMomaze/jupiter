import { Op, QueryTypes } from 'sequelize';
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

  private static resolveDbFromArgs(args: unknown[]) {
    const dbCandidate = args.find((value) => {
      return !!value && typeof value === 'object' && typeof (value as any).transaction === 'function';
    });

    return dbCandidate || sequelize;
  }

  static async getSnagsForWorkpack(
    workpackId: string,
    db: any = sequelize
  ) {
    return WorkpackSnag.findAll({
      where: { workpack_id: workpackId },
      attributes: ['id', 'description', 'status', 'created_by', 'created_at'],
      order: [['created_at', 'ASC'], ['snag_no', 'ASC']],
    });
  }

  static async getOpenSnagsForWorkpack(
    workpackId: string,
    db: any = sequelize
  ) {
    return WorkpackSnag.findAll({
      where: {
        workpack_id: workpackId,
        status: { [Op.ne]: 'CLOSED' },
      },
      attributes: ['id', 'description', 'status', 'created_by', 'created_at'],
      order: [['created_at', 'ASC'], ['snag_no', 'ASC']],
    });
  }

  static async getSnagPatternSummaryForAircraft(
    aircraftId: string,
    db: any = sequelize
  ) {
    return db.query(
      `
      SELECT
        aircraft_id,
        normalized_description AS normalised_description,
        COUNT(*)::int AS occurrence_count,
        MAX(created_at) AS latest_created_at,
        COUNT(*) FILTER (WHERE status != 'CLOSED')::int AS open_count,
        COUNT(*) FILTER (WHERE status = 'CLOSED')::int AS closed_count
      FROM (
        SELECT
          aircraft_id,
          regexp_replace(lower(trim(description)), '\\s+', ' ', 'g') AS normalized_description,
          status,
          created_at
        FROM workpack_snags
        WHERE aircraft_id = :aircraftId
      ) normalized_snags
      GROUP BY aircraft_id, normalized_description
      HAVING COUNT(*) >= 2
      ORDER BY occurrence_count DESC, latest_created_at DESC
      `,
      {
        replacements: { aircraftId },
        type: QueryTypes.SELECT,
      }
    );
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
    db: any = sequelize,
    ...rest: any[]
  ) {
    const resolvedDb = this.resolveDbFromArgs([db, ...rest]);

    return resolvedDb.transaction(async (transaction: any) => {
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
    userIdOrData?: string | Record<string, unknown>,
    db: any = sequelize,
    ...rest: any[]
  ) {
    const actorId = typeof userIdOrData === 'string'
      ? userIdOrData
      : typeof db === 'string'
        ? db
        : undefined;
    const resolvedDb = this.resolveDbFromArgs([db, ...rest]);

    return resolvedDb.transaction(async (transaction: any) => {
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
      snag.resolved_by = actorId ?? null;
      snag.resolved_at = new Date();
      snag.version = (snag.version || 0) + 1;

      await snag.save({ transaction });

      return snag;
    });
  }

  static async closeSnag(
    snagId: string,
    userId?: string,
    db: any = sequelize,
    ...rest: any[]
  ) {
    const resolvedDb = this.resolveDbFromArgs([db, ...rest]);

    return resolvedDb.transaction(async (transaction: any) => {
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
