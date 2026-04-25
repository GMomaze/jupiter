import { Workpack, WorkpackSnag, WorkpackStatus } from '../../../models/index.js';

export class SnagService {
  static hasAdminOverride(actorRoles: string[] = []) {
    return actorRoles.includes('ADMIN') || actorRoles.includes('SUPERVISOR');
  }

  static canResolveSnag(
    snag: any,
    actorId: string | undefined,
    actorRoles: string[] = []
  ) {
    if (this.hasAdminOverride(actorRoles)) {
      return true;
    }

    if (!actorId) {
      return false;
    }

    return snag.assigned_to === actorId;
  }

  static canCloseSnag(actorRoles: string[] = []) {
    return actorRoles.includes('ENGINEER') || this.hasAdminOverride(actorRoles);
  }

  static async reportSnag(
    workpackId: string,
    data: {
      description: string;
      category?: string;
      priority?: string;
    },
    actorId: string | undefined,
    sequelize: any,
    requireAuth: (actorId?: string) => void,
    appendSnagAuditEntry: (
      params: {
        snagId: string;
        workpackId: string;
        userId?: string | undefined;
        action: string;
        field?: string | null;
        oldValue?: unknown;
        newValue?: unknown;
        metadata?: Record<string, unknown>;
      },
      transaction: any
    ) => Promise<void>
  ) {
    requireAuth(actorId);

    const normalizedDescription = String(data.description || '').trim();
    const normalizedCategory = String(data.category || '').trim() || null;
    const normalizedPriority = String(data.priority || 'MEDIUM').trim().toUpperCase() || 'MEDIUM';
    if (!normalizedDescription) {
      throw new Error('SNAG_DESCRIPTION_REQUIRED');
    }

    return sequelize.transaction(async (transaction: any) => {
      const pack = await Workpack.findByPk(workpackId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!pack) throw new Error('WORKPACK_NOT_FOUND');

      const status = await WorkpackStatus.findByPk(pack.status_id, { transaction });
      if (!status) throw new Error('STATUS_NOT_FOUND');
      if (status.code === 'DRAFT') throw new Error('SNAGS_NOT_ALLOWED_IN_DRAFT');

      const latestSnag = await WorkpackSnag.findOne({
        where: { workpack_id: workpackId },
        order: [['snag_no', 'DESC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const nextSnagNo = (latestSnag?.snag_no || 0) + 1;

      const snag = await WorkpackSnag.create(
        {
          workpack_id: workpackId,
          snag_no: nextSnagNo,
          description: normalizedDescription,
          category: normalizedCategory,
          priority: normalizedPriority,
          status: 'OPEN',
          created_by: actorId ?? null,
          created_at: new Date(),
          version: 1,
        },
        { transaction }
      );

      await appendSnagAuditEntry(
        {
          snagId: snag.id,
          workpackId,
          userId: actorId,
          action: 'SNAG_CREATED',
          newValue: {
            snag_no: snag.snag_no,
            description: snag.description,
            category: snag.category,
            priority: snag.priority,
            status: snag.status,
          },
        },
        transaction
      );

      return snag;
    });
  }

  static async startSnag(
    snagId: string,
    actorId: string | undefined,
    sequelize: any,
    requireAuth: (actorId?: string) => void,
    appendSnagAuditEntry: (
      params: {
        snagId: string;
        workpackId: string;
        userId?: string | undefined;
        action: string;
        field?: string | null;
        oldValue?: unknown;
        newValue?: unknown;
        metadata?: Record<string, unknown>;
      },
      transaction: any
    ) => Promise<void>
  ) {
    requireAuth(actorId);

    return sequelize.transaction(async (transaction: any) => {
      const snag = await WorkpackSnag.findByPk(snagId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!snag) throw new Error('SNAG_NOT_FOUND');
      if (snag.status !== 'OPEN') throw new Error('SNAG_START_BLOCKED');

      const previous = {
        status: snag.status,
        assigned_to: snag.assigned_to,
        started_by: snag.started_by,
        started_at: snag.started_at,
      };

      snag.status = 'IN_PROGRESS';
      snag.assigned_to = actorId ?? null;
      snag.started_by = actorId ?? null;
      snag.started_at = new Date();
      snag.version = snag.version + 1;

      await snag.save({ transaction });

      await appendSnagAuditEntry(
        {
          snagId: snag.id,
          workpackId: snag.workpack_id,
          userId: actorId,
          action: 'SNAG_STARTED',
          oldValue: previous,
          newValue: {
            status: snag.status,
            assigned_to: snag.assigned_to,
            started_by: snag.started_by,
            started_at: snag.started_at,
          },
        },
        transaction
      );

      return snag;
    });
  }

  static async resolveSnag(
    snagId: string,
    data: {
      resolution_notes: string;
      parts_used?: string;
      time_spent_minutes?: string | number | null;
    },
    actorId: string | undefined,
    actorRoles: string[] = [],
    sequelize: any,
    requireAuth: (actorId?: string) => void,
    canResolveSnag: (
      snag: any,
      actorId: string | undefined,
      actorRoles: string[]
    ) => boolean,
    appendSnagAuditEntry: (
      params: {
        snagId: string;
        workpackId: string;
        userId?: string | undefined;
        action: string;
        field?: string | null;
        oldValue?: unknown;
        newValue?: unknown;
        metadata?: Record<string, unknown>;
      },
      transaction: any
    ) => Promise<void>
  ) {
    requireAuth(actorId);

    const normalizedResolution = String(data.resolution_notes || '').trim();
    const normalizedPartsUsed = String(data.parts_used || '').trim() || null;
    const normalizedTimeSpent = String(data.time_spent_minutes || '').trim();
    const timeSpentMinutes = normalizedTimeSpent ? Number(normalizedTimeSpent) : null;

    if (!normalizedResolution) {
      throw new Error('SNAG_RESOLUTION_REQUIRED');
    }
    if (normalizedTimeSpent && (!Number.isFinite(timeSpentMinutes ?? NaN) || (timeSpentMinutes ?? 0) < 0)) {
      throw new Error('SNAG_TIME_SPENT_INVALID');
    }

    return sequelize.transaction(async (transaction: any) => {
      const snag = await WorkpackSnag.findByPk(snagId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!snag) throw new Error('SNAG_NOT_FOUND');
      if (snag.status !== 'IN_PROGRESS') throw new Error('SNAG_RESOLVE_BLOCKED');
      if (!canResolveSnag(snag, actorId, actorRoles)) {
        throw new Error('SNAG_RESOLVE_NOT_ASSIGNED');
      }

      const previous = {
        status: snag.status,
        resolution_notes: snag.resolution_notes,
        parts_used: snag.parts_used,
        time_spent_minutes: snag.time_spent_minutes,
        resolved_by: snag.resolved_by,
        resolved_at: snag.resolved_at,
      };

      snag.status = 'RESOLVED';
      snag.resolution_notes = normalizedResolution;
      snag.parts_used = normalizedPartsUsed;
      snag.time_spent_minutes = timeSpentMinutes;
      snag.resolved_by = actorId ?? null;
      snag.resolved_at = new Date();
      snag.version = snag.version + 1;

      await snag.save({ transaction });

      await appendSnagAuditEntry(
        {
          snagId: snag.id,
          workpackId: snag.workpack_id,
          userId: actorId,
          action: 'SNAG_RESOLVED',
          oldValue: previous,
          newValue: {
            status: snag.status,
            resolution_notes: snag.resolution_notes,
            parts_used: snag.parts_used,
            time_spent_minutes: snag.time_spent_minutes,
            resolved_by: snag.resolved_by,
            resolved_at: snag.resolved_at,
          },
        },
        transaction
      );

      return snag;
    });
  }

  static async closeSnag(
    snagId: string,
    actorId: string | undefined,
    actorRoles: string[] = [],
    sequelize: any,
    requireAuth: (actorId?: string) => void,
    canCloseSnag: (actorRoles: string[]) => boolean,
    appendSnagAuditEntry: (
      params: {
        snagId: string;
        workpackId: string;
        userId?: string | undefined;
        action: string;
        field?: string | null;
        oldValue?: unknown;
        newValue?: unknown;
        metadata?: Record<string, unknown>;
      },
      transaction: any
    ) => Promise<void>
  ) {
    requireAuth(actorId);

    if (!canCloseSnag(actorRoles)) {
      throw new Error('SNAG_CLOSE_ROLE_BLOCKED');
    }

    return sequelize.transaction(async (transaction: any) => {
      const snag = await WorkpackSnag.findByPk(snagId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!snag) throw new Error('SNAG_NOT_FOUND');
      if (snag.status !== 'RESOLVED') throw new Error('SNAG_CLOSE_BLOCKED');

      const previous = {
        status: snag.status,
        closed_by: snag.closed_by,
        closed_at: snag.closed_at,
      };

      snag.status = 'CLOSED';
      snag.closed_by = actorId ?? null;
      snag.closed_at = new Date();
      snag.version = snag.version + 1;

      await snag.save({ transaction });

      await appendSnagAuditEntry(
        {
          snagId: snag.id,
          workpackId: snag.workpack_id,
          userId: actorId,
          action: 'SNAG_CLOSED',
          oldValue: previous,
          newValue: {
            status: snag.status,
            closed_by: snag.closed_by,
            closed_at: snag.closed_at,
          },
        },
        transaction
      );

      return snag;
    });
  }
}
