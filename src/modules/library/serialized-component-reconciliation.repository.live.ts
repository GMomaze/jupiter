import { QueryTypes, type QueryOptionsWithType } from 'sequelize';
import sequelize from '../../config/database.js';
import {
  SerializedComponentReconciliationRepository,
  type LegacyReconciliationRow,
  type SerializedComponentReconciliationData,
  type SerializedInstallationReconciliationRow,
} from './serialized-component-reconciliation.repository.js';

async function loadData(tenantId: string | null): Promise<SerializedComponentReconciliationData> {
  const queryOptions: QueryOptionsWithType<QueryTypes.SELECT> = tenantId
    ? { replacements: { tenantId }, type: QueryTypes.SELECT }
    : { type: QueryTypes.SELECT };
  const legacyScope = tenantId
    ? 'WHERE ac.custodian_tenant_id = :tenantId AND aircraft.tenant_id = :tenantId'
    : '';
  const installationScope = tenantId
    ? `WHERE aci.removed_at IS NULL
         AND sc.custodian_tenant_id = :tenantId
         AND aircraft.tenant_id = :tenantId
         AND NOT EXISTS (
             SELECT 1
             FROM aircraft_component_installations foreign_installation
             JOIN aircraft foreign_aircraft ON foreign_aircraft.id = foreign_installation.aircraft_id
            WHERE foreign_installation.serialized_component_id = sc.id
              AND foreign_installation.removed_at IS NULL
              AND foreign_aircraft.tenant_id <> :tenantId
         )`
    : '';
  const componentScope = tenantId ? 'WHERE custodian_tenant_id = :tenantId' : '';

  const [legacyRows, serializedInstallationRows, countRows] = await Promise.all([
    sequelize.query<LegacyReconciliationRow>(
      `SELECT ac.id AS legacy_component_id, ac.aircraft_id,
              aircraft.registration AS aircraft_registration,
              ac.model_id AS legacy_model_id, ac.serial_number AS legacy_serial_number,
              ac.position_code AS legacy_position, ac.current_status AS legacy_status,
              ac.removed_at AS legacy_removed_at, cm.model_code AS legacy_model_code,
              cm.model_name AS legacy_model_name, cm.asset_type_id AS legacy_asset_type_id,
              at.code AS legacy_asset_type_code
         FROM aircraft_components ac
         JOIN aircraft ON aircraft.id = ac.aircraft_id
         LEFT JOIN component_models cm ON cm.id = ac.model_id
         LEFT JOIN rf_asset_type at ON at.id = cm.asset_type_id
         ${legacyScope}
        ORDER BY aircraft.registration ASC NULLS LAST,
                 ac.position_code ASC NULLS LAST, ac.serial_number ASC NULLS LAST`,
      queryOptions,
    ),
    sequelize.query<SerializedInstallationReconciliationRow>(
      `SELECT aci.id AS serialized_installation_id, aci.aircraft_id,
              aircraft.registration AS aircraft_registration,
              aci.position AS serialized_position, aci.removed_at AS serialized_removed_at,
              sc.id AS serialized_component_id, sc.component_model_id AS serialized_model_id,
              sc.serial_number AS serialized_serial_number, sc.status AS serialized_status,
              cm.model_code AS serialized_model_code, cm.model_name AS serialized_model_name,
              cm.asset_type_id AS serialized_asset_type_id,
              at.code AS serialized_asset_type_code, sls.id AS life_state_id
         FROM aircraft_component_installations aci
         JOIN serialized_components sc ON sc.id = aci.serialized_component_id
         JOIN aircraft ON aircraft.id = aci.aircraft_id
         LEFT JOIN component_models cm ON cm.id = sc.component_model_id
         LEFT JOIN rf_asset_type at ON at.id = cm.asset_type_id
         LEFT JOIN serialized_component_life_states sls ON sls.serialized_component_id = sc.id
         ${installationScope}
        ORDER BY aircraft.registration ASC NULLS LAST,
                 aci.position ASC NULLS LAST, sc.serial_number ASC NULLS LAST`,
      queryOptions,
    ),
    sequelize.query<{ total_serialized_components: number }>(
      `SELECT COUNT(*)::int AS total_serialized_components
         FROM serialized_components ${componentScope}`,
      queryOptions,
    ),
  ]);

  return {
    legacyRows,
    serializedInstallationRows,
    totalSerializedComponents: Number(countRows[0]?.total_serialized_components || 0),
  };
}

export const serializedComponentReconciliationRepository =
  new SerializedComponentReconciliationRepository({
    loadForTenant: tenantId => loadData(tenantId),
  });

export const loadGlobalReconciliationDataForMigration = () => loadData(null);
