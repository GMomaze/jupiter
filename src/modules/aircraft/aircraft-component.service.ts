import { sequelize } from '../../models/index.js';
import {
  Aircraft,
  AircraftComponent,
  ComponentModel,
  AssetType
} from '../../models/index.js';
import { QueryTypes } from 'sequelize';

export class AircraftComponentService {

  /**
   * INSTALL COMPONENT (Concurrency Safe)
   */
  static async installComponent(data: any) {

    const transaction = await sequelize.transaction();

    try {

      const {
        aircraft_id,
        model_id,
        serial_number,
        tsn_at_install,
        tso_at_install,
        position_code
      } = data;

      const aircraft = await Aircraft.findByPk(
        aircraft_id,
        { transaction, lock: transaction.LOCK.UPDATE }
      );

      if (!aircraft) throw new Error('AIRCRAFT_NOT_FOUND');
      if (aircraft.status !== 'ACTIVE')
        throw new Error('INSTALL_NOT_ALLOWED_AIRCRAFT_NOT_ACTIVE');

      const componentModel = await ComponentModel.findByPk(
        model_id,
        { include: [AssetType], transaction }
      );

      if (!componentModel)
        throw new Error('COMPONENT_MODEL_NOT_FOUND');

      if (!componentModel.AssetType?.is_installable_on_aircraft)
        throw new Error('ASSET_TYPE_NOT_INSTALLABLE_ON_AIRCRAFT');

      const serialInUse = await AircraftComponent.findOne({
        where: { serial_number, current_status: 'INSTALLED' },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (serialInUse)
        throw new Error('SERIAL_ALREADY_INSTALLED_ON_ANOTHER_AIRCRAFT');

      if (position_code) {

        const conflict = await AircraftComponent.findOne({
          where: {
            aircraft_id,
            position_code,
            current_status: 'INSTALLED'
          },
          transaction,
          lock: transaction.LOCK.UPDATE
        });

        if (conflict)
          throw new Error(
            `POSITION_OCCUPIED: ${position_code}`
          );
      }

      if (componentModel.default_tbo_hours) {

        const tsnInstall = Number(tsn_at_install || 0);

        if (tsnInstall >= componentModel.default_tbo_hours)
          throw new Error(
            `CANNOT_INSTALL_TBO_EXCEEDED: ${componentModel.model_name}`
          );
      }

      await AircraftComponent.create(
        {
          aircraft_id,
          model_id,
          serial_number,
          position_code: position_code || null,
          tsn_at_install: tsn_at_install || 0,
          tso_at_install: tso_at_install || 0,
          install_af_hours: aircraft.total_time_hours || 0,
          current_status: 'INSTALLED',
          removed_at: null,
          version: 0
        },
        { transaction }
      );

      await transaction.commit();

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * REMOVE COMPONENT (Fully Concurrency Safe)
   */
  static async removeComponent(aircraft_component_id: string) {

    const transaction = await sequelize.transaction();

    try {

      const record = await AircraftComponent.findOne({
        where: { id: aircraft_component_id },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!record)
        throw new Error('COMPONENT_INSTALL_RECORD_NOT_FOUND');

      if (record.current_status === 'REMOVED')
        throw new Error('COMPONENT_ALREADY_REMOVED');

      const { affectedRows } = await AircraftComponent.update(
        {
          current_status: 'REMOVED',
          removed_at: new Date(),
          version: record.version + 1
        },
        {
          where: {
            id: aircraft_component_id,
            version: record.version
          },
          transaction
        }
      ) as any;

      if (!affectedRows)
        throw new Error('CONFLICT: Component modified.');

      await transaction.commit();

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * QUARANTINE COMPONENT (Concurrency Safe)
   */
  static async quarantineComponent(aircraft_component_id: string) {

    const transaction = await sequelize.transaction();

    try {

      const record = await AircraftComponent.findOne({
        where: { id: aircraft_component_id },
        include: [{ model: ComponentModel, include: [AssetType] }],
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!record)
        throw new Error('COMPONENT_INSTALL_RECORD_NOT_FOUND');

      if (record.current_status !== 'INSTALLED')
        throw new Error('ONLY_INSTALLED_COMPONENTS_CAN_BE_QUARANTINED');

      const { affectedRows } = await AircraftComponent.update(
        {
          current_status: 'QUARANTINED',
          version: record.version + 1
        },
        {
          where: {
            id: aircraft_component_id,
            version: record.version
          },
          transaction
        }
      ) as any;

      if (!affectedRows)
        throw new Error('CONFLICT: Component modified.');

      const assetType = record.ComponentModel?.AssetType;

      if (assetType?.is_required_for_aircraft) {

        const aircraft = await Aircraft.findByPk(
          record.aircraft_id,
          { transaction, lock: transaction.LOCK.UPDATE }
        );

        if (aircraft?.status === 'ACTIVE') {
          aircraft.status = 'GROUNDED';
          await aircraft.save({ transaction });
        }
      }

      await transaction.commit();

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * RESTORE COMPONENT (Concurrency Safe)
   */
  static async restoreComponent(aircraft_component_id: string) {

    const transaction = await sequelize.transaction();

    try {

      const record = await AircraftComponent.findOne({
        where: { id: aircraft_component_id },
        include: [ComponentModel],
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!record)
        throw new Error('COMPONENT_INSTALL_RECORD_NOT_FOUND');

      if (record.current_status !== 'QUARANTINED')
        throw new Error('ONLY_QUARANTINED_COMPONENTS_CAN_BE_RESTORED');

      if (record.position_code) {

        const conflict = await AircraftComponent.findOne({
          where: {
            aircraft_id: record.aircraft_id,
            position_code: record.position_code,
            current_status: 'INSTALLED'
          },
          transaction,
          lock: transaction.LOCK.UPDATE
        });

        if (conflict)
          throw new Error(
            `POSITION_OCCUPIED: ${record.position_code}`
          );
      }

      const model = record.ComponentModel;

      if (model?.default_tbo_hours) {

        const aircraft = await Aircraft.findByPk(
          record.aircraft_id,
          { transaction }
        );

        const aircraftHours = Number(aircraft?.total_time_hours || 0);
        const installHours = Number(record.install_af_hours || 0);
        const tsnAtInstall = Number(record.tsn_at_install || 0);

        const hoursSinceInstall = aircraftHours - installHours;
        const componentTotalTime = tsnAtInstall + hoursSinceInstall;

        if (componentTotalTime >= model.default_tbo_hours)
          throw new Error(
            `CANNOT_RESTORE_TBO_EXCEEDED: ${model.model_name}`
          );
      }

      const { affectedRows } = await AircraftComponent.update(
        {
          current_status: 'INSTALLED',
          removed_at: null,
          version: record.version + 1
        },
        {
          where: {
            id: aircraft_component_id,
            version: record.version
          },
          transaction
        }
      ) as any;

      if (!affectedRows)
        throw new Error('CONFLICT: Component modified.');

      await transaction.commit();

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
