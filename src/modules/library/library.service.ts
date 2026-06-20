/**
 * PATH: C:\GMO\Projects\jupiter\src\modules\library\library.service.ts
 * PURPOSE: Service for managing the component and requirement library.
 */

import { parse } from 'csv-parse/sync';
import {
  AssetType,
  Manufacturer,
  ComponentModel,
  MaintenanceRequirement,
  ServiceBulletin,
  ServiceBulletinModel,
  SupplementalInspectionDocument,
  SidModelApplicability,
  TaskTemplate,
  SerializedComponent,
  SerializedComponentLifeState,
  SerializedComponentMaintenanceEvent,
  ComponentLifeLimit,
  AircraftComponentInstallation,
  Aircraft,
  ComplianceAssignment,
  User,
} from '../../models/index.js';
import { Op, QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import { AirworthinessDirective } from '../../models/AirworthinessDirective.js';
import { ComplianceItem } from '../../models/ComplianceItem.js';
import { MaintenanceTemplate } from '../../models/MaintenanceTemplate.js';
import { MaintenanceTemplateItem } from '../../models/MaintenanceTemplateItem.js';
import { DueStatusService } from '../due-status/due-status.service.js';
import { formatModelDisplay } from '../../utils/model-display.js';

export class LibraryService {
  static readonly sbModelAllocationStatuses = [
    'MATCHED',
    'NEEDS_REVIEW',
    'LINKED_MANUALLY',
    'MODEL_CREATED_INCOMPLETE',
    'BROAD_RULE_MARKED',
    'IGNORED',
  ];

  static readonly sbModelAllocationClassifications = [
    'EXACT_MODEL_CODE',
    'SHORTHAND_GROUP',
    'BROAD_APPLICABILITY',
    'AMBIGUOUS_PHRASE',
    'UNPARSED_TEXT',
  ];

  static readonly sbModelAllocationReviewBuckets = [
    'LINK_EXISTING_OR_CREATE_INCOMPLETE',
    'PARSER_CANDIDATE_OR_MANUAL_SPLIT',
    'DIRTY_TEXT_MANUAL_REVIEW',
    'BROAD_RULE_REVIEW',
    'BROAD_OR_SERIES_REVIEW',
    'IGNORE_OR_MANUAL_PARSE',
  ];

  private static readonly serializedComponentMaintenanceEventGroupDefinitions = [
    {
      key: 'life_changes',
      title: 'Life Changes',
      eventTypes: ['LIFE_ADJUSTMENT', 'OVERHAUL'],
    },
    {
      key: 'repairs_modifications',
      title: 'Repairs / Modifications',
      eventTypes: ['REPAIR', 'MODIFICATION'],
    },
    {
      key: 'inspections_tests',
      title: 'Inspections / Tests',
      eventTypes: ['INSPECTION', 'TEST'],
    },
    {
      key: 'release_return_to_service',
      title: 'Release / Return to Service',
      eventTypes: ['RETURN_TO_SERVICE'],
    },
    {
      key: 'shop_preservation',
      title: 'Shop / Preservation',
      eventTypes: ['SHOP_VISIT', 'PRESERVATION'],
    },
    {
      key: 'imported_unknown_history',
      title: 'Imported / Unknown History',
      eventTypes: ['UNKNOWN_HISTORY_IMPORT'],
    },
    {
      key: 'scrap_retirement',
      title: 'Scrap / Retirement',
      eventTypes: ['SCRAP'],
    },
  ];

  static readonly serializedComponentGenericMaintenanceEventTypes = [
    'REPAIR',
    'INSPECTION',
    'SHOP_VISIT',
    'TEST',
    'MODIFICATION',
    'PRESERVATION',
    'RETURN_TO_SERVICE',
    'SCRAP',
    'UNKNOWN_HISTORY_IMPORT',
  ];

  private static readonly serializedComponentLifeLimitDueSoonThresholds = {
    hours: DueStatusService.defaultThresholds.hours,
    cycles: DueStatusService.defaultThresholds.cycles,
    calendarDays: DueStatusService.defaultThresholds.calendarDays,
  };

  static readonly serializedReconciliationBuckets = [
    'MATCHED',
    'LEGACY_ONLY',
    'SERIALIZED_ONLY',
    'MODEL_MISMATCH',
    'SERIAL_MISMATCH',
    'POSITION_MISMATCH',
    'INSTALLATION_CONFLICT',
    'LIFE_STATE_MISSING',
    'UNMAPPED',
  ];

  private static readonly sbModelAllocationReviewBucketSql = `
    CASE
      WHEN a.status <> 'NEEDS_REVIEW' THEN NULL
      WHEN a.classification = 'EXACT_MODEL_CODE' THEN 'LINK_EXISTING_OR_CREATE_INCOMPLETE'
      WHEN a.classification = 'BROAD_APPLICABILITY' THEN 'BROAD_RULE_REVIEW'
      WHEN a.classification = 'UNPARSED_TEXT' THEN 'IGNORE_OR_MANUAL_PARSE'
      WHEN a.classification = 'SHORTHAND_GROUP'
        AND (
          a.raw_models_affected_text ~* '\\y(ALL|SERIES|MANUFACTURED|PISTON|CLASSIC)\\y'
        )
        THEN 'BROAD_OR_SERIES_REVIEW'
      WHEN a.classification = 'SHORTHAND_GROUP'
        AND (
          a.raw_models_affected_text ~* '\\y(Inspection|Replacement|Modification|Assembly|Assy|Operation|Instructions|Repair|Placard)\\y'
          OR a.raw_models_affected_text ~* '\\y\\d{3,}[- ]\\d{2,}[A-Z0-9-]*\\y'
          OR a.raw_models_affected_text ~ '\\y\\d{1,2}/\\d{1,2}/\\d{2,4}\\y'
          OR a.raw_models_affected_text ~* '\\y(AD\\s*)?\\d{4}-\\d{2}-\\d{2}\\y'
          OR a.raw_models_affected_text ~ '\\y\\d{2}-\\d{2}-\\d{2}\\y'
          OR a.raw_models_affected_text ~* '\\yATA\\y'
        )
        THEN 'DIRTY_TEXT_MANUAL_REVIEW'
      WHEN a.classification = 'SHORTHAND_GROUP' THEN 'PARSER_CANDIDATE_OR_MANUAL_SPLIT'
      ELSE NULL
    END
  `;

  private static readonly manufacturerAttributes = [
    'id',
    'name',
    'code',
    'description',
    'website',
    'logo_url',
    'address_line_1',
    'address_line_2',
    'city',
    'state',
    'country',
    'postal_code',
    'current_owner',
    'is_active',
    'is_operational',
    'support_email',
    'support_phone',
    'notes',
  ];
  private static readonly componentModelAttributes = [
    'id',
    'manufacturer_id',
    'asset_type_id',
    'model_name',
    'model_code',
    'default_tbo_hours',
    'default_tbo_months',
    'service_interval_hours',
    'service_interval_months',
    'overhaul_interval_hours',
    'overhaul_interval_months',
    'maintenance_notes',
    'is_life_limited',
    'is_active',
  ];
  private static manufacturerColumnCache: Set<string> | null = null;

  private static async getManufacturerColumns() {
    if (this.manufacturerColumnCache) {
      return this.manufacturerColumnCache;
    }

    const definition = await sequelize.getQueryInterface().describeTable('manufacturers');
    this.manufacturerColumnCache = new Set(Object.keys(definition));
    return this.manufacturerColumnCache;
  }

  private static async getSelectableManufacturerAttributes() {
    const columns = await this.getManufacturerColumns();
    return this.manufacturerAttributes.filter((attribute) => columns.has(attribute));
  }

  private static async mapManufacturerPayload<T extends Record<string, any>>(data: T) {
    const columns = await this.getManufacturerColumns();

    return Object.fromEntries(
      Object.entries(data).filter(([key]) => columns.has(key))
    );
  }

  private static compliancePriority(value: string | null | undefined) {
    const normalized = (value || 'MANUAL').toUpperCase();

    if (normalized === 'MANDATORY') return 0;
    if (normalized === 'MANUAL') return 1;
    if (normalized === 'OPTIONAL') return 2;
    return 3;
  }

  private static pickFirstValue(record: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = record[key];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value).trim();
      }
    }

    return '';
  }

  private static pickFirstMatchingValue(
    record: Record<string, unknown>,
    predicate: (key: string) => boolean
  ) {
    for (const [key, value] of Object.entries(record)) {
      if (!predicate(key)) continue;
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value).trim();
      }
    }

    return '';
  }

  private static normalizeSidNumber(value: string | null | undefined) {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ');
  }

  private static normalizeSummary(value: string | null | undefined) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }

  private static parseInteger(value: unknown) {
    const normalized = String(value ?? '').trim();
    if (!normalized) return null;

    const parsed = Number.parseInt(normalized, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private static parseBoolean(value: unknown) {
    if (typeof value === 'boolean') return value;
    const normalized = String(value ?? '').trim().toLowerCase();
    return ['true', 'on', '1', 'yes'].includes(normalized);
  }

  /**
   * Fetch all asset types (AIRFRAME, ENGINE, etc.)
   */
  static async getAssetTypes() {
    return AssetType.findAll({
      order: [['code', 'ASC']],
    });
  }

  static async createAssetType(data: {
    code?: unknown;
    label?: unknown;
    description?: unknown;
    is_installable_on_aircraft?: unknown;
    is_required_for_aircraft?: unknown;
    required_quantity?: unknown;
    is_active?: unknown;
  }) {
    const code = String(data.code ?? '').trim().toUpperCase();
    const label = String(data.label ?? '').trim();
    const description = String(data.description ?? '').trim() || null;
    const isInstallable = this.parseBoolean(data.is_installable_on_aircraft);
    const requestedRequired = this.parseBoolean(data.is_required_for_aircraft);
    const isRequired = isInstallable ? requestedRequired : false;
    const parsedQuantity = this.parseInteger(data.required_quantity);
    const normalizedQuantity = parsedQuantity ?? 0;
    const requiredQuantity = isInstallable ? normalizedQuantity : 0;
    const isActive =
      data.is_active === undefined || data.is_active === null
        ? true
        : this.parseBoolean(data.is_active);

    if (!code) {
      throw new Error('Asset type code is required.');
    }

    if (!label) {
      throw new Error('Asset type label is required.');
    }

    if (String(data.required_quantity ?? '').trim() && parsedQuantity === null) {
      throw new Error('Required quantity must be a non-negative whole number.');
    }

    if (parsedQuantity !== null && String(parsedQuantity) !== String(data.required_quantity).trim()) {
      throw new Error('Required quantity must be a non-negative whole number.');
    }

    if (normalizedQuantity < 0) {
      throw new Error('Required quantity must be a non-negative whole number.');
    }

    if (isRequired && requiredQuantity <= 0) {
      throw new Error('Required aircraft asset types must have a required quantity greater than 0.');
    }

    const duplicate = await AssetType.findOne({ where: { code } });
    if (duplicate) {
      throw new Error('Asset type code already exists.');
    }

    try {
      return await AssetType.create({
        code,
        label,
        description,
        is_installable_on_aircraft: isInstallable,
        is_required_for_aircraft: isRequired,
        required_quantity: requiredQuantity,
        is_active: isActive,
        system_locked: false,
      });
    } catch (error: any) {
      if (error?.name === 'SequelizeUniqueConstraintError') {
        throw new Error('Asset type code already exists.');
      }

      throw error;
    }
  }

  /**
   * Fetch manufacturers that have models for a specific asset type.
   */
  static async getManufacturersByAssetType(assetTypeId: string) {
    return Manufacturer.findAll({
      include: [
        {
          model: ComponentModel,
          where: { asset_type_id: assetTypeId },
          attributes: [],
        },
      ],
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });
  }

  /**
   * Fetch models filtered by manufacturer + asset type.
   */
  static async getModelsByManufacturerAndAssetType(
    manufacturerId: string,
    assetTypeId: string
  ) {
    return ComponentModel.findAll({
      attributes: ['id', 'model_name', 'model_code', 'manufacturer_id', 'asset_type_id', 'is_active'],
      where: {
        manufacturer_id: manufacturerId,
        asset_type_id: assetTypeId,
      },
      order: [['model_name', 'ASC']],
    });
  }

  /**
   * Fetch single model by ID
   */
  static async getModelById(id: string) {
    return ComponentModel.findByPk(id, {
      attributes: [
        'id',
        'model_name',
        'model_code',
        'manufacturer_id',
        'asset_type_id',
        'default_tbo_hours',
        'default_tbo_months',
        'service_interval_hours',
        'service_interval_months',
        'overhaul_interval_hours',
        'overhaul_interval_months',
        'maintenance_notes',
        'is_life_limited',
        'is_active',
        'created_at',
      ],
      include: [
        {
          model: Manufacturer,
          attributes: ['id', 'name', 'code'],
          required: false,
        },
        {
          model: AssetType,
          attributes: ['id', 'code', 'label'],
          required: false,
        },
      ],
    });
  }

  /**
   * Fetch maintenance requirements for a model
   */
  static async getModelRequirements(modelId: string) {
    return MaintenanceRequirement.findAll({
      where: { model_id: modelId },
      order: [['interval_hours', 'ASC']],
    });
  }

  static async getModelServiceBulletins(modelId: string) {
    const bulletins = await ServiceBulletin.findAll({
      include: [
        {
          model: ComponentModel,
          as: 'ApplicableModels',
          where: { id: modelId },
          through: { attributes: [] },
          attributes: ['id', 'model_name'],
        },
      ],
      order: [['issued_on', 'DESC'], ['sb_number', 'ASC']],
    });

    return [...bulletins].sort(
      (left: any, right: any) =>
        this.compliancePriority(left.compliance_type) -
          this.compliancePriority(right.compliance_type) ||
        left.sb_number.localeCompare(right.sb_number)
    );
  }

  static async getModelSids(modelId: string) {
    return SupplementalInspectionDocument.findAll({
      include: [
        {
          model: SidModelApplicability,
          as: 'ModelApplicability',
          where: { model_id: modelId, is_active: true },
          attributes: [],
        },
      ],
      order: [['reference', 'ASC'], ['title', 'ASC']],
    });
  }

  static async getModelApplicabilityAssignments(modelId: string) {
    const [
      assignedAirworthinessDirectives,
      assignableAirworthinessDirectives,
      assignedSupplementalInspectionDocuments,
      assignableSupplementalInspectionDocuments,
      assignedStandardTasks,
      assignableStandardTasks,
    ] = await Promise.all([
      this.getAssignedAirworthinessDirectives(modelId),
      this.getAssignableAirworthinessDirectives(modelId),
      this.getAssignedSupplementalInspectionDocuments(modelId),
      this.getAssignableSupplementalInspectionDocuments(modelId),
      this.getAssignedStandardTasks(modelId),
      this.getAssignableStandardTasks(modelId),
    ]);

    return {
      assignedAirworthinessDirectives,
      assignableAirworthinessDirectives,
      assignedSupplementalInspectionDocuments,
      assignableSupplementalInspectionDocuments,
      assignedStandardTasks,
      assignableStandardTasks,
    };
  }

  private static async getAssignedAirworthinessDirectives(modelId: string) {
    return sequelize.query(
      `
      SELECT DISTINCT
        ad.id,
        ad.ad_number,
        ad.revision,
        ad.subject_heading,
        ad.status,
        ad.effective_date,
        ad.make,
        ad.model
      FROM compliance_assignments ca
      JOIN compliance_items ci
        ON ci.id = ca.compliance_item_id
      JOIN airworthiness_directives ad
        ON ad.id = ci.source_id
      WHERE ca.assignment_type = 'MODEL'
        AND ca.model_id = :modelId
        AND ca.is_active = TRUE
        AND ci.source_type = 'AD'
      ORDER BY ad.ad_number ASC, ad.revision ASC NULLS LAST
      `,
      {
        replacements: { modelId },
        type: QueryTypes.SELECT,
      }
    );
  }

  private static async getAssignableAirworthinessDirectives(modelId: string) {
    return sequelize.query(
      `
      SELECT
        ad.id,
        ad.ad_number,
        ad.revision,
        ad.subject_heading,
        ad.status,
        ad.effective_date,
        ad.make,
        ad.model
      FROM airworthiness_directives ad
      WHERE COALESCE(ad.is_active, TRUE) = TRUE
        AND NOT EXISTS (
          SELECT 1
          FROM compliance_assignments ca
          JOIN compliance_items ci
            ON ci.id = ca.compliance_item_id
          WHERE ca.assignment_type = 'MODEL'
            AND ca.model_id = :modelId
            AND ca.is_active = TRUE
            AND ci.source_type = 'AD'
            AND ci.source_id = ad.id
        )
      ORDER BY ad.ad_number ASC, ad.revision ASC NULLS LAST
      LIMIT 200
      `,
      {
        replacements: { modelId },
        type: QueryTypes.SELECT,
      }
    );
  }

  private static async getAssignedSupplementalInspectionDocuments(modelId: string) {
    return SupplementalInspectionDocument.findAll({
      include: [
        {
          model: SidModelApplicability,
          as: 'ModelApplicability',
          where: { model_id: modelId, is_active: true },
          attributes: [],
        },
      ],
      order: [['reference', 'ASC'], ['title', 'ASC']],
    });
  }

  private static async getAssignableSupplementalInspectionDocuments(modelId: string) {
    const assignedRows = await SidModelApplicability.findAll({
      where: { model_id: modelId, is_active: true },
      attributes: ['sid_id'],
      raw: true,
    });
    const assignedIds = assignedRows.map((row: any) => row.sid_id);

    return SupplementalInspectionDocument.findAll({
      where: {
        is_active: true,
        ...(assignedIds.length ? { id: { [Op.notIn]: assignedIds } } : {}),
      },
      order: [['reference', 'ASC'], ['title', 'ASC']],
      limit: 200,
    });
  }

  private static async getAssignedStandardTasks(modelId: string) {
    return TaskTemplate.findAll({
      where: {
        scope: 'MODEL',
        aircraft_model_id: modelId,
        is_active: true,
      },
      order: [['task_card_number', 'ASC'], ['title', 'ASC']],
    });
  }

  private static async getAssignableStandardTasks(modelId: string) {
    return TaskTemplate.findAll({
      where: {
        is_active: true,
        aircraft_id: null,
        [Op.or]: [
          { aircraft_model_id: null },
          { scope: { [Op.ne]: 'MODEL' } },
        ],
      },
      order: [['task_card_number', 'ASC'], ['title', 'ASC']],
      limit: 200,
    });
  }

  static async getAttachableServiceBulletins(modelId: string) {
    const model = await ComponentModel.findByPk(modelId, {
      attributes: ['id', 'manufacturer_id'],
    });

    if (!model) {
      return [];
    }

    const attachedRows = await ServiceBulletinModel.findAll({
      where: { model_id: modelId },
      attributes: ['service_bulletin_id'],
    });

    const attachedIds = attachedRows.map((row: any) => row.service_bulletin_id);

    const bulletins = await ServiceBulletin.findAll({
      ...(attachedIds.length
        ? {
            where: {
              id: { [Op.notIn]: attachedIds },
            },
          }
        : {}),
      include: [
        {
          model: ComponentModel,
          as: 'ApplicableModels',
          where: { manufacturer_id: model.manufacturer_id },
          through: { attributes: [] },
          attributes: ['id', 'model_name'],
        },
      ],
      order: [['sb_number', 'ASC']],
    });

    return [...bulletins].sort(
      (left: any, right: any) =>
        this.compliancePriority(left.compliance_type) -
          this.compliancePriority(right.compliance_type) ||
        left.sb_number.localeCompare(right.sb_number)
    );
  }

  static async getManufacturers() {
    const attributes = await this.getSelectableManufacturerAttributes();

    return Manufacturer.findAll({
      attributes,
      order: [['name', 'ASC']],
    });
  }

  static async getManufacturersWithModels() {
    const attributes = await this.getSelectableManufacturerAttributes();

    return Manufacturer.findAll({
      attributes,
      include: [
        {
          model: ComponentModel,
          attributes: ['id', 'model_name', 'model_code', 'manufacturer_id', 'asset_type_id', 'is_active'],
          required: false,
        },
      ],
      order: [['name', 'ASC'], [ComponentModel, 'model_name', 'ASC']],
    });
  }

  static async getStandardTasks() {
    return TaskTemplate.findAll({
      attributes: [
        'id',
        'title',
        'description',
        'source_type',
        'interval_hours',
        'interval_months',
        'model_applicability',
        'aircraft_applicability',
        'is_active',
        'created_at',
      ],
      order: [['created_at', 'DESC'], ['title', 'ASC']],
    });
  }

  static async getAirworthinessDirectives() {
    return AirworthinessDirective.findAll({
      attributes: [
        'id',
        'ad_number',
        'revision',
        'subject_heading',
        'status',
        'effective_date',
        'authority',
        'make',
        'model',
        'product_type',
        'product_subtype',
        'is_active',
        'created_at',
      ],
      order: [['created_at', 'DESC'], ['ad_number', 'ASC']],
    });
  }

  static async getServiceBulletins() {
    return ServiceBulletin.findAll({
      attributes: [
        'id',
        'manufacturer',
        'sb_number',
        'title',
        'issued_on',
        'revision',
        'status',
        'category',
        'applicability_make',
        'applicability_model',
        'is_active',
        'created_at',
      ],
      order: [['created_at', 'DESC'], ['manufacturer', 'ASC'], ['sb_number', 'ASC']],
    });
  }

  static async getComplianceItems() {
    return ComplianceItem.findAll({
      attributes: [
        'id',
        'source_type',
        'source_id',
        'code',
        'title',
        'description',
        'status',
        'issued_on',
        'effective_on',
        'created_at',
      ],
      order: [['created_at', 'DESC'], ['source_type', 'ASC'], ['code', 'ASC']],
    });
  }

  static async getMaintenanceTemplates() {
    return MaintenanceTemplate.findAll({
      attributes: [
        'id',
        'name',
        'template_type',
        'model_id',
        'interval_hours',
        'interval_months',
        'is_active',
        'created_at',
      ],
      include: [
        {
          model: ComponentModel,
          as: 'ComponentModel',
          attributes: ['id', 'model_name', 'model_code'],
          required: false,
        },
      ],
      order: [['created_at', 'DESC'], ['name', 'ASC']],
    });
  }

  static async getMaintenanceTemplateById(id: string) {
    return MaintenanceTemplate.findByPk(id, {
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
        'updated_at',
      ],
      include: [
        {
          model: ComponentModel,
          as: 'ComponentModel',
          attributes: ['id', 'model_name', 'model_code'],
          required: false,
        },
        {
          model: MaintenanceTemplateItem,
          as: 'Items',
          attributes: [
            'id',
            'template_id',
            'item_type',
            'item_id',
            'sequence_no',
            'is_required',
            'notes',
            'created_at',
            'updated_at',
          ],
          required: false,
        },
      ],
      order: [[{ model: MaintenanceTemplateItem, as: 'Items' }, 'sequence_no', 'ASC']],
    });
  }

  static async getSupplementalInspectionDocuments() {
    return SupplementalInspectionDocument.findAll({
      attributes: [
        'id',
        'manufacturer',
        'reference',
        'title',
        'category',
        'initial_interval_hours',
        'initial_interval_months',
        'repeat_interval_hours',
        'repeat_interval_months',
        'is_active',
        'created_at',
      ],
      include: [
        {
          model: SidModelApplicability,
          as: 'ModelApplicability',
          attributes: ['id'],
          required: false,
        },
      ],
      order: [['created_at', 'DESC'], ['manufacturer', 'ASC'], ['reference', 'ASC']],
    });
  }

  static async getSupplementalInspectionDocumentById(id: string) {
    return SupplementalInspectionDocument.findByPk(id, {
      attributes: [
        'id',
        'manufacturer',
        'reference',
        'title',
        'description',
        'category',
        'section_reference',
        'ata_chapter',
        'initial_interval_hours',
        'initial_interval_months',
        'repeat_interval_hours',
        'repeat_interval_months',
        'inspection_operation',
        'notes',
        'source_document',
        'is_active',
        'created_at',
        'updated_at',
      ],
      include: [
        {
          model: SidModelApplicability,
          as: 'ModelApplicability',
          attributes: ['id', 'sid_id', 'model_id', 'is_active', 'created_at', 'updated_at'],
          required: false,
          include: [
            {
              model: ComponentModel,
              as: 'ComponentModel',
              attributes: ['id', 'model_name', 'model_code', 'is_active'],
              required: false,
            },
          ],
        },
      ],
    });
  }

  static async getSerializedComponents() {
    return SerializedComponent.findAll({
      attributes: [
        'id',
        'component_model_id',
        'serial_number',
        'part_number',
        'status',
        'condition',
        'notes',
        'created_at',
      ],
      include: [
        {
          model: ComponentModel,
          as: 'ComponentModel',
          attributes: ['id', 'model_name', 'model_code'],
          required: false,
          include: [
            {
              model: Manufacturer,
              attributes: ['id', 'name', 'code'],
              required: false,
            },
            {
              model: AssetType,
              attributes: ['id', 'code', 'label'],
              required: false,
            },
          ],
        },
      ],
      order: [['created_at', 'DESC'], ['serial_number', 'ASC']],
    });
  }

  static async getSerializedComponentReconciliationReport() {
    const [legacyRows, serializedRows, totalSerializedComponentsResult] = await Promise.all([
      sequelize.query(
        `
          SELECT
            ac.id AS legacy_component_id,
            ac.aircraft_id,
            aircraft.registration AS aircraft_registration,
            ac.model_id AS legacy_model_id,
            ac.serial_number AS legacy_serial_number,
            ac.position_code AS legacy_position,
            ac.current_status AS legacy_status,
            ac.removed_at AS legacy_removed_at,
            cm.model_code AS legacy_model_code,
            cm.model_name AS legacy_model_name,
            cm.asset_type_id AS legacy_asset_type_id,
            at.code AS legacy_asset_type_code
          FROM aircraft_components ac
          LEFT JOIN aircraft
            ON aircraft.id = ac.aircraft_id
          LEFT JOIN component_models cm
            ON cm.id = ac.model_id
          LEFT JOIN rf_asset_type at
            ON at.id = cm.asset_type_id
          ORDER BY aircraft.registration ASC NULLS LAST, ac.position_code ASC NULLS LAST, ac.serial_number ASC NULLS LAST
        `,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `
          SELECT
            aci.id AS serialized_installation_id,
            aci.aircraft_id,
            aircraft.registration AS aircraft_registration,
            aci.position AS serialized_position,
            aci.removed_at AS serialized_removed_at,
            sc.id AS serialized_component_id,
            sc.component_model_id AS serialized_model_id,
            sc.serial_number AS serialized_serial_number,
            sc.status AS serialized_status,
            cm.model_code AS serialized_model_code,
            cm.model_name AS serialized_model_name,
            cm.asset_type_id AS serialized_asset_type_id,
            at.code AS serialized_asset_type_code,
            sls.id AS life_state_id
          FROM aircraft_component_installations aci
          JOIN serialized_components sc
            ON sc.id = aci.serialized_component_id
          LEFT JOIN aircraft
            ON aircraft.id = aci.aircraft_id
          LEFT JOIN component_models cm
            ON cm.id = sc.component_model_id
          LEFT JOIN rf_asset_type at
            ON at.id = cm.asset_type_id
          LEFT JOIN serialized_component_life_states sls
            ON sls.serialized_component_id = sc.id
          ORDER BY aircraft.registration ASC NULLS LAST, aci.position ASC NULLS LAST, sc.serial_number ASC NULLS LAST
        `,
        { type: QueryTypes.SELECT }
      ),
      sequelize.query(
        'SELECT COUNT(*)::int AS total_serialized_components FROM serialized_components',
        { type: QueryTypes.SELECT }
      ),
    ]);

    const activeLegacyRows = (legacyRows as any[]).filter((row) =>
      this.isActiveLegacyReconciliationRow(row)
    );
    const activeSerializedRows = (serializedRows as any[]).filter((row) =>
      !row.serialized_removed_at
    );
    const serializedByAircraft = activeSerializedRows.reduce((lookup, row) => {
      const key = this.normalizeReconciliationValue(row.aircraft_id);
      lookup[key] = lookup[key] || [];
      lookup[key].push(row);
      return lookup;
    }, {} as Record<string, any[]>);
    const usedSerializedInstallationIds = new Set<string>();
    const bucketCounts = this.buildEmptySerializedReconciliationBucketCounts();
    const detailRows: any[] = [];

    const legacyPositionCounts = this.countSerializedReconciliationKeys(
      activeLegacyRows.map((row) =>
        this.buildSerializedReconciliationKey(
          row.aircraft_id,
          row.legacy_position,
          row.legacy_asset_type_id
        )
      )
    );
    const serializedPositionCounts = this.countSerializedReconciliationKeys(
      activeSerializedRows.map((row) =>
        this.buildSerializedReconciliationKey(
          row.aircraft_id,
          row.serialized_position,
          row.serialized_asset_type_id
        )
      )
    );
    const legacySerialCounts = this.countSerializedReconciliationKeys(
      activeLegacyRows.map((row) =>
        this.buildSerializedReconciliationKey(row.aircraft_id, row.legacy_serial_number)
      )
    );
    const serializedSerialCounts = this.countSerializedReconciliationKeys(
      activeSerializedRows.map((row) =>
        this.buildSerializedReconciliationKey(row.aircraft_id, row.serialized_serial_number)
      )
    );

    for (const legacyRow of activeLegacyRows) {
      const aircraftKey = this.normalizeReconciliationValue(legacyRow.aircraft_id);
      const candidates = serializedByAircraft[aircraftKey] || [];
      const match = this.findSerializedReconciliationMatch(
        legacyRow,
        candidates,
        usedSerializedInstallationIds
      );
      const serializedRow = match?.row || null;

      if (serializedRow?.serialized_installation_id) {
        usedSerializedInstallationIds.add(String(serializedRow.serialized_installation_id));
      }

      const detailRow = this.buildSerializedReconciliationDetailRow(
        legacyRow,
        serializedRow,
        match?.basis || 'UNMAPPED',
        match?.confidence || 'NONE',
        legacyPositionCounts,
        serializedPositionCounts,
        legacySerialCounts,
        serializedSerialCounts
      );

      bucketCounts[detailRow.bucket] = (bucketCounts[detailRow.bucket] || 0) + 1;
      detailRows.push(detailRow);
    }

    for (const serializedRow of activeSerializedRows) {
      const serializedInstallationId = this.normalizeReconciliationValue(
        serializedRow.serialized_installation_id
      );

      if (usedSerializedInstallationIds.has(serializedInstallationId)) {
        continue;
      }

      const detailRow = this.buildSerializedReconciliationDetailRow(
        null,
        serializedRow,
        'SERIALIZED_ONLY',
        'NONE',
        legacyPositionCounts,
        serializedPositionCounts,
        legacySerialCounts,
        serializedSerialCounts
      );

      bucketCounts[detailRow.bucket] = (bucketCounts[detailRow.bucket] || 0) + 1;
      detailRows.push(detailRow);
    }

    const matchedCount = detailRows.filter((row) =>
      Boolean(row.legacy_component_id && row.serialized_component_id)
    ).length;
    const migrationReadyCount = detailRows.filter((row) => row.bucket === 'MATCHED').length;
    const readinessPercentage =
      detailRows.length > 0
        ? Number(((migrationReadyCount / detailRows.length) * 100).toFixed(1))
        : 100;
    const totalSerializedComponents =
      Number((totalSerializedComponentsResult as any[])?.[0]?.total_serialized_components || 0);

    return {
      generated_at: new Date().toISOString(),
      summary: {
        total_legacy_rows: (legacyRows as any[]).length,
        active_legacy_rows: activeLegacyRows.length,
        total_serialized_components: totalSerializedComponents,
        active_serialized_installations: activeSerializedRows.length,
        matched_count: matchedCount,
        migration_ready_count: migrationReadyCount,
        readiness_percentage: readinessPercentage,
      },
      bucket_counts: bucketCounts,
      details: detailRows,
      detailed_exceptions: detailRows.filter((row) => row.bucket !== 'MATCHED'),
      explanation:
        'Read-only reconciliation only. No mappings are persisted and no lifecycle, compliance, workpack, or SB records are changed.',
    };
  }

  private static isActiveLegacyReconciliationRow(row: any) {
    const status = this.normalizeReconciliationValue(row?.legacy_status).toUpperCase();

    if (row?.legacy_removed_at) {
      return false;
    }

    return status === 'INSTALLED' || status === 'QUARANTINED';
  }

  private static findSerializedReconciliationMatch(
    legacyRow: any,
    candidates: any[],
    usedSerializedInstallationIds: Set<string>
  ) {
    const available = candidates.filter((candidate) => {
      const id = this.normalizeReconciliationValue(candidate.serialized_installation_id);
      return !id || !usedSerializedInstallationIds.has(id);
    });
    const searchRows = available.length > 0 ? available : candidates;
    const serial = this.normalizeReconciliationValue(legacyRow.legacy_serial_number);
    const modelId = this.normalizeReconciliationValue(legacyRow.legacy_model_id);
    const position = this.normalizeReconciliationValue(legacyRow.legacy_position);
    const assetTypeId = this.normalizeReconciliationValue(legacyRow.legacy_asset_type_id);
    const bySerial = (row: any) =>
      serial &&
      this.normalizeReconciliationValue(row.serialized_serial_number) === serial;
    const byModel = (row: any) =>
      modelId &&
      this.normalizeReconciliationValue(row.serialized_model_id) === modelId;
    const byPosition = (row: any) =>
      position &&
      this.normalizeReconciliationValue(row.serialized_position) === position;
    const byAssetType = (row: any) =>
      assetTypeId &&
      this.normalizeReconciliationValue(row.serialized_asset_type_id) === assetTypeId;
    const matchDefinitions = [
      {
        basis: 'AIRCRAFT_SERIAL_MODEL',
        confidence: 'HIGH',
        predicate: (row: any) => bySerial(row) && byModel(row),
      },
      {
        basis: 'AIRCRAFT_SERIAL',
        confidence: 'MEDIUM',
        predicate: (row: any) => bySerial(row),
      },
      {
        basis: 'AIRCRAFT_POSITION_ASSET_MODEL',
        confidence: 'MEDIUM',
        predicate: (row: any) => byPosition(row) && byAssetType(row) && byModel(row),
      },
      {
        basis: 'AIRCRAFT_POSITION_ASSET',
        confidence: 'LOW',
        predicate: (row: any) => byPosition(row) && byAssetType(row),
      },
    ];

    for (const definition of matchDefinitions) {
      const row = searchRows.find(definition.predicate);

      if (row) {
        return {
          ...definition,
          row,
        };
      }
    }

    return null;
  }

  private static buildSerializedReconciliationDetailRow(
    legacyRow: any | null,
    serializedRow: any | null,
    matchBasis: string,
    confidence: string,
    legacyPositionCounts: Record<string, number>,
    serializedPositionCounts: Record<string, number>,
    legacySerialCounts: Record<string, number>,
    serializedSerialCounts: Record<string, number>
  ) {
    const conflictFlags = this.getSerializedReconciliationConflictFlags(
      legacyRow,
      serializedRow,
      legacyPositionCounts,
      serializedPositionCounts,
      legacySerialCounts,
      serializedSerialCounts
    );
    const bucket = this.getSerializedReconciliationBucket(
      legacyRow,
      serializedRow,
      conflictFlags,
      matchBasis
    );

    return {
      aircraft_registration:
        this.normalizeReconciliationValue(
          legacyRow?.aircraft_registration || serializedRow?.aircraft_registration
        ) || 'Unassigned',
      legacy_component_id: legacyRow?.legacy_component_id || null,
      serialized_component_id: serializedRow?.serialized_component_id || null,
      serialized_installation_id: serializedRow?.serialized_installation_id || null,
      legacy_model_id: legacyRow?.legacy_model_id || null,
      serialized_model_id: serializedRow?.serialized_model_id || null,
      legacy_model_display: this.formatSerializedReconciliationModel(
        legacyRow?.legacy_model_code,
        legacyRow?.legacy_model_name
      ),
      serialized_model_display: this.formatSerializedReconciliationModel(
        serializedRow?.serialized_model_code,
        serializedRow?.serialized_model_name
      ),
      legacy_asset_type_code: legacyRow?.legacy_asset_type_code || null,
      serialized_asset_type_code: serializedRow?.serialized_asset_type_code || null,
      legacy_serial_number: legacyRow?.legacy_serial_number || null,
      serialized_serial_number: serializedRow?.serialized_serial_number || null,
      legacy_position: legacyRow?.legacy_position || null,
      serialized_position: serializedRow?.serialized_position || null,
      bucket,
      confidence,
      match_basis: matchBasis,
      conflict_flags: conflictFlags,
    };
  }

  private static getSerializedReconciliationConflictFlags(
    legacyRow: any | null,
    serializedRow: any | null,
    legacyPositionCounts: Record<string, number>,
    serializedPositionCounts: Record<string, number>,
    legacySerialCounts: Record<string, number>,
    serializedSerialCounts: Record<string, number>
  ) {
    const flags: string[] = [];
    const legacyModel = this.normalizeReconciliationValue(legacyRow?.legacy_model_id);
    const serializedModel = this.normalizeReconciliationValue(serializedRow?.serialized_model_id);
    const legacySerial = this.normalizeReconciliationValue(legacyRow?.legacy_serial_number);
    const serializedSerial = this.normalizeReconciliationValue(serializedRow?.serialized_serial_number);
    const legacyPosition = this.normalizeReconciliationValue(legacyRow?.legacy_position);
    const serializedPosition = this.normalizeReconciliationValue(serializedRow?.serialized_position);
    const legacyPositionKey = this.buildSerializedReconciliationKey(
      legacyRow?.aircraft_id,
      legacyRow?.legacy_position,
      legacyRow?.legacy_asset_type_id
    );
    const serializedPositionKey = this.buildSerializedReconciliationKey(
      serializedRow?.aircraft_id,
      serializedRow?.serialized_position,
      serializedRow?.serialized_asset_type_id
    );
    const legacySerialKey = this.buildSerializedReconciliationKey(
      legacyRow?.aircraft_id,
      legacyRow?.legacy_serial_number
    );
    const serializedSerialKey = this.buildSerializedReconciliationKey(
      serializedRow?.aircraft_id,
      serializedRow?.serialized_serial_number
    );

    if (legacyRow && serializedRow && legacyModel && serializedModel && legacyModel !== serializedModel) {
      flags.push('MODEL_MISMATCH');
    }

    if (legacyRow && serializedRow && legacySerial && serializedSerial && legacySerial !== serializedSerial) {
      flags.push('SERIAL_MISMATCH');
    }

    if (legacyRow && serializedRow && legacyPosition && serializedPosition && legacyPosition !== serializedPosition) {
      flags.push('POSITION_MISMATCH');
    }

    if (legacyPositionKey && (legacyPositionCounts[legacyPositionKey] || 0) > 1) {
      flags.push('LEGACY_POSITION_CONFLICT');
    }

    if (serializedPositionKey && (serializedPositionCounts[serializedPositionKey] || 0) > 1) {
      flags.push('SERIALIZED_POSITION_CONFLICT');
    }

    if (legacySerialKey && (legacySerialCounts[legacySerialKey] || 0) > 1) {
      flags.push('LEGACY_SERIAL_DUPLICATE');
    }

    if (serializedSerialKey && (serializedSerialCounts[serializedSerialKey] || 0) > 1) {
      flags.push('SERIALIZED_SERIAL_DUPLICATE');
    }

    if (serializedRow && !serializedRow.life_state_id) {
      flags.push('LIFE_STATE_MISSING');
    }

    return flags;
  }

  private static getSerializedReconciliationBucket(
    legacyRow: any | null,
    serializedRow: any | null,
    conflictFlags: string[],
    matchBasis: string
  ) {
    if (conflictFlags.some((flag) => flag.includes('CONFLICT') || flag.includes('DUPLICATE'))) {
      return 'INSTALLATION_CONFLICT';
    }

    if (!legacyRow && serializedRow) {
      return 'SERIALIZED_ONLY';
    }

    if (legacyRow && !serializedRow) {
      const hasMappingSignals = Boolean(
        this.normalizeReconciliationValue(legacyRow.legacy_serial_number) ||
          this.normalizeReconciliationValue(legacyRow.legacy_position) ||
          this.normalizeReconciliationValue(legacyRow.legacy_model_id)
      );

      return hasMappingSignals ? 'LEGACY_ONLY' : 'UNMAPPED';
    }

    if (conflictFlags.includes('MODEL_MISMATCH')) {
      return 'MODEL_MISMATCH';
    }

    if (conflictFlags.includes('SERIAL_MISMATCH')) {
      return 'SERIAL_MISMATCH';
    }

    if (conflictFlags.includes('POSITION_MISMATCH')) {
      return 'POSITION_MISMATCH';
    }

    if (conflictFlags.includes('LIFE_STATE_MISSING')) {
      return 'LIFE_STATE_MISSING';
    }

    return 'MATCHED';
  }

  private static buildEmptySerializedReconciliationBucketCounts() {
    return this.serializedReconciliationBuckets.reduce((counts, bucket) => {
      counts[bucket] = 0;
      return counts;
    }, {} as Record<string, number>);
  }

  private static countSerializedReconciliationKeys(keys: string[]) {
    return keys.reduce((counts, key) => {
      if (!key) {
        return counts;
      }

      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
  }

  private static buildSerializedReconciliationKey(...parts: unknown[]) {
    const normalized = parts.map((part) => this.normalizeReconciliationValue(part));

    if (normalized.some((part) => !part)) {
      return '';
    }

    return normalized.join('|');
  }

  private static normalizeReconciliationValue(value: unknown) {
    return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
  }

  private static formatSerializedReconciliationModel(modelCode: unknown, modelName: unknown) {
    return formatModelDisplay({
      model_code: modelCode ? String(modelCode) : null,
      model_name: modelName ? String(modelName) : null,
    });
  }

  static async getSbModelApplicabilityAllocations(filters: {
    status?: string;
    classification?: string;
    reviewBucket?: string;
    search?: string;
    sort?: string;
    direction?: string;
  }) {
    const status = String(filters.status || '').trim().toUpperCase();
    const classification = String(filters.classification || '').trim().toUpperCase();
    const reviewBucket = String(filters.reviewBucket || '').trim().toUpperCase();
    const search = String(filters.search || '').trim();
    const sort = String(filters.sort || '').trim();
    const direction =
      String(filters.direction || '').trim().toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const sortColumns: Record<string, string> = {
      created_at: 'a.created_at',
      sb_reference: 'sb.reference',
      classification: 'a.classification',
      status: 'a.status',
    };
    const whereClauses: string[] = [];
    const replacements: Record<string, unknown> = {};

    if (this.sbModelAllocationStatuses.includes(status)) {
      whereClauses.push('a.status = :status');
      replacements.status = status;
    }

    if (this.sbModelAllocationClassifications.includes(classification)) {
      whereClauses.push('a.classification = :classification');
      replacements.classification = classification;
    }

    if (this.sbModelAllocationReviewBuckets.includes(reviewBucket)) {
      whereClauses.push(`${this.sbModelAllocationReviewBucketSql} = :reviewBucket`);
      replacements.reviewBucket = reviewBucket;
    }

    if (search) {
      whereClauses.push(`(
        sb.reference ILIKE :search
        OR sb.title ILIKE :search
        OR a.raw_models_affected_text ILIKE :search
        OR a.parsed_token ILIKE :search
      )`);
      replacements.search = `%${search}%`;
    }

    const orderBy = sortColumns[sort] || sortColumns.created_at;
    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    return sequelize.query(
      `
      SELECT
        a.id,
        a.service_bulletin_id,
        sb.reference AS sb_reference,
        sb.title AS sb_title,
        a.raw_models_affected_text,
        a.parsed_token,
        a.normalized_token,
        a.classification,
        a.status,
        ${this.sbModelAllocationReviewBucketSql} AS review_bucket,
        a.source_adapter,
        a.source_row,
        a.ignored_reason,
        a.created_at,
        a.reviewed_at,
        matched.model_name AS matched_model_name,
        allocated.model_name AS allocated_model_name,
        created.model_name AS created_model_name
      FROM sb_model_applicability_allocations a
      JOIN service_bulletins sb
        ON sb.id = a.service_bulletin_id
      LEFT JOIN component_models matched
        ON matched.id = a.matched_model_id
      LEFT JOIN component_models allocated
        ON allocated.id = a.allocated_model_id
      LEFT JOIN component_models created
        ON created.id = a.created_model_id
      ${whereSql}
      ORDER BY ${orderBy} ${direction}, sb.reference ASC, a.parsed_token ASC
      LIMIT 500
      `,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    );
  }

  static async getSbModelAllocationReviewBucketCounts() {
    return sequelize.query(
      `
      SELECT
        bucket.review_bucket,
        COUNT(*)::int AS count
      FROM (
        SELECT ${this.sbModelAllocationReviewBucketSql} AS review_bucket
        FROM sb_model_applicability_allocations a
      ) bucket
      WHERE bucket.review_bucket IS NOT NULL
      GROUP BY bucket.review_bucket
      ORDER BY bucket.review_bucket ASC
      `,
      {
        type: QueryTypes.SELECT,
      }
    );
  }

  static async getSbModelAllocationLinkOptions() {
    const models = await ComponentModel.findAll({
      attributes: ['id', 'model_name', 'model_code', 'is_active'],
      include: [
        {
          model: Manufacturer,
          attributes: ['id', 'name', 'code'],
          required: false,
        },
        {
          model: AssetType,
          attributes: ['id', 'code', 'label'],
          required: false,
        },
      ],
      order: [[Manufacturer, 'name', 'ASC'], ['model_name', 'ASC']],
      limit: 1000,
    });

    return models.map((model: any) => ({
      ...model.get({ plain: true }),
      display_name: formatModelDisplay(model),
    }));
  }

  static async linkSbModelAllocationToModels(
    allocationId: string,
    modelIds: string[],
    reviewedBy: string | null
  ) {
    const uniqueModelIds = Array.from(
      new Set((modelIds || []).map((id) => String(id || '').trim()).filter(Boolean))
    );

    if (!allocationId || uniqueModelIds.length === 0) {
      throw new Error('Select at least one model to link.');
    }

    return sequelize.transaction(async (transaction) => {
      const allocations = await sequelize.query<any>(
        `
        SELECT
          a.id,
          a.service_bulletin_id,
          a.raw_models_affected_text,
          a.metadata
        FROM sb_model_applicability_allocations a
        WHERE a.id = :allocationId
        FOR UPDATE
        `,
        {
          replacements: { allocationId },
          transaction,
          type: QueryTypes.SELECT,
        }
      );
      const allocation = allocations[0];

      if (!allocation) {
        throw new Error('SB model applicability allocation was not found.');
      }

      const selectedModels = await ComponentModel.findAll({
        attributes: ['id', 'model_name', 'model_code'],
        where: { id: { [Op.in]: uniqueModelIds } },
        transaction,
      });
      const selectedModelIds = selectedModels.map((model: any) => String(model.id));

      if (selectedModelIds.length !== uniqueModelIds.length) {
        throw new Error('One or more selected component models no longer exist.');
      }

      for (const modelId of selectedModelIds) {
        await sequelize.query(
          `
          INSERT INTO service_bulletin_models (
            service_bulletin_id,
            model_id
          ) VALUES (
            :serviceBulletinId,
            :modelId
          )
          ON CONFLICT (service_bulletin_id, model_id) DO NOTHING
          `,
          {
            replacements: {
              serviceBulletinId: allocation.service_bulletin_id,
              modelId,
            },
            transaction,
          }
        );
      }

      const existingMetadata =
        allocation.metadata && typeof allocation.metadata === 'object'
          ? allocation.metadata
          : {};
      const linkedModels = selectedModels.map((model: any) => ({
        id: model.id,
        model_name: model.model_name,
        model_code: model.model_code || null,
      }));

      await sequelize.query(
        `
        UPDATE sb_model_applicability_allocations
        SET
          status = 'LINKED_MANUALLY',
          allocated_model_id = :allocatedModelId,
          reviewed_by = :reviewedBy,
          reviewed_at = CURRENT_TIMESTAMP,
          metadata = CAST(:metadata AS jsonb),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = :allocationId
        `,
        {
          replacements: {
            allocationId,
            allocatedModelId: selectedModelIds.length === 1 ? selectedModelIds[0] : null,
            reviewedBy,
            metadata: JSON.stringify({
              ...existingMetadata,
              manual_linked_models: linkedModels,
              manual_linked_model_ids: selectedModelIds,
            }),
          },
          transaction,
        }
      );

      return {
        linkedCount: selectedModelIds.length,
        rawModelsAffectedText: allocation.raw_models_affected_text,
      };
    });
  }

  static async recheckExactSbModelAllocations(reviewedBy: string | null) {
    return sequelize.transaction(async (transaction) => {
      const allocations = await sequelize.query<any>(
        `
        SELECT
          a.id,
          a.service_bulletin_id,
          a.raw_models_affected_text,
          a.parsed_token,
          a.normalized_token,
          a.metadata
        FROM sb_model_applicability_allocations a
        WHERE a.status = 'NEEDS_REVIEW'
          AND a.classification = 'EXACT_MODEL_CODE'
          AND BTRIM(COALESCE(a.parsed_token, '')) <> ''
        ORDER BY a.created_at ASC NULLS LAST, a.id ASC
        FOR UPDATE
        `,
        {
          transaction,
          type: QueryTypes.SELECT,
        }
      );

      let scanned = 0;
      let matched = 0;
      let linked = 0;
      let noMatch = 0;
      let multipleMatches = 0;
      const samples: Array<{
        allocation_id: string;
        service_bulletin_id: string;
        parsed_token: string;
        model_code: string;
        model_name: string;
      }> = [];

      for (const allocation of allocations) {
        scanned += 1;
        const normalizedToken = String(allocation.parsed_token || '')
          .trim()
          .replace(/\s+/g, ' ')
          .toUpperCase();

        if (!normalizedToken) {
          noMatch += 1;
          continue;
        }

        const modelMatches = await sequelize.query<any>(
          `
          SELECT id::text AS id, model_code, model_name
          FROM component_models
          WHERE UPPER(BTRIM(model_code)) = :normalizedToken
          ORDER BY created_at ASC NULLS LAST, model_name ASC
          `,
          {
            replacements: { normalizedToken },
            transaction,
            type: QueryTypes.SELECT,
          }
        );

        if (modelMatches.length === 0) {
          noMatch += 1;
          continue;
        }

        if (modelMatches.length > 1) {
          multipleMatches += 1;
          continue;
        }

        const model = modelMatches[0];
        const insertResult = await sequelize.query<any>(
          `
          INSERT INTO service_bulletin_models (
            service_bulletin_id,
            model_id
          ) VALUES (
            :serviceBulletinId,
            :modelId
          )
          ON CONFLICT (service_bulletin_id, model_id) DO NOTHING
          RETURNING id
          `,
          {
            replacements: {
              serviceBulletinId: allocation.service_bulletin_id,
              modelId: model.id,
            },
            transaction,
            type: QueryTypes.SELECT,
          }
        );

        if (insertResult.length > 0) {
          linked += 1;
        }

        const existingMetadata =
          allocation.metadata && typeof allocation.metadata === 'object'
            ? allocation.metadata
            : {};

        await sequelize.query(
          `
          UPDATE sb_model_applicability_allocations
          SET
            status = 'MATCHED',
            matched_model_id = :modelId,
            reviewed_by = :reviewedBy,
            reviewed_at = CURRENT_TIMESTAMP,
            metadata = CAST(:metadata AS jsonb),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = :allocationId
          `,
          {
            replacements: {
              allocationId: allocation.id,
              modelId: model.id,
              reviewedBy,
              metadata: JSON.stringify({
                ...existingMetadata,
                exact_model_code_recheck: {
                  matched_model_id: model.id,
                  matched_model_code: model.model_code,
                  matched_model_name: model.model_name,
                  normalized_token: normalizedToken,
                  matched_at: new Date().toISOString(),
                },
              }),
            },
            transaction,
          }
        );

        matched += 1;

        if (samples.length < 10) {
          samples.push({
            allocation_id: allocation.id,
            service_bulletin_id: allocation.service_bulletin_id,
            parsed_token: allocation.parsed_token,
            model_code: model.model_code,
            model_name: model.model_name,
          });
        }
      }

      return {
        scanned,
        matched,
        linked,
        noMatch,
        multipleMatches,
        samples,
      };
    });
  }

  private static normalizeSbModelCodeToken(value: unknown) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }

  private static isUnsafeSbShorthandText(value: string) {
    return (
      /\b(?:ALL|SERIES|CLASSIC|PISTON|MANUFACTURED|ANY)\b/i.test(value) ||
      /\b(?:INSPECTION|REPLACEMENT|ASSEMBLY|MODIFICATION|REPAIR|PLACARD|DATED|AMENDED|INSTRUCTIONS|OPERATION|BRAZIL|COLT)\b/i.test(value) ||
      /\*\*/.test(value) ||
      /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(value) ||
      /\b\d{2}-\d{2}-\d{2}\b/.test(value) ||
      /\b\d{3}-\d{3}\b/.test(value) ||
      /(?:\uFFFD|\u00EF\u00BF\u00BD)/.test(value)
    );
  }

  private static expandCommaFamilyShorthand(text: string) {
    const normalizedText = this.normalizeSbModelCodeToken(text).replace(/\s*,\s*/g, ',');
    const parts = normalizedText.split(',').map((part) => part.trim()).filter(Boolean);

    if (parts.length < 2) {
      return [];
    }

    const firstPart = parts[0] || '';
    const firstMatch = firstPart.match(/^PA-([0-9]+)([A-Z]?)$/);

    if (!firstMatch) {
      return [];
    }

    const family = firstMatch[1];
    const tokens = [firstPart];

    for (const part of parts.slice(1)) {
      if (/^[0-9]+[A-Z]?$/.test(part)) {
        tokens.push(`PA-${part}`);
        continue;
      }

      if (/^[A-Z]+$/.test(part)) {
        tokens.push(`PA-${family}${part}`);
        continue;
      }

      return [];
    }

    return tokens;
  }

  private static expandHyphenSuffixShorthand(text: string) {
    const normalizedText = this.normalizeSbModelCodeToken(text).replace(/\s+/g, '');
    const parts = normalizedText.split('/').map((part) => part.trim()).filter(Boolean);

    if (parts.length < 2) {
      return [];
    }

    const firstPart = parts[0] || '';
    const firstMatch = firstPart.match(/^(PA-[A-Z0-9]+-)([0-9A-Z]+)$/);

    if (!firstMatch) {
      return [];
    }

    const base = firstMatch[1];
    const tokens = [firstPart];

    for (const part of parts.slice(1)) {
      const suffixMatch = part.match(/^-([0-9A-Z]+)$/);
      if (!suffixMatch) {
        return [];
      }

      tokens.push(`${base}${suffixMatch[1]}`);
    }

    return tokens;
  }

  private static expandSameFamilySlashShorthand(text: string) {
    const normalizedText = this.normalizeSbModelCodeToken(text).replace(/\s+/g, '');
    const parts = normalizedText.split('/').map((part) => part.trim()).filter(Boolean);

    if (parts.length < 2) {
      return [];
    }

    const firstPart = parts[0] || '';
    const firstMatch = firstPart.match(/^(PA-[A-Z0-9]+-)([0-9A-Z]+)$/);

    if (!firstMatch) {
      return [];
    }

    const base = firstMatch[1];
    const tokens = [firstPart];

    for (const part of parts.slice(1)) {
      if (!/^[0-9A-Z]+$/.test(part)) {
        return [];
      }

      tokens.push(`${base}${part}`);
    }

    return tokens;
  }

  private static expandPiperMixedFamilySlashShorthand(text: string) {
    const normalizedText = this.normalizeSbModelCodeToken(text).replace(/\s+/g, '');
    const parts = normalizedText.split('/').map((part) => part.trim()).filter(Boolean);

    if (parts.length < 2) {
      return [];
    }

    const firstPart = parts[0] || '';
    const firstMatch = firstPart.match(/^PA-([0-9]+)-[0-9A-Z]+$/);

    if (!firstMatch) {
      return [];
    }

    const family = firstMatch[1];
    const tokens = [firstPart];

    for (const part of parts.slice(1)) {
      if (new RegExp(`^${family}-[0-9A-Z]+$`).test(part)) {
        tokens.push(`PA-${part}`);
        continue;
      }

      if (new RegExp(`^[A-Z]${family}-[0-9A-Z]+$`).test(part)) {
        tokens.push(`PA-${part}`);
        continue;
      }

      return [];
    }

    return tokens;
  }

  private static expandSlashSeparatedKnownCodes(text: string, knownCodes: Set<string>) {
    const normalizedText = this.normalizeSbModelCodeToken(text).replace(/\s*\/\s*/g, '/');
    const parts = normalizedText.split('/').map((part) => part.trim()).filter(Boolean);

    if (parts.length < 2 || parts.some((part) => !knownCodes.has(part))) {
      return [];
    }

    return parts;
  }

  private static expandSpaceSeparatedKnownCodes(text: string, knownCodes: Set<string>) {
    const tokens = this.normalizeSbModelCodeToken(text).split(/\s+/).filter(Boolean);

    if (tokens.length < 2 || tokens.some((token) => !knownCodes.has(token))) {
      return [];
    }

    return tokens;
  }

  private static expandSafeSbShorthand(value: unknown, knownCodes: Set<string>) {
    const text = this.normalizeSbModelCodeToken(value);

    if (!text || this.isUnsafeSbShorthandText(text)) {
      return {
        expandedTokens: [] as string[],
        rejectedReason: !text ? 'EMPTY_TEXT' : 'UNSAFE_TEXT',
      };
    }

    const candidates = [
      this.expandCommaFamilyShorthand(text),
      this.expandHyphenSuffixShorthand(text),
      this.expandSameFamilySlashShorthand(text),
      this.expandPiperMixedFamilySlashShorthand(text),
      this.expandSlashSeparatedKnownCodes(text, knownCodes),
      this.expandSpaceSeparatedKnownCodes(text, knownCodes),
    ];

    const expandedTokens = Array.from(
      new Set(candidates.flat().map((token) => this.normalizeSbModelCodeToken(token)))
    ).filter(Boolean);

    if (expandedTokens.length === 0) {
      return {
        expandedTokens,
        rejectedReason: 'NO_SAFE_EXPANSION',
      };
    }

    return {
      expandedTokens,
      rejectedReason: null,
    };
  }

  static async expandSafeSbShorthandAllocations(reviewedBy: string | null) {
    return sequelize.transaction(async (transaction) => {
      const [allocations, modelRows] = await Promise.all([
        sequelize.query<any>(
          `
          SELECT
            a.id,
            a.service_bulletin_id,
            a.raw_models_affected_text,
            a.parsed_token,
            a.normalized_token,
            a.metadata,
            a.shorthand_expansions
          FROM sb_model_applicability_allocations a
          WHERE a.status = 'NEEDS_REVIEW'
            AND a.classification = 'SHORTHAND_GROUP'
            AND BTRIM(COALESCE(a.parsed_token, '')) <> ''
          ORDER BY a.created_at ASC NULLS LAST, a.id ASC
          FOR UPDATE
          `,
          {
            transaction,
            type: QueryTypes.SELECT,
          }
        ),
        sequelize.query<any>(
          `
          SELECT id::text AS id, model_code, model_name
          FROM component_models
          WHERE model_code IS NOT NULL
            AND BTRIM(model_code) <> ''
          ORDER BY model_code ASC, model_name ASC
          `,
          {
            transaction,
            type: QueryTypes.SELECT,
          }
        ),
      ]);

      const modelsByCode = new Map<string, any[]>();
      modelRows.forEach((model) => {
        const code = this.normalizeSbModelCodeToken(model.model_code);
        if (!code) return;
        const models = modelsByCode.get(code) || [];
        models.push(model);
        modelsByCode.set(code, models);
      });
      const knownCodes = new Set(modelsByCode.keys());
      const samples: Array<{
        allocation_id: string;
        service_bulletin_id: string;
        parsed_token: string;
        expanded_tokens: string[];
        matched_tokens: string[];
        unresolved_tokens: string[];
      }> = [];
      const unsafeExamples: Array<{
        allocation_id: string;
        parsed_token: string;
        reason: string;
      }> = [];
      let scanned = 0;
      let expanded = 0;
      let matchedAllocations = 0;
      let linked = 0;
      let partial = 0;
      let skippedUnsafe = 0;
      let skippedNoExpansion = 0;
      let skippedMultipleMatches = 0;

      for (const allocation of allocations) {
        scanned += 1;
        const expansion = this.expandSafeSbShorthand(allocation.parsed_token, knownCodes);

        if (expansion.expandedTokens.length === 0) {
          if (expansion.rejectedReason === 'UNSAFE_TEXT') {
            skippedUnsafe += 1;
          } else {
            skippedNoExpansion += 1;
          }

          if (unsafeExamples.length < 10) {
            unsafeExamples.push({
              allocation_id: allocation.id,
              parsed_token: allocation.parsed_token,
              reason: expansion.rejectedReason || 'NO_SAFE_EXPANSION',
            });
          }
          continue;
        }

        expanded += 1;
        const matchedModels = [];
        const unresolvedTokens: string[] = [];

        for (const token of expansion.expandedTokens) {
          const modelMatches = modelsByCode.get(token) || [];

          if (modelMatches.length === 1) {
            matchedModels.push({
              token,
              model: modelMatches[0],
            });
          } else {
            unresolvedTokens.push(token);
            if (modelMatches.length > 1) {
              skippedMultipleMatches += 1;
            }
          }
        }

        for (const match of matchedModels) {
          const insertResult = await sequelize.query<any>(
            `
            INSERT INTO service_bulletin_models (
              service_bulletin_id,
              model_id
            ) VALUES (
              :serviceBulletinId,
              :modelId
            )
            ON CONFLICT (service_bulletin_id, model_id) DO NOTHING
            RETURNING id
            `,
            {
              replacements: {
                serviceBulletinId: allocation.service_bulletin_id,
                modelId: match.model.id,
              },
              transaction,
              type: QueryTypes.SELECT,
            }
          );

          if (insertResult.length > 0) {
            linked += 1;
          }
        }

        const existingMetadata =
          allocation.metadata && typeof allocation.metadata === 'object'
            ? allocation.metadata
            : {};
        const shorthandExpansion = {
          parsed_token: allocation.parsed_token,
          expanded_tokens: expansion.expandedTokens,
          matched_tokens: matchedModels.map((match) => match.token),
          unresolved_tokens: unresolvedTokens,
          matched_models: matchedModels.map((match) => ({
            id: match.model.id,
            model_code: match.model.model_code,
            model_name: match.model.model_name,
            token: match.token,
          })),
          expanded_at: new Date().toISOString(),
        };
        const allMatched = matchedModels.length > 0 && unresolvedTokens.length === 0;

        await sequelize.query(
          `
          UPDATE sb_model_applicability_allocations
          SET
            status = :status,
            matched_model_id = :matchedModelId,
            reviewed_by = :reviewedBy,
            reviewed_at = CASE WHEN :allMatched THEN CURRENT_TIMESTAMP ELSE reviewed_at END,
            shorthand_expansions = CAST(:shorthandExpansions AS jsonb),
            metadata = CAST(:metadata AS jsonb),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = :allocationId
          `,
          {
            replacements: {
              allocationId: allocation.id,
              status: allMatched ? 'MATCHED' : 'NEEDS_REVIEW',
              matchedModelId: matchedModels.length === 1 ? matchedModels[0]?.model.id || null : null,
              reviewedBy,
              allMatched,
              shorthandExpansions: JSON.stringify([shorthandExpansion]),
              metadata: JSON.stringify({
                ...existingMetadata,
                safe_shorthand_expansion: shorthandExpansion,
              }),
            },
            transaction,
          }
        );

        if (allMatched) {
          matchedAllocations += 1;
        } else {
          partial += 1;
        }

        if (samples.length < 10) {
          samples.push({
            allocation_id: allocation.id,
            service_bulletin_id: allocation.service_bulletin_id,
            parsed_token: allocation.parsed_token,
            expanded_tokens: expansion.expandedTokens,
            matched_tokens: matchedModels.map((match) => match.token),
            unresolved_tokens: unresolvedTokens,
          });
        }
      }

      return {
        scanned,
        expanded,
        matchedAllocations,
        linked,
        partial,
        skippedUnsafe,
        skippedNoExpansion,
        skippedMultipleMatches,
        samples,
        unsafeExamples,
      };
    });
  }

  static async ignoreSbModelAllocation(
    allocationId: string,
    ignoredReason: string,
    reviewedBy: string | null
  ) {
    const reason = String(ignoredReason || '').trim();

    if (!allocationId) {
      throw new Error('SB model applicability allocation was not found.');
    }

    if (!reason) {
      throw new Error('Ignore reason is required.');
    }

    const [updatedCount] = await sequelize.query(
      `
      UPDATE sb_model_applicability_allocations
      SET
        status = 'IGNORED',
        ignored_reason = :reason,
        reviewed_by = :reviewedBy,
        reviewed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = :allocationId
      RETURNING id
      `,
      {
        replacements: {
          allocationId,
          reason,
          reviewedBy,
        },
        type: QueryTypes.UPDATE,
      }
    );

    if (Number(updatedCount || 0) === 0) {
      throw new Error('SB model applicability allocation was not found.');
    }
  }

  private static async findSbAllocationDefaultAssetType(transaction: any) {
    const assetType = await AssetType.findOne({
      where: { code: 'AIRFRAME' },
      transaction,
    });

    if (!assetType) {
      throw new Error('AIRFRAME asset type is required before creating incomplete aircraft models.');
    }

    return assetType;
  }

  private static async findSbAllocationManufacturer(
    manufacturerName: string,
    transaction: any
  ) {
    const normalizedManufacturer = String(manufacturerName || '').trim() || 'Piper';
    const manufacturer = await Manufacturer.findOne({
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: normalizedManufacturer } },
          { code: normalizedManufacturer.toUpperCase() },
        ],
      },
      transaction,
    });

    if (!manufacturer) {
      throw new Error(
        `Manufacturer ${normalizedManufacturer} must exist before creating incomplete models.`
      );
    }

    return manufacturer;
  }

  static async createIncompleteModelFromSbAllocation(
    allocationId: string,
    proposedModelCode: string,
    proposedModelName: string,
    reviewedBy: string | null
  ) {
    const modelCode = String(proposedModelCode || '').trim().replace(/\s+/g, ' ');
    const modelName = String(proposedModelName || '').trim().replace(/\s+/g, ' ');

    if (!allocationId) {
      throw new Error('SB model applicability allocation was not found.');
    }

    if (!modelCode) {
      throw new Error('Model code is required.');
    }

    const displayName = modelName || modelCode;

    return sequelize.transaction(async (transaction) => {
      const allocations = await sequelize.query<any>(
        `
        SELECT
          a.id,
          a.service_bulletin_id,
          a.raw_models_affected_text,
          a.parsed_token,
          a.normalized_token,
          a.classification,
          a.metadata,
          sb.reference,
          sb.title,
          sb.manufacturer
        FROM sb_model_applicability_allocations a
        JOIN service_bulletins sb
          ON sb.id = a.service_bulletin_id
        WHERE a.id = :allocationId
        FOR UPDATE
        `,
        {
          replacements: { allocationId },
          transaction,
          type: QueryTypes.SELECT,
        }
      );
      const allocation = allocations[0];

      if (!allocation) {
        throw new Error('SB model applicability allocation was not found.');
      }

      const [manufacturer, assetType] = await Promise.all([
        this.findSbAllocationManufacturer(allocation.manufacturer, transaction),
        this.findSbAllocationDefaultAssetType(transaction),
      ]);

      const existingModels = await sequelize.query<any>(
        `
        SELECT id::text AS id, model_name, model_code, maintenance_notes
        FROM component_models
        WHERE manufacturer_id = :manufacturerId
          AND asset_type_id = :assetTypeId
          AND (
            UPPER(BTRIM(model_code)) = UPPER(BTRIM(:modelCode))
            OR UPPER(BTRIM(model_name)) = UPPER(BTRIM(:modelCode))
          )
        ORDER BY created_at ASC NULLS LAST
        LIMIT 1
        `,
        {
          replacements: {
            manufacturerId: manufacturer.id,
            assetTypeId: assetType.id,
            modelCode,
          },
          transaction,
          type: QueryTypes.SELECT,
        }
      );

      let modelId = existingModels[0]?.id || null;
      let created = false;

      if (!modelId) {
        const note = [
          'Incomplete model created from SB model applicability allocation.',
          `SB: ${allocation.reference}`,
          `Raw Models Affected: ${allocation.raw_models_affected_text}`,
          `Parsed token: ${allocation.parsed_token || '-'}`,
          `Model code: ${modelCode}`,
          `Display name: ${displayName}`,
          `Created: ${new Date().toISOString()}`,
        ].join('\n');
        const createdModel = await ComponentModel.create(
          {
            manufacturer_id: manufacturer.id,
            asset_type_id: assetType.id,
            model_name: displayName,
            model_code: modelCode,
            maintenance_notes: note,
            is_life_limited: false,
            is_active: true,
          },
          { transaction }
        );

        modelId = createdModel.id;
        created = true;
      }

      await sequelize.query(
        `
        INSERT INTO service_bulletin_models (
          service_bulletin_id,
          model_id
        ) VALUES (
          :serviceBulletinId,
          :modelId
        )
        ON CONFLICT (service_bulletin_id, model_id) DO NOTHING
        `,
        {
          replacements: {
            serviceBulletinId: allocation.service_bulletin_id,
            modelId,
          },
          transaction,
        }
      );

      const existingMetadata =
        allocation.metadata && typeof allocation.metadata === 'object'
          ? allocation.metadata
          : {};

      await sequelize.query(
        `
        UPDATE sb_model_applicability_allocations
        SET
          status = 'MODEL_CREATED_INCOMPLETE',
          created_model_id = :modelId,
          reviewed_by = :reviewedBy,
          reviewed_at = CURRENT_TIMESTAMP,
          metadata = CAST(:metadata AS jsonb),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = :allocationId
        `,
        {
          replacements: {
            allocationId,
            modelId,
            reviewedBy,
            metadata: JSON.stringify({
              ...existingMetadata,
              incomplete_model_action: {
                model_id: modelId,
                model_code: modelCode,
                model_name: displayName,
                manufacturer_id: manufacturer.id,
                manufacturer_name: manufacturer.name,
                asset_type_id: assetType.id,
                asset_type_code: assetType.code,
                created_new_model: created,
              },
            }),
          },
          transaction,
        }
      );

      return {
        modelId,
        modelName: displayName,
        modelCode,
        created,
      };
    });
  }

  static async getSerializedComponentById(id: string) {
    return SerializedComponent.findByPk(id, {
      attributes: [
        'id',
        'component_model_id',
        'serial_number',
        'part_number',
        'status',
        'condition',
        'notes',
        'created_at',
        'updated_at',
      ],
      include: [
        {
          model: ComponentModel,
          as: 'ComponentModel',
          attributes: ['id', 'model_name', 'model_code'],
          required: false,
          include: [
            {
              model: Manufacturer,
              attributes: ['id', 'name', 'code'],
              required: false,
            },
            {
              model: AssetType,
              attributes: ['id', 'code', 'label'],
              required: false,
            },
          ],
        },
        {
          model: AircraftComponentInstallation,
          as: 'Installations',
          attributes: ['id', 'aircraft_id', 'position', 'installed_at', 'removed_at'],
          where: { removed_at: null },
          required: false,
          include: [
            {
              model: Aircraft,
              as: 'Aircraft',
              attributes: ['id', 'registration', 'status'],
              required: false,
            },
          ],
        },
        {
          model: SerializedComponentLifeState,
          as: 'LifeState',
          required: false,
        },
        {
          model: SerializedComponentMaintenanceEvent,
          as: 'MaintenanceEvents',
          required: false,
          limit: 10,
          order: [['occurred_at', 'DESC']],
        },
      ],
    });
  }

  static async getSerializedComponentLifeDashboard(id: string) {
    const serializedComponentId = String(id || '').trim();

    if (!serializedComponentId) {
      return null;
    }

    const serializedComponent = await SerializedComponent.findByPk(serializedComponentId, {
      attributes: [
        'id',
        'component_model_id',
        'serial_number',
        'part_number',
        'status',
        'condition',
        'notes',
        'created_at',
        'updated_at',
      ],
      include: [
        {
          model: ComponentModel,
          as: 'ComponentModel',
          attributes: ['id', 'model_name', 'model_code'],
          required: false,
          include: [
            {
              model: Manufacturer,
              attributes: ['id', 'name', 'code'],
              required: false,
            },
            {
              model: AssetType,
              attributes: ['id', 'code', 'label'],
              required: false,
            },
            {
              model: ComponentLifeLimit,
              as: 'LifeLimits',
              required: false,
            },
          ],
        },
      ],
    });

    if (!serializedComponent) {
      return null;
    }

    const [installations, lifeState, lifeAdjustmentEvents, maintenanceEvents] = await Promise.all([
      AircraftComponentInstallation.findAll({
        where: { serialized_component_id: serializedComponentId },
        include: [
          {
            model: Aircraft,
            as: 'Aircraft',
            attributes: ['id', 'registration', 'serial_number', 'status'],
            required: false,
          },
        ],
        order: [
          ['installed_at', 'DESC'],
          ['created_at', 'DESC'],
        ],
      }),
      SerializedComponentLifeState.findOne({
        where: { serialized_component_id: serializedComponentId },
      }),
      SerializedComponentMaintenanceEvent.findAll({
        where: {
          serialized_component_id: serializedComponentId,
          event_type: 'LIFE_ADJUSTMENT',
        },
        include: [
          {
            model: User,
            as: 'Recorder',
            attributes: ['id', 'full_name', 'email'],
            required: false,
          },
        ],
        order: [
          ['occurred_at', 'DESC'],
          ['created_at', 'DESC'],
        ],
      }),
      SerializedComponentMaintenanceEvent.findAll({
        where: { serialized_component_id: serializedComponentId },
        include: [
          {
            model: User,
            as: 'Recorder',
            attributes: ['id', 'full_name', 'email'],
            required: false,
          },
        ],
        order: [
          ['occurred_at', 'DESC'],
          ['created_at', 'DESC'],
        ],
      }),
    ]);

    const currentInstallation =
      installations.find((installation: any) => !installation.removed_at) || null;
    const componentModel = (serializedComponent as any).ComponentModel || null;
    const maintenanceEventGroups =
      this.groupSerializedComponentMaintenanceEvents(maintenanceEvents);
    const lifeLimits = componentModel?.LifeLimits || [];
    const dueStatus = this.evaluateSerializedComponentLifeLimits(lifeLimits, lifeState);
    const applicableServiceBulletins = componentModel?.id
      ? await ServiceBulletin.findAll({
          where: {
            is_active: true,
            status: 'ACTIVE',
          },
          include: [
            {
              model: ComponentModel,
              as: 'ApplicableModels',
              where: { id: componentModel.id },
              through: { attributes: [] },
              attributes: ['id', 'model_code', 'model_name'],
              required: true,
            },
          ],
          order: [
            ['sb_number', 'ASC'],
            ['title', 'ASC'],
          ],
        })
      : [];

    return {
      serializedComponent,
      componentModel,
      currentInstallation,
      installationHistory: installations,
      lifeState,
      lifeAdjustmentEvents,
      maintenanceEvents,
      maintenanceEventGroups,
      lifeLimits,
      dueStatus,
      complianceVisibility: {
        currentAircraft: currentInstallation?.Aircraft || null,
        dueStatus,
        applicableServiceBulletins,
        maintenanceEvents,
        maintenanceEventCount: maintenanceEvents.length,
        explanation:
          'Read-only derived visibility only. This panel does not create or complete compliance records.',
      },
    };
  }

  private static parseOptionalDecimal(value: unknown, label: string) {
    const normalized = String(value ?? '').trim();

    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);

    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`${label} must be a non-negative number.`);
    }

    return parsed;
  }

  private static parseOptionalInteger(value: unknown, label: string) {
    const normalized = String(value ?? '').trim();

    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);

    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error(`${label} must be a non-negative whole number.`);
    }

    return parsed;
  }

  private static parseOptionalDate(value: unknown, label: string) {
    const normalized = String(value ?? '').trim();

    if (!normalized) {
      return null;
    }

    if (Number.isNaN(new Date(normalized).getTime())) {
      throw new Error(`${label} must be a valid date.`);
    }

    return normalized;
  }

  private static lifeStateSnapshot(lifeState: any) {
    return {
      tsn_hours: lifeState?.tsn_hours ?? null,
      tso_hours: lifeState?.tso_hours ?? null,
      csn_cycles: lifeState?.csn_cycles ?? null,
      cso_cycles: lifeState?.cso_cycles ?? null,
      overhaul_reference_date: lifeState?.overhaul_reference_date ?? null,
      calendar_reference_date: lifeState?.calendar_reference_date ?? null,
    };
  }

  private static normalizeSerializedComponentLifeLimitBasis(limit: any) {
    const basis = String(limit?.basis || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    const searchable = [
      basis,
      String(limit?.limit_type || '').trim().toUpperCase().replace(/[\s-]+/g, '_'),
      String(limit?.description || '').trim().toUpperCase().replace(/[\s-]+/g, '_'),
    ].filter(Boolean).join(' ');

    if (/\b(ON_CONDITION|CONDITION|OC|INSPECT_CONDITION)\b/.test(searchable)) {
      return 'ON_CONDITION';
    }

    if (/\b(CALENDAR|MONTHS|DATE|EXPIRY|ELAPSED|TIME_LIMIT_DATE)\b/.test(searchable)) {
      return 'CALENDAR';
    }

    if (/\b(SINCE_OVERHAUL|TSO|CSO|TBO|SMOH|SOH|OVERHAUL|TIME_SINCE_OVERHAUL|CYCLES_SINCE_OVERHAUL)\b/.test(searchable)) {
      return 'SINCE_OVERHAUL';
    }

    if (/\b(SINCE_NEW|TSN|CSN|TOTAL|TOTAL_TIME|TOTAL_CYCLES|LIFE_LIMIT)\b/.test(searchable)) {
      return 'SINCE_NEW';
    }

    return 'UNKNOWN';
  }

  private static numericLifeValue(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private static wholeLifeValue(value: unknown) {
    const parsed = this.numericLifeValue(value);
    return parsed === null ? null : Math.trunc(parsed);
  }

  private static startOfUtcDay(value: Date) {
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }

  private static addMonthsToDate(dateValue: string, months: number) {
    const date = new Date(`${dateValue}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    date.setUTCMonth(date.getUTCMonth() + months);
    return date.toISOString().slice(0, 10);
  }

  private static remainingDaysUntil(dateValue: string, today: Date) {
    const dueDate = new Date(`${dateValue}T00:00:00.000Z`);

    if (Number.isNaN(dueDate.getTime())) {
      return null;
    }

    return Math.ceil((this.startOfUtcDay(dueDate) - this.startOfUtcDay(today)) / 86400000);
  }

  private static statusForRemaining(value: number, threshold: number) {
    return DueStatusService.statusForRemaining(value, threshold);
  }

  private static worstLifeLimitStatus(statuses: string[]) {
    return DueStatusService.mostRestrictiveStatus(statuses);
  }

  static evaluateSerializedComponentLifeLimits(
    lifeLimits: any[],
    lifeState: any,
    todayInput: Date | string = new Date()
  ) {
    const today = todayInput instanceof Date ? todayInput : new Date(`${todayInput}T00:00:00.000Z`);
    const activeLimits = (lifeLimits || []).filter((limit) => limit?.is_active !== false);
    const evaluatedLimits: any[] = [];
    const aggregateReasons: string[] = [];

    if (activeLimits.length === 0) {
      return {
        state: 'UNKNOWN',
        explanation: 'No active life limits defined.',
        worstLimit: null,
        has_unknown_limits: true,
        is_partial: false,
        reasons: ['No active life limits defined.'],
        thresholds: this.serializedComponentLifeLimitDueSoonThresholds,
        evaluatedLimits,
      };
    }

    if (!lifeState) {
      return {
        state: 'UNKNOWN',
        explanation: 'No serialized component life state recorded.',
        worstLimit: null,
        has_unknown_limits: true,
        is_partial: false,
        reasons: ['No serialized component life state recorded.'],
        thresholds: this.serializedComponentLifeLimitDueSoonThresholds,
        evaluatedLimits: activeLimits.map((limit) => ({
          id: limit.id,
          limit_type: limit.limit_type,
          basis: limit.basis,
          normalized_basis: this.normalizeSerializedComponentLifeLimitBasis(limit),
          status: 'UNKNOWN',
          remaining_hours: null,
          remaining_cycles: null,
          remaining_calendar_days: null,
          due_date: null,
          missing_reasons: ['No serialized component life state recorded.'],
          description: limit.description || null,
        })),
      };
    }

    for (const limit of activeLimits) {
      const normalizedBasis = this.normalizeSerializedComponentLifeLimitBasis(limit);
      const limitHours = this.numericLifeValue(limit.limit_hours);
      const limitCycles = this.wholeLifeValue(limit.limit_cycles);
      const limitMonths = this.wholeLifeValue(limit.limit_months);
      const missingReasons: string[] = [];
      const dimensionStatuses: string[] = [];
      const evaluated: any = {
        id: limit.id,
        limit_type: limit.limit_type,
        basis: limit.basis,
        normalized_basis: normalizedBasis,
        status: 'UNKNOWN',
        remaining_hours: null,
        remaining_cycles: null,
        remaining_calendar_days: null,
        due_date: null,
        current_hours: null,
        current_cycles: null,
        reference_date: null,
        missing_reasons: missingReasons,
        description: limit.description || null,
      };

      if (normalizedBasis === 'ON_CONDITION') {
        missingReasons.push('On-condition item; remaining life is not calculated.');
        evaluatedLimits.push(evaluated);
        continue;
      }

      if (normalizedBasis === 'UNKNOWN') {
        missingReasons.push('Life-limit basis could not be mapped to a controlled basis.');
        evaluatedLimits.push(evaluated);
        continue;
      }

      if (limitHours !== null) {
        const currentHours =
          normalizedBasis === 'SINCE_NEW'
            ? this.numericLifeValue(lifeState.tsn_hours)
            : normalizedBasis === 'SINCE_OVERHAUL'
              ? this.numericLifeValue(lifeState.tso_hours)
              : null;

        evaluated.current_hours = currentHours;

        if (currentHours === null) {
          missingReasons.push(`Missing current hours for ${normalizedBasis}.`);
        } else {
          evaluated.remaining_hours = Number((limitHours - currentHours).toFixed(2));
          dimensionStatuses.push(
            this.statusForRemaining(
              evaluated.remaining_hours,
              this.serializedComponentLifeLimitDueSoonThresholds.hours
            )
          );
        }
      }

      if (limitCycles !== null) {
        const currentCycles =
          normalizedBasis === 'SINCE_NEW'
            ? this.wholeLifeValue(lifeState.csn_cycles)
            : normalizedBasis === 'SINCE_OVERHAUL'
              ? this.wholeLifeValue(lifeState.cso_cycles)
              : null;

        evaluated.current_cycles = currentCycles;

        if (currentCycles === null) {
          missingReasons.push(`Missing current cycles for ${normalizedBasis}.`);
        } else {
          evaluated.remaining_cycles = limitCycles - currentCycles;
          dimensionStatuses.push(
            this.statusForRemaining(
              evaluated.remaining_cycles,
              this.serializedComponentLifeLimitDueSoonThresholds.cycles
            )
          );
        }
      }

      if (limitMonths !== null) {
        const limitTypeText = `${String(limit.limit_type || '')} ${String(limit.basis || '')}`.toUpperCase();
        const referenceDate =
          normalizedBasis === 'SINCE_OVERHAUL' || /\b(TBO|OVERHAUL|TSO|CSO)\b/.test(limitTypeText)
            ? lifeState.overhaul_reference_date
            : lifeState.calendar_reference_date || lifeState.overhaul_reference_date;

        evaluated.reference_date = referenceDate || null;

        if (!referenceDate) {
          missingReasons.push('Missing calendar reference date for calendar calculation.');
        } else {
          evaluated.due_date = this.addMonthsToDate(referenceDate, limitMonths);
          evaluated.remaining_calendar_days = evaluated.due_date
            ? this.remainingDaysUntil(evaluated.due_date, today)
            : null;

          if (evaluated.remaining_calendar_days === null) {
            missingReasons.push('Calendar due date could not be calculated.');
          } else {
            dimensionStatuses.push(
              this.statusForRemaining(
                evaluated.remaining_calendar_days,
                this.serializedComponentLifeLimitDueSoonThresholds.calendarDays
              )
            );
          }
        }
      }

      if (limitHours === null && limitCycles === null && limitMonths === null) {
        missingReasons.push('No limit hours, cycles, or months defined.');
      }

      evaluated.status = dimensionStatuses.length
        ? this.worstLifeLimitStatus(dimensionStatuses)
        : 'UNKNOWN';
      evaluatedLimits.push(evaluated);
    }

    const statuses = evaluatedLimits.map((limit) => limit.status);
    const computableStatuses = statuses.filter((status) => status !== 'UNKNOWN');
    const hasUnknownLimits = statuses.includes('UNKNOWN');
    const aggregateStatus = computableStatuses.length
      ? this.worstLifeLimitStatus(computableStatuses)
      : 'UNKNOWN';
    const worstLimit =
      evaluatedLimits
        .filter((limit) => limit.status !== 'UNKNOWN')
        .sort((a, b) => {
          const rankDelta =
            DueStatusService.compareStates(b.status, a.status);

          if (rankDelta !== 0) return rankDelta;

          const aRemaining = [
            a.remaining_hours,
            a.remaining_cycles,
            a.remaining_calendar_days,
          ].filter((value) => typeof value === 'number') as number[];
          const bRemaining = [
            b.remaining_hours,
            b.remaining_cycles,
            b.remaining_calendar_days,
          ].filter((value) => typeof value === 'number') as number[];

          return Math.min(...aRemaining, Number.POSITIVE_INFINITY) -
            Math.min(...bRemaining, Number.POSITIVE_INFINITY);
        })[0] || null;

    if (hasUnknownLimits) {
      aggregateReasons.push('One or more life limits could not be calculated.');
    }

    if (!computableStatuses.length) {
      aggregateReasons.push('No active life limits could be calculated from current life state.');
    }

    return {
      state: aggregateStatus,
      explanation:
        aggregateReasons.join(' ') ||
        (worstLimit
          ? `Worst limit: ${worstLimit.limit_type || 'Life limit'} is ${aggregateStatus}.`
          : `Life limits evaluated as ${aggregateStatus}.`),
      worstLimit,
      has_unknown_limits: hasUnknownLimits,
      is_partial: hasUnknownLimits && computableStatuses.length > 0,
      reasons: aggregateReasons,
      thresholds: this.serializedComponentLifeLimitDueSoonThresholds,
      evaluatedLimits,
    };
  }

  private static groupSerializedComponentMaintenanceEvents(events: any[]) {
    const groups = this.serializedComponentMaintenanceEventGroupDefinitions.map((definition) => ({
      ...definition,
      events: [] as any[],
    }));
    const groupByEventType = new Map<string, (typeof groups)[number]>();
    const unknownGroup = groups.find((group) => group.key === 'imported_unknown_history')!;

    groups.forEach((group) => {
      group.eventTypes.forEach((eventType) => {
        groupByEventType.set(eventType, group);
      });
    });

    (events || []).forEach((event) => {
      const normalizedEventType = String(event?.event_type || '').trim().toUpperCase();
      const group = groupByEventType.get(normalizedEventType) || unknownGroup;

      group.events.push(event);
    });

    return groups;
  }

  static async adjustSerializedComponentLifeState(
    id: string,
    data: {
      tsn_hours?: unknown;
      tso_hours?: unknown;
      csn_cycles?: unknown;
      cso_cycles?: unknown;
      overhaul_reference_date?: unknown;
      calendar_reference_date?: unknown;
      reason?: unknown;
      source_reference?: unknown;
      occurred_at?: unknown;
      allow_tso_exceeds_tsn?: unknown;
      allow_cso_exceeds_csn?: unknown;
      recorded_by?: string | null;
    }
  ) {
    const serializedComponentId = String(id || '').trim();
    const reason = String(data.reason || '').trim();
    const sourceReference = String(data.source_reference || '').trim();
    const occurredAt = this.parseOptionalDate(data.occurred_at, 'Occurred at') || new Date().toISOString();

    if (!serializedComponentId) {
      throw new Error('SERIALIZED_COMPONENT_NOT_FOUND');
    }

    if (!reason) {
      throw new Error('Life adjustment reason is required.');
    }

    const nextValues = {
      tsn_hours: this.parseOptionalDecimal(data.tsn_hours, 'TSN hours'),
      tso_hours: this.parseOptionalDecimal(data.tso_hours, 'TSO hours'),
      csn_cycles: this.parseOptionalInteger(data.csn_cycles, 'CSN cycles'),
      cso_cycles: this.parseOptionalInteger(data.cso_cycles, 'CSO cycles'),
      overhaul_reference_date: this.parseOptionalDate(
        data.overhaul_reference_date,
        'Overhaul reference date'
      ),
      calendar_reference_date: this.parseOptionalDate(
        data.calendar_reference_date,
        'Calendar reference date'
      ),
    };

    const hasAnyValue = Object.values(nextValues).some((value) => value !== null);

    if (!hasAnyValue) {
      throw new Error('At least one life value or reference date is required.');
    }

    if (
      nextValues.tsn_hours !== null &&
      nextValues.tso_hours !== null &&
      nextValues.tso_hours > nextValues.tsn_hours &&
      data.allow_tso_exceeds_tsn !== 'on'
    ) {
      throw new Error('TSO greater than TSN requires explicit documented reason confirmation.');
    }

    if (
      nextValues.csn_cycles !== null &&
      nextValues.cso_cycles !== null &&
      nextValues.cso_cycles > nextValues.csn_cycles &&
      data.allow_cso_exceeds_csn !== 'on'
    ) {
      throw new Error('CSO greater than CSN requires explicit documented reason confirmation.');
    }

    return sequelize.transaction(async (transaction) => {
      const serializedComponent = await SerializedComponent.findByPk(serializedComponentId, {
        attributes: ['id', 'serial_number'],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!serializedComponent) {
        throw new Error('SERIALIZED_COMPONENT_NOT_FOUND');
      }

      const existingLifeState = await SerializedComponentLifeState.findOne({
        where: { serialized_component_id: serializedComponentId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const before = this.lifeStateSnapshot(existingLifeState);

      const updateValues = {
        serialized_component_id: serializedComponentId,
        ...nextValues,
        notes: reason,
      };

      let lifeState;

      if (existingLifeState) {
        lifeState = await existingLifeState.update(updateValues, { transaction });
      } else {
        lifeState = await SerializedComponentLifeState.create(updateValues, { transaction });
      }

      const after = this.lifeStateSnapshot(lifeState);
      const eventNotes = [
        'LIFE_ADJUSTMENT',
        `Reason: ${reason}`,
        sourceReference ? `Source Reference: ${sourceReference}` : null,
        `Before: ${JSON.stringify(before)}`,
        `After: ${JSON.stringify(after)}`,
      ].filter(Boolean).join('\n');

      await SerializedComponentMaintenanceEvent.create(
        {
          serialized_component_id: serializedComponentId,
          event_type: 'LIFE_ADJUSTMENT',
          occurred_at: occurredAt,
          recorded_by: data.recorded_by || null,
          notes: eventNotes,
        },
        { transaction }
      );

      return lifeState;
    });
  }

  static async recordSerializedComponentOverhaul(
    id: string,
    data: {
      overhaul_date?: unknown;
      overhaul_provider?: unknown;
      overhaul_reference?: unknown;
      notes?: unknown;
      tsn_hours?: unknown;
      tso_hours?: unknown;
      csn_cycles?: unknown;
      cso_cycles?: unknown;
      overhaul_reference_date?: unknown;
      calendar_reference_date?: unknown;
      recorded_by?: string | null;
    }
  ) {
    const serializedComponentId = String(id || '').trim();
    const overhaulDate = this.parseOptionalDate(data.overhaul_date, 'Overhaul date');
    const overhaulProvider = String(data.overhaul_provider || '').trim();
    const overhaulReference = String(data.overhaul_reference || '').trim();
    const notes = String(data.notes || '').trim();

    if (!serializedComponentId) {
      throw new Error('SERIALIZED_COMPONENT_NOT_FOUND');
    }

    if (!overhaulDate) {
      throw new Error('Overhaul date is required.');
    }

    if (!overhaulProvider) {
      throw new Error('Overhaul provider is required.');
    }

    if (!overhaulReference) {
      throw new Error('Overhaul reference, work order, or release number is required.');
    }

    if (!notes) {
      throw new Error('Overhaul notes are required.');
    }

    const parsedValues = {
      tsn_hours: this.parseOptionalDecimal(data.tsn_hours, 'TSN hours'),
      tso_hours: this.parseOptionalDecimal(data.tso_hours, 'TSO hours'),
      csn_cycles: this.parseOptionalInteger(data.csn_cycles, 'CSN cycles'),
      cso_cycles: this.parseOptionalInteger(data.cso_cycles, 'CSO cycles'),
      overhaul_reference_date:
        this.parseOptionalDate(data.overhaul_reference_date, 'Overhaul reference date') ||
        overhaulDate,
      calendar_reference_date: this.parseOptionalDate(
        data.calendar_reference_date,
        'Calendar reference date'
      ),
    };

    return sequelize.transaction(async (transaction) => {
      const serializedComponent = await SerializedComponent.findByPk(serializedComponentId, {
        attributes: ['id', 'serial_number'],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!serializedComponent) {
        throw new Error('SERIALIZED_COMPONENT_NOT_FOUND');
      }

      const existingLifeState = await SerializedComponentLifeState.findOne({
        where: { serialized_component_id: serializedComponentId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const before = this.lifeStateSnapshot(existingLifeState);
      const updateValues: Record<string, any> = {
        serialized_component_id: serializedComponentId,
        notes: `OVERHAUL: ${notes}`,
      };

      Object.entries(parsedValues).forEach(([key, value]) => {
        if (value !== null) {
          updateValues[key] = value;
        }
      });

      let lifeState;

      if (existingLifeState) {
        lifeState = await existingLifeState.update(updateValues, { transaction });
      } else {
        lifeState = await SerializedComponentLifeState.create(updateValues, { transaction });
      }

      const after = this.lifeStateSnapshot(lifeState);
      const eventNotes = [
        'OVERHAUL',
        `Provider: ${overhaulProvider}`,
        `Reference: ${overhaulReference}`,
        `Notes: ${notes}`,
        `Before: ${JSON.stringify(before)}`,
        `After: ${JSON.stringify(after)}`,
      ].join('\n');

      await SerializedComponentMaintenanceEvent.create(
        {
          serialized_component_id: serializedComponentId,
          event_type: 'OVERHAUL',
          occurred_at: overhaulDate,
          recorded_by: data.recorded_by || null,
          notes: eventNotes,
        },
        { transaction }
      );

      return lifeState;
    });
  }

  static async recordSerializedComponentGenericMaintenanceEvent(
    id: string,
    data: {
      event_type?: unknown;
      occurred_at?: unknown;
      provider?: unknown;
      reference?: unknown;
      notes?: unknown;
      recorded_by?: string | null;
    }
  ) {
    const serializedComponentId = String(id || '').trim();
    const eventType = String(data.event_type || '').trim().toUpperCase();
    const occurredAt = this.parseOptionalDate(data.occurred_at, 'Occurred date');
    const provider = String(data.provider || '').trim();
    const reference = String(data.reference || '').trim();
    const notes = String(data.notes || '').trim();

    if (!serializedComponentId) {
      throw new Error('SERIALIZED_COMPONENT_NOT_FOUND');
    }

    if (!this.serializedComponentGenericMaintenanceEventTypes.includes(eventType)) {
      throw new Error('Invalid serialized component maintenance event type.');
    }

    if (!occurredAt) {
      throw new Error('Occurred date is required.');
    }

    if (!provider) {
      throw new Error('Provider or source is required.');
    }

    if (!reference) {
      throw new Error('Reference, work order, release, or logbook reference is required.');
    }

    if (!notes) {
      throw new Error('Maintenance event notes are required.');
    }

    return sequelize.transaction(async (transaction) => {
      const serializedComponent = await SerializedComponent.findByPk(serializedComponentId, {
        attributes: ['id', 'serial_number'],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!serializedComponent) {
        throw new Error('SERIALIZED_COMPONENT_NOT_FOUND');
      }

      const eventNotes = [
        eventType,
        `Provider / Source: ${provider}`,
        `Reference: ${reference}`,
        `Notes: ${notes}`,
        'Life State: Not changed by generic maintenance event.',
      ].join('\n');

      return SerializedComponentMaintenanceEvent.create(
        {
          serialized_component_id: serializedComponentId,
          event_type: eventType,
          occurred_at: occurredAt,
          recorded_by: data.recorded_by || null,
          notes: eventNotes,
        },
        { transaction }
      );
    });
  }

  static async createSerializedComponent(data: {
    component_model_id: string;
    serial_number: string;
    part_number?: string | undefined;
    status?: string | undefined;
    condition?: string | undefined;
    notes?: string | undefined;
  }) {
    return SerializedComponent.create({
      component_model_id: data.component_model_id,
      serial_number: data.serial_number.trim(),
      part_number: data.part_number?.trim() || null,
      status: data.status?.trim() || 'AVAILABLE',
      condition: data.condition?.trim() || null,
      notes: data.notes?.trim() || null,
    });
  }

  static async updateSerializedComponent(
    id: string,
    data: {
      component_model_id?: string | undefined;
      serial_number?: string | undefined;
      part_number?: string | undefined;
      status?: string | undefined;
      condition?: string | undefined;
      notes?: string | undefined;
    }
  ) {
    const serializedComponent = await this.getSerializedComponentById(id);

    if (!serializedComponent) {
      throw new Error('SERIALIZED_COMPONENT_NOT_FOUND');
    }

    const activeInstallation = Array.isArray((serializedComponent as any).Installations)
      ? (serializedComponent as any).Installations[0] || null
      : null;
    const isInstalled = Boolean(activeInstallation);

    const nextSerialNumber = String(data.serial_number || '').trim();

    if (!nextSerialNumber) {
      throw new Error('Serial number is required.');
    }

    const updates: Record<string, string | null> = {
      serial_number: nextSerialNumber,
      part_number: String(data.part_number || '').trim() || null,
      condition: String(data.condition || '').trim() || null,
      notes: String(data.notes || '').trim() || null,
    };

    if (!isInstalled) {
      const nextComponentModelId = String(data.component_model_id || '').trim();

      if (!nextComponentModelId) {
        throw new Error('Component model is required.');
      }

      const model = await ComponentModel.findByPk(nextComponentModelId, {
        attributes: ['id'],
      });

      if (!model) {
        throw new Error('Component model not found.');
      }

      updates.component_model_id = nextComponentModelId;

      const safeStatuses = new Set(['AVAILABLE', 'QUARANTINED']);
      const currentStatus = String(serializedComponent.status || '').trim().toUpperCase();
      const requestedStatus = String(data.status || '').trim().toUpperCase();

      if (requestedStatus) {
        if (!safeStatuses.has(currentStatus)) {
          throw new Error(
            'Serialized component status is currently controlled by operational lifecycle state and cannot be changed from the Library edit screen.'
          );
        }

        if (!safeStatuses.has(requestedStatus)) {
          throw new Error(
            'Serialized component status can only be changed between AVAILABLE and QUARANTINED from the Library edit screen.'
          );
        }

        updates.status = requestedStatus;
      }
    }

    await serializedComponent.update(updates);

    return this.getSerializedComponentById(id);
  }

  static async getManufacturerById(id: string) {
    const attributes = await this.getSelectableManufacturerAttributes();

    return Manufacturer.findByPk(id, {
      attributes,
      include: [
        {
          model: ComponentModel,
          attributes: [
            'id',
            'model_name',
            'model_code',
            'manufacturer_id',
            'asset_type_id',
            'default_tbo_hours',
            'default_tbo_months',
            'service_interval_hours',
            'service_interval_months',
            'overhaul_interval_hours',
            'overhaul_interval_months',
            'maintenance_notes',
            'is_life_limited',
            'is_active',
          ],
          include: [
            {
              model: AssetType,
              attributes: ['id', 'code', 'label'],
              required: false,
            },
          ],
        },
      ],
    });
  }

  static async createManufacturer(data: {
    name: string;
    code?: string | undefined;
    description?: string | undefined;
    website?: string | undefined;
    logo_url?: string | undefined;
    address_line_1?: string | undefined;
    address_line_2?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    country?: string | undefined;
    postal_code?: string | undefined;
    current_owner?: string | undefined;
    is_active?: boolean | undefined;
    is_operational?: boolean | undefined;
    support_email?: string | undefined;
    support_phone?: string | undefined;
    notes?: string | undefined;
    }) {
    const payload = await this.mapManufacturerPayload({
      name: data.name.trim(),
      code: data.code?.trim().toUpperCase() || null,
      description: data.description?.trim() || null,
      website: data.website?.trim() || null,
      logo_url: data.logo_url?.trim() || null,
      address_line_1: data.address_line_1?.trim() || null,
      address_line_2: data.address_line_2?.trim() || null,
      city: data.city?.trim() || null,
      state: data.state?.trim() || null,
      country: data.country?.trim() || null,
      postal_code: data.postal_code?.trim() || null,
      current_owner: data.current_owner?.trim() || null,
      is_active: data.is_active ?? true,
      is_operational: data.is_operational ?? true,
      support_email: data.support_email?.trim() || null,
      support_phone: data.support_phone?.trim() || null,
      notes: data.notes?.trim() || null,
    });

    return Manufacturer.create(payload);
  }

  static async updateManufacturer(
    id: string,
    data: {
      name: string;
      code?: string | undefined;
      description?: string | undefined;
      website?: string | undefined;
      logo_url?: string | undefined;
      address_line_1?: string | undefined;
      address_line_2?: string | undefined;
      city?: string | undefined;
      state?: string | undefined;
      country?: string | undefined;
      postal_code?: string | undefined;
      current_owner?: string | undefined;
      is_active?: boolean | undefined;
      is_operational?: boolean | undefined;
      support_email?: string | undefined;
      support_phone?: string | undefined;
      notes?: string | undefined;
    }
  ) {
    const payload = await this.mapManufacturerPayload({
      name: data.name.trim(),
      code: data.code?.trim().toUpperCase() || null,
      description: data.description?.trim() || null,
      website: data.website?.trim() || null,
      logo_url: data.logo_url?.trim() || null,
      address_line_1: data.address_line_1?.trim() || null,
      address_line_2: data.address_line_2?.trim() || null,
      city: data.city?.trim() || null,
      state: data.state?.trim() || null,
      country: data.country?.trim() || null,
      postal_code: data.postal_code?.trim() || null,
      current_owner: data.current_owner?.trim() || null,
      is_active: data.is_active ?? true,
      is_operational: data.is_operational ?? true,
      support_email: data.support_email?.trim() || null,
      support_phone: data.support_phone?.trim() || null,
      notes: data.notes?.trim() || null,
    });
    const attributes = await this.getSelectableManufacturerAttributes();

    await Manufacturer.update(
      payload,
      { where: { id } }
    );

    return Manufacturer.findByPk(id, {
      attributes,
    });
  }

  /**
   * CREATE: Add a new model
   */
  static async createModel(data: {
    manufacturer_id: string;
    asset_type_id: string;
    model_name: string;
    model_code?: string | undefined;
    default_tbo_hours?: number | undefined;
    default_tbo_months?: number | undefined;
    service_interval_hours?: number | undefined;
    service_interval_months?: number | undefined;
    overhaul_interval_hours?: number | undefined;
    overhaul_interval_months?: number | undefined;
    maintenance_notes?: string | undefined;
    is_life_limited?: boolean | undefined;
  }) {
    return ComponentModel.create({
      manufacturer_id: data.manufacturer_id,
      asset_type_id: data.asset_type_id,
      model_name: data.model_name,
      model_code: data.model_code?.trim() || null,
      default_tbo_hours: data.default_tbo_hours ?? null,
      default_tbo_months: data.default_tbo_months ?? null,
      service_interval_hours: data.service_interval_hours ?? null,
      service_interval_months: data.service_interval_months ?? null,
      overhaul_interval_hours: data.overhaul_interval_hours ?? null,
      overhaul_interval_months: data.overhaul_interval_months ?? null,
      maintenance_notes: data.maintenance_notes?.trim() || null,
      is_life_limited: data.is_life_limited ?? false,
    });
  }

  /**
   * UPDATE: Update existing model
   */
  static async updateModel(
    id: string,
    data: {
      model_name: string;
      model_code?: string | undefined;
      default_tbo_hours?: number | undefined;
      default_tbo_months?: number | undefined;
      service_interval_hours?: number | undefined;
      service_interval_months?: number | undefined;
      overhaul_interval_hours?: number | undefined;
      overhaul_interval_months?: number | undefined;
      maintenance_notes?: string | undefined;
      is_life_limited?: boolean | undefined;
    }
  ) {
    await ComponentModel.update(
      {
        model_name: data.model_name,
        model_code: data.model_code?.trim() || null,
        default_tbo_hours: data.default_tbo_hours ?? null,
        default_tbo_months: data.default_tbo_months ?? null,
        service_interval_hours: data.service_interval_hours ?? null,
        service_interval_months: data.service_interval_months ?? null,
        overhaul_interval_hours: data.overhaul_interval_hours ?? null,
        overhaul_interval_months: data.overhaul_interval_months ?? null,
        maintenance_notes: data.maintenance_notes?.trim() || null,
        is_life_limited: data.is_life_limited ?? false,
      },
      { where: { id } }
    );

    return ComponentModel.findByPk(id, {
      attributes: LibraryService.componentModelAttributes,
    });
  }

  /**
   * CREATE maintenance requirement
   */
  static async createRequirement(data: {
    model_id: string;
    title: string;
    interval_hours?: number | undefined;
    interval_months?: number | undefined;
    description?: string | undefined;
  }) {
    return MaintenanceRequirement.create({
      model_id: data.model_id,
      title: data.title,
      interval_hours: data.interval_hours ?? null,
      interval_months: data.interval_months ?? null,
      description: data.description ?? null,
    });
  }

  /**
   * UPDATE maintenance requirement
   */
  static async updateRequirement(
    id: string,
    data: {
      title: string;
      interval_hours?: number | undefined;
      interval_months?: number | undefined;
      description?: string | undefined;
    }
  ) {
    await MaintenanceRequirement.update(
      {
        title: data.title,
        interval_hours: data.interval_hours ?? null,
        interval_months: data.interval_months ?? null,
        description: data.description ?? null,
      },
      { where: { id } }
    );

    return MaintenanceRequirement.findByPk(id);
  }

  /**
   * DELETE maintenance requirement
   */
  static async deleteRequirement(id: string) {
    const deleted = await MaintenanceRequirement.destroy({
      where: { id },
    });

    return deleted > 0;
  }

  static async createServiceBulletin(data: {
    model_id: string;
    sb_number: string;
    title: string;
    description?: string | undefined;
    issued_on?: string | undefined;
    compliance_type?: string | undefined;
    revision?: string | undefined;
    document_url?: string | undefined;
  }) {
    const normalizedSbNumber = data.sb_number.trim().toUpperCase();
    const model = await ComponentModel.findByPk(data.model_id, {
      attributes: ['id', 'manufacturer_id'],
    });

    const existing = model
      ? await ServiceBulletin.findOne({
          where: { sb_number: normalizedSbNumber },
          include: [
            {
              model: ComponentModel,
              as: 'ApplicableModels',
              where: { manufacturer_id: model.manufacturer_id },
              through: { attributes: [] },
              attributes: ['id'],
            },
          ],
          order: [['created_at', 'ASC']],
        })
      : await ServiceBulletin.findOne({
          where: { sb_number: normalizedSbNumber },
          order: [['created_at', 'ASC']],
        });

    if (existing) {
      await ServiceBulletinModel.findOrCreate({
        where: {
          service_bulletin_id: existing.id,
          model_id: data.model_id,
        },
        defaults: {
          service_bulletin_id: existing.id,
          model_id: data.model_id,
        },
      });

      await existing.update({
        title: existing.title || data.title,
        description: existing.description || data.description || null,
        issued_on: existing.issued_on || data.issued_on || null,
        compliance_type: existing.compliance_type || data.compliance_type || 'MANUAL',
        revision: existing.revision || data.revision?.trim() || null,
        document_url: existing.document_url || data.document_url?.trim() || null,
      });

      return existing;
    }

    const bulletin = await ServiceBulletin.create({
      model_id: data.model_id,
      sb_number: normalizedSbNumber,
      title: data.title,
      description: data.description ?? null,
      issued_on: data.issued_on || null,
      compliance_type: data.compliance_type || 'MANUAL',
      status: 'ACTIVE',
      revision: data.revision?.trim() || null,
      document_url: data.document_url?.trim() || null,
    });

    await ServiceBulletinModel.findOrCreate({
      where: {
        service_bulletin_id: bulletin.id,
        model_id: data.model_id,
      },
      defaults: {
        service_bulletin_id: bulletin.id,
        model_id: data.model_id,
      },
    });

    return bulletin;
  }

  static async createServiceBulletinsBulk(
    modelId: string,
    entries: Array<{
      sb_number?: string | null;
      title?: string | null;
      description?: string | null;
      compliance_type?: string | null;
      issued_on?: string | null;
      revision?: string | null;
      document_url?: string | null;
    }>
  ) {
    const normalizedEntries = entries
      .map((entry) => {
        const sbNumber = entry.sb_number?.trim();
        const title = entry.title?.trim() || entry.description?.trim();
        const description = entry.description?.trim();

        if (!sbNumber || !title) {
          return null;
        }

        return {
          model_id: modelId,
          sb_number: sbNumber,
          title,
          description,
          compliance_type: entry.compliance_type?.trim() || 'MANUAL',
          issued_on: entry.issued_on?.trim() || undefined,
          revision: entry.revision?.trim() || undefined,
          document_url: entry.document_url?.trim() || undefined,
        };
      })
      .filter(Boolean) as Array<{
      model_id: string;
      sb_number: string;
      title: string;
      description?: string;
      compliance_type?: string;
      issued_on?: string;
      revision?: string;
      document_url?: string;
    }>;

    for (const entry of normalizedEntries) {
      await this.createServiceBulletin(entry);
    }

    return normalizedEntries.length;
  }

  static async attachServiceBulletinsToModel(modelId: string, serviceBulletinIds: string[]) {
    const uniqueIds = Array.from(
      new Set((serviceBulletinIds || []).map((id) => String(id).trim()).filter(Boolean))
    );

    if (uniqueIds.length === 0) {
      return 0;
    }

    let attachedCount = 0;

    for (const serviceBulletinId of uniqueIds) {
      const [, created] = await ServiceBulletinModel.findOrCreate({
        where: {
          service_bulletin_id: serviceBulletinId,
          model_id: modelId,
        },
        defaults: {
          service_bulletin_id: serviceBulletinId,
          model_id: modelId,
        },
      });

      if (created) {
        attachedCount += 1;
      }
    }

    return attachedCount;
  }

  private static async ensureAdComplianceItem(directive: AirworthinessDirective) {
    const existing = await ComplianceItem.findOne({
      where: {
        source_type: 'AD',
        source_id: directive.id,
      } as any,
      order: [['created_at', 'ASC']],
    });

    if (existing) {
      return existing;
    }

    return ComplianceItem.create({
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
      status: ['ACTIVE', 'SUPERSEDED', 'CANCELLED', 'INACTIVE'].includes(
        String(directive.status || '').trim().toUpperCase()
      )
        ? String(directive.status || '').trim().toUpperCase()
        : 'ACTIVE',
    } as any);
  }

  static async assignAirworthinessDirectiveToModel(modelId: string, directiveId: string) {
    const [model, directive] = await Promise.all([
      ComponentModel.findByPk(modelId, { attributes: ['id'] }),
      AirworthinessDirective.findByPk(directiveId),
    ]);

    if (!model) {
      throw new Error('Model not found.');
    }

    if (!directive) {
      throw new Error('Airworthiness directive not found.');
    }

    const complianceItem = await this.ensureAdComplianceItem(directive);
    const existing = await ComplianceAssignment.findOne({
      where: {
        compliance_item_id: complianceItem.id,
        assignment_type: 'MODEL',
        model_id: modelId,
      },
    });

    if (existing) {
      if (!existing.is_active) {
        await existing.update({
          is_active: true,
          assignment_source: 'MANUAL',
          aircraft_id: null,
        });
      }

      return existing;
    }

    return ComplianceAssignment.create({
      compliance_item_id: complianceItem.id,
      assignment_type: 'MODEL',
      model_id: modelId,
      aircraft_id: null,
      assignment_source: 'MANUAL',
      is_active: true,
    });
  }

  static async assignSupplementalInspectionDocumentToModel(modelId: string, sidId: string) {
    const [model, sid] = await Promise.all([
      ComponentModel.findByPk(modelId, { attributes: ['id'] }),
      SupplementalInspectionDocument.findByPk(sidId, { attributes: ['id'] }),
    ]);

    if (!model) {
      throw new Error('Model not found.');
    }

    if (!sid) {
      throw new Error('Supplemental inspection document not found.');
    }

    const existing = await SidModelApplicability.findOne({
      where: {
        sid_id: sidId,
        model_id: modelId,
      },
    });

    if (existing) {
      if (!existing.is_active) {
        await existing.update({ is_active: true });
      }

      return existing;
    }

    return SidModelApplicability.create({
      sid_id: sidId,
      model_id: modelId,
      is_active: true,
    });
  }

  static async assignStandardTaskToModel(modelId: string, taskTemplateId: string) {
    const [model, taskTemplate] = await Promise.all([
      ComponentModel.findByPk(modelId, { attributes: ['id'] }),
      TaskTemplate.findByPk(taskTemplateId),
    ]);

    if (!model) {
      throw new Error('Model not found.');
    }

    if (!taskTemplate) {
      throw new Error('Standard task not found.');
    }

    await taskTemplate.update({
      scope: 'MODEL',
      aircraft_model_id: modelId,
      aircraft_id: null,
    });

    return taskTemplate;
  }

  static async importModelSidsFromCsv(modelId: string, buffer: Buffer) {
    const model = await ComponentModel.findByPk(modelId, {
      attributes: ['id', 'model_name'],
    });

    if (!model) {
      throw new Error('Model not found.');
    }

    const records = parse(buffer, {
      columns: (header: string[]) =>
        header.map((value) =>
          String(value || '')
            .trim()
            .toLowerCase()
            .replace(/^"|"$/g, '')
            .replace(/\s+/g, '_')
        ),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    }) as Record<string, unknown>[];

    const existingSids = (await SupplementalInspectionDocument.findAll()) as any[];
    const existingModelSids = (await this.getModelSids(modelId)) as any[];

    const existingBySidNumber = new Map<string, any>();
    const existingBySummary = new Map<string, any>();

    for (const sid of existingSids) {
      const sidNumberKey = this.normalizeSidNumber(sid.reference);
      const summaryKey = this.normalizeSummary(sid.title);

      if (sidNumberKey) {
        existingBySidNumber.set(sidNumberKey, sid);
      }

      if (summaryKey && !existingBySummary.has(summaryKey)) {
        existingBySummary.set(summaryKey, sid);
      }
    }

    const attachedSummaryKeys = new Set(
      existingModelSids
        .map((sid: any) => this.normalizeSummary(sid.title))
        .filter(Boolean)
    );

    const seenSummaryKeys = new Set<string>();
    const seenSidNumberKeys = new Set<string>();

    let created = 0;
    let attached = 0;
    let skippedDuplicates = 0;
    let skippedInvalid = 0;

    for (const record of records) {
      const sidNumber = this.normalizeSidNumber(
        this.pickFirstValue(record, [
          'sid_number',
          'sid_no',
          'sid',
          'sid_reference',
          'supplemental_inspection_number',
        ])
      );
      const summary = this.pickFirstValue(record, [
        'summary',
        'title',
        'description',
      ]);
      const summaryKey = this.normalizeSummary(summary);

      if (!summaryKey) {
        skippedInvalid += 1;
        continue;
      }

      if (attachedSummaryKeys.has(summaryKey) || seenSummaryKeys.has(summaryKey)) {
        skippedDuplicates += 1;
        continue;
      }

      if (sidNumber && seenSidNumberKeys.has(sidNumber)) {
        skippedDuplicates += 1;
        continue;
      }

      let sid =
        (sidNumber ? existingBySidNumber.get(sidNumber) : null) ||
        existingBySummary.get(summaryKey) ||
        null;

      const payload = {
        manufacturer: 'Cessna',
        reference: sidNumber || summary,
        title: summary,
        description: summary,
        category: null,
        ata_chapter:
          this.pickFirstValue(record, ['ata_chapter', 'ata', 'chapter']) || null,
        section_reference: (
          this.pickFirstValue(record, [
            'section_reference',
            'section',
            'section_ref',
          ]) ||
          this.pickFirstMatchingValue(
            record,
            (key) => key.startsWith('details_found_in_section')
          )
        ) || null,
        initial_interval_hours: this.parseInteger(
          this.pickFirstValue(record, ['initial_interval_hours', 'initial_hours'])
        ),
        initial_interval_months: this.parseInteger(
          this.pickFirstValue(record, ['initial_interval_months', 'initial_months'])
        ),
        repeat_interval_hours: this.parseInteger(
          this.pickFirstValue(record, ['repeat_interval_hours', 'repeat_hours'])
        ),
        repeat_interval_months: this.parseInteger(
          this.pickFirstValue(record, ['repeat_interval_months', 'repeat_months'])
        ),
        inspection_operation:
          this.pickFirstValue(record, ['inspection_operation', 'operation']) || null,
        source_document:
          this.pickFirstValue(record, ['source_pdf', 'source', 'document']) || null,
        is_active: true,
      };

      if (!sid) {
        sid = await SupplementalInspectionDocument.create(payload as any);
        created += 1;
      } else {
        await sid.update({
          manufacturer: sid.manufacturer || payload.manufacturer,
          reference: sid.reference || payload.reference,
          title: sid.title || payload.title,
          description: sid.description || payload.description,
          ata_chapter: sid.ata_chapter || payload.ata_chapter,
          section_reference: sid.section_reference || payload.section_reference,
          initial_interval_hours:
            sid.initial_interval_hours ?? payload.initial_interval_hours,
          initial_interval_months:
            sid.initial_interval_months ?? payload.initial_interval_months,
          repeat_interval_hours:
            sid.repeat_interval_hours ?? payload.repeat_interval_hours,
          repeat_interval_months:
            sid.repeat_interval_months ?? payload.repeat_interval_months,
          inspection_operation:
            sid.inspection_operation || payload.inspection_operation,
          source_document: sid.source_document || payload.source_document,
        });
      }

      const [link, linkCreated] = await SidModelApplicability.findOrCreate({
        where: {
          sid_id: sid.id,
          model_id: modelId,
        },
        defaults: {
          sid_id: sid.id,
          model_id: modelId,
          is_active: true,
        },
      });
      const reactivated = !linkCreated && !link.is_active;

      if (reactivated) {
        await link.update({ is_active: true });
      }

      if (linkCreated || reactivated) {
        attached += 1;
      }

      if (sidNumber) {
        seenSidNumberKeys.add(sidNumber);
        existingBySidNumber.set(sidNumber, sid);
      }

      seenSummaryKeys.add(summaryKey);
      attachedSummaryKeys.add(summaryKey);
      existingBySummary.set(summaryKey, sid);
    }

    return {
      created,
      attached,
      skippedDuplicates,
      skippedInvalid,
      processed: records.length,
    };
  }
}
