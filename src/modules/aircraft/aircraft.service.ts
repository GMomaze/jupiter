import { sequelize } from '../../models/index.js';
import {
  Aircraft,
  AircraftComponent,
  ComponentModel,
  AircraftSbCompliance,
  ServiceBulletin,
  Manufacturer,
  AssetType
} from '../../models/index.js';
import { AuditService } from '../audit/audit.service.js';
import { Op } from 'sequelize';

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
  ];
  private static readonly editableAircraftAttributes = [
    'id',
    'registration',
    'serial_number',
    'model_id',
    'category_id',
    'status',
    'total_time_hours',
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
  private static readonly serviceBulletinPriority: Record<string, number> = {
    MANDATORY: 0,
    MANUAL: 1,
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

  /* ============================================================
     CREATE
  ============================================================ */

  static async create(data: {
    registration: string;
    serial_number: string;
    model_id: string;
    category_id: string;
    total_time_hours?: number;
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
        total_time_hours: this.normalizeHours(data.total_time_hours ?? 0),
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

    return sequelize.transaction(async (transaction) => {

      const aircraft = await Aircraft.findByPk(id, {
        attributes: this.mutableAircraftAttributes,
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!aircraft) throw new Error('AIRCRAFT_NOT_FOUND');

      aircraft.total_time_hours = newTotalHours;
      await aircraft.save({ transaction });

      const installed = await AircraftComponent.findAll({
        where: { aircraft_id: id },
        include: [{
          model: ComponentModel,
          attributes: ['id', 'default_tbo_hours'],
        }],
        transaction
      });

      for (const record of installed) {

        const model = (record as any).ComponentModel;
        if (!model?.default_tbo_hours) continue;

        const hoursSinceInstall =
          newTotalHours - Number(record.install_af_hours || 0);

        const componentTotalTime =
          Number(record.tsn_at_install || 0) + hoursSinceInstall;

        if (componentTotalTime >= model.default_tbo_hours) {

          if (aircraft.status === 'ACTIVE') {

            const oldStatus = aircraft.status;
            aircraft.status = 'GROUNDED';
            await aircraft.save({ transaction });

            await AuditService.log({
              table_name: 'aircraft',
              row_id: id,
              action: 'STATUS_CHANGE',
              actor_id: null,
              reason: 'TBO_EXCEEDED',
              old_values: { status: oldStatus },
              new_values: { status: 'GROUNDED' }
            }, transaction);
          }

          break;
        }
      }

      return aircraft;
    });
  }

  static async updateDetails(id: string, data: {
    registration: string;
    serial_number: string;
    model_id: string;
    category_id: string;
    total_time_hours?: number | string;
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
        loaded_into_system_at: aircraft.loaded_into_system_at,
        manufacture_date: aircraft.manufacture_date,
        tcds_number: aircraft.tcds_number,
        tcds_url: aircraft.tcds_url,
        photo_url: aircraft.photo_url,
        version: aircraft.version,
      };

      aircraft.registration = this.normalizeRegistration(data.registration);
      aircraft.serial_number = data.serial_number.trim();
      aircraft.model_id = data.model_id;
      aircraft.category_id = data.category_id;
      aircraft.total_time_hours = this.normalizeHours(data.total_time_hours ?? 0);
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
        compliance_type: bulletin.compliance_type || 'MANUAL',
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
