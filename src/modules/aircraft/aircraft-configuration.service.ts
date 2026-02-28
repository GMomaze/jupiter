import { sequelize } from '../../models/index.js';
import { QueryTypes } from 'sequelize';

export class AircraftConfigurationService {

  /**
   * CURRENT CONFIGURATION
   */
  static async getCurrentConfiguration(aircraft_id: string) {

    const result = await sequelize.query(
      `
      SELECT
        ac.id,
        ac.model_id,
        ac.serial_number,
        ac.position_code,
        ac.tsn_at_install,
        ac.tso_at_install,
        ac.install_af_hours,
        ac.current_status,
        ac.installation_date,
        ac.removed_at,
        cm.model_name,
        m.name as manufacturer_name,
        at.code as asset_type_code
      FROM aircraft_components ac
      JOIN component_models cm ON cm.id = ac.model_id
      JOIN manufacturers m ON m.id = cm.manufacturer_id
      JOIN rf_asset_type at ON at.id = cm.asset_type_id
      WHERE ac.aircraft_id = :aircraft_id
      AND ac.current_status = 'INSTALLED'
      ORDER BY at.code, ac.position_code NULLS LAST
      `,
      {
        replacements: { aircraft_id },
        type: QueryTypes.SELECT
      }
    );

    return result;
  }

  /**
   * CONFIGURATION AT A GIVEN DATE
   */
  static async getConfigurationAtDate(
    aircraft_id: string,
    snapshotDate: Date
  ) {

    const result = await sequelize.query(
      `
      SELECT
        ac.id,
        ac.model_id,
        ac.serial_number,
        ac.position_code,
        ac.tsn_at_install,
        ac.tso_at_install,
        ac.install_af_hours,
        ac.installation_date,
        ac.removed_at,
        cm.model_name,
        m.name as manufacturer_name,
        at.code as asset_type_code
      FROM aircraft_components ac
      JOIN component_models cm ON cm.id = ac.model_id
      JOIN manufacturers m ON m.id = cm.manufacturer_id
      JOIN rf_asset_type at ON at.id = cm.asset_type_id
      WHERE ac.aircraft_id = :aircraft_id
      AND ac.installation_date <= :snapshotDate
      AND (
            ac.removed_at IS NULL
            OR ac.removed_at > :snapshotDate
          )
      ORDER BY at.code, ac.position_code NULLS LAST
      `,
      {
        replacements: {
          aircraft_id,
          snapshotDate
        },
        type: QueryTypes.SELECT
      }
    );

    return result;
  }
}
