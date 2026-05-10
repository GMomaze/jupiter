import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { QueryTypes, Transaction } from 'sequelize';
import {
  Aircraft,
  MaintenanceTemplate,
  MaintenanceTemplateItem,
  ServiceBulletinModel,
  SidModelApplicability,
  SupplementalInspectionDocument,
  TaskCard,
  Workpack,
  WorkpackExecution,
  WorkpackStatus,
  WorkpackTask,
  sequelize,
} from '../../../models/index.js';
import { ComplianceItem } from '../../../models/ComplianceItem.js';
import {
  PlanningValidationError,
  PlanningValidationService,
} from './planning-validation.service.js';
import { WorkpackPreviewService } from './workpack-preview.service.js';

type TemplateItemType = 'STANDARD_TASK' | 'COMPLIANCE_ITEM' | 'SID';
type WorkpackGenerationStatus = 'SUCCESS' | 'FAILED';

type StandardTaskSource = {
  id: string;
  task_card_number: string;
  title: string;
  description: string;
  scope: string;
  sort_order: number;
  aircraft_model_id: string | null;
  aircraft_id: string | null;
  is_active: boolean;
  source_type: string | null;
  interval_hours: number | null;
  interval_months: number | null;
  model_applicability: string | null;
  aircraft_applicability: string | null;
  created_at: Date;
  updated_at: Date;
};

type SourceMaps = {
  STANDARD_TASK: Map<string, StandardTaskSource>;
  COMPLIANCE_ITEM: Map<string, ComplianceItem>;
  SID: Map<string, SupplementalInspectionDocument>;
};

type ApplicabilityContext = {
  applicableServiceBulletinIds: Set<string>;
  applicableSidIds: Set<string>;
};

type SupportedSourceRecord =
  | StandardTaskSource
  | ComplianceItem
  | SupplementalInspectionDocument;

export interface WorkpackGenerationResult {
  workpack_id: string | null;
  aircraft_id: string;
  template_id: string;
  tasks_created: number;
  executions_created: number;
  status: WorkpackGenerationStatus;
  errors: string[];
}

export class WorkpackGenerationService {
  static async generateWorkpackFromTemplate(params: {
    templateId: string;
    aircraftId: string;
    createdBy: string;
    planningSessionId?: string;
    selectedItemIds?: string[];
  }): Promise<WorkpackGenerationResult> {
    const result: WorkpackGenerationResult = {
      workpack_id: null,
      aircraft_id: params.aircraftId,
      template_id: params.templateId,
      tasks_created: 0,
      executions_created: 0,
      status: 'FAILED',
      errors: [],
    };

    try {
      this.validateParams(params);
      await this.validatePhaseDependency();

      const template = await MaintenanceTemplate.findByPk(params.templateId);
      if (!template) {
        throw new Error('TEMPLATE_NOT_FOUND');
      }

      if (!template.is_active) {
        throw new Error('TEMPLATE_NOT_ACTIVE');
      }

      const aircraft = await Aircraft.findByPk(params.aircraftId, {
        attributes: ['id', 'model_id'],
      });
      if (!aircraft) {
        throw new Error('AIRCRAFT_NOT_FOUND');
      }

      if (!aircraft.model_id) {
        throw new Error('AIRCRAFT_MODEL_NOT_RESOLVED');
      }

      if (!template.model_id) {
        throw new Error('TEMPLATE_MODEL_NOT_SET');
      }

      if (template.model_id !== aircraft.model_id) {
        throw new Error('TEMPLATE_MODEL_MISMATCH');
      }

      const preview = await WorkpackPreviewService.getWorkpackPreview({
        templateId: template.id,
        aircraftId: aircraft.id,
      });

      const normalizedSelectedIds = Array.isArray(params.selectedItemIds)
        ? params.selectedItemIds.map((itemId) => String(itemId || '').trim()).filter(Boolean)
        : [];
      const defaultSelectedIds = preview.items.map((item) =>
        String(item.template_item_id || '').trim()
      ).filter(Boolean);
      const effectiveSelectedIds =
        normalizedSelectedIds.length > 0 ? normalizedSelectedIds : defaultSelectedIds;

      PlanningValidationService.assertValid({
        preview,
        rawSelectedItemIds: normalizedSelectedIds,
        selectedItemIds: effectiveSelectedIds,
      });

      const templateItems = await MaintenanceTemplateItem.findAll({
        where: { template_id: template.id },
        order: [['sequence_no', 'ASC']],
      });

      if (templateItems.length === 0) {
        throw new Error('TEMPLATE_HAS_NO_ITEMS');
      }

      this.validateTemplateItems(templateItems);
      const sourceMaps = await this.resolveSourceMaps(templateItems);
      const applicabilityContext = await this.resolveApplicabilityContext(
        sourceMaps,
        aircraft.model_id
      );
      const applicableTemplateItems = templateItems.filter((item) =>
        this.isTemplateItemApplicable(item, sourceMaps, applicabilityContext, aircraft)
      );

      if (applicableTemplateItems.length === 0) {
        throw new Error('TEMPLATE_HAS_NO_APPLICABLE_ITEMS');
      }

      const selectedItemIdSet = new Set(effectiveSelectedIds);
      const selectedTemplateItems =
        selectedItemIdSet.size > 0
          ? applicableTemplateItems.filter((item) => selectedItemIdSet.has(String(item.id || '').trim()))
          : applicableTemplateItems;

      if (selectedTemplateItems.length === 0) {
        throw new Error('TEMPLATE_SELECTION_EMPTY');
      }

      const transactionResult = await sequelize.transaction(
        async (transaction: Transaction) => {
          const draftStatus = await WorkpackStatus.findOne({
            where: { code: 'DRAFT' },
            transaction,
            lock: transaction.LOCK.UPDATE,
          });

          if (!draftStatus) {
            throw new Error('WORKPACK_STATUS_DRAFT_NOT_FOUND');
          }

          const existingDraft = await Workpack.findOne({
            where: {
              aircraft_id: aircraft.id,
              status_id: draftStatus.id,
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
          });

          if (existingDraft) {
            throw new Error('AIRCRAFT_ALREADY_HAS_DRAFT_WORKPACK');
          }

          const workpack = await Workpack.create(
            {
              aircraft_id: aircraft.id,
              status_id: draftStatus.id,
              // Traceability only. Runtime workpack behavior must stay independent from planning sessions.
              planning_session_id: params.planningSessionId || null,
              work_order_number: this.generateWorkOrderNumber(),
              version: 0,
            },
            { transaction }
          );

          let tasksCreated = 0;
          let executionsCreated = 0;

          for (const item of selectedTemplateItems) {
            const sourceRecord = this.getSourceRecord(sourceMaps, item);
            const taskCard = await this.createTaskCardFromTemplateItem(
              {
                aircraftId: aircraft.id,
                workpack,
                template,
                templateItem: item,
                sourceRecord,
              },
              transaction
            );

            await WorkpackTask.create(
              {
                workpack_id: workpack.id,
                task_id: taskCard.id,
              },
              { transaction }
            );

            await WorkpackExecution.create(
              {
                workpack_id: workpack.id,
                task_id: taskCard.id,
                status: 'OPEN',
                attempt_no: 1,
                version: 1,
              },
              { transaction }
            );

            tasksCreated += 1;
            executionsCreated += 1;
          }

          return {
            workpackId: workpack.id,
            tasksCreated,
            executionsCreated,
          };
        }
      );

      result.workpack_id = transactionResult.workpackId;
      result.tasks_created = transactionResult.tasksCreated;
      result.executions_created = transactionResult.executionsCreated;
      result.status = 'SUCCESS';
      return result;
    } catch (error) {
      result.errors =
        error instanceof PlanningValidationError
          ? error.errors
          : [this.getErrorMessage(error)];
      return result;
    }
  }

  private static validateParams(params: {
    templateId: string;
    aircraftId: string;
    createdBy: string;
    planningSessionId?: string;
    selectedItemIds?: string[];
  }) {
    if (!params.templateId?.trim()) {
      throw new Error('TEMPLATE_ID_REQUIRED');
    }

    if (!params.aircraftId?.trim()) {
      throw new Error('AIRCRAFT_ID_REQUIRED');
    }

    if (!params.createdBy?.trim()) {
      throw new Error('CREATED_BY_REQUIRED');
    }
  }

  private static async validatePhaseDependency() {
    const dependencyPath = path.resolve(
      process.cwd(),
      'docs/ChatGPT/ver3/phase-9.4F-adapt-workpack-generation-to-current-schema.md'
    );

    await access(dependencyPath);
    const dependencyContent = await readFile(dependencyPath, 'utf8');
    const requiredMarker =
      'workpacks -> task_cards -> workpack_tasks -> workpack_executions';

    if (!dependencyContent.includes(requiredMarker)) {
      throw new Error('PHASE_9_4F_DEPENDENCY_INVALID');
    }
  }

  private static validateTemplateItems(templateItems: MaintenanceTemplateItem[]) {
    const seenSequenceNumbers = new Set<number>();

    for (const item of templateItems) {
      if (!this.isSupportedItemType(item.item_type)) {
        throw new Error(`UNSUPPORTED_TEMPLATE_ITEM_TYPE:${item.item_type}`);
      }

      if (!item.item_id) {
        throw new Error(`TEMPLATE_ITEM_SOURCE_ID_MISSING:${item.id}`);
      }

      if (!Number.isInteger(item.sequence_no)) {
        throw new Error(`TEMPLATE_ITEM_SEQUENCE_INVALID:${item.id}`);
      }

      if (seenSequenceNumbers.has(item.sequence_no)) {
        throw new Error(`TEMPLATE_ITEM_SEQUENCE_DUPLICATE:${item.sequence_no}`);
      }

      seenSequenceNumbers.add(item.sequence_no);
    }
  }

  private static async resolveSourceMaps(
    templateItems: MaintenanceTemplateItem[]
  ): Promise<SourceMaps> {
    const standardTaskIds = templateItems
      .filter((item) => item.item_type === 'STANDARD_TASK')
      .map((item) => item.item_id);
    const complianceItemIds = templateItems
      .filter((item) => item.item_type === 'COMPLIANCE_ITEM')
      .map((item) => item.item_id);
    const sidIds = templateItems
      .filter((item) => item.item_type === 'SID')
      .map((item) => item.item_id);

    const [standardTasks, complianceItems, sidDocuments] = await Promise.all([
      standardTaskIds.length > 0
        ? this.loadStandardTaskSources(standardTaskIds)
        : Promise.resolve([]),
      complianceItemIds.length > 0
        ? ComplianceItem.findAll({ where: { id: complianceItemIds } })
        : Promise.resolve([]),
      sidIds.length > 0
        ? SupplementalInspectionDocument.findAll({ where: { id: sidIds } })
        : Promise.resolve([]),
    ]);

    const maps: SourceMaps = {
      STANDARD_TASK: new Map(standardTasks.map((item) => [item.id, item])),
      COMPLIANCE_ITEM: new Map(complianceItems.map((item) => [item.id, item])),
      SID: new Map(sidDocuments.map((item) => [item.id, item])),
    };

    for (const item of templateItems) {
      if (!maps[item.item_type].has(item.item_id)) {
        throw new Error(
          `TEMPLATE_ITEM_SOURCE_NOT_FOUND:${item.item_type}:${item.item_id}`
        );
      }
    }

    return maps;
  }

  private static async resolveApplicabilityContext(
    sourceMaps: SourceMaps,
    modelId: string
  ): Promise<ApplicabilityContext> {
    const complianceItemIds = Array.from(sourceMaps.COMPLIANCE_ITEM.keys());
    const sidIds = Array.from(sourceMaps.SID.keys());

    const serviceBulletinIds = complianceItemIds
      .map((itemId) => sourceMaps.COMPLIANCE_ITEM.get(itemId))
      .filter((item): item is ComplianceItem => Boolean(item))
      .filter((item) => item.source_type === 'SB' && item.source_id)
      .map((item) => item.source_id);

    const [applicableServiceBulletinRows, applicableSidRows] = await Promise.all([
      serviceBulletinIds.length > 0
        ? ServiceBulletinModel.findAll({
            attributes: ['service_bulletin_id'],
            where: { model_id: modelId, service_bulletin_id: serviceBulletinIds },
            raw: true,
          })
        : Promise.resolve([]),
      sidIds.length > 0
        ? SidModelApplicability.findAll({
            attributes: ['sid_id'],
            where: { model_id: modelId, sid_id: sidIds, is_active: true },
            raw: true,
          })
        : Promise.resolve([]),
    ]);

    return {
      applicableServiceBulletinIds: new Set(
        applicableServiceBulletinRows.map((row: any) => String(row.service_bulletin_id || '').trim()).filter(Boolean)
      ),
      applicableSidIds: new Set(
        applicableSidRows.map((row: any) => String(row.sid_id || '').trim()).filter(Boolean)
      ),
    };
  }

  private static isTemplateItemApplicable(
    item: MaintenanceTemplateItem,
    sourceMaps: SourceMaps,
    applicabilityContext: ApplicabilityContext,
    aircraft: Pick<Aircraft, 'id' | 'model_id'>
  ) {
    if (item.item_type === 'STANDARD_TASK') {
      const standardTask = sourceMaps.STANDARD_TASK.get(item.item_id);
      if (!standardTask || !standardTask.is_active) {
        return false;
      }

      const normalizedScope = String(standardTask.scope || '').trim().toUpperCase();
      if (normalizedScope === 'GLOBAL' || normalizedScope === 'MPI') {
        return true;
      }

      if (normalizedScope === 'MODEL') {
        return String(standardTask.aircraft_model_id || '').trim() === String(aircraft.model_id || '').trim();
      }

      if (normalizedScope === 'AIRCRAFT') {
        return String(standardTask.aircraft_id || '').trim() === String(aircraft.id || '').trim();
      }

      return false;
    }

    if (item.item_type === 'COMPLIANCE_ITEM') {
      const complianceItem = sourceMaps.COMPLIANCE_ITEM.get(item.item_id);
      if (!complianceItem) {
        return false;
      }

      if (String(complianceItem.status || '').trim().toUpperCase() !== 'ACTIVE') {
        return false;
      }

      if (complianceItem.source_type === 'SB') {
        return applicabilityContext.applicableServiceBulletinIds.has(
          String(complianceItem.source_id || '').trim()
        );
      }

      return true;
    }

    const sid = sourceMaps.SID.get(item.item_id);
    if (!sid || !sid.is_active) {
      return false;
    }

    return applicabilityContext.applicableSidIds.has(String(sid.id || '').trim());
  }

  private static async loadStandardTaskSources(taskTemplateIds: string[]) {
    const rows = await sequelize.query<StandardTaskSource>(
      `
      SELECT
        id,
        task_card_number,
        title,
        description,
        scope,
        sort_order,
        aircraft_model_id,
        aircraft_id,
        is_active,
        source_type,
        interval_hours,
        interval_months,
        model_applicability,
        aircraft_applicability,
        created_at,
        updated_at
      FROM task_templates
      WHERE id IN (:taskTemplateIds)
      `,
      {
        replacements: { taskTemplateIds },
        type: QueryTypes.SELECT,
      }
    );

    for (const row of rows) {
      if (!row.title?.trim()) {
        throw new Error(`STANDARD_TASK_SOURCE_TITLE_INVALID:${row.id}`);
      }

      if (!row.description?.trim()) {
        throw new Error(`STANDARD_TASK_SOURCE_DESCRIPTION_INVALID:${row.id}`);
      }
    }

    return rows;
  }

  private static getSourceRecord(
    sourceMaps: SourceMaps,
    item: MaintenanceTemplateItem
  ): SupportedSourceRecord {
    const sourceRecord = sourceMaps[item.item_type].get(item.item_id);
    if (!sourceRecord) {
      throw new Error(`TEMPLATE_ITEM_SOURCE_NOT_FOUND:${item.item_type}:${item.item_id}`);
    }

    return sourceRecord;
  }

  private static async createTaskCardFromTemplateItem(
    params: {
      aircraftId: string;
      workpack: Workpack;
      template: MaintenanceTemplate;
      templateItem: MaintenanceTemplateItem;
      sourceRecord: SupportedSourceRecord;
    },
    transaction: Transaction
  ) {
    const taskCardPayload = this.buildTaskCardPayload(params);

    return TaskCard.create(taskCardPayload, { transaction });
  }

  private static buildTaskCardPayload(params: {
    aircraftId: string;
    workpack: Workpack;
    template: MaintenanceTemplate;
    templateItem: MaintenanceTemplateItem;
    sourceRecord: SupportedSourceRecord;
  }) {
    const { aircraftId, workpack, template, templateItem, sourceRecord } = params;
    const baseDescription = this.buildBaseDescription(templateItem, sourceRecord);
    const sequenceLabel = String(templateItem.sequence_no).padStart(3, '0');
    const commonPayload: Record<string, unknown> = {
      task_card_number: `${workpack.work_order_number}-T${sequenceLabel}`,
      aircraft_id: aircraftId,
      status: 'OPEN',
      component_id: null,
      version: 0,
    };

    if (templateItem.item_type === 'STANDARD_TASK') {
      const standardTask = sourceRecord as StandardTaskSource;

      return {
        ...commonPayload,
        title: standardTask.title,
        description: baseDescription,
        template_source_id: standardTask.id,
        compliance_item_id: null,
        service_bulletin_id: null,
      };
    }

    if (templateItem.item_type === 'COMPLIANCE_ITEM') {
      const complianceItem = sourceRecord as ComplianceItem;

      return {
        ...commonPayload,
        title: `${complianceItem.code}: ${complianceItem.title}`,
        description: baseDescription,
        template_source_id: null,
        compliance_item_id: complianceItem.id,
        service_bulletin_id:
          complianceItem.source_type === 'SB' ? complianceItem.source_id : null,
      };
    }

    const sid = sourceRecord as SupplementalInspectionDocument;

    return {
      ...commonPayload,
      title: `SID ${sid.reference}: ${sid.title}`,
      description: baseDescription,
      template_source_id: null,
      compliance_item_id: null,
      service_bulletin_id: null,
    };
  }

  private static buildBaseDescription(
    templateItem: MaintenanceTemplateItem,
    sourceRecord: SupportedSourceRecord
  ) {
    const sourceDescription = this.getSourceDescription(sourceRecord);
    const sourceIdentity = this.getSourceIdentityLine(templateItem, sourceRecord);
    const lines = [
      sourceDescription,
      '',
      `Template sequence: ${templateItem.sequence_no}`,
      `Template required: ${templateItem.is_required ? 'YES' : 'NO'}`,
      sourceIdentity,
    ];

    if (templateItem.notes?.trim()) {
      lines.push(`Template notes: ${templateItem.notes.trim()}`);
    }

    return lines.filter((line) => line !== '').join('\n');
  }

  private static getSourceDescription(sourceRecord: SupportedSourceRecord) {
    if ('task_card_number' in sourceRecord) {
      return sourceRecord.description || sourceRecord.title;
    }

    if (sourceRecord instanceof ComplianceItem) {
      return sourceRecord.description || sourceRecord.title;
    }

    return sourceRecord.description || sourceRecord.notes || sourceRecord.title;
  }

  private static getSourceIdentityLine(
    item: MaintenanceTemplateItem,
    sourceRecord: SupportedSourceRecord
  ) {
    if (item.item_type === 'STANDARD_TASK') {
      const standardTask = sourceRecord as StandardTaskSource;
      return `Source standard task: ${standardTask.task_card_number}`;
    }

    if (item.item_type === 'COMPLIANCE_ITEM') {
      const complianceItem = sourceRecord as ComplianceItem;
      return `Source compliance item: ${complianceItem.code}`;
    }

    const sid = sourceRecord as SupplementalInspectionDocument;
    return `Source SID: ${sid.reference}`;
  }

  private static generateWorkOrderNumber() {
    return `WP-TPL-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private static isSupportedItemType(itemType: string): itemType is TemplateItemType {
    return (
      itemType === 'STANDARD_TASK' ||
      itemType === 'COMPLIANCE_ITEM' ||
      itemType === 'SID'
    );
  }

  private static getErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return 'WORKPACK_GENERATION_FAILED';
  }
}
