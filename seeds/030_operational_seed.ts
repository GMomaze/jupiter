import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  try {
    // Clean in FK order for repeatable seeding.
    await knex('workpack_requirements').del();
    await knex('workpack_tasks').del();
    await knex('workpacks').del();
    await knex('task_cards').del();
    await knex('aircraft_components').del();
    await knex('aircraft').del();
    await knex('component_models').del();

    // Get required reference data.
    const airframeAssetType = await knex('rf_asset_type')
      .where({ code: 'AIRFRAME' })
      .first();

    const engineAssetType = await knex('rf_asset_type')
      .where({ code: 'ENGINE' })
      .first();

    const category = await knex('rf_aircraft_category')
      .where({ code: 'FIXED_WING' })
      .first();

    let airframeManufacturer = await knex('manufacturers')
      .where({ name: 'Cessna' })
      .first();

    if (!airframeManufacturer) {
      [airframeManufacturer] = await knex('manufacturers')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          name: 'Cessna',
          code: 'CESSNA',
          is_active: true
        })
        .returning('*');
    }

    let engineManufacturer = await knex('manufacturers')
      .where({ name: 'Lycoming' })
      .first();

    if (!engineManufacturer) {
      [engineManufacturer] = await knex('manufacturers')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          name: 'Lycoming',
          code: 'LYCOMING',
          is_active: true
        })
        .returning('*');
    }

    if (!airframeAssetType || !engineAssetType || !category || !airframeManufacturer || !engineManufacturer) {
      throw new Error('❌ Missing reference data');
    }

    // Create airframe model for the aircraft master.
    const [airframeModel] = await knex('component_models')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        manufacturer_id: airframeManufacturer.id,
        model_name: 'Cessna 172',
        asset_type_id: airframeAssetType.id,
        default_tbo_hours: null,
        default_tbo_months: null,
        is_life_limited: false,
        is_active: true
      })
      .returning('*');

    // Create engine component model for installed components.
    const [engineModel] = await knex('component_models')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        manufacturer_id: engineManufacturer.id,
        model_name: 'O-320-D2J',
        asset_type_id: engineAssetType.id,
        default_tbo_hours: 2000,
        default_tbo_months: null,
        is_life_limited: false,
        is_active: true
      })
      .returning('*');

    // Create aircraft.
    const [aircraft] = await knex('aircraft')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        registration: 'ZS-ABC',
        serial_number: 'SN123',
        category_id: category.id,
        model_id: airframeModel.id,
        status: 'REGISTERED',
        total_time_hours: 1000,
        total_time_cycles: 500,
        version: 0
      })
      .returning('*');

    // Create installed component row.
    const [installedEngine] = await knex('aircraft_components')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        aircraft_id: aircraft.id,
        model_id: engineModel.id,
        serial_number: 'ENG001',
        position_code: 'ENG-1',
        installation_date: knex.fn.now(),
        install_af_hours: 500,
        tso_at_install: 0,
        tsn_at_install: 0,
        current_status: 'INSTALLED'
      })
      .returning('*');

    await knex('task_cards').insert([
      {
        id: knex.raw('gen_random_uuid()'),
        title: 'Drain engine oil',
        description: 'Drain engine oil into an approved waste container and inspect for contamination.',
        status: 'OPEN',
        aircraft_id: aircraft.id,
        component_id: installedEngine.id,
        version: 0
      },
      {
        id: knex.raw('gen_random_uuid()'),
        title: 'Remove oil filter',
        description: 'Remove the installed oil filter and inspect the filter media for debris.',
        status: 'OPEN',
        aircraft_id: aircraft.id,
        component_id: installedEngine.id,
        version: 0
      },
      {
        id: knex.raw('gen_random_uuid()'),
        title: 'Remove spark plugs',
        description: 'Remove all spark plugs for inspection, cleaning, and gap check.',
        status: 'OPEN',
        aircraft_id: aircraft.id,
        component_id: installedEngine.id,
        version: 0
      },
      {
        id: knex.raw('gen_random_uuid()'),
        title: 'Fit new oil filter',
        description: 'Install a new approved oil filter and safety wire it in accordance with the maintenance manual.',
        status: 'OPEN',
        aircraft_id: aircraft.id,
        component_id: installedEngine.id,
        version: 0
      },
      {
        id: knex.raw('gen_random_uuid()'),
        title: 'Replenish oil to correct level',
        description: 'Refill engine with the correct grade and quantity of oil and verify dipstick level.',
        status: 'OPEN',
        aircraft_id: aircraft.id,
        component_id: installedEngine.id,
        version: 0
      },
      {
        id: knex.raw('gen_random_uuid()'),
        title: 'Refit spark plugs and torque',
        description: 'Reinstall spark plugs using the correct torque values and reconnect ignition leads.',
        status: 'OPEN',
        aircraft_id: aircraft.id,
        component_id: installedEngine.id,
        version: 0
      }
    ]);

    console.log('✈️ Operational seed complete');

  } catch (error) {
    console.error('❌ Operational Seed Error:', error);
    throw error;
  }
}
