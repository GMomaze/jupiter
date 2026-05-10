import { pool } from '../../config/database.js';

type TaskStatus =
  | 'OPEN'
  | 'CERTIFIED_BY_ENGINEER'
  | 'LOCKED';

export class TaskService {

  /* ============================================================
      CREATE
  ============================================================ */

  static async create(data: {
    title: string;
    description: string;
    aircraft_id: string;
    component_id?: string | null;
  }, actorId?: string) {

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `
        INSERT INTO task_cards
        (title, description, aircraft_id, component_id, status, version)
        VALUES ($1, $2, $3, $4, 'OPEN', 0)
        RETURNING *
        `,
        [
          data.title,
          data.description,
          data.aircraft_id,
          data.component_id || null
        ]
      );

      const newTask = rows[0];

      // Standardized Audit Log entry per Protocol 03
      // Using row_id instead of record_id
      await client.query(
        `
        INSERT INTO audit_log (table_name, row_id, action, new_values, actor_id, created_at)
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
        `,
        ['task_cards', newTask.id, 'CREATE', JSON.stringify(newTask), actorId || null]
      );

      await client.query('COMMIT');
      return newTask;

    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /* ============================================================
      INTERNAL LOCK FETCH
  ============================================================ */

  private static async getTask(client: any, taskId: string) {
    const { rows } = await client.query(
      `SELECT * FROM task_cards WHERE id = $1 FOR UPDATE`,
      [taskId]
    );

    if (!rows.length) throw new Error('TASK_NOT_FOUND');

    return rows[0];
  }

  /* ============================================================
      SIGN OFF
  ============================================================ */

  static async signOff(taskId: string, userId: string) {

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const task = await this.getTask(client, taskId);

      // Enforce lifecycle using the current certified engineer state.
      if (task.status !== 'OPEN') {
        throw new Error('SIGN_OFF_FAILED: Task must be OPEN to be signed.');
      }

      await client.query(
        `
        UPDATE task_cards
        SET status = 'CERTIFIED_BY_ENGINEER',
            signed_by = $2,
            signed_at = CURRENT_TIMESTAMP,
            version = version + 1
        WHERE id = $1
        `,
        [taskId, userId]
      );

      // Audit status transition per Protocol 03 & 08
      await client.query(
        `
        INSERT INTO audit_log (table_name, row_id, action, old_values, new_values, actor_id, created_at)
        VALUES ($1, $2, 'STATUS_CHANGE', $3, $4, $5, CURRENT_TIMESTAMP)
        `,
        [
          'task_cards', 
          taskId, 
          JSON.stringify({ status: 'OPEN' }), 
          JSON.stringify({ status: 'CERTIFIED_BY_ENGINEER' }), 
          userId
        ]
      );

      await client.query('COMMIT');

    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /* ============================================================
      LOCK
  ============================================================ */

  static async lockTask(taskId: string, userId?: string) {

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const task = await this.getTask(client, taskId);

      if (task.status === 'LOCKED') {
        throw new Error('TASK_LOCKED: Task is already locked.');
      }

      // Lock only after engineer certification in the current lifecycle.
      if (task.status !== 'CERTIFIED_BY_ENGINEER') {
        throw new Error('LOCK_FAILED: Task must be CERTIFIED_BY_ENGINEER before it can be LOCKED.');
      }

      await client.query(
        `
        UPDATE task_cards
        SET status = 'LOCKED',
            version = version + 1
        WHERE id = $1
        `,
        [taskId]
      );

      await client.query(
        `
        INSERT INTO audit_log (table_name, row_id, action, old_values, new_values, actor_id, created_at)
        VALUES ($1, $2, 'STATUS_CHANGE', $3, $4, $5, CURRENT_TIMESTAMP)
        `,
        [
          'task_cards', 
          taskId, 
          JSON.stringify({ status: 'CERTIFIED_BY_ENGINEER' }), 
          JSON.stringify({ status: 'LOCKED' }), 
          userId || null
        ]
      );

      await client.query('COMMIT');

    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /* ============================================================
      UPDATE DESCRIPTION
  ============================================================ */

  static async updateDescription(taskId: string, description: string, userId?: string) {

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const task = await this.getTask(client, taskId);

      // Enforce Immutability (Protocol 07 & 08)
      if (task.status === 'CERTIFIED_BY_ENGINEER' || task.status === 'LOCKED') {
        throw new Error('TASK_LOCKED');
      }

      await client.query(
        `
        UPDATE task_cards
        SET description = $2,
            version = version + 1
        WHERE id = $1
        `,
        [taskId, description]
      );

      await client.query(
        `
        INSERT INTO audit_log (table_name, row_id, action, old_values, new_values, actor_id, created_at)
        VALUES ($1, $2, 'UPDATE', $3, $4, $5, CURRENT_TIMESTAMP)
        `,
        [
          'task_cards', 
          taskId, 
          JSON.stringify({ description: task.description }), 
          JSON.stringify({ description }), 
          userId || null
        ]
      );

      await client.query('COMMIT');

    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}
