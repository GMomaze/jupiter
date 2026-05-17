import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { WorkpackService } from './workpack.service.js';
import { PdfService as ServicePdfService } from './pdf.service.js';
import { AircraftService } from '../aircraft/aircraft.service.js';
import { TaskImportService } from './services/TaskImportService.js';
import { CrsDataService } from './services/crs-data.service.js';
import { SnagService } from './services/snag.service.js';
import { TaskExecutionService } from './services/task-execution.service.js';
import { WorkpackPlanningService } from './services/workpack-planning.service.js';
import { WorkpackGenerationService } from './services/workpack-generation.service.js';
import { WorkpackPreviewService } from './services/workpack-preview.service.js';
import { PlanningSessionService } from './services/planning-session.service.js';
import { PlanningValidationError } from './services/planning-validation.service.js';
import { WorkpackComponentIntegrationService } from './services/workpack-component-integration.service.js';
import { WorkpackOperationalMaturityService } from './services/workpack-operational-maturity.service.js';
import {
  DocumentVerificationError,
  DocumentVerificationService,
} from './services/document-verification.service.js';
import { CrsDocumentService } from './services/crs-document.service.js';
import { CrmaDocumentService } from './services/crma-document.service.js';
import {
  AuditLog,
  Workpack,
  WorkpackStatus,
  Aircraft,
  AircraftComponent,
  ComponentModel,
  TaskCard,
  TaskTemplate,
  MaintenanceTemplate,
  User,
  ServiceBulletin,
  WorkpackExecution,
  WorkpackMeasurement,
  WorkpackAuditLog,
  WorkpackSnag,
  WorkpackSnagAuditLog,
  sequelize
} from '../../models/index.js';

export class WorkpackController {
  private static getParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] || '' : value || '';
  }

  private static normalizeMaintenanceType(value: string | string[] | undefined) {
    return String(this.getParam(value) || '').trim().toUpperCase();
  }

  private static getSelectedTemplateItemIds(value: unknown) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean);
    }

    const singleValue = String(value || '').trim();
    return singleValue ? [singleValue] : [];
  }

  private static getTaskIdsFromQuery(value: string | string[] | undefined) {
    const values = Array.isArray(value) ? value : [value];
    return Array.from(
      new Set(
        values
          .flatMap((entry) => String(entry || '').split(','))
          .map((entry) => entry.trim())
          .filter(Boolean)
      )
    );
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

  private static readonly crsValidationHtmlMap: Record<string, string> = {
    WORKPACK_NOT_FOUND: 'Workpack was not found.',
    WORKPACK_STATUS_NOT_CERTIFIED: 'Workpack is not CERTIFIED.',
    WORKPACK_CERTIFIED_BY_MISSING: 'Certification record is missing certified_by.',
    WORKPACK_CERTIFIED_AT_MISSING: 'Certification record is missing certified_at.',
    WORKPACK_AIRCRAFT_REGISTRATION_MISSING: 'Aircraft registration is missing.',
    WORKPACK_AIRCRAFT_MODEL_MISSING: 'Aircraft type/model is missing.',
    WORKPACK_HAS_UNCERTIFIED_TASKS: 'All tasks must be CERTIFIED_BY_ENGINEER or LOCKED before CRS generation.',
    WORKPACK_HAS_INCOMPLETE_COMPLIANCE: 'Compliance must be COMPLETE before CRS generation.',
    WORKPACK_HAS_OPEN_SNAGS: 'All snags must be CLOSED before CRS generation.',
  };

  private static async validateCrsRequest(packId: string) {
    const validation = await CrsDataService.validateCrsGeneration(packId);

    if (validation.valid) {
      return null;
    }

    const validationIssues = (validation.issues || [])
      .map((issue: any) =>
        issue?.message ||
        WorkpackController.crsValidationHtmlMap[issue?.code] ||
        String(issue?.code || '').trim()
      )
      .filter(Boolean) as string[];

    const issues =
      validationIssues.length > 0
        ? validationIssues
        : (validation.errors || []).map(
            (code: string) => WorkpackController.crsValidationHtmlMap[code] || code
          );

    return {
      html: WorkpackController.renderCrsValidationBlock('CRS cannot be generated', issues),
      issues,
    };
  }

  private static renderDocumentVerificationBlock(title: string, issues: string[]) {
    return WorkpackController.renderCrsValidationBlock(title, issues);
  }

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

  private static escapeHtml(value: string | null | undefined) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private static renderCrsValidationBlock(title: string, issues: string[]) {
    const items = issues
      .map((issue) => `<li class="leading-relaxed">${WorkpackController.escapeHtml(issue)}</li>`)
      .join('');

    return `
      <div class="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-900 shadow-sm">
        <p class="text-sm font-black uppercase tracking-widest text-red-700">${WorkpackController.escapeHtml(title)}</p>
        <ul class="mt-3 list-disc space-y-1 pl-5 text-sm">
          ${items}
        </ul>
      </div>
    `;
  }

  private static async getCloseValidationIssues(packId: string) {
    return WorkpackService.getCloseBlockingErrors(packId);
  }

  private static async getCertificationValidationIssues(packId: string, roleCodes: string[]) {
    return WorkpackService.getCertificationBlockingErrors(packId, roleCodes);
  }

  private static normalizeAuditEntry(
    entry: Record<string, any>
  ) {
    return {
      ...entry,
      entity_label: String(entry.entity_label || '').trim() || 'Record',
      action: String(entry.action || '').trim() || 'UNKNOWN',
      actor_name: String(entry.actor_name || '').trim() || 'System',
      actor_id: entry.actor_id || null,
      created_at: entry.created_at || null,
      sort_time: entry.created_at ? new Date(entry.created_at).getTime() : 0,
    };
  }

  private static getAuditEventLabel(entry: Record<string, any>) {
    const action = String(entry.action || '').trim().toUpperCase();
    const entityType = String(entry.entity_type || '').trim().toLowerCase();
    const newValue = entry.new_value || {};

    if (action === 'CREATE' && entityType === 'workpack') return 'Workpack Created';
    if (action === 'DELETE_DRAFT' && entityType === 'workpack') return 'Draft Workpack Deleted';
    if (action === 'STATUS_CHANGE' && entityType === 'workpack') {
      const status = String(newValue?.status || '').trim().toUpperCase();
      if (status === 'ISSUED') return 'Workpack Issued';
      if (status === 'IN_PROGRESS') return 'Workpack Started';
      if (status === 'CERTIFIED') return 'Workpack Certified';
      if (status === 'CLOSED') return 'Workpack Closed';
      return 'Workpack Status Changed';
    }

    if (action === 'TASK_ADDED') return 'Task Added to Workpack';
    if (action === 'TASK_REMOVED') return 'Task Removed from Workpack';
    if (action === 'CREATE_FROM_TEMPLATE') return 'Workpack Created from Template';
    if (action === 'TASK_TEMPLATE_ADDED') return 'Template Task Added';
    if (action === 'CREATE_FROM_SERVICE_BULLETIN') return 'Service Bulletin Task Created';
    if (action === 'SERVICE_BULLETINS_ADDED') return 'Service Bulletins Added';

    if (action === 'TASK_STARTED') return 'Task Started';
    if (action === 'TASK_COMPLETED_BY_MECHANIC') return 'Task Completed';
    if (action === 'TASK_CERTIFIED_BY_ENGINEER') return 'Task Certified';
    if (action === 'TASK_LOCKED') return 'Task Locked';
    if (action === 'TASK_WORK_NOTE_UPDATED') return 'Task Work Note Updated';
    if (action === 'SIGNATURE_RECORDED') return 'Task Signature Recorded';

    if (action === 'SNAG_CREATED') return 'Snag Created';
    if (action === 'SNAG_STARTED') return 'Snag Started';
    if (action === 'SNAG_RESOLVED') return 'Snag Resolved';
    if (action === 'SNAG_CLOSED') return 'Snag Closed';

    return action
      .toLowerCase()
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Audit Event';
  }

  private static getAuditEntityType(entry: Record<string, any>) {
    const entityType = String(entry.entity_type || '').trim().toLowerCase();
    if (entityType === 'task_execution') {
      return 'task';
    }
    if (['workpack', 'task', 'snag'].includes(entityType)) {
      return entityType;
    }
    return 'workpack';
  }

  private static getAuditDescription(entry: Record<string, any>) {
    const entityType = this.getAuditEntityType(entry);
    const newValue = entry.new_value || {};
    const oldValue = entry.old_value || {};
    const metadata = entry.metadata || {};

    if (entityType === 'workpack' && entry.action === 'STATUS_CHANGE') {
      const fromStatus = String(oldValue?.status || '').trim();
      const toStatus = String(newValue?.status || '').trim();
      if (fromStatus && toStatus) {
        return `${fromStatus} -> ${toStatus}`;
      }
    }

    if (entry.action === 'TASK_WORK_NOTE_UPDATED') {
      return 'Mechanic notes or captured values were updated.';
    }

    if (metadata?.field) {
      return `Field updated: ${metadata.field}`;
    }

    return '';
  }

  private static async getPackForAudit(packId: string) {
    return Workpack.findByPk(packId, {
      attributes: ['id', 'work_order_number', 'aircraft_id', 'status_id', 'created_at', 'updated_at'],
      include: [
        {
          model: WorkpackStatus,
          attributes: ['id', 'code', 'label'],
        },
        WorkpackController.workpackAircraftInclude,
        {
          model: TaskCard,
          attributes: ['id', 'task_card_number', 'title', 'status', 'created_at'],
          through: { attributes: [] },
          required: false,
        },
        {
          model: WorkpackSnag,
          as: 'Snags',
          attributes: ['id', 'snag_no', 'description', 'status', 'created_at'],
          required: false,
        },
      ],
    });
  }

  private static async getWorkpackAuditTimeline(packId: string) {
    const pack = await this.getPackForAudit(packId);
    if (!pack) {
      return { pack: null, entries: [] };
    }

    const tasks = ((pack as any).TaskCards || []) as any[];
    const snags = ((pack as any).Snags || []) as any[];
    const taskIds = tasks.map((task) => task.id);
    const snagIds = snags.map((snag) => snag.id);
    const genericAuditWhere: any[] = [
      { table_name: 'workpacks', row_id: packId },
    ];

    if (taskIds.length > 0) {
      genericAuditWhere.push({
        table_name: 'task_cards',
        row_id: {
          [Op.in]: taskIds,
        },
      });
    }

    if (snagIds.length > 0) {
      genericAuditWhere.push({
        table_name: 'workpack_snags',
        row_id: {
          [Op.in]: snagIds,
        },
      });
    }

    const [genericAudit, executionAudit, snagAudit] = await Promise.all([
      AuditLog.findAll({
        where: { [Op.or]: genericAuditWhere },
        include: [
          {
            model: User,
            as: 'actor',
            attributes: this.basicUserAttributes,
            required: false,
          },
        ],
        order: [['created_at', 'ASC']],
      }),
      WorkpackAuditLog.findAll({
        where: { workpack_id: packId },
        include: [
          {
            model: User,
            as: 'Actor',
            attributes: this.basicUserAttributes,
            required: false,
          },
          {
            model: TaskCard,
            as: 'Task',
            attributes: ['id', 'task_card_number', 'title'],
            required: false,
          },
        ],
        order: [['created_at', 'ASC'], ['sequence', 'ASC']],
      }),
      WorkpackSnagAuditLog.findAll({
        where: { workpack_id: packId },
        include: [
          {
            model: User,
            as: 'Actor',
            attributes: this.basicUserAttributes,
            required: false,
          },
          {
            model: WorkpackSnag,
            as: 'Snag',
            attributes: ['id', 'snag_no', 'description'],
            required: false,
          },
        ],
        order: [['created_at', 'ASC'], ['sequence', 'ASC']],
      }),
    ]);

    const taskById = new Map(tasks.map((task) => [String(task.id), task]));
    const snagById = new Map(snags.map((snag) => [String(snag.id), snag]));

    const genericEntries = genericAudit.map((log: any) => {
      const tableName = String(log.table_name || '').trim();
      const rowId = String(log.row_id || '').trim();
      const task = taskById.get(rowId);
      const snag = snagById.get(rowId);
      const entityLabel =
        tableName === 'workpacks'
          ? `Workpack ${String((pack as any).work_order_number || '').trim() || packId}`
          : tableName === 'task_cards'
            ? `Task ${String(task?.task_card_number || '').trim() || rowId}`
            : tableName === 'workpack_snags'
              ? `Snag ${String(snag?.snag_no || '').trim() || rowId}`
              : tableName;

      return this.normalizeAuditEntry({
        source: 'audit_log',
        entity_type: tableName === 'task_cards' ? 'task' : tableName === 'workpack_snags' ? 'snag' : 'workpack',
        entity_id: rowId,
        entity_label: entityLabel,
        action: log.action,
        actor_name: log.actor?.full_name || log.actor?.email || 'System',
        actor_id: log.actor_id || null,
        created_at: log.created_at,
        old_value: log.old_values ?? null,
        new_value: log.new_values ?? null,
        metadata: log.reason ? { reason: log.reason } : null,
      });
    });

    const executionEntries = executionAudit.map((log: any) =>
      this.normalizeAuditEntry({
        source: 'workpack_audit_log',
        entity_type: 'task_execution',
        entity_id: String(log.execution_id || ''),
        entity_label: `Task ${String(log.Task?.task_card_number || '').trim() || String(log.task_id || '').trim()}`,
        action: log.action,
        actor_name: log.Actor?.full_name || log.Actor?.email || 'System',
        actor_id: log.user_id || null,
        created_at: log.created_at,
        old_value: log.old_value ?? null,
        new_value: log.new_value ?? null,
        metadata: {
          ...(log.metadata || {}),
          field: log.field || null,
          sequence: log.sequence,
        },
      })
    );

    const snagEntries = snagAudit.map((log: any) =>
      this.normalizeAuditEntry({
        source: 'workpack_snag_audit_log',
        entity_type: 'snag',
        entity_id: String(log.snag_id || ''),
        entity_label: `Snag ${String(log.Snag?.snag_no || '').trim() || String(log.snag_id || '').trim()}`,
        action: log.action,
        actor_name: log.Actor?.full_name || log.Actor?.email || 'System',
        actor_id: log.user_id || null,
        created_at: log.created_at,
        old_value: log.old_value ?? null,
        new_value: log.new_value ?? null,
        metadata: {
          ...(log.metadata || {}),
          field: log.field || null,
          sequence: log.sequence,
        },
      })
    );

    const entries = [...genericEntries, ...executionEntries, ...snagEntries]
      .map((entry) => ({
        ...entry,
        filter_entity_type: this.getAuditEntityType(entry),
        event_label: this.getAuditEventLabel(entry),
        event_description: this.getAuditDescription(entry),
      }))
      .sort((a, b) => a.sort_time - b.sort_time);

    return { pack, entries };
  }

  private static async renderExecutionPage(
    req: Request,
    res: Response,
    packId: string,
    options?: {
      status?: number;
      crsValidation?: {
        title: string;
        issues: string[];
      } | null;
    }
  ) {
    const pack = await Workpack.findByPk(packId, {
      include: [WorkpackStatus, WorkpackController.workpackAircraftInclude, {
        model: TaskCard,
        include: [
          { model: ServiceBulletin, as: 'ServiceBulletin' },
          { model: User, as: 'Assignee' },
          { model: User, as: 'MechanicCompleter' },
          { model: User, as: 'EngineerCertifier' },
          { model: AircraftComponent, as: 'Component', required: false },
        ],
      }]
    });
    if (!pack) return res.status(404).send('Workpack not found');
    const tasks = await WorkpackController.attachLatestExecutions(packId, (pack as any).TaskCards || []);
    const snags = await TaskExecutionService.getExecutionSnags(packId);
    const openSnags = await TaskExecutionService.getOpenExecutionSnags(packId);
    const aircraftId = String((pack as any).aircraft_id || (pack as any).Aircraft?.id || '').trim();
    const snagPatterns = aircraftId
      ? await SnagService.getSnagPatternSummaryForAircraft(aircraftId)
      : [];
    const componentExecutionContext = await WorkpackComponentIntegrationService.buildForWorkpack({
      aircraftId,
      tasks,
      snags,
    });
    const operationalMaturity = WorkpackOperationalMaturityService.build({
      tasks,
      snags,
      componentExecutionContext,
    });

    return res.status(options?.status || 200).render('workpacks/execution', {
      pack,
      tasks,
      snags,
      openSnags,
      snagPatterns,
      componentExecutionContext,
      operationalMaturity,
      crsValidation: options?.crsValidation || null,
      user: req.user
    });
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
      'WORKPACK_EDIT_LOCKED': 'This workpack can no longer be edited because execution has already started or the workpack is no longer in an editable state.',
      'WORKPACK_TEMPLATE_ADD_BLOCKED': 'Task templates can only be added while the workpack is in DRAFT or ISSUED status.',
      'TASK_TEMPLATE_NOT_COMPATIBLE_WITH_AIRCRAFT': 'This task template is not applicable to the selected aircraft.',
      'TASK_TEMPLATE_ALREADY_ADDED_TO_WORKPACK': 'This task template has already been added to the selected draft workpack.',
      'TASK_OWNED_BY_ANOTHER_MECHANIC': 'This task is assigned to another mechanic. You may view it, but only the assigned mechanic or an authorized override role may make changes.',
      'TASK_NOT_STARTED': 'Please start the task before entering notes or measurements.',
      'TASK_START_BLOCKED': 'This task cannot be started from its current status.',
      'TASK_COMPLETE_BLOCKED': 'Only a task that is in progress and assigned to you can be completed.',
      'TASK_NOTE_EDIT_BLOCKED': 'This task is no longer editable in its current status.',
      'SNAG_DESCRIPTION_REQUIRED': 'Enter the snag before saving it.',
      'SNAG_AIRCRAFT_INVALID': 'Aircraft reference is invalid.',
      'SNAG_CREATED_BY_INVALID': 'Created by must reference a valid user.',
      'SNAG_COMPONENT_INVALID': 'Component reference is invalid.',
      'SNAG_COMPONENT_AIRCRAFT_MISMATCH': 'Selected component does not belong to the selected aircraft.',
      'SNAG_WORKPACK_INVALID': 'Workpack reference is invalid.',
      'SNAG_WORKPACK_AIRCRAFT_MISMATCH': 'Selected workpack does not belong to the selected aircraft.',
      'SNAG_RESOLUTION_REQUIRED': 'Enter the snag resolution before resolving it.',
      'SNAG_START_ROLE_BLOCKED': 'Only a mechanic, engineer, or supervisor can start a snag.',
      'SNAG_START_BLOCKED': 'This snag has already been started.',
      'SNAG_RESOLVE_BLOCKED': 'Only an in-progress snag can be resolved.',
      'SNAG_RESOLVE_NOT_ASSIGNED': 'Only the assigned mechanic, engineer, or a supervisor override can resolve this snag.',
      'SNAG_CLOSE_BLOCKED': 'Only a resolved snag can be closed.',
      'SNAG_CLOSE_ROLE_BLOCKED': 'Only an engineer or supervisor can close a snag.',
      'SNAG_TIME_SPENT_INVALID': 'Time spent must be a valid number of minutes.',
      'SNAG_WORKPACK_REQUIRED': 'Workpack reference is required to create a snag.',
      'SNAG_AIRCRAFT_REQUIRED': 'Aircraft reference is required to create a snag.',
      'SNAGS_NOT_ALLOWED_IN_DRAFT': 'Snags can only be logged after the workpack has been issued.',
      'WORKPACK_CERTIFY_ROLE_BLOCKED': 'Only engineer users may certify the workpack.',
      'WORKPACK_CERTIFY_BLOCKED': 'The workpack cannot be certified until all certification requirements pass.',
      'WORKPACK_CLOSE_BLOCKED': 'The workpack cannot be closed until all close requirements pass.',
      'WORKPACK_CLOSE_BLOCKED_BY_OPEN_SNAGS': 'All snags must be closed before the workpack can be closed.',
      'TASK_LOCK_BLOCKED': 'Only engineer-certified tasks may be locked.',
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
      const planningAircraftId = WorkpackController.getParam(req.query.planning_aircraft_id as string | string[] | undefined);
      const planningMaintenanceType = WorkpackController.normalizeMaintenanceType(
        req.query.maintenance_type as string | string[] | undefined
      );
      const sessionAircraftId = WorkpackController.getParam(
        req.query.session_aircraft_id as string | string[] | undefined
      );
      const sessionStatus = String(
        WorkpackController.getParam(req.query.session_status as string | string[] | undefined) || ''
      )
        .trim()
        .toUpperCase();
      const editablePlanningStatuses = await WorkpackStatus.findAll({
        where: { code: ['DRAFT', 'ISSUED'] }
      });
      
      const workpacks = await Workpack.findAll({
        where: { status_id: editablePlanningStatuses.map((status) => status.id) },
        include: [WorkpackStatus, WorkpackController.workpackAircraftInclude, TaskCard],
        order: [['created_at', 'DESC']]
      });

      await Promise.all(
        workpacks.map(async (wp: any) => {
          const statusCode = String(wp.WorkpackStatus?.code || '').trim();
          const planningEditable = await WorkpackPlanningService.canEditWorkpack(
            wp.id,
            statusCode,
            sequelize
          );

          wp.setDataValue('planning_editable', planningEditable);
          wp.setDataValue(
            'planning_locked_reason',
            statusCode === 'ISSUED' && !planningEditable
              ? 'Execution has started. This issued workpack is locked for planning changes.'
              : null
          );
        })
      );

      const unassignedTasks = await TaskCard.findAll({
        where: sequelize.literal(`NOT EXISTS (SELECT 1 FROM workpack_tasks wt WHERE wt.task_id = "TaskCard"."id")`),
        order: [['created_at', 'ASC']]
      });
      const draftWorkpacks = workpacks.filter((wp: any) => wp.getDataValue('planning_editable'));
      const compatibleDraftAircraftIds = new Set(
        draftWorkpacks
          .map((wp: any) => String(wp.aircraft_id || '').trim())
          .filter(Boolean)
      );
      const filteredUnassignedTasks = unassignedTasks.filter((task: any) =>
        compatibleDraftAircraftIds.has(String(task.aircraft_id || '').trim())
      );
      const unassignedTasksByAircraftId = filteredUnassignedTasks.reduce((acc: Record<string, any[]>, task: any) => {
        const aircraftId = String(task.aircraft_id || '').trim();
        if (!aircraftId) {
          return acc;
        }

        if (!acc[aircraftId]) {
          acc[aircraftId] = [];
        }

        acc[aircraftId].push(task);
        return acc;
      }, {});

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
          'is_required_for_wood',
          'is_required_for_fabric',
          'is_required_for_bungees',
          'is_required_for_woodprop',
          'is_required_for_retractable',
        ],
        where: { is_active: true },
        order: [['sort_order', 'ASC']],
        raw: true,
      });
      const taskTemplates = taskTemplateRows;
      const maintenanceTemplates = await MaintenanceTemplate.findAll({
        attributes: [
          'id',
          'name',
          'description',
          'template_type',
          'model_id',
          'interval_hours',
          'interval_months',
          'is_active',
          'created_at',
        ],
        where: { is_active: true },
        order: [['created_at', 'DESC'], ['name', 'ASC']],
        raw: true,
      });
      const planningMaintenanceTypes = Array.from(
        new Set(
          ['MPI', '100HR', 'ANNUAL', ...maintenanceTemplates.map((template: any) =>
            String(template.template_type || '').trim().toUpperCase()
          )]
            .filter(Boolean)
        )
      ).sort();
      const planningAircraft = planningAircraftId
        ? await Aircraft.findByPk(planningAircraftId, {
            attributes: ['id', 'registration', 'model_id'],
            include: [
              {
                model: AircraftComponent,
                as: 'installed_components',
                attributes: ['id', 'model_id', 'serial_number', 'position_code', 'current_status'],
                required: false,
                include: [
                  {
                    model: ComponentModel,
                    attributes: ['id', 'model_name'],
                    required: false,
                  },
                ],
              },
            ],
          })
        : null;
      const planningCandidateTemplates =
        planningAircraft && planningMaintenanceType
          ? maintenanceTemplates.filter((template: any) => {
              const templateType = String(template.template_type || '').trim().toUpperCase();
              return (
                String(template.model_id || '').trim() === String((planningAircraft as any).model_id || '').trim() &&
                templateType === planningMaintenanceType
              );
            })
          : [];
      const planningSessions = (req as any).user?.id
        ? await PlanningSessionService.listSessionsForUser({
            userId: String((req as any).user.id),
            ...(sessionAircraftId ? { aircraftId: sessionAircraftId } : {}),
            ...(sessionStatus ? { status: sessionStatus } : {}),
          })
        : [];
      
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

      res.render('workpacks/planner', {
        workpacks,
        unassignedTasks: filteredUnassignedTasks,
        unassignedTasksByAircraftId,
        taskTemplates,
        maintenanceTemplates,
        planningAircraft,
        planningCandidateTemplates,
        planningSessions,
        planningSessionFilters: {
          aircraft_id: sessionAircraftId,
          status: sessionStatus,
        },
        planningMaintenanceTypes,
        planningSelection: {
          aircraft_id: planningAircraftId,
          maintenance_type: planningMaintenanceType,
        },
        aircraft,
        serviceBulletinsByWorkpackId,
        user: req.user
      });
    } catch (e: any) {
      // Log the full error to help identify missing columns
      console.error('[WorkpackController] renderPlanner Database Error:', e.original || e);
      res.status(500).send(WorkpackController.getFriendlyErrorMessage(e));
    }
  }

  static async renderTemplateAircraftPreview(req: Request, res: Response) {
    try {
      const templateId = WorkpackController.getParam(req.params.templateId);
      const aircraftId = WorkpackController.getParam(req.params.aircraftId);
      const maintenanceType = WorkpackController.normalizeMaintenanceType(
        req.query.maintenance_type as string | string[] | undefined
      );

      const preview = await WorkpackPreviewService.getWorkpackPreview({
        templateId,
        aircraftId,
      });

      res.render('workpacks/preview', {
        preview,
        templateId,
        aircraftId,
        maintenanceType,
        selectedItemIds: preview.items.map((item) => item.template_item_id),
        commitResult: null,
        user: req.user,
      });
    } catch (e: any) {
      console.error(
        '[WorkpackController] renderTemplateAircraftPreview Error:',
        e.original || e
      );
      res.status(500).send(WorkpackController.getFriendlyErrorMessage(e));
    }
  }

  static async renderPlanningSessionPreview(req: Request, res: Response) {
    try {
      const sessionId = WorkpackController.getParam(req.params.sessionId);
      const userId = String((req as any).user?.id || '').trim();
      const session = await PlanningSessionService.getSessionForUser(sessionId, userId);

      if (!session) {
        return res.status(404).send('Planning session not found');
      }

      const livePreview = await WorkpackPreviewService.getWorkpackPreview({
        templateId: String((session as any).template_id || '').trim(),
        aircraftId: String((session as any).aircraft_id || '').trim(),
      });

      const preview = PlanningSessionService.hydratePreviewFromSession(session, livePreview);
      const selectedItemIds = Array.isArray((session as any).selected_item_ids)
        ? (session as any).selected_item_ids
        : [];

      res.render('workpacks/preview', {
        preview,
        templateId: String((session as any).template_id || '').trim(),
        aircraftId: String((session as any).aircraft_id || '').trim(),
        maintenanceType: String((session as any).maintenance_type || '').trim(),
        selectedItemIds,
        planningSession: session,
        commitResult: null,
        user: req.user,
      });
    } catch (e: any) {
      console.error(
        '[WorkpackController] renderPlanningSessionPreview Error:',
        e.original || e
      );
      res.status(500).send(WorkpackController.getFriendlyErrorMessage(e));
    }
  }

  static async handleSavePlanningSession(req: Request, res: Response) {
    try {
      const sessionId = String(req.body.session_id || '').trim() || undefined;
      const templateId = WorkpackController.getParam(req.body.template_id);
      const aircraftId = WorkpackController.getParam(req.body.aircraft_id);
      const maintenanceType = WorkpackController.normalizeMaintenanceType(req.body.maintenance_type);
      const selectedItemIds = WorkpackController.getSelectedTemplateItemIds(req.body.selected_item_ids);
      const userId = String((req as any).user?.id || '').trim();

      const session = await PlanningSessionService.saveSession({
        ...(sessionId ? { sessionId } : {}),
        userId,
        templateId,
        aircraftId,
        maintenanceType,
        selectedItemIds,
      });

      return res.redirect(`/workpacks/planning-sessions/${session.id}`);
    } catch (e: any) {
      console.error(
        '[WorkpackController] handleSavePlanningSession Error:',
        e.original || e
      );
      res.status(500).send(WorkpackController.getFriendlyErrorMessage(e));
    }
  }

  static async handleDeletePlanningSession(req: Request, res: Response) {
    try {
      const sessionId = WorkpackController.getParam(req.params.sessionId);
      const userId = String((req as any).user?.id || '').trim();
      await PlanningSessionService.deleteSession({
        sessionId,
        userId,
      });
      return res.redirect('/workpacks/planner');
    } catch (e: any) {
      console.error(
        '[WorkpackController] handleDeletePlanningSession Error:',
        e.original || e
      );
      res.status(500).send(WorkpackController.getFriendlyErrorMessage(e));
    }
  }

  static async handleGenerateFromTemplatePreview(req: Request, res: Response) {
    try {
      const templateId = WorkpackController.getParam(req.params.templateId);
      const aircraftId = WorkpackController.getParam(req.params.aircraftId);
      const createdBy = String((req as any).user?.id || '').trim();
      const maintenanceType = WorkpackController.normalizeMaintenanceType(
        req.body.maintenance_type as string | string[] | undefined
      );
      const selectedItemIds = WorkpackController.getSelectedTemplateItemIds(
        req.body.selected_item_ids
      );
      const sessionId = String(req.body.session_id || '').trim();

      const preview = await WorkpackPreviewService.getWorkpackPreview({
        templateId,
        aircraftId,
      });

      if (!preview.can_generate) {
        return res.status(400).render('workpacks/preview', {
          preview,
          templateId,
          aircraftId,
          maintenanceType,
          selectedItemIds,
          planningSession: sessionId
            ? await PlanningSessionService.getSessionForUser(sessionId, createdBy)
            : null,
          commitResult: {
            workpack_id: null,
            tasks_created: 0,
            executions_created: 0,
            status: 'FAILED',
            errors: preview.blocking_errors,
          },
          user: req.user,
        });
      }

      const finalizeResult = sessionId
        ? await PlanningSessionService.finalizeSession({
            sessionId,
            userId: createdBy,
            createdBy,
          })
        : null;
      const commitResult = finalizeResult
        ? finalizeResult.generationResult
        : await WorkpackGenerationService.generateWorkpackFromTemplate({
            templateId,
            aircraftId,
            createdBy,
            selectedItemIds,
          });
      const planningSession = finalizeResult
        ? await PlanningSessionService.getSessionForUser(sessionId, createdBy)
        : null;

      return res.render('workpacks/preview', {
        preview,
        templateId,
        aircraftId,
        maintenanceType,
        selectedItemIds,
        planningSession,
        commitResult,
        user: req.user,
      });
    } catch (e: any) {
      if (e instanceof PlanningValidationError) {
        const templateId = WorkpackController.getParam(req.params.templateId);
        const aircraftId = WorkpackController.getParam(req.params.aircraftId);
        const createdBy = String((req as any).user?.id || '').trim();
        const maintenanceType = WorkpackController.normalizeMaintenanceType(
          req.body.maintenance_type as string | string[] | undefined
        );
        const selectedItemIds = WorkpackController.getSelectedTemplateItemIds(
          req.body.selected_item_ids
        );
        const sessionId = String(req.body.session_id || '').trim();
        const preview = await WorkpackPreviewService.getWorkpackPreview({
          templateId,
          aircraftId,
        });

        return res.status(400).render('workpacks/preview', {
          preview: {
            ...preview,
            can_generate: false,
            blocking_errors: e.errors,
          },
          templateId,
          aircraftId,
          maintenanceType,
          selectedItemIds,
          planningSession: sessionId
            ? await PlanningSessionService.getSessionForUser(sessionId, createdBy)
            : null,
          commitResult: {
            workpack_id: null,
            tasks_created: 0,
            executions_created: 0,
            status: 'FAILED',
            errors: e.errors,
          },
          user: req.user,
        });
      }

      console.error(
        '[WorkpackController] handleGenerateFromTemplatePreview Error:',
        e.original || e
      );
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
    return WorkpackController.renderExecutionPage(req, res, packId);
  }

  static async renderPackAudit(req: Request, res: Response) {
    try {
      const packId = WorkpackController.getParam(req.params.id);
      const { pack, entries } = await WorkpackController.getWorkpackAuditTimeline(packId);

      if (!pack) {
        return res.status(404).send('Workpack not found');
      }

      const selectedEntityType = String(req.query.entity_type || '').trim().toLowerCase();
      const selectedUserId = String(req.query.user_id || '').trim();
      const fromDate = String(req.query.from || '').trim();
      const toDate = String(req.query.to || '').trim();
      const showRaw = String(req.query.raw || '').trim() === '1';

      const filteredEntries = entries.filter((entry: any) => {
        if (selectedEntityType && entry.filter_entity_type !== selectedEntityType) {
          return false;
        }

        if (selectedUserId && String(entry.actor_id || '') !== selectedUserId) {
          return false;
        }

        if (fromDate && entry.created_at) {
          const entryTime = new Date(entry.created_at).getTime();
          const fromTime = new Date(`${fromDate}T00:00:00`).getTime();
          if (Number.isFinite(fromTime) && entryTime < fromTime) {
            return false;
          }
        }

        if (toDate && entry.created_at) {
          const entryTime = new Date(entry.created_at).getTime();
          const toTime = new Date(`${toDate}T23:59:59.999`).getTime();
          if (Number.isFinite(toTime) && entryTime > toTime) {
            return false;
          }
        }

        return true;
      });

      const availableUsers = entries
        .filter((entry: any) => entry.actor_id)
        .reduce((acc: Array<{ id: string; name: string }>, entry: any) => {
          if (!acc.some((user) => user.id === String(entry.actor_id))) {
            acc.push({
              id: String(entry.actor_id),
              name: String(entry.actor_name || 'System'),
            });
          }
          return acc;
        }, [])
        .sort((a, b) => a.name.localeCompare(b.name));

      return res.render('workpacks/audit', {
        pack,
        auditEntries: filteredEntries,
        availableUsers,
        filters: {
          entity_type: selectedEntityType,
          user_id: selectedUserId,
          from: fromDate,
          to: toDate,
          raw: showRaw,
        },
        user: req.user,
      });
    } catch (e: any) {
      console.error('[WorkpackController] renderPackAudit Error:', e.original || e);
      res.status(500).send(WorkpackController.getFriendlyErrorMessage(e));
    }
  }

  static async renderQA(req: Request, res: Response) {
    const status = await WorkpackStatus.findOne({ where: { code: 'CERTIFIED' } });
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
      ],
    });
    if (!pack) return res.status(404).send('Workpack not found');
    const snags = await WorkpackSnag.findAll({
      where: { workpack_id: packId },
      attributes: ['id', 'status'],
      order: [['snag_no', 'ASC']],
    });
    (pack as any).Snags = snags;
    const statusCode = String((pack as any).WorkpackStatus?.code || '').trim();
    const canShowAvailableTemplates = ['DRAFT', 'ISSUED'].includes(statusCode);
    const planningEditable = await WorkpackPlanningService.canEditWorkpack(
      packId,
      statusCode,
      sequelize
    );
    const availableTemplates = canShowAvailableTemplates
      ? await WorkpackPlanningService.getCompatibleTemplatesForWorkpack(
          pack as any,
          (pack as any).Aircraft || null,
          sequelize
        )
      : [];
    const linkedTasks = await TaskCard.findAll({
      include: [
        {
          model: Workpack,
          through: {
            attributes: [],
          },
          where: { id: packId },
          attributes: [],
          required: true,
        },
        { model: User, as: 'Assignee', required: false },
        { model: User, as: 'MechanicCompleter', required: false },
        { model: User, as: 'EngineerCertifier', required: false },
        { model: AircraftComponent, as: 'Component', required: false },
      ],
      order: [
        ['task_card_number', 'ASC'],
        ['created_at', 'ASC'],
      ],
    });
    const tasks = (await WorkpackController.attachLatestExecutions(packId, linkedTasks as any[]))
      .filter((t: any) => !t.service_bulletin_id);
    const aircraftId = String((pack as any).aircraft_id || (pack as any).Aircraft?.id || '').trim();
    const componentExecutionContext = await WorkpackComponentIntegrationService.buildForWorkpack({
      aircraftId,
      tasks,
    });
    res.render('workpacks/tasks', {
      pack,
      tasks,
      availableTemplates,
      canShowAvailableTemplates,
      planningEditable,
      componentExecutionContext,
      user: req.user
    });
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
    } catch (e: any) {
      const msg = WorkpackController.getFriendlyErrorMessage(e);
      if (req.headers['hx-request']) {
        return res.status(400).send(`<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">${msg}</div>`);
      }
      req.flash('error', msg);
      res.redirect('/workpacks/planner');
    }
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
    } catch (e: any) {
      const packId = WorkpackController.getParam(req.params.id);
      const issues =
        Array.isArray(e?.blockingErrors) && e.blockingErrors.length > 0
          ? e.blockingErrors
          : await WorkpackController.getCloseValidationIssues(packId);

      if (issues.length > 0) {
        if (req.headers['hx-request']) {
          return res.status(400).send(
            WorkpackController.renderCrsValidationBlock('Workpack cannot be closed', issues)
          );
        }

        return WorkpackController.renderExecutionPage(req, res, packId, {
          status: 400,
          crsValidation: {
            title: 'Workpack cannot be closed',
            issues,
          },
        });
      }

      res.status(400).send(WorkpackController.getFriendlyErrorMessage(e));
    }
  }

  static async handleCertify(req: Request, res: Response) {
    try {
      const packId = WorkpackController.getParam(req.params.id);
      const user: any = (req as any).user;
      const roleCodes = (user?.roles || []).map((role: any) => role.code).filter(Boolean);

      await WorkpackService.certify(packId, user?.id, roleCodes);

      return res.redirect(`/workpacks/${packId}/execution`);
    } catch (e: any) {
      const packId = WorkpackController.getParam(req.params.id);
      const user: any = (req as any).user;
      const roleCodes = (user?.roles || []).map((role: any) => role.code).filter(Boolean);
      const issues =
        Array.isArray(e?.blockingErrors) && e.blockingErrors.length > 0
          ? e.blockingErrors
          : await WorkpackController.getCertificationValidationIssues(packId, roleCodes);

      if (issues.length > 0) {
        if (req.headers['hx-request']) {
          return res.status(400).send(
            WorkpackController.renderCrsValidationBlock('Workpack cannot be certified', issues)
          );
        }

        return WorkpackController.renderExecutionPage(req, res, packId, {
          status: 400,
          crsValidation: {
            title: 'Workpack cannot be certified',
            issues,
          },
        });
      }

      res.status(400).send(WorkpackController.getFriendlyErrorMessage(e));
    }
  }

  static async handleServicePdf(req: Request, res: Response) {
    try {
      const packId = WorkpackController.getParam(req.params.id);
      const validation = await WorkpackController.validateCrsRequest(packId);
      if (validation) {
        return res.status(400).send(validation.html);
      }

      await WorkpackController.sendPdf(res, packId, 'SERVICE', (workpackId) =>
        ServicePdfService.generateCRS(workpackId)
      );
    } catch (e: any) { res.status(400).send(WorkpackController.getFriendlyErrorMessage(e)); }
  }

  static async handleReleasePdf(req: Request, res: Response) {
    try {
      const packId = WorkpackController.getParam(req.params.id);
      const verification = await DocumentVerificationService.verifyCrsDocument(packId);
      if (!verification.valid || !verification.data) {
        return res
          .status(400)
          .send(
            WorkpackController.renderDocumentVerificationBlock(
              'CRS cannot be generated',
              verification.issues
            )
          );
      }

      const pdf = await CrsDocumentService.generate(verification.data);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=CRS_${packId}.pdf`);
      res.send(pdf);
    } catch (e: any) {
      if (e instanceof DocumentVerificationError) {
        return res
          .status(400)
          .send(
            WorkpackController.renderDocumentVerificationBlock(
              'CRS cannot be generated',
              e.issues
            )
          );
      }

      res.status(400).send(WorkpackController.getFriendlyErrorMessage(e));
    }
  }

  static async handleCrmaPdf(req: Request, res: Response) {
    try {
      const packId = WorkpackController.getParam(req.params.id);
      const taskIds = WorkpackController.getTaskIdsFromQuery(
        (req.query.taskIds as string | string[] | undefined) ||
        (req.query.taskId as string | string[] | undefined)
      );
      const verification = await DocumentVerificationService.verifyCrmaDocument(packId, taskIds);
      if (!verification.valid || !verification.data) {
        return res
          .status(400)
          .send(
            WorkpackController.renderDocumentVerificationBlock(
              'CRMA cannot be generated',
              verification.issues
            )
          );
      }

      const pdf = await CrmaDocumentService.generate(verification.data);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=CRMA_${packId}.pdf`);
      res.send(pdf);
    } catch (e: any) {
      if (e instanceof DocumentVerificationError) {
        return res
          .status(400)
          .send(
            WorkpackController.renderDocumentVerificationBlock(
              'CRMA cannot be generated',
              e.issues
            )
          );
      }

      res.status(400).send(WorkpackController.getFriendlyErrorMessage(e));
    }
  }

  static async handleCrsPdf(req: Request, res: Response) {
    return WorkpackController.handleReleasePdf(req, res);
  }

  static async handleTaskSign(req: Request, res: Response) {
    try {
      const user: any = (req as any).user;
      const roleCodes = (user?.roles || []).map((role: any) => role.code).filter(Boolean);
      const t = await WorkpackService.signTask(
        WorkpackController.getParam(req.params.taskId),
        user?.id,
        roleCodes
      );
      return WorkpackController.actionResponse(req, res, t);
    } catch (e: any) { res.status(400).send(e.message); }
  }

  static async handleAddTemplateTask(req: Request, res: Response) {
    try {
      await WorkpackService.addTaskFromTemplate(req.body.workpack_id, WorkpackController.getParam(req.params.templateId), (req as any).user?.id);
      return WorkpackController.actionResponse(req, res);
    } catch (e: any) {
      const msg = WorkpackController.getFriendlyErrorMessage(e);
      if (req.headers['hx-request']) {
        return res.status(400).send(`<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">${msg}</div>`);
      }
      req.flash('error', msg);
      const workpackId = String(req.body.workpack_id || '').trim();
      res.redirect(workpackId ? `/workpacks/${workpackId}/tasks` : '/workpacks/planner');
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

      const defectText = String(req.body.defect_text || req.body.description || '').trim();
      const componentId = String(req.body.component_id || '').trim() || null;

      if (!defectText) {
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
        component_id: componentId,
        defect_text: defectText,
        created_by: user.id,
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
      const defectText = String(req.body.defect_text || req.body.description || '').trim();
      const componentId = String(req.body.component_id || '').trim() || null;
      const userId = String(req.body.created_by || req.body.user_id || '').trim();

      if (!workpackId || workpackId !== packId) {
        throw new Error('SNAG_WORKPACK_REQUIRED');
      }

      if (!aircraftId) {
        throw new Error('SNAG_AIRCRAFT_REQUIRED');
      }

      if (!defectText) {
        throw new Error('SNAG_DESCRIPTION_REQUIRED');
      }

      if (!user?.id || !userId || userId !== user.id) {
        throw new Error('UNAUTHENTICATED');
      }

      await TaskExecutionService.createExecutionSnag({
        workpack_id: workpackId,
        aircraft_id: aircraftId,
        component_id: componentId,
        defect_text: defectText,
        created_by: user.id,
      });

      return res.redirect(`/workpacks/${packId}/execution`);
    } catch (e: any) {
      res.status(400).send(WorkpackController.getFriendlyErrorMessage(e));
    }
  }

  static async handleCreateStandaloneSnag(req: Request, res: Response) {
    try {
      const user: any = (req as any).user;
      const aircraftId = String(req.body.aircraft_id || '').trim();
      const componentId = String(req.body.component_id || '').trim() || null;
      const defectText = String(req.body.defect_text || req.body.description || '').trim();
      const createdBy = String(req.body.created_by || user?.id || '').trim();

      if (!aircraftId) {
        throw new Error('SNAG_AIRCRAFT_REQUIRED');
      }

      if (!defectText) {
        throw new Error('SNAG_DESCRIPTION_REQUIRED');
      }

      if (!user?.id || createdBy !== user.id) {
        throw new Error('UNAUTHENTICATED');
      }

      await TaskExecutionService.createExecutionSnag({
        workpack_id: null,
        aircraft_id: aircraftId,
        component_id: componentId,
        defect_text: defectText,
        created_by: createdBy,
      });

      return WorkpackController.actionResponse(req, res);
    } catch (e: any) {
      res.status(400).send(WorkpackController.getFriendlyErrorMessage(e));
    }
  }

  static async handleStartSnag(req: Request, res: Response) {
    try {
      const packId = WorkpackController.getParam(req.params.id);
      const user: any = (req as any).user;
      const roleCodes = (user?.roles || []).map((role: any) => role.code).filter(Boolean);
      await WorkpackService.startSnag(
        WorkpackController.getParam(req.params.snagId),
        user?.id,
        roleCodes
      );
      return res.redirect(
        String(req.body.return_to || '').trim().toLowerCase() === 'execution'
          ? `/workpacks/${packId}/execution`
          : `/workpacks/${packId}/snags`
      );
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
      return res.redirect(
        String(req.body.return_to || '').trim().toLowerCase() === 'execution'
          ? `/workpacks/${packId}/execution`
          : `/workpacks/${packId}/snags`
      );
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
