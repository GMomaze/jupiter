import { Op, QueryTypes } from 'sequelize';
import { sequelize, WorkpackSnag, Workpack, Aircraft, AircraftComponent, User } from '../../../models/index.js';
import { AuditService } from '../../audit/audit.service.js';
import { WorkpackAuditService } from './workpack-audit.service.js';

type CreateSnagParams = {
  workpack_id?: string | null;
  aircraft_id: string;
  component_id?: string | null;
  defect_text: string;
  created_by: string;
};

export class SnagService {
  private static normalizeDescription(description: string) {
    return String(description || '').trim();
  }

  static canStartSnag(actorRoles: string[] = []) {
    return actorRoles.some((role) =>
      ['MECHANIC', 'ENGINEER', 'SUPERVISOR', 'ADMIN'].includes(role)
    );
  }

  static canResolveSnag(
    snag: any,
    actorId: string | undefined,
    actorRoles: string[] = []
  ) {
    if (actorRoles.includes('SUPERVISOR') || actorRoles.includes('ADMIN')) {
      return true;
    }

    if (!actorRoles.some((role) => ['MECHANIC', 'ENGINEER'].includes(role))) {
      return false;
    }

    if (!actorId) {
      return false;
    }

    if (!snag?.assigned_to) {
      return true;
    }

    return snag.assigned_to === actorId;
  }

  static canCloseSnag(actorRoles: string[] = []) {
    return actorRoles.some((role) =>
      ['ENGINEER', 'SUPERVISOR', 'ADMIN'].includes(role)
    );
  }

  private static resolveDbFromArgs(args: unknown[]) {
    const dbCandidate = args.find((value) => {
      return !!value && typeof value === 'object' && typeof (value as any).transaction === 'function';
    });

    return dbCandidate || sequelize;
  }

  private static resolveFunctionArg<T extends Function>(args: unknown[], predicate?: (fn: T) => boolean) {
    return (args.find((value) => {
      if (typeof value !== 'function') {
        return false;
      }

      return predicate ? predicate(value as T) : true;
    }) as T | undefined) || undefined;
  }

  static async getSnagsForWorkpack(
    workpackId: string,
    db: any = sequelize
  ) {
    try {
      return await WorkpackSnag.findAll({
        where: { workpack_id: workpackId },
        attributes: [
          'id',
          'workpack_id',
          'component_id',
          'defect_text',
          'description',
          'status',
          'resolution_notes',
          'parts_used',
          'time_spent_minutes',
          'created_by',
          'assigned_to',
          'created_at',
          'started_at',
          'resolved_at',
        ],
        include: [
          {
            model: AircraftComponent,
            as: 'Component',
            attributes: ['id', 'serial_number', 'position_code'],
            required: false,
          },
        ],
        order: [['created_at', 'ASC'], ['snag_no', 'ASC']],
      });
    } catch (error: any) {
      console.warn('[SnagService] getSnagsForWorkpack fallback without component join/order:', error?.original?.message || error?.message || error);
      return WorkpackSnag.findAll({
        where: { workpack_id: workpackId },
        attributes: [
          'id',
          'workpack_id',
          'defect_text',
          'description',
          'status',
          'resolution_notes',
          'parts_used',
          'time_spent_minutes',
          'created_by',
          'assigned_to',
          'created_at',
          'started_at',
          'resolved_at',
        ],
        order: [['created_at', 'ASC']],
      });
    }
  }

  static async getOpenSnagsForWorkpack(
    workpackId: string,
    db: any = sequelize
  ) {
    try {
      return await WorkpackSnag.findAll({
        where: {
          workpack_id: workpackId,
          status: { [Op.ne]: 'CLOSED' },
        },
        attributes: [
          'id',
          'workpack_id',
          'component_id',
          'defect_text',
          'description',
          'status',
          'resolution_notes',
          'parts_used',
          'time_spent_minutes',
          'created_by',
          'assigned_to',
          'created_at',
          'started_at',
          'resolved_at',
        ],
        include: [
          {
            model: AircraftComponent,
            as: 'Component',
            attributes: ['id', 'serial_number', 'position_code'],
            required: false,
          },
        ],
        order: [['created_at', 'ASC'], ['snag_no', 'ASC']],
      });
    } catch (error: any) {
      console.warn('[SnagService] getOpenSnagsForWorkpack fallback without component join/order:', error?.original?.message || error?.message || error);
      return WorkpackSnag.findAll({
        where: {
          workpack_id: workpackId,
          status: { [Op.ne]: 'CLOSED' },
        },
        attributes: [
          'id',
          'workpack_id',
          'defect_text',
          'description',
          'status',
          'resolution_notes',
          'parts_used',
          'time_spent_minutes',
          'created_by',
          'assigned_to',
          'created_at',
          'started_at',
          'resolved_at',
        ],
        order: [['created_at', 'ASC']],
      });
    }
  }

  static async getSnagPatternSummaryForAircraft(
    aircraftId: string,
    db: any = sequelize
  ) {
    const queryWithComponent = `
      WITH normalized_snags AS (
        SELECT
          ws.aircraft_id,
          ws.component_id,
          COALESCE(
            (
              SELECT string_agg(token, ' ' ORDER BY ord)
              FROM (
                SELECT token, ord
                FROM (
                  SELECT
                    token,
                    ord,
                    LAG(token) OVER (ORDER BY ord) AS previous_token
                  FROM regexp_split_to_table(prepared.normalized_text, '\\s+') WITH ORDINALITY AS split_tokens(token, ord)
                ) token_window
                WHERE token <> '' AND (previous_token IS NULL OR token <> previous_token)
              ) deduplicated_tokens
            ),
            ''
          ) AS normalized_description,
          ws.status,
          ws.created_at
        FROM workpack_snags ws
        CROSS JOIN LATERAL (
          SELECT trim(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(
                      regexp_replace(
                        regexp_replace(
                          lower(trim(ws.description)),
                          '(^|\\s)r\\s*[\\/\\-\\.,]?\\s*h(\\s|$)',
                          '\\1rh\\2',
                          'g'
                        ),
                        '(^|\\s)l\\s*[\\/\\-\\.,]?\\s*h(\\s|$)',
                        '\\1lh\\2',
                        'g'
                      ),
                      '(^|\\s)right\\s*[-\\s]?hand(\\s|$)',
                      '\\1rh\\2',
                      'g'
                    ),
                    '(^|\\s)left\\s*[-\\s]?hand(\\s|$)',
                    '\\1lh\\2',
                    'g'
                  ),
                  '(^|\\s)right(\\s|$)',
                  '\\1rh\\2',
                  'g'
                ),
                '(^|\\s)left(\\s|$)',
                '\\1lh\\2',
                'g'
              ),
              '[^[:alnum:]\\s]+',
              ' ',
              'g'
            )
          ) AS normalized_text
        ) prepared
        WHERE ws.aircraft_id = :aircraftId
      )

      SELECT
        aircraft_id,
        component_id,
        normalized_description AS normalised_description,
        COUNT(*)::int AS occurrence_count,
        (COUNT(*) >= 2) AS recurring,
        MAX(created_at) AS latest_created_at,
        COUNT(*) FILTER (WHERE status != 'CLOSED')::int AS open_count,
        COUNT(*) FILTER (WHERE status = 'CLOSED')::int AS closed_count
      FROM normalized_snags
      GROUP BY aircraft_id, component_id, normalized_description
      HAVING COUNT(*) >= 2
      ORDER BY occurrence_count DESC, latest_created_at DESC
    `;

    const queryWithoutComponent = `
      WITH normalized_snags AS (
        SELECT
          ws.aircraft_id,
          NULL::uuid AS component_id,
          COALESCE(
            (
              SELECT string_agg(token, ' ' ORDER BY ord)
              FROM (
                SELECT token, ord
                FROM (
                  SELECT
                    token,
                    ord,
                    LAG(token) OVER (ORDER BY ord) AS previous_token
                  FROM regexp_split_to_table(prepared.normalized_text, '\\s+') WITH ORDINALITY AS split_tokens(token, ord)
                ) token_window
                WHERE token <> '' AND (previous_token IS NULL OR token <> previous_token)
              ) deduplicated_tokens
            ),
            ''
          ) AS normalized_description,
          ws.status,
          ws.created_at
        FROM workpack_snags ws
        CROSS JOIN LATERAL (
          SELECT trim(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(
                      regexp_replace(
                        regexp_replace(
                          lower(trim(ws.description)),
                          '(^|\\s)r\\s*[\\/\\-\\.,]?\\s*h(\\s|$)',
                          '\\1rh\\2',
                          'g'
                        ),
                        '(^|\\s)l\\s*[\\/\\-\\.,]?\\s*h(\\s|$)',
                        '\\1lh\\2',
                        'g'
                      ),
                      '(^|\\s)right\\s*[-\\s]?hand(\\s|$)',
                      '\\1rh\\2',
                      'g'
                    ),
                    '(^|\\s)left\\s*[-\\s]?hand(\\s|$)',
                    '\\1lh\\2',
                    'g'
                  ),
                  '(^|\\s)right(\\s|$)',
                  '\\1rh\\2',
                  'g'
                ),
                '(^|\\s)left(\\s|$)',
                '\\1lh\\2',
                'g'
              ),
              '[^[:alnum:]\\s]+',
              ' ',
              'g'
            )
          ) AS normalized_text
        ) prepared
        WHERE ws.aircraft_id = :aircraftId
      )

      SELECT
        aircraft_id,
        component_id,
        normalized_description AS normalised_description,
        COUNT(*)::int AS occurrence_count,
        (COUNT(*) >= 2) AS recurring,
        MAX(created_at) AS latest_created_at,
        COUNT(*) FILTER (WHERE status != 'CLOSED')::int AS open_count,
        COUNT(*) FILTER (WHERE status = 'CLOSED')::int AS closed_count
      FROM normalized_snags
      GROUP BY aircraft_id, component_id, normalized_description
      HAVING COUNT(*) >= 2
      ORDER BY occurrence_count DESC, latest_created_at DESC
    `;

    try {
      return await db.query(queryWithComponent, {
        replacements: { aircraftId },
        type: QueryTypes.SELECT,
      });
    } catch (error: any) {
      console.warn('[SnagService] getSnagPatternSummaryForAircraft fallback without component_id:', error?.original?.message || error?.message || error);
      return db.query(queryWithoutComponent, {
        replacements: { aircraftId },
        type: QueryTypes.SELECT,
      });
    }
  }

  private static async getNextSnagNo(
    workpackId: string | null | undefined,
    transaction: any
  ) {
    if (!workpackId) {
      return 1;
    }

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
    const defectText = this.normalizeDescription(params.defect_text);
    const workpackId = String(params.workpack_id || '').trim() || null;
    const aircraftId = String(params.aircraft_id || '').trim();
    const componentId = String(params.component_id || '').trim() || null;
    const createdBy = String(params.created_by || '').trim();

    if (!defectText) {
      throw new Error('SNAG_DESCRIPTION_REQUIRED');
    }

    return db.transaction(async (transaction: any) => {
      const aircraft = await Aircraft.findByPk(aircraftId, {
        attributes: ['id'],
        transaction,
      });

      if (!aircraft) {
        throw new Error('SNAG_AIRCRAFT_INVALID');
      }

      const user = await User.findByPk(createdBy, {
        attributes: ['id'],
        transaction,
      });

      if (!user) {
        throw new Error('SNAG_CREATED_BY_INVALID');
      }

      if (componentId) {
        const component = await AircraftComponent.findByPk(componentId, {
          attributes: ['id', 'aircraft_id'],
          transaction,
        });

        if (!component) {
          throw new Error('SNAG_COMPONENT_INVALID');
        }

        if (String((component as any).aircraft_id || '') !== aircraftId) {
          throw new Error('SNAG_COMPONENT_AIRCRAFT_MISMATCH');
        }
      }

      if (workpackId) {
        const workpack = await Workpack.findByPk(workpackId, {
          attributes: ['id', 'aircraft_id'],
          transaction,
        });

        if (!workpack) {
          throw new Error('SNAG_WORKPACK_INVALID');
        }

        if (String((workpack as any).aircraft_id || '') !== aircraftId) {
          throw new Error('SNAG_WORKPACK_AIRCRAFT_MISMATCH');
        }
      }

      const nextSnagNo = await this.getNextSnagNo(workpackId, transaction);

      const snag = await WorkpackSnag.create(
        {
          workpack_id: workpackId,
          aircraft_id: aircraftId,
          component_id: componentId,
          snag_no: nextSnagNo,
          defect_text: defectText,
          description: defectText,
          status: 'OPEN',
          created_by: createdBy,
          created_at: new Date(),
          version: 1,
        },
        { transaction }
      );

      await AuditService.log({
        table_name: 'workpack_snags',
        row_id: snag.id,
        action: 'SNAG_CREATED',
        actor_id: createdBy,
        new_values: {
          workpack_id: snag.workpack_id,
          aircraft_id: snag.aircraft_id,
          component_id: snag.component_id,
          defect_text: snag.defect_text,
          status: snag.status,
          created_by: snag.created_by,
        },
      }, transaction);

      if (snag.workpack_id) {
        await WorkpackAuditService.appendSnagAuditEntry(
          {
            snagId: snag.id,
            workpackId: snag.workpack_id,
            userId: createdBy,
            action: 'SNAG_CREATED',
            field: null,
            oldValue: null,
            newValue: {
              aircraft_id: snag.aircraft_id,
              component_id: snag.component_id,
              defect_text: snag.defect_text,
              status: snag.status,
            },
            metadata: {
              created_at: snag.created_at?.toISOString?.() || snag.created_at || null,
            },
          },
          transaction
        );
      }

      return snag;
    });
  }

  static async startSnag(
    snagId: string,
    userId?: string,
    actorRoles: string[] = [],
    db: any = sequelize,
    ...rest: any[]
  ) {
    const resolvedDb = this.resolveDbFromArgs([db, ...rest]);
    const requireAuth =
      this.resolveFunctionArg<(actorId?: string) => void>(rest, (fn) => fn.length <= 1) ||
      (() => {});
    const appendSnagAuditEntry =
      this.resolveFunctionArg<(params: any, transaction: any) => Promise<void>>(rest, (fn) => fn.length >= 2) ||
      (async () => {});

    requireAuth(userId);

    return resolvedDb.transaction(async (transaction: any) => {
      const snag = await WorkpackSnag.findByPk(snagId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!snag) {
        throw new Error('SNAG_NOT_FOUND');
      }

      if (!this.canStartSnag(actorRoles)) {
        throw new Error('SNAG_START_ROLE_BLOCKED');
      }

      if (snag.status !== 'OPEN') {
        throw new Error('SNAG_START_BLOCKED');
      }

      const previousStatus = snag.status;
      snag.status = 'IN_PROGRESS';
      snag.assigned_to = userId ?? null;
      snag.started_by = userId ?? null;
      snag.started_at = new Date();
      snag.version = (snag.version || 0) + 1;

      await snag.save({ transaction });
      await appendSnagAuditEntry(
        {
          snagId: snag.id,
          workpackId: snag.workpack_id,
          userId,
          action: 'SNAG_STARTED',
          field: 'status',
          oldValue: { status: previousStatus },
          newValue: { status: snag.status },
          metadata: {
            assigned_to: snag.assigned_to,
            started_at: snag.started_at?.toISOString?.() || snag.started_at || null,
          },
        },
        transaction
      );

      return snag;
    });
  }

  static async resolveSnag(
    snagId: string,
    data: Record<string, unknown> = {},
    actorId?: string,
    actorRoles: string[] = [],
    db: any = sequelize,
    requireAuth: (actorId?: string) => void = () => {},
    canResolveSnag: (
      snag: any,
      actorId: string | undefined,
      actorRoles: string[]
    ) => boolean = () => false,
    appendSnagAuditEntry: (params: any, transaction: any) => Promise<void> = async () => {}
  ) {
    requireAuth(actorId);
    const resolvedDb = this.resolveDbFromArgs([db]);
    const resolutionNotes = this.normalizeDescription(String(data.resolution_notes || ''));
    const partsUsed = String(data.parts_used || '').trim() || null;
    const rawMinutes = data.time_spent_minutes;
    const timeSpentMinutes =
      rawMinutes === undefined || rawMinutes === null || String(rawMinutes).trim() === ''
        ? null
        : Number(rawMinutes);

    if (!resolutionNotes) {
      throw new Error('SNAG_RESOLUTION_REQUIRED');
    }

    if (timeSpentMinutes !== null && (!Number.isFinite(timeSpentMinutes) || timeSpentMinutes < 0)) {
      throw new Error('SNAG_TIME_SPENT_INVALID');
    }

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

      if (!canResolveSnag(snag, actorId, actorRoles)) {
        throw new Error('SNAG_RESOLVE_NOT_ASSIGNED');
      }

      const previousStatus = snag.status;
      snag.status = 'RESOLVED';
      snag.resolution_notes = resolutionNotes;
      snag.parts_used = partsUsed;
      snag.time_spent_minutes = timeSpentMinutes;
      snag.resolved_by = actorId ?? null;
      snag.resolved_at = new Date();
      snag.version = (snag.version || 0) + 1;

      await snag.save({ transaction });
      await appendSnagAuditEntry(
        {
          snagId: snag.id,
          workpackId: snag.workpack_id,
          userId: actorId,
          action: 'SNAG_RESOLVED',
          field: 'status',
          oldValue: { status: previousStatus },
          newValue: { status: snag.status },
          metadata: {
            resolution_notes: snag.resolution_notes,
            parts_used: snag.parts_used,
            time_spent_minutes: snag.time_spent_minutes,
            resolved_at: snag.resolved_at?.toISOString?.() || snag.resolved_at || null,
          },
        },
        transaction
      );

      return snag;
    });
  }

  static async closeSnag(
    snagId: string,
    userId?: string,
    actorRoles: string[] = [],
    db: any = sequelize,
    requireAuth: (actorId?: string) => void = () => {},
    canCloseSnag: (actorRoles: string[]) => boolean = () => false,
    appendSnagAuditEntry: (params: any, transaction: any) => Promise<void> = async () => {}
  ) {
    requireAuth(userId);
    const resolvedDb = this.resolveDbFromArgs([db]);

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

      if (!canCloseSnag(actorRoles)) {
        throw new Error('SNAG_CLOSE_ROLE_BLOCKED');
      }

      const previousStatus = snag.status;
      snag.status = 'CLOSED';
      snag.closed_by = userId ?? null;
      snag.closed_at = new Date();
      snag.version = (snag.version || 0) + 1;

      await snag.save({ transaction });
      await appendSnagAuditEntry(
        {
          snagId: snag.id,
          workpackId: snag.workpack_id,
          userId,
          action: 'SNAG_CLOSED',
          field: 'status',
          oldValue: { status: previousStatus },
          newValue: { status: snag.status },
          metadata: {
            closed_at: snag.closed_at?.toISOString?.() || snag.closed_at || null,
          },
        },
        transaction
      );

      return snag;
    });
  }
}
