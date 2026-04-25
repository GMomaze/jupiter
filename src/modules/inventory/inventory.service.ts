import { pool } from '../../config/database.js';

export class InventoryService {
  /**
   * REMOVE COMPONENT (Off-Unit)
   * Detaches a part from an aircraft and places it in the Store.
   */
  static async removeComponent(componentId: string, actorId: string, remarks: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get current aircraft and its current hours
      const { rows } = await client.query(`
        SELECT c.aircraft_id, a.total_time_hours 
        FROM components c
        JOIN aircraft a ON c.aircraft_id = a.id
        WHERE c.id = $1
      `, [componentId]);

      if (!rows.length) throw new Error('Component not currently installed on an aircraft.');
      const { aircraft_id, total_time_hours } = rows[0];

      // 2. Record the movement in the ledger
      await client.query(`
        INSERT INTO inventory_movements (component_id, aircraft_id, action_type, hours_at_movement, actor_id, remarks)
        VALUES ($1, $2, 'REMOVAL', $3, $4, $5)
      `, [componentId, aircraft_id, total_time_hours, actorId, remarks]);

      // 3. Update Component: Set to SERVICEABLE and remove aircraft link
      await client.query(`
        UPDATE components 
        SET aircraft_id = NULL, 
            status = 'SERVICEABLE',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [componentId]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * INSTALL COMPONENT (On-Unit)
   * Attaches a part from the Store to an aircraft.
   */
  static async installComponent(componentId: string, aircraftId: string, actorId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get target Aircraft current hours
      const { rows: ac } = await client.query(
        'SELECT total_time_hours FROM aircraft WHERE id = $1', 
        [aircraftId]
      );
      if (!ac.length) throw new Error('Target aircraft not found.');
      const currentAfHours = ac[0].total_time_hours;

      // 2. Verify component availability
      const { rows: comp } = await client.query(
        "SELECT status FROM components WHERE id = $1 AND status = 'SERVICEABLE'",
        [componentId]
      );
      if (!comp.length) throw new Error('Component is not Serviceable or already installed.');

      // 3. Record the movement
      await client.query(`
        INSERT INTO inventory_movements (component_id, aircraft_id, action_type, hours_at_movement, actor_id)
        VALUES ($1, $2, 'INSTALLATION', $3, $4)
      `, [componentId, aircraftId, currentAfHours, actorId]);

      // 4. Update Component: Set Aircraft, Status, and the new Install Base (AF Hours)
      await client.query(`
        UPDATE components 
        SET aircraft_id = $2, 
            status = 'INSTALLED',
            install_hours_airframe = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [componentId, aircraftId, currentAfHours]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
