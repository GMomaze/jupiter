import { Request, Response } from 'express';
import { ComponentService } from './component.service.js';
import { pool } from '../../config/database.js';

export class ComponentController {
  static async renderCreate(req: Request, res: Response) {
    const conditions = await pool.query('SELECT * FROM rf_component_condition ORDER BY label ASC');
    const models = await pool.query('SELECT * FROM component_models ORDER BY model_name ASC');
    res.render('modules/components/create', { 
      conditions: conditions.rows,
      models: models.rows
    });
  }

  static async create(req: Request, res: Response) {
    try {
      const component = await ComponentService.create(req.body);
      res.header('HX-Redirect', `/components/${component.id}`);
      res.status(201).send();
    } catch (err: any) {
      res.status(400).send(err.message);
    }
  }

  static async install(req: Request, res: Response) {
    try {
      const { aircraft_id, tso_at_install, tsn_at_install, reason } = req.body;
      const comp = await ComponentService.install({
        componentId: req.params.id,
        aircraftId: aircraft_id,
        tsoAtInstall: parseFloat(tso_at_install || 0),
        tsnAtInstall: parseFloat(tsn_at_install || 0),
        reason
      });
      res.render('modules/components/partials/install-status', { comp });
    } catch (err: any) {
      res.status(422).set('HX-Retarget', '#error-toast').send(err.message);
    }
  }

  static async remove(req: Request, res: Response) {
    try {
      const comp = await ComponentService.remove(req.params.id, req.body.reason);
      res.render('modules/components/partials/install-status', { comp });
    } catch (err: any) {
      res.status(422).send(err.message);
    }
  }
}