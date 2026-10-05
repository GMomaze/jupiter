import { Op, type FindOptions, type Transaction } from 'sequelize';
import { Aircraft, PlanningSession, TaskCard, Workpack, WorkpackSnag, sequelize } from '../../models/index.js';
import {
  assertTenantQueryAuthority,
  type TenantQueryAuthority,
} from '../tenancy/tenant-query-authority.js';

type Options = { transaction?: Transaction; lock?: FindOptions['lock'] };

function stableFailure(error: unknown): never {
  if (error instanceof Error && error.message === 'TENANT_AUTHORITY_REQUIRED') throw error;
  throw new Error('TENANT_QUERY_FAILED');
}

function transactionAndLock(options: Options) {
  return {
    ...(options.transaction ? { transaction: options.transaction } : {}),
    ...(options.lock ? { lock: options.lock } : {}),
  };
}

export class WorkpackTenantRepository {
  async getById(authority: TenantQueryAuthority, id: string, options: Options = {}) {
    assertTenantQueryAuthority(authority);
    try {
      return (await Workpack.findOne({
        where: { id, tenant_id: authority.tenantId },
        ...transactionAndLock(options),
      })) ?? undefined;
    } catch (error) {
      return stableFailure(error);
    }
  }

  async list(authority: TenantQueryAuthority, where: Record<string, unknown> = {}) {
    assertTenantQueryAuthority(authority);
    try {
      return await Workpack.findAll({ where: { ...where, tenant_id: authority.tenantId } });
    } catch (error) {
      return stableFailure(error);
    }
  }

  async getSnagById(authority: TenantQueryAuthority, snagId: string, options: Options = {}) {
    assertTenantQueryAuthority(authority);
    try {
      const rows = await sequelize.query(
        `SELECT snag.*
           FROM workpack_snags snag
          WHERE snag.id = :snagId
            AND (
              (snag.workpack_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM workpacks owned_workpack
                 WHERE owned_workpack.id = snag.workpack_id
                   AND owned_workpack.tenant_id = :tenantId
              ))
              OR
              (snag.workpack_id IS NULL AND EXISTS (
                SELECT 1 FROM aircraft owned_aircraft
                 WHERE owned_aircraft.id = snag.aircraft_id
                   AND owned_aircraft.tenant_id = :tenantId
              ))
            )
          ${options.lock ? 'FOR UPDATE OF snag' : ''}`,
        {
          replacements: { snagId, tenantId: authority.tenantId },
          model: WorkpackSnag,
          mapToModel: true,
          ...(options.transaction ? { transaction: options.transaction } : {}),
        },
      );
      return rows[0] ?? undefined;
    } catch (error) {
      return stableFailure(error);
    }
  }

  async getTaskCardById(authority: TenantQueryAuthority, taskId: string, options: Options = {}) {
    assertTenantQueryAuthority(authority);
    try {
      const task = await TaskCard.findOne({
        where: {
          id: taskId,
          [Op.and]: sequelize.literal(`NOT EXISTS (
            SELECT 1
              FROM workpack_tasks authority_links
              JOIN workpacks authority_workpacks
                ON authority_workpacks.id = authority_links.workpack_id
             WHERE authority_links.task_id = "TaskCard"."id"
               AND authority_workpacks.tenant_id <> ${sequelize.escape(authority.tenantId)}
          )`),
        },
        include: [{
          model: Workpack,
          attributes: ['id', 'tenant_id'],
          through: { attributes: [] },
          where: { tenant_id: authority.tenantId },
          required: true,
        }],
        ...transactionAndLock(options),
      });
      return task ?? undefined;
    } catch (error) {
      return stableFailure(error);
    }
  }

  async getTaskCardForLink(
    authority: TenantQueryAuthority,
    taskId: string,
    aircraftId: string,
    options: Options = {},
  ) {
    assertTenantQueryAuthority(authority);
    try {
      return (await TaskCard.findOne({
        where: {
          id: taskId,
          aircraft_id: aircraftId,
          [Op.and]: sequelize.literal(`NOT EXISTS (
            SELECT 1
              FROM workpack_tasks authority_links
              JOIN workpacks authority_workpacks
                ON authority_workpacks.id = authority_links.workpack_id
             WHERE authority_links.task_id = "TaskCard"."id"
               AND authority_workpacks.tenant_id <> ${sequelize.escape(authority.tenantId)}
          )`),
        },
        ...transactionAndLock(options),
      })) ?? undefined;
    } catch (error) {
      return stableFailure(error);
    }
  }
}

export class PlanningSessionTenantRepository {
  async getByIdForUser(
    authority: TenantQueryAuthority,
    id: string,
    userId: string,
    options: Options = {},
  ) {
    assertTenantQueryAuthority(authority);
    try {
      return (await PlanningSession.findOne({
        where: { id, user_id: userId, tenant_id: authority.tenantId },
        ...transactionAndLock(options),
      })) ?? undefined;
    } catch (error) {
      return stableFailure(error);
    }
  }
}

export const workpackTenantRepository = new WorkpackTenantRepository();
export const planningSessionTenantRepository = new PlanningSessionTenantRepository();
