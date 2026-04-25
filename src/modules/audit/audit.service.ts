import { AuditLog, User } from '../../models/index.js';

export class AuditService {

  static async log(data: {
    table_name: string;
    row_id: string;
    action: string;
    actor_id?: string | null;
    old_values?: any;
    new_values?: any;
    reason?: string | null;
  }, transaction?: any) {

    if (!data.row_id) {
      throw new Error('AUDIT_ERROR: row_id required');
    }

    let actorId: string | null = null;

    // ✅ FIX: verify user actually exists
    if (
      data.actor_id &&
      /^[0-9a-fA-F-]{36}$/.test(data.actor_id)
    ) {
      const user = await User.findByPk(data.actor_id, { transaction });
      if (user) {
        actorId = data.actor_id;
      }
    }

    return AuditLog.create(
      {
        table_name: data.table_name,
        row_id: data.row_id,
        action: data.action,
        actor_id: actorId, // ✅ NULL if invalid → no FK error
        old_values: data.old_values ?? null,
        new_values: data.new_values ?? null,
        reason: data.reason ?? null
      },
      { transaction }
    );
  }

  static async getLogs(filters: {
    table_name?: string;
    actor_id?: string;
  } = {}) {

    const where: any = {};

    if (filters.table_name) where.table_name = filters.table_name;
    if (filters.actor_id) where.actor_id = filters.actor_id;

    const logs = await AuditLog.findAll({
      where,
      include: [
        {
          model: User,
          as: 'actor',
          attributes: ['id', 'email', 'full_name'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']],
      limit: 100
    });

    return logs.map(log => ({
      id: log.id,
      table_name: log.table_name,
      row_id: (log as any).row_id,
      action: log.action,
      old_values: log.old_values,
      new_values: log.new_values,
      reason: log.reason,
      created_at: log.created_at,
      actor_name: (log as any).actor?.email || null
    }));
  }
}

