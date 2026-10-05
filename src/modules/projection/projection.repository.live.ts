import { QueryTypes } from 'sequelize';
import { sequelize } from '../../models/index.js';
import {
  FleetProjectionRepository,
  type ProjectionAircraftRow,
  type ProjectionComponentRow,
} from './projection.repository.js';

const COMPONENT_PROJECTION_SQL = `
  WITH tenant_components AS (
    SELECT
      component.id,
      component.aircraft_id,
      component.serial_number,
      component.install_af_hours,
      component.tso_at_install,
      component.current_status,
      model.model_name,
      asset_type.label AS category_name,
      model.default_tbo_hours AS tbo_hours,
      CASE
        WHEN component.current_status = 'INSTALLED'
          THEN component.tso_at_install + GREATEST(aircraft.total_time_hours - component.install_af_hours, 0)
        ELSE component.tso_at_install
      END AS current_actual_tso
    FROM aircraft_components component
    JOIN aircraft ON aircraft.id = component.aircraft_id
    JOIN component_models model ON model.id = component.model_id
    LEFT JOIN rf_asset_type asset_type ON asset_type.id = model.asset_type_id
    WHERE
      (
        component.current_status = 'INSTALLED'
        AND aircraft.tenant_id = :tenantId
        AND component.custodian_tenant_id = :tenantId
      )
      OR
      (
        component.current_status = 'REMOVED'
        AND component.custodian_tenant_id = :tenantId
      )
  )
  SELECT
    id,
    aircraft_id,
    model_name,
    COALESCE(category_name, 'UNCATEGORIZED') AS category_name,
    serial_number,
    install_af_hours AS install_hours_airframe,
    current_actual_tso,
    tbo_hours,
    CASE WHEN tbo_hours IS NULL OR tbo_hours <= 0 THEN NULL
         ELSE tbo_hours - current_actual_tso END AS hours_remaining,
    CASE WHEN tbo_hours IS NULL OR tbo_hours <= 0 THEN 'UNKNOWN'
         WHEN tbo_hours - current_actual_tso <= 0 THEN 'EXPIRED'
         WHEN tbo_hours - current_actual_tso <= 50 THEN 'CRITICAL'
         ELSE 'NORMAL' END AS maintenance_status,
    current_status,
    tso_at_install
  FROM tenant_components
  ORDER BY model_name ASC, serial_number ASC`;

export const fleetProjectionRepository = new FleetProjectionRepository({
  listAircraft: (tenantId) => sequelize.query<ProjectionAircraftRow>(
    `SELECT id, registration, serial_number, total_time_hours
       FROM aircraft
      WHERE tenant_id = :tenantId
      ORDER BY registration ASC`,
    { replacements: { tenantId }, type: QueryTypes.SELECT },
  ),
  listComponents: (tenantId) => sequelize.query<ProjectionComponentRow>(
    COMPONENT_PROJECTION_SQL,
    { replacements: { tenantId }, type: QueryTypes.SELECT },
  ),
});
