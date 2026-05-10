import { QueryTypes } from 'sequelize';
import {
  Aircraft,
  ComponentModel,
  MaintenanceTemplate,
  MaintenanceTemplateItem,
  ServiceBulletinModel,
  SidModelApplicability,
  SupplementalInspectionDocument,
  sequelize,
} from '../../../models/index.js';
import { ComplianceItem } from '../../../models/ComplianceItem.js';

type TemplateItemType = 'STANDARD_TASK' | 'COMPLIANCE_ITEM' | 'SID';
type PreviewValidationStatus = 'READY' | 'BLOCKED';

type StandardTaskSource = {
  id: string;
  task_card_number: string | null;
  title: string | null;
  description: string | null;
  scope: string | null;
  aircraft_model_id: string | null;
  aircraft_id: string | null;
  is_active: boolean | null;
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

export interface WorkpackPreviewItem {
  template_item_id: string;
  sequence_no: number;
  item_type: TemplateItemType;
  source_id: string;
  source_reference: string | null;
  title: string | null;
  description: string | null;
  is_required: boolean;
  notes: string | null;
  validation_status: PreviewValidationStatus;
  validation_errors: string[];
}

export interface WorkpackPreviewResult {
  can_generate: boolean;
  blocking_errors: string[];
  template: {
    id: string;
    name: string;
    model_id: string;
    template_type: string;
    is_active: boolean;
  } | null;
  aircraft: {
    id: string;
    registration: string;
    model_id: string;
    model_name: string | null;
  } | null;
  summary: {
    total_items: number;
    standard_task_count: number;
    compliance_item_count: number;
    sid_count: number;
  };
  items: WorkpackPreviewItem[];
}

export class WorkpackPreviewService {
  static async getWorkpackPreview(params: {
    templateId: string;
    aircraftId: string;
  }): Promise<WorkpackPreviewResult> {
    const result: WorkpackPreviewResult = {
      can_generate: false,
      blocking_errors: [],
      template: null,
      aircraft: null,
      summary: {
        total_items: 0,
        standard_task_count: 0,
        compliance_item_count: 0,
        sid_count: 0,
      },
      items: [],
    };

    try {
      this.validateParams(params);

      const template = await MaintenanceTemplate.findByPk(params.templateId, {
        attributes: ['id', 'name', 'model_id', 'template_type', 'is_active'],
      });

      if (!template) {
        result.blocking_errors.push('TEMPLATE_NOT_FOUND');
        return result;
      }

      result.template = {
        id: template.id,
        name: template.name,
        model_id: template.model_id,
        template_type: template.template_type,
        is_active: template.is_active,
      };

      if (!template.is_active) {
        result.blocking_errors.push('TEMPLATE_INACTIVE');
      }

      const aircraft = await Aircraft.findByPk(params.aircraftId, {
        attributes: ['id', 'registration', 'model_id'],
      });

      if (!aircraft) {
        result.blocking_errors.push('AIRCRAFT_NOT_FOUND');
        return result;
      }

      const componentModel = aircraft.model_id
        ? await ComponentModel.findByPk(aircraft.model_id, {
            attributes: ['id', 'model_name'],
          })
        : null;

      result.aircraft = {
        id: aircraft.id,
        registration: aircraft.registration,
        model_id: aircraft.model_id,
        model_name: componentModel?.model_name ?? null,
      };

      if (!template.model_id) {
        result.blocking_errors.push('TEMPLATE_MODEL_NOT_SET');
      }

      if (!aircraft.model_id) {
        result.blocking_errors.push('AIRCRAFT_MODEL_NOT_RESOLVED');
      }

      if (
        template.model_id &&
        aircraft.model_id &&
        template.model_id !== aircraft.model_id
      ) {
        result.blocking_errors.push('TEMPLATE_MODEL_MISMATCH');
      }

      const templateItems = await MaintenanceTemplateItem.findAll({
        where: { template_id: template.id },
        order: [['sequence_no', 'ASC']],
      });

      if (templateItems.length === 0) {
        result.blocking_errors.push('TEMPLATE_HAS_NO_ITEMS');
        return result;
      }

      const sourceMaps = await this.resolveSourceMaps(templateItems);
      const applicabilityContext = await this.resolveApplicabilityContext(
        sourceMaps,
        aircraft.model_id
      );
      const applicableTemplateItems = templateItems.filter((item) =>
        this.isTemplateItemApplicable(item, sourceMaps, applicabilityContext, aircraft)
      );

      if (applicableTemplateItems.length === 0) {
        result.blocking_errors.push('TEMPLATE_HAS_NO_APPLICABLE_ITEMS');
        return result;
      }

      result.summary = this.buildSummary(applicableTemplateItems);
      result.items = this.buildPreviewItems(applicableTemplateItems, sourceMaps);

      if (result.items.some((item) => item.validation_status === 'BLOCKED')) {
        result.blocking_errors.push('SOURCE_RECORD_MISSING');
      }

      result.can_generate = result.blocking_errors.length === 0;
      return result;
    } catch (error) {
      result.blocking_errors.push(this.getErrorMessage(error));
      result.can_generate = false;
      return result;
    }
  }

  private static validateParams(params: {
    templateId: string;
    aircraftId: string;
  }) {
    if (!params.templateId?.trim()) {
      throw new Error('TEMPLATE_ID_REQUIRED');
    }

    if (!params.aircraftId?.trim()) {
      throw new Error('AIRCRAFT_ID_REQUIRED');
    }
  }

  private static buildSummary(templateItems: MaintenanceTemplateItem[]) {
    return {
      total_items: templateItems.length,
      standard_task_count: templateItems.filter(
        (item) => item.item_type === 'STANDARD_TASK'
      ).length,
      compliance_item_count: templateItems.filter(
        (item) => item.item_type === 'COMPLIANCE_ITEM'
      ).length,
      sid_count: templateItems.filter((item) => item.item_type === 'SID').length,
    };
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

    return {
      STANDARD_TASK: new Map(standardTasks.map((item) => [item.id, item])),
      COMPLIANCE_ITEM: new Map(complianceItems.map((item) => [item.id, item])),
      SID: new Map(sidDocuments.map((item) => [item.id, item])),
    };
  }

  private static async loadStandardTaskSources(taskTemplateIds: string[]) {
    return sequelize.query<StandardTaskSource>(
      `
      SELECT
        id,
        task_card_number,
        title,
        description,
        scope,
        aircraft_model_id,
        aircraft_id,
        is_active
      FROM task_templates
      WHERE id IN (:taskTemplateIds)
      `,
      {
        replacements: { taskTemplateIds },
        type: QueryTypes.SELECT,
      }
    );
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
      if (!standardTask || standardTask.is_active === false) {
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
    if (!sid || sid.is_active === false) {
      return false;
    }

    return applicabilityContext.applicableSidIds.has(String(sid.id || '').trim());
  }

  private static buildPreviewItems(
    templateItems: MaintenanceTemplateItem[],
    sourceMaps: SourceMaps
  ) {
    return templateItems.map((item) =>
      this.buildPreviewItem(
        item,
        sourceMaps[item.item_type].get(item.item_id) ?? null
      )
    );
  }

  private static buildPreviewItem(
    item: MaintenanceTemplateItem,
    sourceRecord:
      | StandardTaskSource
      | ComplianceItem
      | SupplementalInspectionDocument
      | null
  ): WorkpackPreviewItem {
    const validationErrors: string[] = [];

    if (!this.isSupportedItemType(item.item_type)) {
      validationErrors.push(`UNSUPPORTED_TEMPLATE_ITEM_TYPE:${item.item_type}`);
    }

    if (!item.item_id) {
      validationErrors.push(`TEMPLATE_ITEM_SOURCE_ID_MISSING:${item.id}`);
    }

    if (!sourceRecord) {
      validationErrors.push(
        `TEMPLATE_ITEM_SOURCE_NOT_FOUND:${item.item_type}:${item.item_id}`
      );
    }

    let sourceReference: string | null = null;
    let title: string | null = null;
    let description: string | null = null;

    if (sourceRecord && item.item_type === 'STANDARD_TASK') {
      const standardTask = sourceRecord as StandardTaskSource;
      sourceReference = standardTask.task_card_number?.trim() || standardTask.id;
      title = standardTask.title?.trim() || null;
      description = standardTask.description?.trim() || null;

      if (standardTask.is_active === false) {
        validationErrors.push(`STANDARD_TASK_INACTIVE:${standardTask.id}`);
      }
    } else if (sourceRecord && item.item_type === 'COMPLIANCE_ITEM') {
      const complianceItem = sourceRecord as ComplianceItem;
      sourceReference = complianceItem.code?.trim() || complianceItem.id;
      title = complianceItem.title?.trim() || null;
      description =
        complianceItem.description?.trim() || complianceItem.title?.trim() || null;
    } else if (sourceRecord && item.item_type === 'SID') {
      const sid = sourceRecord as SupplementalInspectionDocument;
      sourceReference = sid.reference?.trim() || sid.id;
      title = sid.title?.trim() || null;
      description =
        sid.description?.trim() || sid.notes?.trim() || null;

      if (sid.is_active === false) {
        validationErrors.push(`SID_INACTIVE:${sid.id}`);
      }
    }

    if (!title) {
      validationErrors.push(`SOURCE_TITLE_MISSING:${item.item_type}:${item.item_id}`);
    }

    if (!description) {
      validationErrors.push(
        `SOURCE_DESCRIPTION_MISSING:${item.item_type}:${item.item_id}`
      );
    }

    return {
      template_item_id: item.id,
      sequence_no: item.sequence_no,
      item_type: this.isSupportedItemType(item.item_type)
        ? item.item_type
        : 'STANDARD_TASK',
      source_id: item.item_id,
      source_reference: sourceReference,
      title,
      description,
      is_required: item.is_required,
      notes: item.notes,
      validation_status:
        validationErrors.length > 0 ? 'BLOCKED' : 'READY',
      validation_errors: validationErrors,
    };
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

    return 'WORKPACK_PREVIEW_FAILED';
  }
}
