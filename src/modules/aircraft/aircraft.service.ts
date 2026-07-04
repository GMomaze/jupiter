import { sequelize } from '../../models/index.js';
import {
  Aircraft,
  AircraftComponent,
  ComponentModel,
  AdApplicabilityAllocation,
  AirworthinessDirective,
  AircraftSbCompliance,
  ComplianceAssignment,
  ComplianceItem,
  ServiceBulletin,
  Manufacturer,
  AssetType,
  TaskTemplate,
  User
} from '../../models/index.js';
import { AuditService } from '../audit/audit.service.js';
import { UtilisationService } from '../utilisation/utilisation.service.js';
import { Op, QueryTypes } from 'sequelize';

type AircraftStatus =
  | 'REGISTERED'
  | 'ACTIVE'
  | 'GROUNDED'
  | 'RETIRED';

export class AircraftService {
  private static readonly mutableAircraftAttributes = [
    'id',
    'status',
    'total_time_hours',
    'total_time_cycles',
    'version',
  ];
  private static readonly editableAircraftAttributes = [
    'id',
    'registration',
    'serial_number',
    'model_id',
    'category_id',
    'status',
    'total_time_hours',
    'total_time_cycles',
    'loaded_into_system_at',
    'manufacture_date',
    'tcds_number',
    'tcds_url',
    'photo_url',
    'version',
  ];

  private static readonly serviceBulletinStatuses = new Set([
    'OPEN',
    'COMPLIED',
    'NOT_APPLICABLE'
  ]);
  private static readonly adComplianceStatuses = new Set([
    'DUE',
    'IN_PROGRESS',
    'COMPLIANT',
    'NOT_APPLICABLE',
  ]);
  private static readonly adComplianceStatusTransitions: Record<string, string[]> = {
    DUE: ['IN_PROGRESS', 'COMPLIANT', 'NOT_APPLICABLE'],
    IN_PROGRESS: ['COMPLIANT', 'NOT_APPLICABLE'],
    COMPLIANT: [],
    NOT_APPLICABLE: [],
  };
  private static readonly serviceBulletinPriority: Record<string, number> = {
    MANDATORY: 0,
    REQUIRED: 1,
    OPTIONAL: 2
  };

  private static normalizeBoolean(value: unknown) {
    if (typeof value !== 'string') {
      return false;
    }

    return value.toLowerCase() === 'true';
  }

  private static allowedTransitions: Record<AircraftStatus, AircraftStatus[]> = {
    REGISTERED: ['ACTIVE'],
    ACTIVE: ['GROUNDED', 'RETIRED'],
    GROUNDED: ['ACTIVE', 'RETIRED'],
    RETIRED: []
  };

  /* ============================================================
     BASIC READ (REQUIRED BY TESTS)
  ============================================================ */

  static async getById(id: string) {
    return Aircraft.findByPk(id);
  }

  /* ============================================================
     VALIDATION
  ============================================================ */

  private static validateTransition(current: AircraftStatus, target: AircraftStatus) {
    const allowed = this.allowedTransitions[current] || [];
    if (!allowed.includes(target)) {
      throw new Error('INVALID_TRANSITION');
    }
  }

  private static requireReason(reason: string) {
    if (!reason || reason.trim() === '') {
      throw new Error('REASON_REQUIRED');
    }
  }

  private static normalizeRegistration(registration: string) {
    const compact = registration.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (
      compact.startsWith('ZS') ||
      compact.startsWith('ZU') ||
      compact.startsWith('ZT')
    ) {
      const prefix = compact.slice(0, 2);
      const suffix = compact.slice(2);

      if (!/^[A-Z]{3}$/.test(suffix)) {
        throw new Error('INVALID_REGISTRATION_FORMAT');
      }

      return `${prefix}-${suffix}`;
    }

    return registration.trim().toUpperCase();
  }

  private static normalizeHours(value: number | string | null | undefined) {
    const hours = Number(value ?? 0);

    if (!Number.isFinite(hours) || hours < 0) {
      throw new Error('INVALID_TOTAL_TIME_HOURS');
    }

    return hours;
  }

  private static normalizeCycles(value: number | string | null | undefined) {
    const cycles = Number(value ?? 0);

    if (!Number.isInteger(cycles) || cycles < 0) {
      throw new Error('INVALID_TOTAL_TIME_CYCLES');
    }

    return cycles;
  }

  private static utilizationFieldChanged(
    currentValue: number | string | null | undefined,
    submittedValue: number | string | null | undefined,
    normalizer: (value: number | string | null | undefined) => number
  ) {
    if (submittedValue === undefined) {
      return false;
    }

    return normalizer(currentValue) !== normalizer(submittedValue);
  }

  /* ============================================================
     CREATE
  ============================================================ */

  static async create(data: {
    registration: string;
    serial_number: string;
    model_id: string;
    category_id: string;
    total_time_hours?: number;
    total_time_cycles?: number;
    loaded_into_system_at?: string | null;
    manufacture_date?: string | null;
    tcds_number?: string | null;
    tcds_url?: string | null;
    photo_url?: string | null;
  }) {

    if (!data.model_id) throw new Error('MODEL_ID_REQUIRED');
    if (!data.category_id) throw new Error('CATEGORY_ID_REQUIRED');

    return sequelize.transaction(async (transaction) => {

      const aircraft = await Aircraft.create({
        registration: this.normalizeRegistration(data.registration),
        serial_number: data.serial_number,
        model_id: data.model_id,
        category_id: data.category_id,
        status: 'REGISTERED',
        total_time_hours: 0,
        total_time_cycles: 0,
        loaded_into_system_at: data.loaded_into_system_at || null,
        manufacture_date: data.manufacture_date || null,
        tcds_number: data.tcds_number?.trim() || null,
        tcds_url: data.tcds_url?.trim() || null,
        photo_url: data.photo_url?.trim() || null,
        version: 0
      }, { transaction });

      await AuditService.log({
        table_name: 'aircraft',
        row_id: aircraft.id,
        action: 'CREATE',
        actor_id: null,
        reason: 'Aircraft Registration',
        new_values: { status: 'REGISTERED' }
      }, transaction);

      const initialHours = this.normalizeHours(data.total_time_hours ?? 0);
      const initialCycles = this.normalizeCycles(data.total_time_cycles ?? 0);

      if (initialHours > 0 || initialCycles > 0) {
        await UtilisationService.recordUtilisation({
          aircraftId: aircraft.id,
          newTotalTimeHours: initialHours,
          newTotalTimeCycles: initialCycles,
          sourceType: 'INITIAL_BASELINE',
          sourceReference: 'Aircraft registration',
          effectiveDate:
            data.loaded_into_system_at ||
            data.manufacture_date ||
            new Date().toISOString().slice(0, 10),
          reason: 'Initial aircraft utilisation baseline',
          createdBy: null,
          metadata: {
            source: 'AircraftService.create',
          },
          transaction,
        });
      }

      return aircraft;
    });
  }

  /* ============================================================
     TRANSITIONS
  ============================================================ */

  static async activate(id: string, reason: string) {
    return this.returnToService(id, reason);
  }

  static async ground(id: string, reason: string) {
    this.requireReason(reason);

    return sequelize.transaction(async (transaction) => {

      const aircraft = await Aircraft.findByPk(id, {
        attributes: this.mutableAircraftAttributes,
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!aircraft) throw new Error('AIRCRAFT_NOT_FOUND');

      this.validateTransition(aircraft.status as AircraftStatus, 'GROUNDED');

      const oldStatus = aircraft.status;

      aircraft.status = 'GROUNDED';
      await aircraft.save({ transaction });

      await AuditService.log({
        table_name: 'aircraft',
        row_id: id,
        action: 'STATUS_CHANGE',
        actor_id: null,
        reason,
        old_values: { status: oldStatus },
        new_values: { status: 'GROUNDED' }
      }, transaction);

      return aircraft;
    });
  }

  static async retire(id: string, reason: string) {
    this.requireReason(reason);

    return sequelize.transaction(async (transaction) => {

      const aircraft = await Aircraft.findByPk(id, {
        attributes: this.mutableAircraftAttributes,
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!aircraft) throw new Error('AIRCRAFT_NOT_FOUND');

      this.validateTransition(aircraft.status as AircraftStatus, 'RETIRED');

      const oldStatus = aircraft.status;

      aircraft.status = 'RETIRED';
      await aircraft.save({ transaction });

      await AuditService.log({
        table_name: 'aircraft',
        row_id: id,
        action: 'STATUS_CHANGE',
        actor_id: null,
        reason,
        old_values: { status: oldStatus },
        new_values: { status: 'RETIRED' }
      }, transaction);

      return aircraft;
    });
  }

  static async returnToService(id: string, reason: string) {
    this.requireReason(reason);

    return sequelize.transaction(async (transaction) => {

      const aircraft = await Aircraft.findByPk(id, {
        attributes: this.mutableAircraftAttributes,
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!aircraft) throw new Error('AIRCRAFT_NOT_FOUND');

      this.validateTransition(aircraft.status as AircraftStatus, 'ACTIVE');

      const quarantined = await AircraftComponent.findOne({
        where: {
          aircraft_id: id,
          current_status: 'QUARANTINED',
          removed_at: null
        },
        transaction
      });

      if (quarantined) {
        throw new Error(
          'INVALID_OPERATION: Cannot return aircraft to service with quarantined components installed.'
        );
      }

      const oldStatus = aircraft.status;

      aircraft.status = 'ACTIVE';
      await aircraft.save({ transaction });

      await AuditService.log({
        table_name: 'aircraft',
        row_id: id,
        action: 'STATUS_CHANGE',
        actor_id: null,
        reason,
        old_values: { status: oldStatus },
        new_values: { status: 'ACTIVE' }
      }, transaction);

      return aircraft;
    });
  }

  /* ============================================================
     HOURS UPDATE
  ============================================================ */

  static async updateHours(id: string, newTotalHours: number) {
    const result = await UtilisationService.recordUtilisation({
      aircraftId: id,
      newTotalTimeHours: newTotalHours,
      sourceType: 'MANUAL_ENTRY',
      sourceReference: 'AircraftService.updateHours compatibility wrapper',
      effectiveDate: new Date().toISOString().slice(0, 10),
      reason: 'Aircraft hours update',
      createdBy: null,
      metadata: {
        source: 'AircraftService.updateHours',
        compatibility_wrapper: true,
      },
    });

    return result.aircraft;
  }

  static async updateDetails(id: string, data: {
    registration: string;
    serial_number: string;
    model_id: string;
    category_id: string;
    total_time_hours?: number | string;
    total_time_cycles?: number | string;
    loaded_into_system_at?: string | null;
    manufacture_date?: string | null;
    tcds_number?: string | null;
    tcds_url?: string | null;
    photo_url?: string | null | undefined;
    version?: number | string;
  }) {
    if (!data.registration?.trim()) throw new Error('REGISTRATION_REQUIRED');
    if (!data.serial_number?.trim()) throw new Error('SERIAL_NUMBER_REQUIRED');
    if (!data.model_id) throw new Error('MODEL_ID_REQUIRED');
    if (!data.category_id) throw new Error('CATEGORY_ID_REQUIRED');

    return sequelize.transaction(async (transaction) => {
      const aircraft = await Aircraft.findByPk(id, {
        attributes: this.editableAircraftAttributes,
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!aircraft) throw new Error('AIRCRAFT_NOT_FOUND');

      const submittedVersion = Number(data.version);
      if (Number.isFinite(submittedVersion) && submittedVersion !== aircraft.version) {
        throw new Error('STALE_AIRCRAFT_RECORD');
      }

      const oldValues = {
        registration: aircraft.registration,
        serial_number: aircraft.serial_number,
        model_id: aircraft.model_id,
        category_id: aircraft.category_id,
        total_time_hours: aircraft.total_time_hours,
        total_time_cycles: aircraft.total_time_cycles,
        loaded_into_system_at: aircraft.loaded_into_system_at,
        manufacture_date: aircraft.manufacture_date,
        tcds_number: aircraft.tcds_number,
        tcds_url: aircraft.tcds_url,
        photo_url: aircraft.photo_url,
        version: aircraft.version,
      };

      if (
        this.utilizationFieldChanged(
          aircraft.total_time_hours,
          data.total_time_hours,
          (value) => this.normalizeHours(value)
        ) ||
        this.utilizationFieldChanged(
          aircraft.total_time_cycles,
          data.total_time_cycles,
          (value) => this.normalizeCycles(value)
        )
      ) {
        throw new Error('UTILISATION_CHANGE_REQUIRES_UTILISATION_SERVICE');
      }

      aircraft.registration = this.normalizeRegistration(data.registration);
      aircraft.serial_number = data.serial_number.trim();
      aircraft.model_id = data.model_id;
      aircraft.category_id = data.category_id;
      aircraft.loaded_into_system_at = data.loaded_into_system_at || null;
      aircraft.manufacture_date = data.manufacture_date || null;
      aircraft.tcds_number = data.tcds_number?.trim() || null;
      aircraft.tcds_url = data.tcds_url?.trim() || null;

      if (typeof data.photo_url === 'string') {
        aircraft.photo_url = data.photo_url.trim() || null;
      }

      await aircraft.save({ transaction });

      await AuditService.log({
        table_name: 'aircraft',
        row_id: aircraft.id,
        action: 'UPDATE',
        actor_id: null,
        reason: 'Aircraft details updated',
        old_values: oldValues,
        new_values: {
          registration: aircraft.registration,
          serial_number: aircraft.serial_number,
          model_id: aircraft.model_id,
          category_id: aircraft.category_id,
          total_time_hours: aircraft.total_time_hours,
          total_time_cycles: aircraft.total_time_cycles,
          loaded_into_system_at: aircraft.loaded_into_system_at,
          manufacture_date: aircraft.manufacture_date,
          tcds_number: aircraft.tcds_number,
          tcds_url: aircraft.tcds_url,
          photo_url: aircraft.photo_url,
          version: aircraft.version,
        }
      }, transaction);

      return aircraft;
    });
  }

  static async getServiceBulletinsForAircraft(aircraftId: string, options?: {
    status?: string;
    critical?: string;
    open_only?: string;
    sort?: string;
  }) {
    const aircraft = await Aircraft.findByPk(aircraftId, {
      attributes: ['id', 'model_id'],
      include: [
        {
          model: AircraftComponent,
          as: 'installed_components',
          required: false,
          attributes: ['model_id']
        }
      ]
    });

    if (!aircraft) throw new Error('AIRCRAFT_NOT_FOUND');

    const modelIds = Array.from(
      new Set([
        aircraft.model_id,
        ...((aircraft as any).installed_components || []).map(
          (component: any) => component.model_id
        )
      ].filter(Boolean))
    );

    if (modelIds.length === 0) {
      return [];
    }

    const bulletins = await ServiceBulletin.findAll({
      include: [
        {
          model: ComponentModel,
          as: 'ApplicableModels',
          attributes: [
            'id',
            'model_name',
            'manufacturer_id',
            'asset_type_id'
          ],
          where: {
            id: {
              [Op.in]: modelIds
            }
          },
          through: { attributes: [] },
          include: [
            {
              model: Manufacturer,
              attributes: ['id', 'name', 'code'],
              required: false
            },
            {
              model: AssetType,
              attributes: ['id', 'code', 'label'],
              required: false
            }
          ]
        }
      ],
      order: [['sb_number', 'ASC']]
    });

    const complianceRows = await AircraftSbCompliance.findAll({
      where: { aircraft_id: aircraftId }
    });

    const complianceByBulletinId = new Map(
      complianceRows.map((row: any) => [row.service_bulletin_id, row])
    );

    return bulletins.map((bulletin: any) => {
      const compliance = complianceByBulletinId.get(bulletin.id);
      const matchingModel = (bulletin.ApplicableModels || []).find((model: any) =>
        modelIds.includes(model.id)
      ) || (bulletin.ApplicableModels || [])[0];

      return {
        id: bulletin.id,
        sb_number: bulletin.sb_number,
        title: bulletin.title,
        model_id: matchingModel?.id || null,
        model_name: matchingModel?.model_name || null,
        asset_type: matchingModel?.AssetType?.code || null,
        source_primary: bulletin.source_primary || 'MANUAL',
        source_refs: bulletin.source_refs || [],
        compliance_type: bulletin.compliance_type || 'REQUIRED',
        status: compliance?.status || 'OPEN',
        description: bulletin.description || null,
        document_url: bulletin.document_url || null,
        complied_at: compliance?.complied_at || null
      };
    })
      .filter((bulletin) => {
        if (this.normalizeBoolean(options?.critical)) {
          return bulletin.compliance_type === 'MANDATORY';
        }

        return true;
      })
      .filter((bulletin) => {
        const requestedStatus = this.normalizeBoolean(options?.open_only)
          ? 'OPEN'
          : options?.status;

        if (!requestedStatus) {
          return true;
        }

        return bulletin.status === requestedStatus;
      })
      .sort((left, right) => {
        if (options?.sort === 'status') {
          return left.status.localeCompare(right.status) ||
            left.sb_number.localeCompare(right.sb_number);
        }

        const leftPriority =
          this.serviceBulletinPriority[left.compliance_type] ?? 3;
        const rightPriority =
          this.serviceBulletinPriority[right.compliance_type] ?? 3;

        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }

        return left.sb_number.localeCompare(right.sb_number);
      });
  }

  static async getApplicableStandardTasksForAircraft(aircraftId: string) {
    const aircraft = await Aircraft.findByPk(aircraftId, {
      attributes: ['id', 'model_id'],
    });

    if (!aircraft) throw new Error('AIRCRAFT_NOT_FOUND');

    const scopeFilters: Record<string, unknown>[] = [
      { scope: 'GLOBAL' },
      { scope: 'MPI' },
      { scope: 'AIRCRAFT', aircraft_id: aircraft.id },
    ];

    if (aircraft.model_id) {
      scopeFilters.push({
        scope: 'MODEL',
        aircraft_model_id: aircraft.model_id,
      });
    }

    return TaskTemplate.findAll({
      attributes: [
        'id',
        'task_card_number',
        'title',
        'scope',
        'source_type',
        'interval_hours',
        'interval_months',
        'model_applicability',
        'aircraft_applicability',
      ],
      where: {
        is_active: true,
        [Op.or]: scopeFilters,
      },
      order: [
        ['scope', 'ASC'],
        ['sort_order', 'ASC'],
        ['task_card_number', 'ASC'],
        ['title', 'ASC'],
      ],
    });
  }

  static async getAdApplicabilityPreviewForAircraft(aircraftId: string) {
    const aircraft = await Aircraft.findByPk(aircraftId, {
      attributes: ['id', 'model_id'],
      include: [
        {
          model: ComponentModel,
          attributes: ['id', 'model_code', 'model_name', 'manufacturer_id'],
          required: false,
          include: [
            {
              model: Manufacturer,
              attributes: ['id', 'name', 'code'],
              required: false,
            },
          ],
        },
      ],
    });

    if (!aircraft) throw new Error('AIRCRAFT_NOT_FOUND');

    const modelId = aircraft.model_id || null;
    const manufacturerId = (aircraft as any).ComponentModel?.manufacturer_id || null;
    const matchFilters = [
      modelId ? { matched_component_model_id: modelId } : null,
      manufacturerId ? { matched_manufacturer_id: manufacturerId } : null,
    ].filter(Boolean) as Record<string, string>[];

    if (matchFilters.length === 0) {
      return [];
    }

    const allocations = await AdApplicabilityAllocation.findAll({
      where: {
        status: 'ACCEPTED',
        classification: {
          [Op.notIn]: ['UNRESOLVED_MAKE', 'UNRESOLVED_MODEL'],
        },
        [Op.or]: matchFilters,
      },
      include: [
        {
          model: AirworthinessDirective,
          as: 'AirworthinessDirective',
          attributes: ['id', 'ad_number', 'revision', 'subject_heading', 'subject'],
          required: false,
        },
        {
          model: Manufacturer,
          as: 'MatchedManufacturer',
          attributes: ['id', 'name', 'code'],
          required: false,
        },
        {
          model: ComponentModel,
          as: 'MatchedComponentModel',
          attributes: ['id', 'model_code', 'model_name', 'manufacturer_id'],
          required: false,
          include: [
            {
              model: Manufacturer,
              attributes: ['id', 'name', 'code'],
              required: false,
            },
          ],
        },
        {
          model: User,
          as: 'Reviewer',
          attributes: ['id', 'full_name', 'email'],
          required: false,
        },
      ],
      order: [
        ['ad_number_snapshot', 'ASC'],
        ['classification', 'ASC'],
        ['reviewed_at', 'DESC'],
      ],
    });

    const previewableAllocations = allocations.filter(
      (allocation: any) =>
        !['UNRESOLVED_MAKE', 'UNRESOLVED_MODEL'].includes(String(allocation.classification))
    );

    const directiveIds = Array.from(
      new Set(
        previewableAllocations
          .map((allocation: any) => allocation.airworthiness_directive_id)
          .filter(Boolean)
      )
    );
    const operationalRows = directiveIds.length
      ? await sequelize.query<{
          directive_id: string;
          compliance_item_id: string;
          compliance_assignment_id: string | null;
          aircraft_compliance_id: string | null;
          aircraft_compliance_status: string | null;
          aircraft_compliance_notes: string | null;
          aircraft_compliance_method: string | null;
        }>(
          `
          SELECT
            ci.source_id::text AS directive_id,
            ci.id::text AS compliance_item_id,
            ca.id::text AS compliance_assignment_id,
            ac.id::text AS aircraft_compliance_id,
            ac.status AS aircraft_compliance_status,
            ac.notes AS aircraft_compliance_notes,
            ac.compliance_method AS aircraft_compliance_method
          FROM compliance_items ci
          LEFT JOIN compliance_assignments ca
            ON ca.compliance_item_id = ci.id
           AND ca.assignment_type = 'AIRCRAFT'
           AND ca.aircraft_id = :aircraftId
           AND ca.is_active = TRUE
          LEFT JOIN aircraft_compliance ac
            ON ac.compliance_item_id = ci.id
           AND ac.aircraft_id = :aircraftId
          WHERE ci.source_type = 'AD'
            AND ci.source_id IN (:directiveIds)
          `,
          {
            replacements: { aircraftId, directiveIds },
            type: QueryTypes.SELECT,
          }
        )
      : [];
    const operationalByDirectiveId = new Map(
      operationalRows.map((row) => [row.directive_id, row])
    );

    return previewableAllocations.map((allocation: any) => {
      const directive = allocation.AirworthinessDirective || {};
      const operationalRow = operationalByDirectiveId.get(
        allocation.airworthiness_directive_id
      );
      const matchedModel = allocation.MatchedComponentModel || null;
      const matchedManufacturer = allocation.MatchedManufacturer || null;
      const modelLabel = matchedModel
        ? [matchedModel.model_code, matchedModel.model_name].filter(Boolean).join(' - ')
        : '';
      const modelManufacturer = matchedModel?.Manufacturer
        ? [matchedModel.Manufacturer.name, matchedModel.Manufacturer.code].filter(Boolean).join(' / ')
        : '';
      const manufacturerLabel = matchedManufacturer
        ? [matchedManufacturer.name, matchedManufacturer.code].filter(Boolean).join(' / ')
        : '';

      return {
        id: allocation.id,
        ad_number: allocation.ad_number_snapshot || directive.ad_number || '-',
        revision: allocation.ad_revision_snapshot || directive.revision || null,
        subject: directive.subject_heading || directive.subject || '-',
        allocation_type:
          allocation.target_type === 'MANUAL_LINK' &&
          allocation.classification === 'MANUAL_MODEL_LINK'
            ? 'Manual model link'
            : allocation.target_type === 'MANUAL_LINK' &&
                allocation.classification === 'MANUAL_MANUFACTURER_LINK'
              ? 'Manual manufacturer link'
              : allocation.target_type === 'BROAD_RULE'
                ? 'Broad rule'
                : allocation.matched_component_model_id === modelId
                  ? 'Model allocation'
                  : 'Manufacturer allocation',
        matched_target:
          [modelManufacturer, modelLabel].filter(Boolean).join(' / ') ||
          manufacturerLabel ||
          '-',
        classification: allocation.classification || '-',
        accepted_by: allocation.Reviewer?.full_name || allocation.Reviewer?.email || '-',
        accepted_at: allocation.reviewed_at || null,
        review_reason: allocation.review_reason || '-',
        compliance_item_id: operationalRow?.compliance_item_id || null,
        compliance_assignment_id: operationalRow?.compliance_assignment_id || null,
        aircraft_compliance_id: operationalRow?.aircraft_compliance_id || null,
        aircraft_compliance_status: operationalRow?.aircraft_compliance_status || null,
        aircraft_compliance_notes: operationalRow?.aircraft_compliance_notes || null,
        aircraft_compliance_method: operationalRow?.aircraft_compliance_method || null,
      };
    });
  }

  static async updateServiceBulletinCompliance(data: {
    aircraft_id: string;
    service_bulletin_id: string;
    status: string;
    notes?: string;
  }) {
    if (!this.serviceBulletinStatuses.has(data.status)) {
      throw new Error('INVALID_SERVICE_BULLETIN_STATUS');
    }

    return sequelize.transaction(async (transaction) => {
      const existing = await AircraftSbCompliance.findOne({
        where: {
          aircraft_id: data.aircraft_id,
          service_bulletin_id: data.service_bulletin_id,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const payload = {
        status: data.status,
        notes: data.notes?.trim() || null,
        complied_at: data.status === 'COMPLIED' ? (existing?.complied_at || new Date()) : null,
      };

      if (existing) {
        await existing.update(payload, { transaction });
        return existing;
      }

      return AircraftSbCompliance.create(
        {
          aircraft_id: data.aircraft_id,
          service_bulletin_id: data.service_bulletin_id,
          ...payload,
        },
        { transaction }
      );
    });
  }

  static async createAdComplianceAssignmentFromAcceptedAllocation(params: {
    aircraftId: string;
    allocationId: string;
    actorUserId?: string | null;
  }) {
    void params.actorUserId;

    const aircraft = await Aircraft.findByPk(params.aircraftId, {
      attributes: ['id', 'model_id'],
      include: [
        {
          model: ComponentModel,
          attributes: ['id', 'manufacturer_id'],
          required: false,
        },
      ],
    });

    if (!aircraft) {
      throw new Error('AIRCRAFT_NOT_FOUND');
    }

    if (!aircraft.model_id || !(aircraft as any).ComponentModel?.manufacturer_id) {
      throw new Error('AIRCRAFT_MODEL_CONTEXT_REQUIRED');
    }

    const allocation = await AdApplicabilityAllocation.findByPk(params.allocationId, {
      include: [
        {
          model: AirworthinessDirective,
          as: 'AirworthinessDirective',
          required: false,
        },
      ],
    });

    if (!allocation) {
      throw new Error('AD_ALLOCATION_NOT_FOUND');
    }

    if (allocation.status !== 'ACCEPTED') {
      throw new Error('AD_ALLOCATION_NOT_ACCEPTED');
    }

    const applicableAllocations = await this.getAdApplicabilityPreviewForAircraft(
      params.aircraftId
    );
    const appliesToAircraft = applicableAllocations.some(
      (item) => item.id === params.allocationId
    );

    if (!appliesToAircraft) {
      throw new Error('AD_ALLOCATION_NOT_APPLICABLE_TO_AIRCRAFT');
    }

    const directive =
      (allocation as any).AirworthinessDirective ||
      (await AirworthinessDirective.findByPk(allocation.airworthiness_directive_id));

    if (!directive) {
      throw new Error('AIRWORTHINESS_DIRECTIVE_NOT_FOUND');
    }

    return sequelize.transaction(async (transaction) => {
      let complianceItem = await ComplianceItem.findOne({
        where: {
          source_type: 'AD',
          source_id: directive.id,
        } as any,
        transaction,
      });
      let createdComplianceItem = false;

      if (!complianceItem) {
        complianceItem = await ComplianceItem.create(
          {
            item_type: 'AD',
            code: directive.ad_number,
            title:
              directive.subject_heading?.trim() ||
              directive.subject?.trim() ||
              directive.ad_number,
            description: directive.summary?.trim() || directive.subject?.trim() || null,
            authority: directive.authority || null,
            revision: directive.revision || null,
            effective_on: directive.effective_date || null,
            source_table: 'airworthiness_directives',
            source_type: 'AD',
            source_id: directive.id,
            compliance_basis: 'MANDATORY',
            status: 'ACTIVE',
          } as any,
          { transaction }
        );
        createdComplianceItem = true;
      }

      const existingAssignment = await ComplianceAssignment.findOne({
        where: {
          compliance_item_id: complianceItem.id,
          assignment_type: 'AIRCRAFT',
          aircraft_id: params.aircraftId,
        },
        order: [
          ['is_active', 'DESC'],
          ['created_at', 'DESC'],
        ],
        transaction,
      });

      if (existingAssignment) {
        if (!existingAssignment.is_active) {
          await existingAssignment.update(
            {
              assignment_type: 'AIRCRAFT',
              aircraft_id: params.aircraftId,
              model_id: null,
              assignment_source: 'MANUAL',
              is_active: true,
            },
            { transaction }
          );

          return {
            complianceItem,
            assignment: existingAssignment,
            createdComplianceItem,
            createdAssignment: false,
            reactivatedAssignment: true,
            alreadyAssigned: false,
          };
        }

        return {
          complianceItem,
          assignment: existingAssignment,
          createdComplianceItem,
          createdAssignment: false,
          reactivatedAssignment: false,
          alreadyAssigned: true,
        };
      }

      const assignment = await ComplianceAssignment.create(
        {
          compliance_item_id: complianceItem.id,
          assignment_type: 'AIRCRAFT',
          aircraft_id: params.aircraftId,
          model_id: null,
          assignment_source: 'MANUAL',
          is_active: true,
        },
        { transaction }
      );

      return {
        complianceItem,
        assignment,
        createdComplianceItem,
        createdAssignment: true,
        reactivatedAssignment: false,
        alreadyAssigned: false,
      };
    });
  }

  static async createAdOperationalComplianceRecordFromAssignment(params: {
    aircraftId: string;
    assignmentId: string;
    actorUserId?: string | null;
    notes?: string | null;
  }) {
    void params.actorUserId;

    const aircraft = await Aircraft.findByPk(params.aircraftId, {
      attributes: ['id'],
    });

    if (!aircraft) {
      throw new Error('AIRCRAFT_NOT_FOUND');
    }

    const assignment = await ComplianceAssignment.findByPk(params.assignmentId, {
      include: [
        {
          model: ComplianceItem,
          as: 'ComplianceItem',
          required: false,
        },
      ],
    });

    if (!assignment) {
      throw new Error('AD_COMPLIANCE_ASSIGNMENT_NOT_FOUND');
    }

    if (assignment.assignment_type !== 'AIRCRAFT') {
      throw new Error('AD_COMPLIANCE_ASSIGNMENT_NOT_AIRCRAFT');
    }

    if (!assignment.is_active) {
      throw new Error('AD_COMPLIANCE_ASSIGNMENT_INACTIVE');
    }

    if (assignment.aircraft_id !== params.aircraftId) {
      throw new Error('AD_COMPLIANCE_ASSIGNMENT_AIRCRAFT_MISMATCH');
    }

    const complianceItem =
      (assignment as any).ComplianceItem ||
      (await ComplianceItem.findByPk(assignment.compliance_item_id));

    if (!complianceItem) {
      throw new Error('COMPLIANCE_ITEM_NOT_FOUND');
    }

    if (complianceItem.item_type !== 'AD' && complianceItem.source_type !== 'AD') {
      throw new Error('COMPLIANCE_ITEM_NOT_AD');
    }

    const notes = params.notes?.trim() || null;

    return sequelize.transaction(async (transaction) => {
      const existingRows = await sequelize.query<{ id: string }>(
        `
        SELECT id::text
        FROM aircraft_compliance
        WHERE aircraft_id = :aircraftId
          AND compliance_item_id = :complianceItemId
        LIMIT 1
        `,
        {
          replacements: {
            aircraftId: params.aircraftId,
            complianceItemId: complianceItem.id,
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );

      if (existingRows.length > 0) {
        throw new Error('AIRCRAFT_COMPLIANCE_ALREADY_EXISTS');
      }

      const createdRows = await sequelize.query<{ id: string }>(
        `
        INSERT INTO aircraft_compliance (
          aircraft_id,
          compliance_item_id,
          status,
          notes
        )
        VALUES (
          :aircraftId,
          :complianceItemId,
          'DUE',
          :notes
        )
        RETURNING id::text
        `,
        {
          replacements: {
            aircraftId: params.aircraftId,
            complianceItemId: complianceItem.id,
            notes,
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );

      return {
        aircraftComplianceId: createdRows[0]?.id || null,
        complianceItem,
        assignment,
        created: true,
      };
    });
  }

  static async updateAdOperationalComplianceStatus(params: {
    aircraftId: string;
    complianceId: string;
    status: string;
    actorUserId?: string | null;
    notes?: string | null;
    complianceMethod?: string | null;
  }) {
    const aircraft = await Aircraft.findByPk(params.aircraftId, {
      attributes: ['id'],
    });

    if (!aircraft) {
      throw new Error('AIRCRAFT_NOT_FOUND');
    }

    const targetStatus = String(params.status || '').trim().toUpperCase();

    if (!this.adComplianceStatuses.has(targetStatus)) {
      throw new Error('INVALID_AD_COMPLIANCE_STATUS');
    }

    const notesProvided = Object.prototype.hasOwnProperty.call(params, 'notes');
    const complianceMethodProvided = Object.prototype.hasOwnProperty.call(
      params,
      'complianceMethod'
    );

    return sequelize.transaction(async (transaction) => {
      const rows = await sequelize.query<{
        id: string;
        aircraft_id: string;
        compliance_item_id: string;
        status: string;
        notes: string | null;
        compliance_method: string | null;
        item_type: string | null;
        source_type: string | null;
      }>(
        `
        SELECT
          ac.id::text,
          ac.aircraft_id::text,
          ac.compliance_item_id::text,
          ac.status,
          ac.notes,
          ac.compliance_method,
          ci.item_type,
          ci.source_type
        FROM aircraft_compliance ac
        LEFT JOIN compliance_items ci
          ON ci.id = ac.compliance_item_id
        WHERE ac.id = :complianceId
        LIMIT 1
        FOR UPDATE OF ac
        `,
        {
          replacements: {
            complianceId: params.complianceId,
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      const row = rows[0];

      if (!row) {
        throw new Error('AIRCRAFT_COMPLIANCE_NOT_FOUND');
      }

      if (row.aircraft_id !== params.aircraftId) {
        throw new Error('AIRCRAFT_COMPLIANCE_AIRCRAFT_MISMATCH');
      }

      if (!row.item_type && !row.source_type) {
        throw new Error('COMPLIANCE_ITEM_NOT_FOUND');
      }

      if (row.item_type !== 'AD' && row.source_type !== 'AD') {
        throw new Error('COMPLIANCE_ITEM_NOT_AD');
      }

      if (
        row.status !== targetStatus &&
        !this.adComplianceStatusTransitions[row.status]?.includes(targetStatus)
      ) {
        throw new Error('INVALID_AD_COMPLIANCE_STATUS_TRANSITION');
      }

      const normalizedNotes = notesProvided
        ? (params.notes?.trim() || null)
        : row.notes;
      const normalizedComplianceMethod = complianceMethodProvided
        ? (params.complianceMethod?.trim() || null)
        : row.compliance_method;

      await sequelize.query(
        `
        UPDATE aircraft_compliance
        SET
          status = :status,
          notes = :notes,
          compliance_method = :complianceMethod,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = :complianceId
        `,
        {
          replacements: {
            complianceId: params.complianceId,
            status: targetStatus,
            notes: normalizedNotes,
            complianceMethod: normalizedComplianceMethod,
          },
          transaction,
        }
      );

      await AuditService.log(
        {
          table_name: 'aircraft_compliance',
          row_id: params.complianceId,
          action: 'AD_COMPLIANCE_STATUS_UPDATE',
          actor_id: params.actorUserId || null,
          reason: normalizedNotes,
          old_values: {
            aircraft_id: row.aircraft_id,
            compliance_item_id: row.compliance_item_id,
            status: row.status,
            notes: row.notes,
            compliance_method: row.compliance_method,
          },
          new_values: {
            aircraft_id: row.aircraft_id,
            compliance_item_id: row.compliance_item_id,
            status: targetStatus,
            notes: normalizedNotes,
            compliance_method: normalizedComplianceMethod,
          },
        },
        transaction
      );

      return {
        aircraftComplianceId: params.complianceId,
        complianceItemId: row.compliance_item_id,
        previousStatus: row.status,
        status: targetStatus,
        notes: normalizedNotes,
        complianceMethod: normalizedComplianceMethod,
      };
    });
  }

  static async markServiceBulletinComplied(aircraftId: string, serviceBulletinId: string) {
    return this.updateServiceBulletinCompliance({
      aircraft_id: aircraftId,
      service_bulletin_id: serviceBulletinId,
      status: 'COMPLIED'
    });
  }

  static async markServiceBulletinNotApplicable(aircraftId: string, serviceBulletinId: string) {
    return this.updateServiceBulletinCompliance({
      aircraft_id: aircraftId,
      service_bulletin_id: serviceBulletinId,
      status: 'NOT_APPLICABLE'
    });
  }
}

export default new AircraftService();
