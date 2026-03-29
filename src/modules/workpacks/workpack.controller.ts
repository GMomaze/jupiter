import { Request, Response } from 'express';
import { WorkpackService } from './workpack.service.js';
import { PdfService } from './pdf.service.js';

import {
  Workpack,
  WorkpackStatus,
  Aircraft,
  TaskCard,
  TaskTemplate,
  User,
  sequelize
} from '../../models/index.js';

export class WorkpackController {
  private static getFriendlyErrorMessage(error: any) {
    if (error?.message === 'WORKPACK_ALREADY_EXISTS') {
      return 'A workpack with that work order number already exists.';
    }

    if (error?.message === 'VALIDATION_FAILED: Aircraft already has DRAFT.') {
      return 'This aircraft already has a draft workpack.';
    }

    if (error?.message === 'ONLY_DRAFT_WORKPACKS_CAN_BE_DELETED') {
      return 'Only draft workpacks can be deleted.';
    }

    if (error?.name === 'SequelizeUniqueConstraintError') {
      return 'A workpack with that work order number already exists.';
    }

    if (error?.message === 'TASK_TEMPLATE_NOT_COMPATIBLE_WITH_AIRCRAFT') {
      return 'That task template does not match the selected aircraft.';
    }

    if (error?.message === 'TASK_TEMPLATE_ALREADY_ADDED_TO_WORKPACK') {
      return 'That task template has already been added to this draft workpack.';
    }

    return error?.message || 'Something went wrong.';
  }

  private static respondAfterTaskAction(req: Request, res: Response, task: any) {
    if (!req.headers['hx-request']) {
      const returnTo = req.get('referer') || '/workpacks/hangar';
      return res.redirect(returnTo);
    }

    return res.set('HX-Refresh', 'true').status(204).send();
  }

  private static async renderTaskRowResponse(req: Request, res: Response, task: any) {
    const hydratedTask = await TaskCard.findByPk(task.id, {
      include: [
        {
          model: User,
          as: 'Assignee',
          attributes: ['id', 'full_name', 'email']
        },
        {
          model: User,
          as: 'MechanicCompleter',
          attributes: ['id', 'full_name', 'email']
        },
        {
          model: User,
          as: 'EngineerCertifier',
          attributes: ['id', 'full_name', 'email']
        }
      ]
    });

    const packs = await Workpack.findAll({
      include: [
        { model: WorkpackStatus },
        {
          model: TaskCard,
          where: { id: task.id },
          include: [
            {
              model: User,
              as: 'Assignee',
              attributes: ['id', 'full_name', 'email']
            },
            {
              model: User,
              as: 'MechanicCompleter',
              attributes: ['id', 'full_name', 'email']
            },
            {
              model: User,
              as: 'EngineerCertifier',
              attributes: ['id', 'full_name', 'email']
            }
          ]
        }
      ],
      order: [['updated_at', 'DESC']]
    });

    const pack = packs[0] || null;

    return res.render('partials/task_row', {
      task: hydratedTask || task,
      pack,
      user: req.user,
      layout: false
    });
  }

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

    const taskTemplates = await TaskTemplate.findAll({
      where: { is_active: true },
      include: [
        {
          model: Aircraft,
          as: 'Aircraft',
          attributes: ['id', 'registration']
        }
      ],
      order: [['scope', 'ASC'], ['title', 'ASC']]
    });

    res.render('workpacks/planner', {
      workpacks,
      unassignedTasks,
      taskTemplates,
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
        {
          model: TaskCard,
          include: [
            {
              model: User,
              as: 'Assignee',
              attributes: ['id', 'full_name', 'email']
            },
            {
              model: User,
              as: 'MechanicCompleter',
              attributes: ['id', 'full_name', 'email']
            },
            {
              model: User,
              as: 'EngineerCertifier',
              attributes: ['id', 'full_name', 'email']
            }
          ]
        }
      ]
    });

    if (!pack) {
      return res.status(404).send('Workpack not found');
    }

    const tasks = (pack as any).TaskCards || [];

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
        {
          model: TaskCard,
          include: [
            {
              model: User,
              as: 'Assignee',
              attributes: ['id', 'full_name', 'email']
            },
            {
              model: User,
              as: 'MechanicCompleter',
              attributes: ['id', 'full_name', 'email']
            },
            {
              model: User,
              as: 'EngineerCertifier',
              attributes: ['id', 'full_name', 'email']
            }
          ]
        }
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
      const friendlyMessage = WorkpackController.getFriendlyErrorMessage(error);

      if (req.headers['hx-request']) {
        return res.status(400).send(friendlyMessage);
      }

      req.flash('error', friendlyMessage);
      return res.redirect('/workpacks/planner');
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

    try {

      const task = await WorkpackService.signTask(
        req.params.taskId,
        actorId
      );

      return this.respondAfterTaskAction(req, res, task);

    } catch (error: any) {
      res.status(400).send(error.message);
    }
  }

  static async handleAddTemplateTask(req: Request, res: Response) {

    const { templateId } = req.params;
    const { workpack_id } = req.body;
    const actorId = (req as any).user?.id;

    try {
      await WorkpackService.addTaskFromTemplate(workpack_id, templateId, actorId);
      res.setHeader('HX-Refresh', 'true');
      res.status(200).send();
    } catch (error: any) {
      res.status(400).send(WorkpackController.getFriendlyErrorMessage(error));
    }
  }

  static async handleDeleteDraft(req: Request, res: Response) {

    const actorId = (req as any).user?.id;

    try {
      await WorkpackService.deleteDraft(req.params.id, actorId);

      if (req.headers['hx-request']) {
        return res.set('HX-Refresh', 'true').status(204).send();
      }

      return res.redirect('/workpacks/planner');
    } catch (error: any) {
      const friendlyMessage = WorkpackController.getFriendlyErrorMessage(error);

      if (req.headers['hx-request']) {
        return res.status(400).send(friendlyMessage);
      }

      req.flash('error', friendlyMessage);
      return res.redirect('/workpacks/planner');
    }
  }

  static async handleTaskStart(req: Request, res: Response) {

    const actorId = (req as any).user?.id;

    try {

      const task = await WorkpackService.startTask(
        req.params.taskId,
        actorId
      );

      return this.respondAfterTaskAction(req, res, task);

    } catch (error: any) {
      res.status(400).send(error.message);
    }
  }

  static async handleTaskComplete(req: Request, res: Response) {

    const actorId = (req as any).user?.id;

    try {

      const task = await WorkpackService.completeTask(
        req.params.taskId,
        actorId
      );

      return this.respondAfterTaskAction(req, res, task);

    } catch (error: any) {
      res.status(400).send(error.message);
    }
  }

  static async handleTaskWorkNote(req: Request, res: Response) {

    const actorId = (req as any).user?.id;

    try {

      const task = await WorkpackService.saveWorkPerformed(
        req.params.taskId,
        req.body.work_performed ?? '',
        actorId
      );

      return this.respondAfterTaskAction(req, res, task);

    } catch (error: any) {
      res.status(400).send(error.message);
    }
  }

  static async handleTaskLock(req: Request, res: Response) {

    const actorId = (req as any).user?.id;

    try {

      const task = await WorkpackService.lockTask(
        req.params.taskId,
        actorId
      );

      return this.respondAfterTaskAction(req, res, task);

    } catch (error: any) {
      res.status(400).send(error.message);
    }
  }
}
