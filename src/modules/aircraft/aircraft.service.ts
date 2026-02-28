import { sequelize } from '../../models/index.js';
import {
  Aircraft,
  AircraftComponent,
  ComponentModel
} from '../../models/index.js';
import { AuditService } from '../audit/audit.service.js';

type AircraftStatus =
  | 'REGISTERED'
  | 'ACTIVE'
  | 'GROUNDED'
  | 'RETIRED';

export class AircraftService {

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

  /* ============================================================
     CREATE
  ============================================================ */

  static async create(data: {
    registration: string;
    serial_number: string;
    model_id: string;
    category_id: string;
  }) {

    if (!data.model_id) throw new Error('MODEL_ID_REQUIRED');
    if (!data.category_id) throw new Error('CATEGORY_ID_REQUIRED');

    return sequelize.transaction(async (transaction) => {

      const aircraft = await Aircraft.create({
        registration: data.registration.toUpperCase(),
        serial_number: data.serial_number,
        model_id: data.model_id,
        category_id: data.category_id,
        status: 'REGISTERED',
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
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!aircraft) throw new Error('AIRCRAFT_NOT_FOUND');

      aircraft.total_time_hours = newTotalHours;
      await aircraft.save({ transaction });

      const installed = await AircraftComponent.findAll({
        where: { aircraft_id: id },
        include: [{ model: ComponentModel }],
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
}

export default new AircraftService();