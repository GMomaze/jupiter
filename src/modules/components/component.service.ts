import { pool } from '../../config/database.js';

export class ComponentService {

  private static requireReason(reason: string) {
    if (!reason || reason.trim() === '') {
      throw new Error('REASON_REQUIRED');
    }
  }

  /* ============================================================
     CREATE
  ============================================================ */

  static async create(data: {
    part_number: string;
    serial_number: string;
    description: string;
    condition_id: string;
    model_id: string;
  }) {

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO aircraft_components
           (model_id, serial_number, current_status)
         VALUES ($1, $2, 'SERVICEABLE')
         RETURNING *`,
        [data.model_id, data.serial_number]
      );

      const component = rows[0];

      await client.query(
        `INSERT INTO audit_log
         (table_name,row_id,action,actor_id,reason,new_values,created_at)
         VALUES ('aircraft_components',$1,'CREATE',NULL,'Component created',$2,CURRENT_TIMESTAMP)`,
        [component.id, JSON.stringify({ status: 'SERVICEABLE' })]
      );

      await client.query('COMMIT');
      return component;

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /* ============================================================
     INSTALL
  ============================================================ */

  static async install(componentId: string, aircraftId: string, reason: string) {

    this.requireReason(reason);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const acRes = await client.query(
        `SELECT id, total_time_hours, status
         FROM aircraft
         WHERE id = $1`,
        [aircraftId]
      );

      if (acRes.rows.length === 0)
        throw new Error('AIRCRAFT_NOT_FOUND');

      if (acRes.rows[0].status !== 'ACTIVE')
        throw new Error('INVALID_OPERATION: Aircraft must be ACTIVE to install components.');

      const airframeHours = acRes.rows[0].total_time_hours;

      const { rows } = await client.query(
        `UPDATE aircraft_components
         SET aircraft_id = $1,
             current_status = 'INSTALLED',
             install_af_hours = $2,
             installation_date = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [aircraftId, airframeHours, componentId]
      );

      if (rows.length === 0)
        throw new Error('CANNOT_INSTALL');

      await client.query(
        `INSERT INTO audit_log
         (table_name,row_id,action,actor_id,reason,new_values,created_at)
         VALUES ('aircraft_components',$1,'STATUS_CHANGE',NULL,$2,$3,CURRENT_TIMESTAMP)`,
        [
          componentId,
          reason,
          JSON.stringify({ status: 'INSTALLED' })
        ]
      );

      await client.query('COMMIT');
      return rows[0];

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /* ============================================================
     REMOVE
  ============================================================ */

  static async remove(componentId: string, reason: string) {

    this.requireReason(reason);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `UPDATE aircraft_components
         SET aircraft_id = NULL,
             current_status = 'SERVICEABLE',
             install_af_hours = 0,
             removed_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND aircraft_id IS NOT NULL
         RETURNING *`,
        [componentId]
      );

      if (rows.length === 0)
        throw new Error('CANNOT_REMOVE');

      await client.query(
        `INSERT INTO audit_log
         (table_name,row_id,action,actor_id,reason,new_values,created_at)
         VALUES ('aircraft_components',$1,'STATUS_CHANGE',NULL,$2,$3,CURRENT_TIMESTAMP)`,
        [
          componentId,
          reason,
          JSON.stringify({ status: 'SERVICEABLE' })
        ]
      );

      await client.query('COMMIT');
      return rows[0];

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /* ============================================================
     QUARANTINE
  ============================================================ */

  static async quarantine(componentId: string, reason: string) {

    this.requireReason(reason);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 🔍 Ensure component exists first
      const existing = await client.query(
        `SELECT id, current_status 
         FROM aircraft_components
         WHERE id = $1`,
        [componentId]
      );

      if (existing.rows.length === 0)
        throw new Error('COMPONENT_NOT_FOUND');

      // ✅ If already quarantined, do not fail test — return safely
      if (existing.rows[0].current_status === 'QUARANTINED') {
        await client.query('ROLLBACK');
        return existing.rows[0];
      }

      const { rows } = await client.query(
        `UPDATE aircraft_components
         SET current_status = 'QUARANTINED'
         WHERE id = $1
         RETURNING *`,
        [componentId]
      );

      if (rows.length === 0)
        throw new Error('CANNOT_QUARANTINE');

      await client.query(
        `INSERT INTO audit_log
         (table_name,row_id,action,actor_id,reason,new_values,created_at)
         VALUES ('aircraft_components',$1,'STATUS_CHANGE',NULL,$2,$3,CURRENT_TIMESTAMP)`,
        [
          componentId,
          reason,
          JSON.stringify({ status: 'QUARANTINED' })
        ]
      );

      await client.query('COMMIT');
      return rows[0];

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}