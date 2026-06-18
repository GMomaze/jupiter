import { sequelize } from '../../models/index.js';
import {
  Aircraft,
  AircraftComponent,
  AircraftComponentInstallation,
  ComponentModel,
  AssetType,
  SerializedComponent,
  SerializedComponentLifeState,
  ComponentLifeLimit,
  Manufacturer,
} from '../../models/index.js';

export class AircraftComponentService {
  private static readonly serializedInstallStatuses = ['REMOVED', 'AVAILABLE'];
  private static readonly serializedTrackingBases = new Set([
    'AIRCRAFT_HOURS',
    'AIRCRAFT_CYCLES',
    'CALENDAR',
    'ENGINE_METER',
    'PROPELLER_METER',
    'MANUAL_AUTHORISED',
  ]);
  private static readonly aircraftAttributes = [
    'id',
    'status',
    'total_time_hours',
    'total_time_cycles',
  ];

  private static readonly componentModelAttributes = [
    'id',
    'model_name',
    'asset_type_id',
    'default_tbo_hours',
  ];

  private static assetTypeInclude = {
    model: AssetType,
    attributes: ['id', 'code', 'label', 'is_installable_on_aircraft', 'is_required_for_aircraft'],
  };

  private static normalizeTrackingBasis(value: unknown) {
    const trackingBasis = String(value || '').trim().toUpperCase();

    if (!trackingBasis) {
      throw new Error('TRACKING_BASIS_REQUIRED');
    }

    if (!AircraftComponentService.serializedTrackingBases.has(trackingBasis)) {
      throw new Error('INVALID_TRACKING_BASIS');
    }

    return trackingBasis;
  }

  private static parseOptionalDecimal(value: unknown, errorCode: string) {
    const normalized = String(value ?? '').trim();

    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);

    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(errorCode);
    }

    return Number(parsed.toFixed(2));
  }

  private static parseOptionalInteger(value: unknown, errorCode: string) {
    const normalized = String(value ?? '').trim();

    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);

    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error(errorCode);
    }

    return parsed;
  }

  private static normalizeAircraftHours(value: unknown) {
    const hours = Number(value ?? 0);
    return Number.isFinite(hours) && hours >= 0 ? Number(hours.toFixed(2)) : 0;
  }

  private static normalizeAircraftCycles(value: unknown) {
    const cycles = Number(value ?? 0);
    return Number.isInteger(cycles) && cycles >= 0 ? cycles : 0;
  }

  private static async hasLegacyPositionConflict(params: {
    aircraftId: string;
    assetTypeId: string;
    position: string;
    transaction: any;
  }) {
    const conflict = await AircraftComponent.findOne({
      where: {
        aircraft_id: params.aircraftId,
        position_code: params.position,
        current_status: 'INSTALLED'
      },
      include: [
        {
          model: ComponentModel,
          attributes: ['id', 'asset_type_id'],
          required: true,
          where: {
            asset_type_id: params.assetTypeId,
          },
        },
      ],
      transaction: params.transaction,
      lock: params.transaction.LOCK.UPDATE,
    });

    return Boolean(conflict);
  }

  private static async hasSerializedPositionConflict(params: {
    aircraftId: string;
    assetTypeId: string;
    position: string;
    transaction: any;
  }) {
    const conflict = await AircraftComponentInstallation.findOne({
      where: {
        aircraft_id: params.aircraftId,
        position: params.position,
        removed_at: null,
      },
      include: [
        {
          model: SerializedComponent,
          as: 'SerializedComponent',
          attributes: ['id', 'component_model_id'],
          required: true,
          include: [
            {
              model: ComponentModel,
              as: 'ComponentModel',
              attributes: ['id', 'asset_type_id'],
              required: true,
              where: {
                asset_type_id: params.assetTypeId,
              },
            },
          ],
        },
      ],
      transaction: params.transaction,
      lock: params.transaction.LOCK.UPDATE,
    });

    return Boolean(conflict);
  }

  static async getAvailableSerializedComponents() {
    return SerializedComponent.findAll({
      attributes: [
        'id',
        'component_model_id',
        'serial_number',
        'part_number',
        'status',
        'condition',
        'notes',
      ],
      where: { status: 'AVAILABLE' },
      include: [
        {
          model: ComponentModel,
          as: 'ComponentModel',
          attributes: ['id', 'model_name', 'model_code', 'manufacturer_id', 'asset_type_id'],
          required: true,
          include: [
            {
              model: Manufacturer,
              attributes: ['id', 'name', 'code'],
              required: false,
            },
            {
              model: AssetType,
              attributes: ['id', 'code', 'label', 'is_installable_on_aircraft'],
              required: true,
              where: { is_installable_on_aircraft: true },
            },
          ],
        },
      ],
      order: [
        [{ model: ComponentModel, as: 'ComponentModel' }, { model: AssetType, as: 'AssetType' }, 'code', 'ASC'],
        [{ model: ComponentModel, as: 'ComponentModel' }, { model: Manufacturer, as: 'Manufacturer' }, 'name', 'ASC'],
        [{ model: ComponentModel, as: 'ComponentModel' }, 'model_name', 'ASC'],
        ['serial_number', 'ASC'],
      ],
    });
  }

  static async getActiveSerializedInstallationsForAircraft(aircraftId: string) {
    return AircraftComponentInstallation.findAll({
      attributes: [
        'id',
        'aircraft_id',
        'serialized_component_id',
        'installation_context',
        'installed_at',
        'removed_at',
        'position',
        'tracking_basis',
        'install_aircraft_hours',
        'install_aircraft_cycles',
        'install_tsn',
        'install_tso',
        'install_csn',
        'install_cso',
        'removal_aircraft_hours',
        'removal_aircraft_cycles',
        'removal_csn',
        'removal_cso',
        'notes',
      ],
      where: {
        aircraft_id: aircraftId,
        removed_at: null,
      },
      include: [
        {
          model: SerializedComponent,
          as: 'SerializedComponent',
          attributes: [
            'id',
            'component_model_id',
            'serial_number',
            'part_number',
            'status',
            'condition',
            'notes',
          ],
          required: true,
          include: [
            {
              model: ComponentModel,
              as: 'ComponentModel',
              attributes: ['id', 'model_name', 'model_code', 'manufacturer_id', 'asset_type_id'],
              required: false,
              include: [
                {
                  model: Manufacturer,
                  attributes: ['id', 'name', 'code'],
                  required: false,
                },
                {
                  model: AssetType,
                  attributes: ['id', 'code', 'label', 'is_required_for_aircraft'],
                  required: false,
                },
                {
                  model: ComponentLifeLimit,
                  as: 'LifeLimits',
                  required: false,
                },
              ],
            },
            {
              model: SerializedComponentLifeState,
              as: 'LifeState',
              required: false,
            },
          ],
        },
      ],
      order: [
        [{ model: SerializedComponent, as: 'SerializedComponent' }, { model: ComponentModel, as: 'ComponentModel' }, { model: AssetType, as: 'AssetType' }, 'code', 'ASC'],
        ['position', 'ASC'],
        ['installed_at', 'DESC'],
      ],
    });
  }

  static async getSerializedInstallationHistoryForComponents(serializedComponentIds: string[]) {
    const ids = Array.from(
      new Set(
        (serializedComponentIds || [])
          .map((value) => String(value || '').trim())
          .filter(Boolean)
      )
    );

    if (ids.length === 0) {
      return [];
    }

    return AircraftComponentInstallation.findAll({
      attributes: [
        'id',
        'aircraft_id',
        'serialized_component_id',
        'installation_context',
        'installed_at',
        'removed_at',
        'position',
        'tracking_basis',
        'install_aircraft_hours',
        'install_aircraft_cycles',
        'install_tsn',
        'install_tso',
        'install_csn',
        'install_cso',
        'removal_aircraft_hours',
        'removal_aircraft_cycles',
        'removal_tsn',
        'removal_tso',
        'removal_csn',
        'removal_cso',
        'notes',
        'created_at',
        'updated_at',
      ],
      where: {
        serialized_component_id: ids,
      },
      include: [
        {
          model: Aircraft,
          as: 'Aircraft',
          attributes: ['id', 'registration', 'serial_number'],
          required: false,
        },
      ],
      order: [['installed_at', 'DESC'], ['created_at', 'DESC']],
    });
  }

  static async getTechnicalStatusInstallableLegacyComponentsForAircraft(aircraftId: string) {
    return AircraftComponent.findAll({
      attributes: [
        'id',
        'aircraft_id',
        'model_id',
        'serial_number',
        'position_code',
        'current_status',
      ],
      where: {
        aircraft_id: aircraftId,
        current_status: 'INSTALLED',
      },
      include: [
        {
          model: ComponentModel,
          attributes: AircraftComponentService.componentModelAttributes,
          required: false,
          include: [
            {
              model: Manufacturer,
              attributes: ['id', 'name', 'code'],
              required: false,
            },
            {
              model: AssetType,
              attributes: ['id', 'code', 'label', 'is_installable_on_aircraft', 'is_required_for_aircraft'],
              required: false,
            },
          ],
        },
      ],
      order: [
        [{ model: ComponentModel, as: 'ComponentModel' }, { model: AssetType, as: 'AssetType' }, 'code', 'ASC'],
        ['position_code', 'ASC'],
      ],
    });
  }

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
        installation_date,
        tsn_at_install,
        tso_at_install,
        position_code
      } = data;
      const normalizedSerialNumber = String(serial_number || '').trim();
      const normalizedPositionCode = String(position_code || '').trim().toUpperCase() || null;
      const normalizedInstallationDate = String(installation_date || '').trim() || null;

      if (!normalizedSerialNumber)
        throw new Error('SERIAL_NUMBER_REQUIRED');

      if (!normalizedInstallationDate)
        throw new Error('INSTALLATION_DATE_REQUIRED');

      if (
        normalizedInstallationDate &&
        Number.isNaN(new Date(normalizedInstallationDate).getTime())
      ) {
        throw new Error('INVALID_INSTALLATION_DATE');
      }

      const aircraft = await Aircraft.findByPk(
        aircraft_id,
        {
          attributes: AircraftComponentService.aircraftAttributes,
          transaction,
          lock: transaction.LOCK.UPDATE
        }
      );

      if (!aircraft) throw new Error('AIRCRAFT_NOT_FOUND');
      if (aircraft.status !== 'ACTIVE')
        throw new Error('INSTALL_NOT_ALLOWED_AIRCRAFT_NOT_ACTIVE');

      const componentModel = await ComponentModel.findByPk(
        model_id,
        {
          attributes: AircraftComponentService.componentModelAttributes,
          include: [AircraftComponentService.assetTypeInclude],
          transaction
        }
      );

      if (!componentModel)
        throw new Error('COMPONENT_MODEL_NOT_FOUND');

      if (!componentModel.AssetType?.is_installable_on_aircraft)
        throw new Error('ASSET_TYPE_NOT_INSTALLABLE_ON_AIRCRAFT');

      const serialInUse = await AircraftComponent.findOne({
        where: { serial_number: normalizedSerialNumber, current_status: 'INSTALLED' },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (serialInUse)
        throw new Error('SERIAL_ALREADY_INSTALLED_ON_ANOTHER_AIRCRAFT');

      if (normalizedPositionCode) {
        const assetTypeId = String(componentModel.asset_type_id || '').trim();
        const hasConflict =
          Boolean(assetTypeId) &&
          (
            await AircraftComponentService.hasLegacyPositionConflict({
              aircraftId: aircraft_id,
              assetTypeId,
              position: normalizedPositionCode,
              transaction,
            }) ||
            await AircraftComponentService.hasSerializedPositionConflict({
              aircraftId: aircraft_id,
              assetTypeId,
              position: normalizedPositionCode,
              transaction,
            })
          );

        if (hasConflict)
          throw new Error(
            `POSITION_OCCUPIED: ${normalizedPositionCode}`
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
          serial_number: normalizedSerialNumber,
          position_code: normalizedPositionCode,
          installation_date: normalizedInstallationDate,
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
        include: [{
          model: ComponentModel,
          attributes: AircraftComponentService.componentModelAttributes,
          include: [AircraftComponentService.assetTypeInclude]
        }],
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
          {
            attributes: AircraftComponentService.aircraftAttributes,
            transaction,
            lock: transaction.LOCK.UPDATE
          }
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
        include: [{
          model: ComponentModel,
          attributes: AircraftComponentService.componentModelAttributes,
        }],
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
          {
            attributes: ['id', 'total_time_hours'],
            transaction
          }
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

  static async installSerializedComponent(data: any) {
    const transaction = await sequelize.transaction();

    try {
      const aircraftId = String(data.aircraft_id || '').trim();
      const serializedComponentId = String(data.serialized_component_id || '').trim();
      const trackingBasis = AircraftComponentService.normalizeTrackingBasis(data.tracking_basis);
      const installedAt = String(data.installed_at || '').trim();
      const position = String(data.position || '').trim().toUpperCase() || null;
      const notes = String(data.notes || '').trim() || null;
      const installTsn = AircraftComponentService.parseOptionalDecimal(
        data.install_tsn,
        'INVALID_INSTALL_TSN'
      );
      const installTso = AircraftComponentService.parseOptionalDecimal(
        data.install_tso,
        'INVALID_INSTALL_TSO'
      );
      const installCsn = AircraftComponentService.parseOptionalInteger(
        data.install_csn,
        'INVALID_INSTALL_CSN'
      );
      const installCso = AircraftComponentService.parseOptionalInteger(
        data.install_cso,
        'INVALID_INSTALL_CSO'
      );

      if (!aircraftId) throw new Error('AIRCRAFT_NOT_FOUND');
      if (!serializedComponentId) throw new Error('SERIALIZED_COMPONENT_NOT_FOUND');
      if (!installedAt || Number.isNaN(new Date(installedAt).getTime())) {
        throw new Error('INVALID_INSTALLATION_DATE');
      }

      const aircraft = await Aircraft.findByPk(aircraftId, {
        attributes: ['id', 'total_time_hours', 'total_time_cycles'],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!aircraft) throw new Error('AIRCRAFT_NOT_FOUND');

      const serializedComponent = await SerializedComponent.findByPk(serializedComponentId, {
        attributes: ['id', 'status', 'component_model_id'],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!serializedComponent) throw new Error('SERIALIZED_COMPONENT_NOT_FOUND');
      if (serializedComponent.status !== 'AVAILABLE') {
        throw new Error('SERIALIZED_COMPONENT_NOT_AVAILABLE');
      }

      const serializedComponentModel = serializedComponent.component_model_id
        ? await ComponentModel.findByPk(serializedComponent.component_model_id, {
            attributes: ['id', 'asset_type_id'],
            transaction,
          })
        : null;

      const activeInstallation = await AircraftComponentInstallation.findOne({
        where: {
          serialized_component_id: serializedComponentId,
          removed_at: null,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (activeInstallation) {
        throw new Error('SERIALIZED_COMPONENT_ALREADY_INSTALLED');
      }

      if (position) {
        const assetTypeId = String(serializedComponentModel?.asset_type_id || '').trim();
        const hasConflict =
          Boolean(assetTypeId) &&
          (
            await AircraftComponentService.hasSerializedPositionConflict({
              aircraftId,
              assetTypeId,
              position,
              transaction,
            }) ||
            await AircraftComponentService.hasLegacyPositionConflict({
              aircraftId,
              assetTypeId,
              position,
              transaction,
            })
          );

        if (hasConflict) {
          throw new Error(`POSITION_OCCUPIED: ${position}`);
        }
      }

      await AircraftComponentInstallation.create(
        {
          aircraft_id: aircraftId,
          serialized_component_id: serializedComponentId,
          installation_context: 'MAINTENANCE_INSTALL',
          installed_at: installedAt,
          removed_at: null,
          position,
          tracking_basis: trackingBasis,
          install_aircraft_hours: AircraftComponentService.normalizeAircraftHours(aircraft.total_time_hours),
          install_aircraft_cycles: AircraftComponentService.normalizeAircraftCycles(aircraft.total_time_cycles),
          install_tsn: installTsn,
          install_tso: installTso,
          install_csn: installCsn,
          install_cso: installCso,
          installed_by: data.installed_by || null,
          notes,
        },
        { transaction }
      );

      await serializedComponent.update(
        { status: 'INSTALLED' },
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async baselineCaptureSerializedComponent(data: any) {
    const transaction = await sequelize.transaction();

    try {
      const aircraftId = String(data.aircraft_id || '').trim();
      const serializedComponentId = String(data.serialized_component_id || '').trim();
      const trackingBasis = AircraftComponentService.normalizeTrackingBasis(data.tracking_basis);
      const installedAt = String(data.installed_at || '').trim();
      const position = String(data.position || '').trim().toUpperCase() || null;
      const installTsn = AircraftComponentService.parseOptionalDecimal(
        data.install_tsn,
        'INVALID_INSTALL_TSN'
      );
      const installTso = AircraftComponentService.parseOptionalDecimal(
        data.install_tso,
        'INVALID_INSTALL_TSO'
      );
      const installCsn = AircraftComponentService.parseOptionalInteger(
        data.install_csn,
        'INVALID_INSTALL_CSN'
      );
      const installCso = AircraftComponentService.parseOptionalInteger(
        data.install_cso,
        'INVALID_INSTALL_CSO'
      );
      const notes = String(data.notes || '').trim();
      const uncertaintyNotes = String(data.uncertainty_notes || '').trim();
      const inheritedStatusContext = String(data.inherited_status_context || '').trim();

      if (!aircraftId) throw new Error('AIRCRAFT_NOT_FOUND');
      if (!serializedComponentId) throw new Error('SERIALIZED_COMPONENT_NOT_FOUND');
      if (!installedAt || Number.isNaN(new Date(installedAt).getTime())) {
        throw new Error('INVALID_INSTALLATION_DATE');
      }

      const aircraft = await Aircraft.findByPk(aircraftId, {
        attributes: ['id', 'total_time_hours', 'total_time_cycles'],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!aircraft) throw new Error('AIRCRAFT_NOT_FOUND');

      const serializedComponent = await SerializedComponent.findByPk(serializedComponentId, {
        attributes: ['id', 'status', 'component_model_id'],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!serializedComponent) throw new Error('SERIALIZED_COMPONENT_NOT_FOUND');
      if (serializedComponent.status !== 'AVAILABLE') {
        throw new Error('SERIALIZED_COMPONENT_NOT_AVAILABLE');
      }

      const serializedComponentModel = serializedComponent.component_model_id
        ? await ComponentModel.findByPk(serializedComponent.component_model_id, {
            attributes: ['id', 'asset_type_id'],
            transaction,
          })
        : null;

      const activeInstallation = await AircraftComponentInstallation.findOne({
        where: {
          serialized_component_id: serializedComponentId,
          removed_at: null,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (activeInstallation) {
        throw new Error('SERIALIZED_COMPONENT_ALREADY_INSTALLED');
      }

      if (position) {
        const assetTypeId = String(serializedComponentModel?.asset_type_id || '').trim();
        const hasConflict =
          Boolean(assetTypeId) &&
          (
            await AircraftComponentService.hasSerializedPositionConflict({
              aircraftId,
              assetTypeId,
              position,
              transaction,
            }) ||
            await AircraftComponentService.hasLegacyPositionConflict({
              aircraftId,
              assetTypeId,
              position,
              transaction,
            })
          );

        if (hasConflict) {
          throw new Error(`POSITION_OCCUPIED: ${position}`);
        }
      }

      const composedNotes = [
        'Baseline Capture: Existing aircraft configuration captured during onboarding.',
        inheritedStatusContext ? `Inherited Status Context: ${inheritedStatusContext}` : null,
        uncertaintyNotes ? `Uncertainty Notes: ${uncertaintyNotes}` : null,
        notes || null,
      ].filter(Boolean).join('\n');

      await AircraftComponentInstallation.create(
        {
          aircraft_id: aircraftId,
          serialized_component_id: serializedComponentId,
          installation_context: 'BASELINE_CAPTURE',
          installed_at: installedAt,
          removed_at: null,
          position,
          tracking_basis: trackingBasis,
          install_aircraft_hours: AircraftComponentService.normalizeAircraftHours(aircraft.total_time_hours),
          install_aircraft_cycles: AircraftComponentService.normalizeAircraftCycles(aircraft.total_time_cycles),
          install_tsn: installTsn,
          install_tso: installTso,
          install_csn: installCsn,
          install_cso: installCso,
          installed_by: data.installed_by || null,
          notes: composedNotes || null,
        },
        { transaction }
      );

      await serializedComponent.update(
        { status: 'INSTALLED' },
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async removeSerializedComponent(data: any) {
    const transaction = await sequelize.transaction();

    try {
      const aircraftId = String(data.aircraft_id || '').trim();
      const installationId = String(data.installation_id || '').trim();
      const removedAt = String(data.removed_at || '').trim();
      const notes = String(data.notes || '').trim() || null;
      const resultingStatus = String(data.resulting_status || '').trim().toUpperCase();
      const removalTsn = AircraftComponentService.parseOptionalDecimal(
        data.removal_tsn,
        'INVALID_REMOVAL_TSN'
      );
      const removalTso = AircraftComponentService.parseOptionalDecimal(
        data.removal_tso,
        'INVALID_REMOVAL_TSO'
      );
      const removalCsn = AircraftComponentService.parseOptionalInteger(
        data.removal_csn,
        'INVALID_REMOVAL_CSN'
      );
      const removalCso = AircraftComponentService.parseOptionalInteger(
        data.removal_cso,
        'INVALID_REMOVAL_CSO'
      );

      if (!aircraftId) throw new Error('AIRCRAFT_NOT_FOUND');
      if (!installationId) throw new Error('ACTIVE_SERIALIZED_INSTALLATION_NOT_FOUND');
      if (!removedAt || Number.isNaN(new Date(removedAt).getTime())) {
        throw new Error('INVALID_REMOVAL_DATE');
      }
      if (!AircraftComponentService.serializedInstallStatuses.includes(resultingStatus)) {
        throw new Error('INVALID_RESULTING_STATUS');
      }

      const aircraft = await Aircraft.findByPk(aircraftId, {
        attributes: ['id', 'total_time_hours', 'total_time_cycles'],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!aircraft) throw new Error('AIRCRAFT_NOT_FOUND');

      const installation = await AircraftComponentInstallation.findOne({
        where: {
          id: installationId,
          aircraft_id: aircraftId,
          removed_at: null,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!installation) {
        throw new Error('ACTIVE_SERIALIZED_INSTALLATION_NOT_FOUND');
      }

      if (new Date(removedAt).getTime() < new Date(installation.installed_at).getTime()) {
        throw new Error('REMOVAL_BEFORE_INSTALL');
      }

      const serializedComponent = await SerializedComponent.findByPk(
        installation.serialized_component_id,
        {
          attributes: ['id', 'status'],
          transaction,
          lock: transaction.LOCK.UPDATE,
        }
      );

      if (!serializedComponent) {
        throw new Error('SERIALIZED_COMPONENT_NOT_FOUND');
      }

      if (serializedComponent.status !== 'INSTALLED') {
        throw new Error('SERIALIZED_COMPONENT_NOT_INSTALLED');
      }

      await installation.update(
        {
          removed_at: removedAt,
          removal_aircraft_hours: AircraftComponentService.normalizeAircraftHours(aircraft.total_time_hours),
          removal_aircraft_cycles: AircraftComponentService.normalizeAircraftCycles(aircraft.total_time_cycles),
          removal_tsn: removalTsn,
          removal_tso: removalTso,
          removal_csn: removalCsn,
          removal_cso: removalCso,
          removed_by: data.removed_by || null,
          notes: notes
            ? [installation.notes, `Removal: ${notes}`].filter(Boolean).join('\n')
            : installation.notes,
        },
        { transaction }
      );

      await serializedComponent.update(
        { status: resultingStatus },
        { transaction }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
