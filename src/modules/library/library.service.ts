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
  AircraftComponentInstallation,
  Aircraft,
  ComplianceAssignment,
} from '../../models/index.js';
import { Op, QueryTypes } from 'sequelize';
import sequelize from '../../config/database.js';
import { AirworthinessDirective } from '../../models/AirworthinessDirective.js';
import { ComplianceItem } from '../../models/ComplianceItem.js';
import { MaintenanceTemplate } from '../../models/MaintenanceTemplate.js';
import { MaintenanceTemplateItem } from '../../models/MaintenanceTemplateItem.js';
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
    hours: 10,
    cycles: 10,
    calendarDays: 30,
  };

  private static readonly serializedComponentLifeLimitStatusRank: Record<string, number> = {
    UNKNOWN: 0,
    COMPLIANT: 1,
    DUE_SOON: 2,
    DUE: 3,
    OVERDUE: 4,
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

  /**
   * Fetch all asset types (AIRFRAME, ENGINE, etc.)
   */
  static async getAssetTypes() {
    return AssetType.findAll({
      order: [['code', 'ASC']],
    });
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
      ],
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
