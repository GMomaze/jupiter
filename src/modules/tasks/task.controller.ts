import { Request, Response } from 'express';
import { TaskService } from './task.service.js';
import { defineAbilitiesFor } from '../auth/ability.js';

export class TaskController {

  /**
   * CREATE TASK (UNASSIGNED)
   * Required for Planner + E2E
   */
  static async create(req: Request, res: Response) {
    try {
      const { title, description, aircraft_id } = req.body;

      if (!title || !aircraft_id) {
        return res.status(400).send('title and aircraft_id are required');
      }

      const task = await TaskService.create({
        title,
        description,
        aircraft_id
      });

      return res.status(201).json(task);
    } catch (err: any) {
      return res.status(422).send(err.message);
    }
  }

  /**
   * SIGN-OFF TASK
   * Legal transition to SIGNED (snapshot handled in service)
   */
  static async signOff(req: Request, res: Response) {
    
    const ability = defineAbilitiesFor(req.user);

    if (ability.cannot('sign', 'TaskCard')) {
      return res
        .status(403)
        .send('FORBIDDEN: You do not have Certifying Staff privileges.');
    }

    try {
      const taskId = req.params.id;

      // Snapshot + state transition handled inside service
      const task = await TaskService.signOff(
        taskId,
        req.user.id,
        '' // HTML content can be passed later if needed
      );

      return res.status(200).json(task);
    } catch (err: any) {
      return res.status(422).send(err.message);
    }
  }
}
