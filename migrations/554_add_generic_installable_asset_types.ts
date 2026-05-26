'use strict';

const assetTypes = [
  ['MAGNETO', 'Magneto'],
  ['STARTER', 'Starter'],
  ['ALTERNATOR', 'Alternator'],
  ['STARTER_GENERATOR', 'Starter Generator'],
  ['GENERATOR', 'Generator'],
  ['FUEL_PUMP', 'Fuel Pump'],
  ['VACUUM_PUMP', 'Vacuum Pump'],
  ['GOVERNOR', 'Governor'],
  ['TURBOCHARGER', 'Turbocharger'],
  ['ACTUATOR', 'Actuator'],
  ['AVIONICS', 'Avionics'],
  ['ELT', 'ELT'],
  ['BATTERY', 'Battery'],
  ['WHEEL', 'Wheel'],
  ['BRAKE_ASSEMBLY', 'Brake Assembly'],
  ['CYLINDER', 'Cylinder'],
  ['IGNITION_HARNESS', 'Ignition Harness'],
  ['OXYGEN_BOTTLE', 'Oxygen Bottle'],
  ['INVERTER', 'Inverter'],
  ['HYDRAULIC_PUMP', 'Hydraulic Pump'],
  ['SERVO', 'Servo'],
  ['TRANSPONDER', 'Transponder'],
  ['GPS', 'GPS'],
  ['RADIO', 'Radio'],
  ['AUTOPILOT', 'Autopilot'],
  ['LANDING_GEAR_COMPONENT', 'Landing Gear Component'],
  ['FLIGHT_CONTROL_COMPONENT', 'Flight Control Component'],
];

async function getExistingCodes(queryInterface) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT code FROM rf_asset_type WHERE code IN (:codes)`,
    {
      replacements: { codes: assetTypes.map(([code]) => code) },
    }
  );

  return new Set(rows.map((row) => row.code));
}

export default {
  async up(queryInterface) {
    const existingCodes = await getExistingCodes(queryInterface);
    const now = new Date();

    const missingRows = assetTypes
      .filter(([code]) => !existingCodes.has(code))
      .map(([code, label]) => ({
        code,
        label,
        description: null,
        is_installable_on_aircraft: true,
        is_required_for_aircraft: false,
        required_quantity: 0,
        is_active: true,
        system_locked: false,
        created_at: now,
      }));

    if (missingRows.length > 0) {
      await queryInterface.bulkInsert('rf_asset_type', missingRows);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete(
      'rf_asset_type',
      {
        code: assetTypes.map(([code]) => code),
      }
    );
  },
};
