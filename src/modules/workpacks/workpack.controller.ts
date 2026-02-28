import { Request, Response } from 'express';
import { WorkpackService } from './workpack.service.js';
import { PdfService } from './pdf.service.js';

import {
  Workpack,
  WorkpackStatus,
  Aircraft,
  TaskCard,
  sequelize
} from '../../models/index.js';

export class WorkpackController {

  /* ============================================================
     INDEX
  ============================================================ */

  static async renderIndex(req: Request, res: Response) {

    const workpacks = await Workpack.findAll({
      include: [
        { model: WorkpackStatus },
        { model: Aircraft }
      ],
      order: [['created_at', 'DESC']]
    });

    res.render('workpacks/index', {
      workpacks,
      user: req.user
    });
  }

  /* ============================================================
     PLANNER DASHBOARD
  ============================================================ */

  static async renderPlanner(req: Request, res: Response) {

    const draftStatus = await WorkpackStatus.findOne({
      where: { code: 'DRAFT' }
    });

    const workpacks = await Workpack.findAll({
      where: { status_id: draftStatus?.id },
      include: [
        { model: WorkpackStatus },
        { model: Aircraft },
        { model: TaskCard }
      ],
      order: [['created_at', 'DESC']]
    });

    const unassignedTasks = await TaskCard.findAll({
      where: sequelize.literal(`
        NOT EXISTS (
          SELECT 1 FROM workpack_tasks wt
          WHERE wt.task_id = "TaskCard"."id"
        )
      `),
      order: [['created_at', 'ASC']]
    });

    const aircraft = await Aircraft.findAll({
      order: [['registration', 'ASC']]
    });

    res.render('workpacks/planner', {
      workpacks,
      unassignedTasks,
      aircraft,
      user: req.user
    });
  }

  /* ============================================================
     HANGAR DASHBOARD
  ============================================================ */

  static async renderHangar(req: Request, res: Response) {

    const statuses = await WorkpackStatus.findAll({
      where: { code: ['ISSUED', 'IN_PROGRESS'] }
    });

    const statusIds = statuses.map(s => s.id);

    const activePacks = await Workpack.findAll({
      where: { status_id: statusIds },
      include: [
        { model: WorkpackStatus },
        { model: Aircraft }
      ],
      order: [['updated_at', 'DESC']]
    });

    res.render('workpacks/hangar', {
      activePacks,
      user: req.user
    });
  }

  /* ============================================================
     EXECUTION VIEW
  ============================================================ */

  static async renderExecution(req: Request, res: Response) {

    const user = req.user as any;

    const pack = await Workpack.findByPk(req.params.id, {
      include: [
        { model: WorkpackStatus },
        { model: Aircraft },
        { model: TaskCard }
      ]
    });

    if (!pack) {
      return res.status(404).send('Workpack not found');
    }

    let tasks = (pack as any).TaskCards || [];

    if (user?.roles?.includes('ENGINEER')) {
      tasks = tasks.filter((t: any) =>
        !t.assigned_to || t.assigned_to === user.id
      );
    }

    res.render('workpacks/execution', {
      pack,
      tasks,
      user
    });
  }

  /* ============================================================
     QA DASHBOARD
  ============================================================ */

  static async renderQA(req: Request, res: Response) {

    const inProgressStatus = await WorkpackStatus.findOne({
      where: { code: 'IN_PROGRESS' }
    });

    const packs = await Workpack.findAll({
      where: { status_id: inProgressStatus?.id },
      include: [
        { model: WorkpackStatus },
        { model: Aircraft },
        { model: TaskCard }
      ],
      order: [['updated_at', 'DESC']]
    });

    const reviewPacks = packs.map(pack => {

      const tasks = (pack as any).TaskCards || [];
      const total = tasks.length;
      const locked = tasks.filter((t: any) => t.status === 'LOCKED').length;

      return {
        ...pack.toJSON(),
        total_tasks: total,
        locked_tasks: locked,
        percent_complete: total ? Math.round((locked / total) * 100) : 0
      };
    });

    res.render('workpacks/qa', {
      reviewPacks,
      user: req.user
    });
  }

  /* ============================================================
     PACK TASK VIEW
  ============================================================ */

  static async renderPackTasks(req: Request, res: Response) {

    const pack = await Workpack.findByPk(req.params.id, {
      include: [
        { model: WorkpackStatus },
        { model: Aircraft },
        { model: TaskCard }
      ]
    });

    if (!pack) {
      return res.status(404).send('Workpack not found');
    }

    const tasks = (pack as any).TaskCards || [];

    res.render('workpacks/tasks', {
      pack,
      tasks,
      user: req.user
    });
  }

  /* ============================================================
     ACTIONS
  ============================================================ */

  static async handleCreate(req: Request, res: Response) {

    const { work_order_number, aircraft_id } = req.body;
    const actorId = (req as any).user?.id;

    try {
      await WorkpackService.create(
        { work_order_number, aircraft_id },
        actorId
      );

      if (req.headers['hx-request']) {
        return res.set('HX-Refresh', 'true').status(204).send();
      }

      res.redirect('/workpacks/planner');

    } catch (error: any) {
      res.status(400).send(error.message);
    }
  }

  static async handleAddTask(req: Request, res: Response) {

    const { taskId } = req.params;
    const { workpack_id } = req.body;
    const actorId = (req as any).user?.id;

    try {
      await WorkpackService.addTask(workpack_id, taskId, actorId);
      res.setHeader('HX-Refresh', 'true');
      res.status(200).send();
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  }

  static async handleRemoveTask(req: Request, res: Response) {

    const { id, taskId } = req.params;
    const actorId = (req as any).user?.id;

    try {
      await WorkpackService.removeTask(id, taskId, actorId);
      res.set('HX-Refresh', 'true').send();
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  }

  static async handleIssue(req: Request, res: Response) {

    const actorId = (req as any).user?.id;

    try {
      await WorkpackService.issue(req.params.id, actorId);
      res.redirect('/workpacks/hangar');
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  }

  static async handleStart(req: Request, res: Response) {

    const actorId = (req as any).user?.id;

    try {
      await WorkpackService.startWork(req.params.id, actorId);
      res.redirect('/workpacks/hangar');
    } catch (error: any) {
      res.status(400).send(error.message);
    }
  }

  static async handleClose(req: Request, res: Response) {

    const actorId = (req as any).user?.id;

    try {
      await WorkpackService.close(req.params.id, actorId);

      const pdfBuffer = await PdfService.generateCRS(req.params.id);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=CRS_${req.params.id}.pdf`
      );

      res.send(pdfBuffer);

    } catch (error: any) {
      res.status(400).send(error.message);
    }
  }

  static async handleTaskSign(req: Request, res: Response) {

    const actorId = (req as any).user?.id;
    const role = (req as any).user?.roles?.[0];

    try {

      const task = await WorkpackService.signTask(
        req.params.taskId,
        actorId,
        role
      );

      res.render('partials/task_row', {
        task,
        user: req.user,
        layout: false
      });

    } catch (error: any) {
      res.status(400).send(error.message);
    }
  }

  static async handleTaskLock(req: Request, res: Response) {

    const actorId = (req as any).user?.id;
    const role = (req as any).user?.roles?.[0];

    try {

      const task = await WorkpackService.lockTask(
        req.params.taskId,
        actorId,
        role
      );

      res.render('partials/task_row', {
        task,
        user: req.user,
        layout: false
      });

    } catch (error: any) {
      res.status(400).send(error.message);
    }
  }
}