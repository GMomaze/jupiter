import { Request, Response } from 'express';
import { pool } from '../../config/database.js';

export class ProjectionController {
  static async renderFleetStatus(req: Request, res: Response) {
    try {
      // 1. Fetch Installed Components via the View
      const { rows: installedRows } = await pool.query(`
        SELECT 
          a.id AS ac_id,
          a.registration,
          a.serial_number AS ac_serial,
          a.total_time_hours,
          v.id AS comp_id,
          v.model_name,
          v.category_name,
          v.serial_number AS comp_serial,
          v.install_hours_airframe,
          v.current_actual_tso,
          v.tbo_hours,
          v.hours_remaining,
          v.maintenance_status
        FROM aircraft a
        LEFT JOIN vw_component_status v ON a.registration = v.tail_number
        ORDER BY a.registration ASC
      `);

      // 2. Fetch UNINSTALLED Components (Verified DDL names)
      const { rows: uninstalled } = await pool.query(`
        SELECT 
          c.id,
          c.serial_number,
          c.tso_at_install,
          m.model_name
        FROM components c
        LEFT JOIN component_models m ON c.model_id = m.id
        WHERE c.aircraft_id IS NULL 
        AND c.status = 'SERVICEABLE'
      `);

      // 3. Group the flat rows into the 'aircraft' structure
      const aircraftMap = new Map();

      installedRows.forEach(row => {
        if (!aircraftMap.has(row.registration)) {
          aircraftMap.set(row.registration, {
            id: row.ac_id,
            registration: row.registration,
            serial_number: row.ac_serial,
            total_hours: row.total_time_hours,
            components: []
          });
        }

        if (row.comp_serial) {
          aircraftMap.get(row.registration).components.push({
            id: row.comp_id,
            model_name: row.model_name,
            category_name: row.category_name,
            serial_number: row.comp_serial,
            install_hours_airframe: row.install_hours_airframe,
            current_actual_tso: row.current_actual_tso,
            tbo_hours: row.tbo_hours,
            hours_remaining: row.hours_remaining,
            maintenance_status: row.maintenance_status
          });
        }
      });

      const aircraft = Array.from(aircraftMap.values());

      // 4. Pass both to the view
      res.render('modules/projection/fleet_health', { 
        aircraft, 
        uninstalled 
      });

    } catch (err: any) {
      console.error('PROJECTION_ERROR:', err.message);
      res.status(500).send(`
        <div style="padding: 20px; color: red; border: 1px solid red;">
          <h3>Phase 5 Projection Error</h3>
          <p>${err.message}</p>
        </div>
      `);
    }
  }

  static async getSummary(req: Request, res: Response) {
    try {
      const { rows: summaryRows } = await pool.query(`
        SELECT maintenance_status, COUNT(*) as count 
        FROM vw_component_status 
        GROUP BY maintenance_status
      `);
      
      const statuses = ['NORMAL', 'CRITICAL', 'EXPIRED'];
      const summary = statuses.map(s => ({
        maintenance_status: s,
        count: summaryRows.find(r => r.maintenance_status === s)?.count || 0
      }));

      res.render('modules/projection/partials/summary_cards', { summary, layout: false });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  }
}