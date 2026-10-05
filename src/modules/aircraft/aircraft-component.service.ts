import { withTenantTransaction } from '../tenancy/tenant-transaction.js';
import {
  ComponentModel,
  AssetType,
} from '../../models/index.js';
import { assertTenantQueryAuthority, type TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { aircraftTenantRepository } from './aircraft-tenant.repository.live.js';
import { serializedComponentTenantRepository } from '../library/serialized-component-tenant.repository.live.js';
import { aircraftComponentInstallationTenantRepository } from './aircraft-component-installation-tenant.repository.live.js';
import { aircraftComponentTenantRepository } from './aircraft-component-tenant.repository.live.js';
import { aircraftComponentMovementHistoryRepository } from '../inventory/aircraft-component-movement-history.repository.live.js';

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

  static async getAvailableSerializedComponents(authority: TenantQueryAuthority) {
    assertTenantQueryAuthority(authority);
    return withTenantTransaction(authority, async (transaction) =>
      serializedComponentTenantRepository.listAvailable(authority, { transaction }),
    );
  }

  static async getActiveSerializedInstallationsForAircraft(authority: TenantQueryAuthority, aircraftId: string) {
    assertTenantQueryAuthority(authority);
    return withTenantTransaction(authority, async (transaction) =>
      aircraftComponentInstallationTenantRepository.listActiveWorkflowForAircraft(authority, aircraftId, { transaction }),
    );
  }

  static async getSerializedInstallationHistoryForComponents(authority: TenantQueryAuthority, serializedComponentIds: string[]) {
    assertTenantQueryAuthority(authority);
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

    return withTenantTransaction(authority, async (transaction) =>
      aircraftComponentInstallationTenantRepository.listWorkflowHistoryForSerializedComponents(authority, ids, { transaction }),
    );
  }

  static async getTechnicalStatusInstallableLegacyComponentsForAircraft(authority: TenantQueryAuthority, aircraftId: string) {
    assertTenantQueryAuthority(authority);
    return withTenantTransaction(authority, async (transaction) =>
      aircraftComponentTenantRepository.listInstalledForAircraft(authority, aircraftId, { transaction }),
    );
  }

  /**
   * INSTALL COMPONENT (Concurrency Safe)
   */
  static async installComponent(authority: TenantQueryAuthority, data: any) {
    assertTenantQueryAuthority(authority);

    return withTenantTransaction(authority, async (transaction) => {

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

      const aircraft = await aircraftTenantRepository.getForRootUpdate(authority, aircraft_id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!aircraft) throw new Error('TENANT_RESOURCE_UNAVAILABLE');
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

      const serialInUse = await aircraftComponentTenantRepository.hasInstalledSerialConflict(
        authority,
        normalizedSerialNumber,
        {
          transaction,
          lock: transaction.LOCK.UPDATE,
        },
      );

      if (serialInUse)
        throw new Error('SERIAL_ALREADY_INSTALLED_ON_ANOTHER_AIRCRAFT');

      if (normalizedPositionCode) {
        const assetTypeId = String(componentModel.asset_type_id || '').trim();
        const hasConflict =
          Boolean(assetTypeId) &&
          (
            await aircraftComponentTenantRepository.hasActivePositionConflict(authority, aircraft_id, assetTypeId, normalizedPositionCode, { transaction, lock: transaction.LOCK.UPDATE }) ||
            await aircraftComponentInstallationTenantRepository.hasActivePositionConflict(authority, aircraft_id, assetTypeId, normalizedPositionCode, { transaction, lock: transaction.LOCK.UPDATE })
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

      await aircraftComponentTenantRepository.create(authority,
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

    });
  }

  /**
   * REMOVE COMPONENT (Fully Concurrency Safe)
   */
  static async removeComponent(
    authority: TenantQueryAuthority,
    aircraft_component_id: string,
    actorId?: string,
    remarks?: unknown,
  ) {
    assertTenantQueryAuthority(authority);

    const normalizedActorId = String(actorId || '').trim();
    if (!normalizedActorId) throw new Error('AUTHENTICATED_ACTOR_REQUIRED');

    return withTenantTransaction(authority, async (transaction) => {

      const record = await aircraftComponentTenantRepository.getCustodyForUpdate(authority, aircraft_component_id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!record)
        throw new Error('TENANT_RESOURCE_UNAVAILABLE');

      if (record.current_status !== 'INSTALLED')
        throw new Error('ONLY_INSTALLED_COMPONENTS_CAN_BE_REMOVED');

      const aircraftId = String(record.aircraft_id || '');
      const aircraft = await aircraftTenantRepository.getForRootUpdate(authority, aircraftId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!aircraft) throw new Error('TENANT_RESOURCE_UNAVAILABLE');

      const occurredAt = new Date();
      const aircraftHours = AircraftComponentService.normalizeAircraftHours(aircraft.total_time_hours);
      const accruedHours = Math.max(0, aircraftHours - AircraftComponentService.normalizeAircraftHours(record.install_af_hours));
      const carriedTsn = Number((AircraftComponentService.normalizeAircraftHours(record.tsn_at_install) + accruedHours).toFixed(2));
      const carriedTso = Number((AircraftComponentService.normalizeAircraftHours(record.tso_at_install) + accruedHours).toFixed(2));

      const updateResult = await aircraftComponentTenantRepository.updateCustodyByVersion(
        authority,
        aircraft_component_id,
        Number(record.version),
        {
          current_status: 'REMOVED',
          removed_at: occurredAt,
          tsn_at_install: carriedTsn,
          tso_at_install: carriedTso,
          version: Number(record.version) + 1,
        },
        { transaction },
      );

      if (updateResult.outcome !== 'CHANGED')
        throw new Error('CONFLICT: Component modified.');

      await aircraftComponentMovementHistoryRepository.append(authority, {
        aircraft_component_id,
        action_type: 'REMOVAL',
        source_aircraft_id: aircraftId,
        target_aircraft_id: null,
        actor_id: normalizedActorId,
        occurred_at: occurredAt,
        aircraft_hours: aircraftHours,
        remarks: String(remarks ?? '').trim() || null,
      }, { transaction });

    });
  }

  /**
   * QUARANTINE COMPONENT (Concurrency Safe)
   */
  static async quarantineComponent(authority: TenantQueryAuthority, aircraft_component_id: string) {
    assertTenantQueryAuthority(authority);

    return withTenantTransaction(authority, async (transaction) => {

      const record = await aircraftComponentTenantRepository.getForUpdate(authority, aircraft_component_id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!record)
        throw new Error('TENANT_RESOURCE_UNAVAILABLE');

      if (record.current_status !== 'INSTALLED')
        throw new Error('ONLY_INSTALLED_COMPONENTS_CAN_BE_QUARANTINED');

      const context = await aircraftComponentTenantRepository.getOperationalContext(authority, aircraft_component_id, { transaction });
      if (!context) throw new Error('TENANT_RESOURCE_UNAVAILABLE');

      const updateResult = await aircraftComponentTenantRepository.updateByVersion(
        authority,
        aircraft_component_id,
        String(record.aircraft_id || ''),
        Number(record.version),
        {
          current_status: 'QUARANTINED',
          version: Number(record.version) + 1,
        },
        { transaction },
      );

      if (updateResult.outcome !== 'CHANGED')
        throw new Error('CONFLICT: Component modified.');

      const assetType = (context as any).ComponentModel?.AssetType;

      if (assetType?.is_required_for_aircraft) {

        const aircraft = await aircraftTenantRepository.getForRootUpdate(authority, String(record.aircraft_id || ''), {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (aircraft?.status === 'ACTIVE') {
          aircraft.status = 'GROUNDED';
          await aircraft.save({ transaction });
        }
      }

    });
  }

  /**
   * RESTORE COMPONENT (Concurrency Safe)
   */
  static async restoreComponent(authority: TenantQueryAuthority, aircraft_component_id: string) {
    assertTenantQueryAuthority(authority);

    return withTenantTransaction(authority, async (transaction) => {

      const record = await aircraftComponentTenantRepository.getForUpdate(authority, aircraft_component_id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!record)
        throw new Error('TENANT_RESOURCE_UNAVAILABLE');

      if (record.current_status !== 'QUARANTINED')
        throw new Error('ONLY_QUARANTINED_COMPONENTS_CAN_BE_RESTORED');

      if (record.position_code) {

        const conflict = await aircraftComponentTenantRepository.hasInstalledPositionConflict(
          authority,
          String(record.aircraft_id || ''),
          String(record.position_code),
          {
            transaction,
            lock: transaction.LOCK.UPDATE,
          },
        );

        if (conflict)
          throw new Error(
            `POSITION_OCCUPIED: ${record.position_code}`
          );
      }

      const context = await aircraftComponentTenantRepository.getOperationalContext(authority, aircraft_component_id, { transaction });
      if (!context) throw new Error('TENANT_RESOURCE_UNAVAILABLE');
      const model = (context as any).ComponentModel;

      if (model?.default_tbo_hours) {

        const aircraft = await aircraftTenantRepository.getById(authority, String(record.aircraft_id || ''), { transaction });

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

      const updateResult = await aircraftComponentTenantRepository.updateByVersion(
        authority,
        aircraft_component_id,
        String(record.aircraft_id || ''),
        Number(record.version),
        {
          current_status: 'INSTALLED',
          removed_at: null,
          version: Number(record.version) + 1,
        },
        { transaction },
      );

      if (updateResult.outcome !== 'CHANGED')
        throw new Error('CONFLICT: Component modified.');

    });
  }

  static async reinstallComponent(
    authority: TenantQueryAuthority,
    aircraftComponentId: string,
    targetAircraftId: string,
    actorId: string,
    remarks?: unknown,
  ) {
    assertTenantQueryAuthority(authority);
    const normalizedActorId = String(actorId || '').trim();
    if (!normalizedActorId) throw new Error('AUTHENTICATED_ACTOR_REQUIRED');

    return withTenantTransaction(authority, async (transaction) => {
      const record = await aircraftComponentTenantRepository.getCustodyForUpdate(authority, aircraftComponentId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!record) throw new Error('TENANT_RESOURCE_UNAVAILABLE');
      if (record.current_status !== 'REMOVED') throw new Error('ONLY_REMOVED_COMPONENTS_CAN_BE_REINSTALLED');

      const aircraft = await aircraftTenantRepository.getForRootUpdate(authority, targetAircraftId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!aircraft) throw new Error('TENANT_RESOURCE_UNAVAILABLE');
      if (aircraft.status !== 'ACTIVE') throw new Error('INSTALL_NOT_ALLOWED_AIRCRAFT_NOT_ACTIVE');

      const context = await aircraftComponentTenantRepository.getCustodyOperationalContext(authority, aircraftComponentId, { transaction });
      if (!context) throw new Error('TENANT_RESOURCE_UNAVAILABLE');
      const componentModel = (context as any).ComponentModel;
      if (!componentModel) throw new Error('COMPONENT_MODEL_NOT_FOUND');
      if (!componentModel.AssetType?.is_installable_on_aircraft) throw new Error('ASSET_TYPE_NOT_INSTALLABLE_ON_AIRCRAFT');

      if (await aircraftComponentTenantRepository.hasInstalledSerialConflict(authority, String(record.serial_number || ''), {
        transaction,
        lock: transaction.LOCK.UPDATE,
      })) throw new Error('SERIAL_ALREADY_INSTALLED_ON_ANOTHER_AIRCRAFT');

      const position = String(record.position_code || '').trim().toUpperCase() || null;
      if (position) {
        const assetTypeId = String(componentModel.asset_type_id || '').trim();
        const conflict = Boolean(assetTypeId) && (
          await aircraftComponentTenantRepository.hasActivePositionConflict(authority, targetAircraftId, assetTypeId, position, { transaction, lock: transaction.LOCK.UPDATE }) ||
          await aircraftComponentInstallationTenantRepository.hasActivePositionConflict(authority, targetAircraftId, assetTypeId, position, { transaction, lock: transaction.LOCK.UPDATE })
        );
        if (conflict) throw new Error(`POSITION_OCCUPIED: ${position}`);
      }

      const carriedTsn = AircraftComponentService.normalizeAircraftHours(record.tsn_at_install);
      const carriedTso = AircraftComponentService.normalizeAircraftHours(record.tso_at_install);
      if (componentModel.default_tbo_hours && carriedTsn >= Number(componentModel.default_tbo_hours)) {
        throw new Error(`CANNOT_INSTALL_TBO_EXCEEDED: ${componentModel.model_name}`);
      }

      const occurredAt = new Date();
      const aircraftHours = AircraftComponentService.normalizeAircraftHours(aircraft.total_time_hours);
      const updateResult = await aircraftComponentTenantRepository.updateCustodyByVersion(
        authority,
        aircraftComponentId,
        Number(record.version),
        {
          aircraft_id: targetAircraftId,
          current_status: 'INSTALLED',
          removed_at: null,
          installation_date: occurredAt.toISOString().slice(0, 10),
          install_af_hours: aircraftHours,
          tsn_at_install: carriedTsn,
          tso_at_install: carriedTso,
          version: Number(record.version) + 1,
        },
        { transaction },
      );
      if (updateResult.outcome !== 'CHANGED') throw new Error('CONFLICT: Component modified.');

      await aircraftComponentMovementHistoryRepository.append(authority, {
        aircraft_component_id: aircraftComponentId,
        action_type: 'INSTALLATION',
        source_aircraft_id: null,
        target_aircraft_id: targetAircraftId,
        actor_id: normalizedActorId,
        occurred_at: occurredAt,
        aircraft_hours: aircraftHours,
        remarks: String(remarks ?? '').trim() || null,
      }, { transaction });

    });
  }

  static async installSerializedComponent(authority: TenantQueryAuthority, data: any) {
    assertTenantQueryAuthority(authority);
    return withTenantTransaction(authority, async (transaction) => {
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

      const aircraft = await aircraftTenantRepository.getForRootUpdate(authority, aircraftId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!aircraft) throw new Error('TENANT_RESOURCE_UNAVAILABLE');

      const serializedComponent = await serializedComponentTenantRepository.getForUpdate(authority, serializedComponentId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!serializedComponent) throw new Error('TENANT_RESOURCE_UNAVAILABLE');
      if (serializedComponent.status !== 'AVAILABLE') {
        throw new Error('SERIALIZED_COMPONENT_NOT_AVAILABLE');
      }

      const serializedComponentModel = serializedComponent.component_model_id
        ? await ComponentModel.findByPk(serializedComponent.component_model_id, {
            attributes: ['id', 'asset_type_id'],
            transaction,
          })
        : null;

      const activeInstallation = await aircraftComponentInstallationTenantRepository.getActiveForSerializedComponentUpdate(authority, serializedComponentId, {
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
            await aircraftComponentInstallationTenantRepository.hasActivePositionConflict(authority, aircraftId, assetTypeId, position, { transaction, lock: transaction.LOCK.UPDATE }) ||
            await aircraftComponentTenantRepository.hasActivePositionConflict(authority, aircraftId, assetTypeId, position, { transaction, lock: transaction.LOCK.UPDATE })
          );

        if (hasConflict) {
          throw new Error(`POSITION_OCCUPIED: ${position}`);
        }
      }

      await aircraftComponentInstallationTenantRepository.create(authority,
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

      const statusResult = await serializedComponentTenantRepository.updateInstallationStatus(authority, serializedComponentId, 'INSTALLED', { transaction });
      if (statusResult.outcome !== 'CHANGED') throw new Error('TENANT_RESOURCE_UNAVAILABLE');

    });
  }

  static async baselineCaptureSerializedComponent(authority: TenantQueryAuthority, data: any) {
    assertTenantQueryAuthority(authority);
    return withTenantTransaction(authority, async (transaction) => {
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

      const aircraft = await aircraftTenantRepository.getForRootUpdate(authority, aircraftId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!aircraft) throw new Error('TENANT_RESOURCE_UNAVAILABLE');

      const serializedComponent = await serializedComponentTenantRepository.getForUpdate(authority, serializedComponentId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!serializedComponent) throw new Error('TENANT_RESOURCE_UNAVAILABLE');
      if (serializedComponent.status !== 'AVAILABLE') {
        throw new Error('SERIALIZED_COMPONENT_NOT_AVAILABLE');
      }

      const serializedComponentModel = serializedComponent.component_model_id
        ? await ComponentModel.findByPk(serializedComponent.component_model_id, {
            attributes: ['id', 'asset_type_id'],
            transaction,
          })
        : null;

      const activeInstallation = await aircraftComponentInstallationTenantRepository.getActiveForSerializedComponentUpdate(authority, serializedComponentId, {
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
            await aircraftComponentInstallationTenantRepository.hasActivePositionConflict(authority, aircraftId, assetTypeId, position, { transaction, lock: transaction.LOCK.UPDATE }) ||
            await aircraftComponentTenantRepository.hasActivePositionConflict(authority, aircraftId, assetTypeId, position, { transaction, lock: transaction.LOCK.UPDATE })
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

      await aircraftComponentInstallationTenantRepository.create(authority,
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

      const statusResult = await serializedComponentTenantRepository.updateInstallationStatus(authority, serializedComponentId, 'INSTALLED', { transaction });
      if (statusResult.outcome !== 'CHANGED') throw new Error('TENANT_RESOURCE_UNAVAILABLE');

    });
  }

  static async removeSerializedComponent(authority: TenantQueryAuthority, data: any) {
    assertTenantQueryAuthority(authority);
    return withTenantTransaction(authority, async (transaction) => {
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

      const aircraft = await aircraftTenantRepository.getForRootUpdate(authority, aircraftId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!aircraft) throw new Error('TENANT_RESOURCE_UNAVAILABLE');

      const installation = await aircraftComponentInstallationTenantRepository.getActiveForUpdate(authority, installationId, aircraftId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!installation) {
        throw new Error('TENANT_RESOURCE_UNAVAILABLE');
      }

      if (new Date(removedAt).getTime() < new Date(String(installation.installed_at)).getTime()) {
        throw new Error('REMOVAL_BEFORE_INSTALL');
      }

      const serializedComponentId = String(installation.serialized_component_id || '');
      const serializedComponent = await serializedComponentTenantRepository.getForUpdate(authority, serializedComponentId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
      });

      if (!serializedComponent) {
        throw new Error('TENANT_RESOURCE_UNAVAILABLE');
      }

      if (serializedComponent.status !== 'INSTALLED') {
        throw new Error('SERIALIZED_COMPONENT_NOT_INSTALLED');
      }

      const removalResult = await aircraftComponentInstallationTenantRepository.removeActiveById(authority, installationId, aircraftId,
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
            : (installation.notes == null ? null : String(installation.notes)),
        },
        { transaction }
      );
      if (removalResult.outcome !== 'CHANGED') throw new Error('TENANT_RESOURCE_UNAVAILABLE');

      const statusResult = await serializedComponentTenantRepository.updateInstallationStatus(authority, serializedComponentId, resultingStatus as 'REMOVED' | 'AVAILABLE', { transaction });
      if (statusResult.outcome !== 'CHANGED') throw new Error('TENANT_RESOURCE_UNAVAILABLE');

    });
  }
}
