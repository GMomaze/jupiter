import {
  Aircraft,
  MaintenanceTemplate,
  PlanningSession,
  Workpack,
} from '../../../models/index.js';
import {
  WorkpackPreviewItem,
  WorkpackPreviewResult,
  WorkpackPreviewService,
} from './workpack-preview.service.js';
import { WorkpackGenerationService } from './workpack-generation.service.js';
import {
  PlanningValidationError,
  PlanningValidationService,
} from './planning-validation.service.js';

type PlanningSessionState = {
  template: WorkpackPreviewResult['template'];
  aircraft: WorkpackPreviewResult['aircraft'];
  summary: WorkpackPreviewResult['summary'];
  items: WorkpackPreviewItem[];
  blocking_errors: string[];
};

type PlanningSessionStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'READY_FOR_GENERATION'
  | 'GENERATED';

export class PlanningSessionService {
  static async listSessionsForUser(params: {
    userId: string;
    aircraftId?: string;
    status?: string;
  }) {
    const where: Record<string, unknown> = {
      user_id: params.userId,
    };
    const normalizedAircraftId = String(params.aircraftId || '').trim();
    const normalizedStatus = String(params.status || '').trim().toUpperCase();

    if (normalizedAircraftId) {
      where.aircraft_id = normalizedAircraftId;
    }

    if (normalizedStatus === 'OPEN') {
      where.status = ['DRAFT', 'IN_PROGRESS', 'READY_FOR_GENERATION'];
    } else if (normalizedStatus === 'CLOSED') {
      where.status = 'GENERATED';
    } else if (this.isKnownStatus(normalizedStatus)) {
      where.status = normalizedStatus;
    }

    return PlanningSession.findAll({
      where,
      include: [
        {
          model: Aircraft,
          as: 'Aircraft',
          attributes: ['id', 'registration', 'model_id'],
          required: false,
        },
        {
          model: MaintenanceTemplate,
          as: 'Template',
          attributes: ['id', 'name', 'template_type', 'model_id'],
          required: false,
        },
        {
          model: Workpack,
          as: 'GeneratedWorkpack',
          attributes: ['id', 'work_order_number'],
          required: false,
        },
      ],
      order: [['updated_at', 'DESC']],
    });
  }

  static async deleteSession(params: {
    sessionId: string;
    userId: string;
  }) {
    const session = await PlanningSession.findOne({
      where: {
        id: params.sessionId,
        user_id: params.userId,
      },
    });

    if (!session) {
      throw new Error('PLANNING_SESSION_NOT_FOUND');
    }

    if (this.isGeneratedState(session.status)) {
      throw new Error('PLANNING_SESSION_DELETE_BLOCKED');
    }

    await session.destroy();
  }

  static async getSessionForUser(sessionId: string, userId: string) {
    return PlanningSession.findOne({
      where: {
        id: sessionId,
        user_id: userId,
      },
      include: [
        {
          model: Aircraft,
          as: 'Aircraft',
          attributes: ['id', 'registration', 'model_id'],
          required: false,
        },
        {
          model: MaintenanceTemplate,
          as: 'Template',
          attributes: ['id', 'name', 'template_type', 'model_id'],
          required: false,
        },
        {
          model: Workpack,
          as: 'GeneratedWorkpack',
          attributes: ['id', 'work_order_number'],
          required: false,
        },
      ],
    });
  }

  static async saveSession(params: {
    sessionId?: string;
    userId: string;
    aircraftId: string;
    templateId: string;
    maintenanceType: string;
    selectedItemIds: string[];
  }) {
    const state = await this.buildSessionState(params);

    const normalizedMaintenanceType = String(params.maintenanceType || '').trim().toUpperCase();
    const normalizedSelectedIds = this.normalizeSelectedItemIds(
      params.selectedItemIds,
      state.items
    );
    const validation = PlanningValidationService.validate({
      preview: state,
      rawSelectedItemIds: params.selectedItemIds,
      selectedItemIds: normalizedSelectedIds,
    });
    state.blocking_errors = validation.errors;

    let session =
      params.sessionId
        ? await PlanningSession.findOne({
            where: {
              id: params.sessionId,
              user_id: params.userId,
              status: ['DRAFT', 'IN_PROGRESS', 'READY_FOR_GENERATION'],
            },
          })
        : null;

    if (!session) {
      session = await PlanningSession.findOne({
        where: {
          user_id: params.userId,
          aircraft_id: params.aircraftId,
          template_id: params.templateId,
          maintenance_type: normalizedMaintenanceType,
          status: ['DRAFT', 'IN_PROGRESS', 'READY_FOR_GENERATION'],
        },
      });
    }

    const nextStatus = this.resolveSaveStatus({
      currentStatus: (session?.status || 'DRAFT') as PlanningSessionStatus,
      selectedItemIds: normalizedSelectedIds,
      candidateItems: state.items,
      validationPassed: validation.isValid,
    });

    if (session) {
      if (this.isGeneratedState(session.status)) {
        throw new Error('PLANNING_SESSION_READ_ONLY');
      }

      session.aircraft_id = params.aircraftId;
      session.template_id = params.templateId;
      session.maintenance_type = normalizedMaintenanceType;
      session.candidate_content = state;
      session.selected_item_ids = normalizedSelectedIds;
      session.status = nextStatus;
      await session.save();
      return session;
    }

    return PlanningSession.create({
      user_id: params.userId,
      created_by: params.userId,
      aircraft_id: params.aircraftId,
      template_id: params.templateId,
      maintenance_type: normalizedMaintenanceType,
      candidate_content: state,
      selected_item_ids: normalizedSelectedIds,
      status: nextStatus,
      generated_workpack_id: null,
    });
  }

  static async finalizeSession(params: {
    sessionId: string;
    userId: string;
    createdBy: string;
  }) {
    const session = await PlanningSession.findOne({
      where: {
        id: params.sessionId,
        user_id: params.userId,
        status: ['DRAFT', 'IN_PROGRESS', 'READY_FOR_GENERATION'],
      },
    });

    if (!session) {
      throw new Error('PLANNING_SESSION_NOT_FOUND');
    }

    const currentStatus = (session.status || 'DRAFT') as PlanningSessionStatus;
    if (this.isGeneratedState(currentStatus)) {
      throw new Error('PLANNING_SESSION_READ_ONLY');
    }

    const liveState = await this.buildSessionState({
      aircraftId: session.aircraft_id,
      templateId: session.template_id,
      selectedItemIds: Array.isArray(session.selected_item_ids) ? session.selected_item_ids : [],
    });
    const candidateItems = liveState.items;
    const selectedItemIds = this.normalizeSelectedItemIds(
      Array.isArray(session.selected_item_ids) ? session.selected_item_ids : [],
      candidateItems
    );
    const validation = PlanningValidationService.validate({
      preview: liveState,
      rawSelectedItemIds: Array.isArray(session.selected_item_ids) ? session.selected_item_ids : [],
      selectedItemIds,
    });
    const nextStatus = this.resolveSaveStatus({
      currentStatus,
      selectedItemIds,
      candidateItems,
      validationPassed: validation.isValid,
    });

    if (nextStatus !== 'READY_FOR_GENERATION') {
      throw new PlanningValidationError(
        validation.errors.length > 0
          ? validation.errors
          : ['Planning session is not valid for workpack generation yet.']
      );
    }

    const generationResult = await WorkpackGenerationService.generateWorkpackFromTemplate({
      templateId: session.template_id,
      aircraftId: session.aircraft_id,
      createdBy: params.createdBy,
      planningSessionId: session.id,
      selectedItemIds,
    });

    if (generationResult.status === 'SUCCESS' && generationResult.workpack_id) {
      session.status = 'GENERATED';
      session.generated_workpack_id = generationResult.workpack_id;
      session.finalized_by = params.createdBy;
      session.finalized_at = new Date();
      await session.save();
    }

    return { session, generationResult };
  }

  static hydratePreviewFromSession(session: any, livePreview?: WorkpackPreviewResult) {
    const savedState = (session?.candidate_content || {}) as Partial<PlanningSessionState>;
    const blockingErrors = Array.isArray(savedState.blocking_errors)
      ? savedState.blocking_errors
      : livePreview?.blocking_errors || [];

    return {
      can_generate: blockingErrors.length === 0,
      blocking_errors: blockingErrors,
      template: savedState.template || livePreview?.template || null,
      aircraft: savedState.aircraft || livePreview?.aircraft || null,
      summary: savedState.summary || livePreview?.summary || {
        total_items: 0,
        standard_task_count: 0,
        compliance_item_count: 0,
        sid_count: 0,
      },
      items: Array.isArray(savedState.items) ? savedState.items : livePreview?.items || [],
    } as WorkpackPreviewResult;
  }

  private static async buildSessionState(params: {
    aircraftId: string;
    templateId: string;
    selectedItemIds: string[];
  }): Promise<PlanningSessionState> {
    const preview = await WorkpackPreviewService.getWorkpackPreview({
      templateId: params.templateId,
      aircraftId: params.aircraftId,
    });

    return {
      template: preview.template,
      aircraft: preview.aircraft,
      summary: preview.summary,
      items: preview.items,
      blocking_errors: preview.blocking_errors,
    };
  }

  private static getSessionItems(session: any) {
    const candidateContent = (session?.candidate_content || {}) as Partial<PlanningSessionState>;
    return Array.isArray(candidateContent.items) ? candidateContent.items : [];
  }

  private static resolveSaveStatus(params: {
    currentStatus: PlanningSessionStatus;
    selectedItemIds: string[];
    candidateItems: Array<{ template_item_id: string }>;
    validationPassed: boolean;
  }): PlanningSessionStatus {
    const { currentStatus, selectedItemIds, candidateItems, validationPassed } = params;

    if (currentStatus === 'GENERATED') {
      return 'GENERATED';
    }

    const allCandidateIds = candidateItems
      .map((item) => String(item.template_item_id || '').trim())
      .filter(Boolean);
    const hasCandidateItems = allCandidateIds.length > 0;
    const selectedSet = new Set(
      selectedItemIds.map((itemId) => String(itemId || '').trim()).filter(Boolean)
    );
    const hasModifications =
      selectedSet.size > 0 &&
      (selectedSet.size !== allCandidateIds.length ||
        allCandidateIds.some((itemId) => !selectedSet.has(itemId)));

    let status: PlanningSessionStatus = currentStatus;

    if (status === 'DRAFT' && (hasCandidateItems || hasModifications)) {
      status = 'IN_PROGRESS';
    }

    if (status === 'IN_PROGRESS' || status === 'READY_FOR_GENERATION') {
      if (validationPassed && selectedItemIds.length > 0) {
        status = 'READY_FOR_GENERATION';
      } else {
        status = 'IN_PROGRESS';
      }
    }

    return status;
  }

  private static isGeneratedState(status: string | null | undefined) {
    return String(status || '').trim().toUpperCase() === 'GENERATED';
  }

  private static isKnownStatus(status: string) {
    return ['DRAFT', 'IN_PROGRESS', 'READY_FOR_GENERATION', 'GENERATED'].includes(
      String(status || '').trim().toUpperCase()
    );
  }

  private static normalizeSelectedItemIds(selectedItemIds: string[], items: Array<{ template_item_id: string }>) {
    const selected = new Set(
      (Array.isArray(selectedItemIds) ? selectedItemIds : [])
        .map((itemId) => String(itemId || '').trim())
        .filter(Boolean)
    );
    const validIds = items
      .map((item) => String(item.template_item_id || '').trim())
      .filter(Boolean);

    if (selected.size === 0) {
      return validIds;
    }

    return validIds.filter((itemId) => selected.has(itemId));
  }
}
