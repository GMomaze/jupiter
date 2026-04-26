import { Request, Response } from 'express';
import { WorkpackService } from './workpack.service.js';
import { PdfService as ServicePdfService } from './pdf.service.js';
import { PdfService as ReleasePdfService } from './pdf.release.js';
import { PdfService as CrmaPdfService } from './pdf.crma.js';
import { AircraftService } from '../aircraft/aircraft.service.js';
import { TaskImportService } from './services/TaskImportService.js';
import { SnagService } from './services/snag.service.js';
import { TaskExecutionService } from './services/task-execution.service.js';
import {
  Workpack,
  WorkpackStatus,
  Aircraft,
  TaskCard,
  TaskTemplate,
  User,
  ServiceBulletin,
  WorkpackExecution,
  WorkpackMeasurement,
  WorkpackSnag,
  WorkpackSnagAuditLog,
  sequelize
} from '../../models/index.js';

export class WorkpackController {
  private static getParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] || '' : value || '';
  }

  private static readonly workpackAircraftInclude = {
    model: Aircraft,
    attributes: [
      'id',
      'registration',
      'serial_number',
      'model_id',
      'category_id',
      'status',
      'total_time_hours',
      'total_time_cycles',
      'version',
      'created_at',
      'updated_at',
    ],
  };

  private static readonly basicUserAttributes = ['id', 'email', 'full_name'];

  private static async findPackForSnags(packId: string, includeAuditEntries: boolean) {
    return Workpack.findByPk(packId, {
      attributes: [
        'id',
        'work_order_number',
        'aircraft_id',
        'status_id',
        'created_at',
        'updated_at',
      ],
      include: [
        {
          model: WorkpackStatus,
          attributes: ['id', 'code', 'label'],
        },
        WorkpackController.workpackAircraftInclude,
        {
          model: WorkpackSnag,
          as: 'Snags',
          attributes: [
            'id',
            'workpack_id',
            'snag_no',
            'description',
            'status',
            'category',
            'priority',
            'parts_used',
            'time_spent_minutes',
            'resolution_notes',
            'created_by',
            'assigned_to',
            'resolved_by',
            'closed_by',
            'started_by',
            'created_at',
            'started_at',
            'resolved_at',
            'closed_at',
          ],
          include: [
            { model: User, as: 'Reporter', attributes: WorkpackController.basicUserAttributes, required: false },
            { model: User, as: 'Assignee', attributes: WorkpackController.basicUserAttributes, required: false },
            { model: User, as: 'Starter', attributes: WorkpackController.basicUserAttributes, required: false },
            { model: User, as: 'Resolver', attributes: WorkpackController.basicUserAttributes, required: false },
            { model: User, as: 'Closer', attributes: WorkpackController.basicUserAttributes, required: false },
            ...(includeAuditEntries
              ? [
                  {
                    model: WorkpackSnagAuditLog,
                    as: 'AuditEntries',
                    attributes: ['id', 'action', 'sequence', 'created_at', 'user_id'],
                    include: [
                      {
                        model: User,
                        as: 'Actor',
                        attributes: WorkpackController.basicUserAttributes,
                        required: false
                      }
                    ],
                    required: false,
                  }
                ]
              : []),
          ],
          required: false,
        },
      ],
      order: includeAuditEntries
        ? [
            [{ model: WorkpackSnag, as: 'Snags' }, 'snag_no', 'DESC'],
            [{ model: WorkpackSnag, as: 'Snags' }, { model: WorkpackSnagAuditLog, as: 'AuditEntries' }, 'sequence', 'DESC'],
          ]
        : [
            [{ model: WorkpackSnag, as: 'Snags' }, 'snag_no', 'DESC'],
          ],
    });
  }

  private static async sendPdf(
    res: Response,
    workpackId: string,
    filenamePrefix: string,
    generator: (workpackId: string) => Promise<Buffer>
  ) {
    const pdf = await generator(workpackId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filenamePrefix}_${workpackId}.pdf`);
    res.send(pdf);
  }

  private static isGenericMeasurementLabel(label: string) {
    return /^Value \d+$/i.test(String(label || '').trim());
  }

  private static getMeasurementDefinitions(description: string | null | undefined) {
    return Array.from(String(description || '').matchAll(/\[([^\]]*)\]/g)).map((match, index) => {
      const rawLabel = String(match[1] || '').trim();
      return {
        field_key: `field_${index}`,
        field_label: rawLabel || `Value ${index + 1}`,
        position: index + 1,
      };
    });
  }

  private static splitWorkPerformed(rawValue: string | null | undefined) {
    const startMarker = '[Captured Values]';
    const endMarker = '[/Captured Values]';
    const value = String(rawValue || '').trim();
    const start = value.indexOf(startMarker);
    const end = value.indexOf(endMarker);

    if (start === -1 || end === -1 || end < start) {
      return { captured: '', note: value };
    }

    const captured = value.slice(start + startMarker.length, end).trim();
    const before = value.slice(0, start).trim();
    const after = value.slice(end + endMarker.length).trim();

    return {
      captured,
      note: [before, after].filter(Boolean).join('\n\n').trim(),
    };
  }

  private static parseCapturedValues(captured: string) {
    const values = new Map<string, string>();

    String(captured || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) return;

        const label = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        if (!label || !value) return;

        values.set(label, value);
      });

    return values;
  }

  private static buildPreferredMeasurements(task: any, latestExecution: any) {
    const definitions = this.getMeasurementDefinitions(task.description);
    const executionMeasurements = Array.isArray(latestExecution?.Measurements)
      ? latestExecution.Measurements
      : [];
    const legacyCaptured = this.parseCapturedValues(
      this.splitWorkPerformed(task.work_performed).captured
    );

    if (!definitions.length) {
      if (executionMeasurements.length) {
        return executionMeasurements;
      }

      return Array.from(legacyCaptured.entries()).map(([label, value], index) => ({
        id: null,
        execution_id: latestExecution?.id || null,
        field_key: `field_${index}`,
        field_label: label,
        position: index + 1,
        value,
      }));
    }

    const byKey = new Map<string, any>();
    const byLabel = new Map<string, any>();
    const byPosition = new Map<number, any>();

    executionMeasurements.forEach((measurement: any) => {
      const key = String(measurement.field_key || '').trim();
      const label = String(measurement.field_label || '').trim();
      const position = Number(measurement.position);

      if (key) {
        byKey.set(key, measurement);
      }

      if (label) {
        byLabel.set(label, measurement);
      }

      if (Number.isFinite(position) && position > 0) {
        byPosition.set(position, measurement);
      }
    });

    const matchedMeasurements = new Set<any>();

    const preferredMeasurements = definitions.map((definition) => {
      const structuredMeasurement =
        byKey.get(definition.field_key) ||
        byPosition.get(definition.position) ||
        byLabel.get(definition.field_label) ||
        null;
      if (structuredMeasurement) {
        matchedMeasurements.add(structuredMeasurement);
      }
      const structuredValue = String(structuredMeasurement?.value || '').trim();
      const legacyValue = String(legacyCaptured.get(definition.field_label) || '').trim();

      return {
        id: structuredMeasurement?.id || null,
        execution_id: structuredMeasurement?.execution_id || latestExecution?.id || null,
        field_key: structuredMeasurement?.field_key || definition.field_key,
        field_label: structuredMeasurement?.field_label || definition.field_label,
        position: structuredMeasurement?.position || definition.position,
        value: structuredValue || legacyValue || null,
      };
    });

    const extraStructuredMeasurements = executionMeasurements
      .filter((measurement: any) => !matchedMeasurements.has(measurement))
      .map((measurement: any) => ({
        id: measurement.id || null,
        execution_id: measurement.execution_id || latestExecution?.id || null,
        field_key: measurement.field_key,
        field_label: measurement.field_label,
        position: measurement.position,
        value: measurement.value ?? null,
      }))
      .sort((a: any, b: any) => Number(a.position || 0) - Number(b.position || 0));

    return [...preferredMeasurements, ...extraStructuredMeasurements];
  }

  private static async attachLatestExecutions(packId: string, tasks: any[]) {
    if (!tasks.length) {
      return tasks;
    }

    let executions: any[] = [];

    try {
      executions = await WorkpackExecution.findAll({
        attributes: [
          'id',
          'workpack_id',
          'task_id',
          'attempt_no',
          'status',
          'started_by',
          'completed_by',
          'certified_by',
          'started_at',
          'completed_at',
          'certified_at',
          'version',
        ],
        where: {
          workpack_id: packId,
          task_id: tasks.map((task) => task.id),
        },
        include: [
          {
            model: WorkpackMeasurement,
            as: 'Measurements',
            attributes: ['id', 'execution_id', 'field_key', 'field_label', 'position', 'value'],
            required: false,
          },
        ],
        order: [
          ['task_id', 'ASC'],
          ['attempt_no', 'DESC'],
          [{ model: WorkpackMeasurement, as: 'Measurements' }, 'position', 'ASC'],
        ],
      });
    } catch (e: any) {
      const sql = String(e?.sql || e?.parent?.sql || '');
      const code = e?.parent?.code || e?.original?.code;
      const isExecutionSchemaGap =
        code === '42P01' ||
        code === '42703' ||
        sql.includes('workpack_executions') ||
        sql.includes('workpack_measurements');

      if (!isExecutionSchemaGap) {
        throw e;
      }

      console.warn('[WorkpackController] attachLatestExecutions missing execution schema, continuing without execution history');

      tasks.forEach((task: any) => {
        task.setDataValue('LatestExecution', null);
        task.setDataValue('PrefillMeasurements', {});
      });

      return tasks;
    }

    const latestByTaskId = new Map<string, any>();
    for (const execution of executions) {
      if (!latestByTaskId.has(execution.task_id)) {
        latestByTaskId.set(execution.task_id, execution);
      }
    }

    tasks.forEach((task: any) => {
      task.setDataValue('LatestExecution', latestByTaskId.get(task.id) || null);
    });

    tasks.sort((a: any, b: any) =>
      String(a.task_card_number || '').localeCompare(
        String(b.task_card_number || ''),
        undefined,
        { numeric: true, sensitivity: 'base' }
      )
    );

    const carryForwardValues = new Map<string, string>();

    tasks.forEach((task: any) => {
      const latestExecution = task.getDataValue('LatestExecution');
      const preferredMeasurements = this.buildPreferredMeasurements(task, latestExecution);

      if (latestExecution) {
        latestExecution.setDataValue('Measurements', preferredMeasurements);
      } else if (preferredMeasurements.length) {
        task.setDataValue('LatestExecution', {
          id: null,
          workpack_id: packId,
          task_id: task.id,
          attempt_no: 1,
          status: task.status,
          started_by: null,
          completed_by: null,
          certified_by: null,
          started_at: null,
          completed_at: null,
          certified_at: null,
          version: 0,
          Measurements: preferredMeasurements,
        });
      }

      task.setDataValue(
        'PrefillMeasurements',
        Object.fromEntries(carryForwardValues.entries())
      );

      preferredMeasurements.forEach((measurement: any) => {
        const label = String(measurement.field_label || '').trim();
        const value = String(measurement.value || '').trim();
        if (label && value && !this.isGenericMeasurementLabel(label)) {
          carryForwardValues.set(label, value);
        }
      });
    });

    return tasks;
  }

  private static getFriendlyErrorMessage(err: any) {
      const map: Record<string, string> = {
      'WORKPACK_ALREADY_EXISTS': 'A workpack with this work order number already exists.',
      'VALIDATION_FAILED: Aircraft already has DRAFT.': 'This aircraft already has an open draft workpack.',
      'ONLY_DRAFT_WORKPACKS_CAN_BE_DELETED': 'Only draft workpacks can be deleted.',
      'TASK_TEMPLATE_NOT_COMPATIBLE_WITH_AIRCRAFT': 'This task template is not applicable to the selected aircraft.',
      'TASK_TEMPLATE_ALREADY_ADDED_TO_WORKPACK': 'This task template has already been added to the selected draft workpack.',
      'TASK_OWNED_BY_ANOTHER_MECHANIC': 'This task is assigned to another mechanic. You may view it, but only the assigned mechanic or an authorized override role may make changes.',
      'TASK_NOT_STARTED': 'Please start the task before entering notes or measurements.',
      'TASK_START_BLOCKED': 'This task cannot be started from its current status.',
      'TASK_COMPLETE_BLOCKED': 'Only a task that is in progress and assigned to you can be completed.',
      'TASK_NOTE_EDIT_BLOCKED': 'This task is no longer editable in its current status.',
      'SNAG_DESCRIPTION_REQUIRED': 'Enter the snag before saving it.',
      'SNAG_RESOLUTION_REQUIRED': 'Enter the snag resolution before resolving it.',
      'SNAG_START_BLOCKED': 'This snag has already been started.',
      'SNAG_RESOLVE_BLOCKED': 'Only an in-progress snag can be resolved.',
      'SNAG_RESOLVE_NOT_ASSIGNED': 'Only the assigned mechanic can resolve this snag.',
      'SNAG_CLOSE_BLOCKED': 'Only a resolved snag can be closed.',
      'SNAG_CLOSE_ROLE_BLOCKED': 'Only an engineer or supervisor can close a snag.',
      'SNAG_TIME_SPENT_INVALID': 'Time spent must be a valid number of minutes.',
      'SNAG_WORKPACK_REQUIRED': 'Workpack reference is required to create a snag.',
      'SNAG_AIRCRAFT_REQUIRED': 'Aircraft reference is required to create a snag.',
      'SNAGS_NOT_ALLOWED_IN_DRAFT': 'Snags can only be logged after the workpack has been issued.',
      'WORKPACK_CLOSE_BLOCKED_BY_OPEN_SNAGS': 'All snags must be closed before the workpack can be closed.',
      'WORKPACK_RELEASE_PDF_BLOCKED': 'Release PDF is only available after the workpack has been fully signed off and certified.',
      'SequelizeUniqueConstraintError': 'A workpack with this work order number already exists.'
      };
    return map[err?.message] || map[err?.name] || err?.message || 'Something went wrong.';
  }

  private static actionResponse(req: Request, res: Response, task?: any) {
    if (req.headers['hx-request']) return res.set('HX-Refresh', 'true').status(204).send();
    return res.redirect(req.get('referer') || '/workpacks/planner');
  }

  // DASHBOARDS
  static async renderIndex(req: Request, res: Response) {
    try {
      const [workpacks] = await sequelize.query(
        `SELECT
           w.id,
           w.work_order_number,
           w.created_at,
           a.registration,
           s.code AS status_code,
           s.label AS status_label
         FROM workpacks w
         JOIN aircraft a ON a.id = w.aircraft_id
         JOIN rf_workpack_status s ON s.id = w.status_id
         ORDER BY w.created_at DESC`
      );

      res.render('workpacks/index', { workpacks, user: req.user });
    } catch (e: any) {
      console.error('[WorkpackController] renderIndex Database Error:', e.original || e);
      res.status(500).send(WorkpackController.getFriendlyErrorMessage(e));
    }
  }

  static async renderPlanner(req: Request, res: Response) {
    try {
      const draftStatus = await WorkpackStatus.findOne({ where: { code: 'DRAFT' } });
      
      const workpacks = await Workpack.findAll({
        where: { status_id: draftStatus?.id || null },
        include: [WorkpackStatus, WorkpackController.workpackAircraftInclude, TaskCard],
        order: [['created_at', 'DESC']]
      });

      const unassignedTasks = await TaskCard.findAll({
        where: sequelize.literal(`NOT EXISTS (SELECT 1 FROM workpack_tasks wt WHERE wt.task_id = "TaskCard"."id")`),
        order: [['created_at', 'ASC']]
      });

      const aircraft = await Aircraft.findAll({
        attributes: ['id', 'registration', 'model_id'],
        order: [['registration', 'ASC']],
      });
      const taskTemplateRows = await TaskTemplate.findAll({
        attributes: [
          'id',
          'scope',
          'task_card_number',
          'sort_order',
          'title',
          'description',
          'aircraft_model_id',
          'aircraft_id',
          'is_active',
        ],
        where: { is_active: true },
        order: [['sort_order', 'ASC']],
        raw: true,
      });
      const taskTemplates = taskTemplateRows.map((template: any) => ({
        ...template,
        is_required_for_wood: false,
        is_required_for_fabric: false,
        is_required_for_bungees: false,
        is_required_for_woodprop: false,
        is_required_for_retractable: false,
      }));
      
      const serviceBulletinsByWorkpackId = Object.fromEntries(await Promise.all(workpacks.map(async (wp: any) => {
        if (!wp.aircraft_id) return [wp.id, []];
        try {
          const sbs = await AircraftService.getServiceBulletinsForAircraft(wp.aircraft_id, { open_only: 'true' });
          const existing = new Set((wp.TaskCards || []).map((t: any) => t.service_bulletin_id).filter(Boolean));
          return [wp.id, sbs.filter((b: any) => !existing.has(b.id))];
        } catch (err) {
          console.error(`[Planner] SB Fetch Error for WP ${wp.id}:`, err);
          return [wp.id, []];
        }
      })));

      res.render('workpacks/planner', { workpacks, unassignedTasks, taskTemplates, aircraft, serviceBulletinsByWorkpackId, user: req.user });
    } catch (e: any) {
      // Log the full error to help identify missing columns
      console.error('[WorkpackController] renderPlanner Database Error:', e.original || e);
      res.status(500).send(WorkpackController.getFriendlyErrorMessage(e));
    }
  }

  static async renderHangar(req: Request, res: Response) {
    const statuses = await WorkpackStatus.findAll({ where: { code: ['ISSUED', 'IN_PROGRESS'] } });
    const activePacks = await Workpack.findAll({
      where: { status_id: statuses.map(s => s.id) },
      include: [WorkpackStatus, WorkpackController.workpackAircraftInclude],
      order: [['updated_at', 'DESC']]
    });
    res.render('workpacks/hangar', { activePacks, user: req.user });
  }

  static async renderExecution(req: Request, res: Response) {
    const packId = WorkpackController.getParam(req.params.id);
    const pack = await Workpack.findByPk(packId, {
      include: [WorkpackStatus, WorkpackController.workpackAircraftInclude, { model: TaskCard, include: [{ model: ServiceBulletin, as: 'ServiceBulletin' }, { model: User, as: 'Assignee' }, { model: User, as: 'MechanicCompleter' }, { model: User, as: 'EngineerCertifier' }] }]
    });
    if (!pack) return res.status(404).send('Workpack not found');
    const tasks = await WorkpackController.attachLatestExecutions(packId, (pack as any).TaskCards || []);
    const snags = await TaskExecutionService.getExecutionSnags(packId);
    const openSnags = await TaskExecutionService.getOpenExecutionSnags(packId);
    const aircraftId = String((pack as any).aircraft_id || (pack as any).Aircraft?.id || '').trim();
    const snagPatterns = aircraftId
      ? await SnagService.getSnagPatternSummaryForAircraft(aircraftId)
      : [];
    res.render('workpacks/execution', { pack, tasks, snags, openSnags, snagPatterns, user: req.user });
  }

  static async renderQA(req: Request, res: Response) {
    const status = await WorkpackStatus.findOne({ where: { code: 'IN_PROGRESS' } });
    const packs = await Workpack.findAll({ where: { status_id: status?.id }, include: [WorkpackStatus, WorkpackController.workpackAircraftInclude, TaskCard] });
    const reviewPacks = packs.map(p => {
      const ts = (p as any).TaskCards || [];
      const total = ts.length;
      const locked = ts.filter((t: any) => t.status === 'LOCKED').length;
      return { ...p.toJSON(), total_tasks: total, locked_tasks: locked, percent_complete: total ? Math.round((locked / total) * 100) : 0 };
    });
    res.render('workpacks/qa', { reviewPacks, user: req.user });
  }

  static async renderPackTasks(req: Request, res: Response) {
    const packId = WorkpackController.getParam(req.params.id);
    const pack = await Workpack.findByPk(packId, {
      include: [
        WorkpackStatus,
        WorkpackController.workpackAircraftInclude,
        {
          model: TaskCard,
          include: [
            { model: User, as: 'Assignee' },
            { model: User, as: 'MechanicCompleter' },
            { model: User, as: 'EngineerCertifier' },
          ],
        },
        {
          model: WorkpackSnag,
          as: 'Snags',
          attributes: ['id', 'status'],
          required: false,
        },
      ],
    });
    if (!pack) return res.status(404).send('Workpack not found');
    const tasks = (await WorkpackController.attachLatestExecutions(packId, (pack as any).TaskCards || []))
      .filter((t: any) => !t.service_bulletin_id);
    res.render('workpacks/tasks', { pack, tasks, user: req.user });
  }

  static async renderPackServiceBulletins(req: Request, res: Response) {
    const packId = WorkpackController.getParam(req.params.id);
    const pack = await Workpack.findByPk(packId, { include: [WorkpackStatus, WorkpackController.workpackAircraftInclude, { model: TaskCard, include: [{ model: ServiceBulletin, as: 'ServiceBulletin' }, { model: User, as: 'Assignee' }] }] });
    if (!pack) return res.status(404).send('Workpack not found');
    const serviceBulletinTasks = (await WorkpackController.attachLatestExecutions(packId, (pack as any).TaskCards || []))
      .filter((t: any) => !!t.service_bulletin_id);
    res.render('workpacks/service-bulletins', { pack, serviceBulletinTasks, user: req.user });
  }

  static async renderPackSnags(req: Request, res: Response) {
    try {
      let pack;
      const packId = WorkpackController.getParam(req.params.id);

      try {
        pack = await WorkpackController.findPackForSnags(packId, true);
      } catch (e: any) {
        const sql = String(e?.sql || e?.parent?.sql || '');
        const isMissingSnagAuditTable =
          e?.parent?.code === '42P01' &&
          sql.includes('workpack_snag_audit_log');

        if (!isMissingSnagAuditTable) {
          throw e;
        }

        console.warn('[WorkpackController] renderPackSnags missing workpack_snag_audit_log, retrying without audit history');
        pack = await WorkpackController.findPackForSnags(packId, false);
      }

      if (!pack) return res.status(404).send('Workpack not found');
      res.render('workpacks/snags', { pack, snags: (pack as any).Snags || [], user: req.user });
    } catch (e: any) {
      console.error('[WorkpackController] renderPackSnags Database Error:', e.original || e);
      res.status(500).send(WorkpackController.getFriendlyErrorMessage(e));
    }
  }

  // ACTIONS
  static async handleCreate(req: Request, res: Response) {
    try {
      await WorkpackService.create(req.body, (req as any).user?.id);
      return WorkpackController.actionResponse(req, res);
    } catch (e: any) {
      const msg = WorkpackController.getFriendlyErrorMessage(e);
      if (req.headers['hx-request']) return res.status(400).send(msg);
      req.flash('error', msg);
      res.redirect('/workpacks/planner');
    }
  }

  static async handleAddTask(req: Request, res: Response) {
    try {
      await WorkpackService.addTask(req.body.workpack_id, WorkpackController.getParam(req.params.taskId), (req as any).user?.id);
      return WorkpackController.actionResponse(req, res);
    } catch (e: any) { res.status(400).send(e.message); }
  }

  static async handleRemoveTask(req: Request, res: Response) {
    try {
      await WorkpackService.removeTask(WorkpackController.getParam(req.params.id), WorkpackController.getParam(req.params.taskId), (req as any).user?.id);
      return WorkpackController.actionResponse(req, res);
    } catch (e: any) { res.status(400).send(e.message); }
  }

  static async handleIssue(req: Request, res: Response) {
    try {
      await WorkpackService.issue(WorkpackController.getParam(req.params.id), (req as any).user?.id);
      res.redirect('/workpacks/hangar');
    } catch (e: any) { res.status(400).send(e.message); }
  }

  static async handleStart(req: Request, res: Response) {
    try {
      await WorkpackService.startWork(WorkpackController.getParam(req.params.id), (req as any).user?.id);
      res.redirect('/workpacks/hangar');
    } catch (e: any) { res.status(400).send(e.message); }
  }

  static async handleClose(req: Request, res: Response) {
    try {
      const packId = WorkpackController.getParam(req.params.id);
      await WorkpackService.close(packId, (req as any).user?.id);
      await WorkpackController.sendPdf(res, packId, 'CRS', (workpackId) =>
        ServicePdfService.generateCRS(workpackId)
      );
    } catch (e: any) { res.status(400).send(e.message); }
  }

  static async handleServicePdf(req: Request, res: Response) {
    try {
      await WorkpackController.sendPdf(res, WorkpackController.getParam(req.params.id), 'SERVICE', (workpackId) =>
        ServicePdfService.generateCRS(workpackId)
      );
    } catch (e: any) { res.status(400).send(e.message); }
  }

  static async handleReleasePdf(req: Request, res: Response) {
    try {
      const packId = WorkpackController.getParam(req.params.id);
      const pack = await Workpack.findByPk(packId, {
        include: [{ model: WorkpackStatus, attributes: ['id', 'code', 'label'] }]
      });

      if (!pack) {
        return res.status(404).send('Workpack not found');
      }

      if ((pack as any).WorkpackStatus?.code !== 'CERTIFIED') {
        throw new Error('WORKPACK_RELEASE_PDF_BLOCKED');
      }

      await WorkpackController.sendPdf(res, packId, 'RELEASE', (workpackId) =>
        ReleasePdfService.generateCRS(workpackId)
      );
    } catch (e: any) { res.status(400).send(WorkpackController.getFriendlyErrorMessage(e)); }
  }

  static async handleCrmaPdf(req: Request, res: Response) {
    try {
      await WorkpackController.sendPdf(res, WorkpackController.getParam(req.params.id), 'CRMA', (workpackId) =>
        CrmaPdfService.generateCRS(workpackId)
      );
    } catch (e: any) { res.status(400).send(e.message); }
  }

  static async handleTaskSign(req: Request, res: Response) {
    try {
      const t = await WorkpackService.signTask(WorkpackController.getParam(req.params.taskId), (req as any).user?.id);
      return WorkpackController.actionResponse(req, res, t);
    } catch (e: any) { res.status(400).send(e.message); }
  }

  static async handleAddTemplateTask(req: Request, res: Response) {
    try {
      await WorkpackService.addTaskFromTemplate(req.body.workpack_id, WorkpackController.getParam(req.params.templateId), (req as any).user?.id);
      return WorkpackController.actionResponse(req, res);
    } catch (e: any) {
      res.status(400).send(WorkpackController.getFriendlyErrorMessage(e));
    }
  }

  static async handleAddServiceBulletins(req: Request, res: Response) {
    try {
      const ids = Array.isArray(req.body.service_bulletin_ids) ? req.body.service_bulletin_ids : [req.body.service_bulletin_ids].filter(Boolean);
      await WorkpackService.addServiceBulletins(WorkpackController.getParam(req.params.id), ids, (req as any).user?.id);
      return WorkpackController.actionResponse(req, res);
    } catch (e: any) {
      const msg = e?.message === 'NO_SERVICE_BULLETINS_SELECTED' ? 'Select at least one SB.' : WorkpackController.getFriendlyErrorMessage(e);
      if (req.headers['hx-request']) return res.status(400).send(msg);
      req.flash('error', msg); res.redirect('/workpacks/planner');
    }
  }

  static async handleDeleteDraft(req: Request, res: Response) {
    try {
      await WorkpackService.deleteDraft(WorkpackController.getParam(req.params.id), (req as any).user?.id);
      return WorkpackController.actionResponse(req, res);
    } catch (e: any) {
      const msg = WorkpackController.getFriendlyErrorMessage(e);
      if (req.headers['hx-request']) return res.status(400).send(msg);
      req.flash('error', msg); res.redirect('/workpacks/planner');
    }
  }

  static async handleCreateSnag(req: Request, res: Response) {
    try {
      const packId = WorkpackController.getParam(req.params.id);
      const user: any = (req as any).user;
      const pack = await Workpack.findByPk(packId, {
        attributes: ['id', 'aircraft_id'],
      });

      if (!pack) {
        return res.status(404).send('Workpack not found');
      }

      const description = String(req.body.description || '').trim();

      if (!description) {
        throw new Error('SNAG_DESCRIPTION_REQUIRED');
      }

      if (!(pack as any).aircraft_id) {
        throw new Error('SNAG_AIRCRAFT_REQUIRED');
      }

      if (!user?.id) {
        throw new Error('UNAUTHENTICATED');
      }

      await TaskExecutionService.createExecutionSnag({
        workpack_id: packId,
        aircraft_id: (pack as any).aircraft_id,
        description,
        user_id: user.id,
      });

      return res.redirect(`/workpacks/${packId}/snags`);
    } catch (e: any) {
      res.status(400).send(WorkpackController.getFriendlyErrorMessage(e));
    }
  }

  static async handleCreateExecutionSnag(req: Request, res: Response) {
    try {
      const packId = WorkpackController.getParam(req.params.id);
      const user: any = (req as any).user;
      const workpackId = String(req.body.workpack_id || '').trim();
      const aircraftId = String(req.body.aircraft_id || '').trim();
      const description = String(req.body.description || '').trim();
      const userId = String(req.body.user_id || '').trim();

      if (!workpackId || workpackId !== packId) {
        throw new Error('SNAG_WORKPACK_REQUIRED');
      }

      if (!aircraftId) {
        throw new Error('SNAG_AIRCRAFT_REQUIRED');
      }

      if (!description) {
        throw new Error('SNAG_DESCRIPTION_REQUIRED');
      }

      if (!user?.id || !userId || userId !== user.id) {
        throw new Error('UNAUTHENTICATED');
      }

      await TaskExecutionService.createExecutionSnag({
        workpack_id: workpackId,
        aircraft_id: aircraftId,
        description,
        user_id: user.id,
      });

      return res.redirect(`/workpacks/${packId}/execution`);
    } catch (e: any) {
      res.status(400).send(WorkpackController.getFriendlyErrorMessage(e));
    }
  }

  static async handleStartSnag(req: Request, res: Response) {
    try {
      const packId = WorkpackController.getParam(req.params.id);
      await WorkpackService.startSnag(WorkpackController.getParam(req.params.snagId), (req as any).user?.id);
      return res.redirect(`/workpacks/${packId}/snags`);
    } catch (e: any) {
      res.status(400).send(WorkpackController.getFriendlyErrorMessage(e));
    }
  }

  static async handleCompleteSnag(req: Request, res: Response) {
    try {
      const packId = WorkpackController.getParam(req.params.id);
      const user: any = (req as any).user;
      const roleCodes = (user?.roles || []).map((role: any) => role.code).filter(Boolean);
      await WorkpackService.resolveSnag(
        WorkpackController.getParam(req.params.snagId),
        {
          resolution_notes: req.body.resolution_notes ?? '',
          parts_used: req.body.parts_used ?? '',
          time_spent_minutes: req.body.time_spent_minutes ?? '',
        },
        user?.id,
        roleCodes
      );
      return res.redirect(`/workpacks/${packId}/snags`);
    } catch (e: any) {
      res.status(400).send(WorkpackController.getFriendlyErrorMessage(e));
    }
  }

  static async handleCloseSnag(req: Request, res: Response) {
    try {
      const packId = WorkpackController.getParam(req.params.id);
      const user: any = (req as any).user;
      const roleCodes = (user?.roles || []).map((role: any) => role.code).filter(Boolean);
      await WorkpackService.closeSnag(WorkpackController.getParam(req.params.snagId), user?.id, roleCodes);
      return res.redirect(`/workpacks/${packId}/snags`);
    } catch (e: any) {
      res.status(400).send(WorkpackController.getFriendlyErrorMessage(e));
    }
  }

  static async handleTaskStart(req: Request, res: Response) {
    try {
      const user: any = (req as any).user;
      const roleCodes = (user?.roles || []).map((role: any) => role.code).filter(Boolean);
      const t = await WorkpackService.startTask(WorkpackController.getParam(req.params.taskId), user?.id, roleCodes);
      return WorkpackController.actionResponse(req, res, t);
    } catch (e: any) { res.status(400).send(WorkpackController.getFriendlyErrorMessage(e)); }
  }

  static async handleTaskComplete(req: Request, res: Response) {
    try {
      const user: any = (req as any).user;
      const roleCodes = (user?.roles || []).map((role: any) => role.code).filter(Boolean);
      const t = await WorkpackService.completeTask(
        WorkpackController.getParam(req.params.taskId),
        user?.id,
        roleCodes,
        req.body.work_performed ?? '',
        req.body.measurements_payload
      );
      return WorkpackController.actionResponse(req, res, t);
    } catch (e: any) { res.status(400).send(WorkpackController.getFriendlyErrorMessage(e)); }
  }

  static async handleTaskWorkNote(req: Request, res: Response) {
    try {
      const user: any = (req as any).user;
      const roleCodes = (user?.roles || []).map((role: any) => role.code).filter(Boolean);
      const t = await WorkpackService.saveWorkPerformed(
        WorkpackController.getParam(req.params.taskId),
        req.body.work_performed ?? '',
        user?.id,
        roleCodes,
        req.body.measurements_payload
      );
      return WorkpackController.actionResponse(req, res, t);
    } catch (e: any) { res.status(400).send(WorkpackController.getFriendlyErrorMessage(e)); }
  }

  static async handleTaskLock(req: Request, res: Response) {
    try {
      const t = await WorkpackService.lockTask(WorkpackController.getParam(req.params.taskId), (req as any).user?.id);
      return WorkpackController.actionResponse(req, res, t);
    } catch (e: any) { res.status(400).send(e.message); }
  }

  static async handleImportTemplates(req: Request, res: Response) {
    try {
      if (!req.file) throw new Error('No CSV file uploaded.');
      const count = await TaskImportService.importStandardMpiTasks(req.file.buffer);
      const msg = `Successfully imported ${count} task templates.`;
      if (req.headers['hx-request']) return res.set('HX-Refresh', 'true').status(200).send(msg);
      req.flash('success', msg);
      res.redirect('/workpacks/planner');
    } catch (e: any) {
      const errorMsg = WorkpackController.getFriendlyErrorMessage(e);
      if (req.headers['hx-request']) return res.status(400).send(`Import failed: ${errorMsg}`);
      req.flash('error', `Import failed: ${errorMsg}`);
      res.redirect('/workpacks/planner');
    }
  }
}
