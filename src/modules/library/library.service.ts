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
  CessnaSid,
  ModelSid,
} from '../../models/index.js';
import { Op } from 'sequelize';
import sequelize from '../../config/database.js';

export class LibraryService {
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
        'is_life_limited',
        'is_active',
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
    return CessnaSid.findAll({
      include: [
        {
          model: ComponentModel,
          as: 'ApplicableModels',
          where: { id: modelId },
          through: { attributes: ['is_active', 'created_at'] },
          attributes: ['id', 'model_name'],
        },
      ],
      order: [['sid_number', 'ASC'], ['title', 'ASC']],
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

  static async getManufacturerById(id: string) {
    const attributes = await this.getSelectableManufacturerAttributes();

    return Manufacturer.findByPk(id, {
      attributes,
      include: [
        {
          model: ComponentModel,
          attributes: ['id', 'model_name', 'model_code', 'manufacturer_id', 'asset_type_id', 'is_active'],
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

    const existingSids = (await CessnaSid.findAll()) as any[];
    const existingModelSids = (await this.getModelSids(modelId)) as any[];

    const existingBySidNumber = new Map<string, any>();
    const existingBySummary = new Map<string, any>();

    for (const sid of existingSids) {
      const sidNumberKey = this.normalizeSidNumber(sid.sid_number);
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
        sid_number: sidNumber || summary,
        title: summary,
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
        source_pdf:
          this.pickFirstValue(record, ['source_pdf', 'source', 'document']) || null,
      };

      if (!sid) {
        sid = await CessnaSid.create(payload as any);
        created += 1;
      } else {
        await sid.update({
          sid_number: sid.sid_number || payload.sid_number,
          title: sid.title || payload.title,
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
          source_pdf: sid.source_pdf || payload.source_pdf,
        });
      }

      const [, linkCreated] = await ModelSid.findOrCreate({
        where: {
          model_id: modelId,
          sid_id: sid.id,
        },
        defaults: {
          model_id: modelId,
          sid_id: sid.id,
          is_active: true,
        },
      });

      if (linkCreated) {
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
