'use strict';

export default {
  async up(queryInterface, Sequelize) {
    try {
      console.log('🌱 Operational Seed Starting...');

      // =========================================
      // CLEAN (FK ORDER)
      // =========================================
      await queryInterface.bulkDelete('workpack_requirements', null, {});
      await queryInterface.bulkDelete('workpack_tasks', null, {});
      await queryInterface.bulkDelete('workpacks', null, {});
      await queryInterface.bulkDelete('task_cards', null, {});
      await queryInterface.bulkDelete('task_templates', null, {});
      await queryInterface.bulkDelete('aircraft_sb_compliance', null, {});
      await queryInterface.bulkDelete('service_bulletins', null, {});
      await queryInterface.bulkDelete('aircraft_components', null, {});
      await queryInterface.bulkDelete('aircraft', null, {});
      await queryInterface.bulkDelete('component_models', null, {});

      // =========================================
      // LOAD REFERENCE DATA
      // =========================================
      const [airframeAssetType] = await queryInterface.sequelize.query(
        `SELECT * FROM rf_asset_type WHERE code = 'AIRFRAME' LIMIT 1`,
        { type: Sequelize.QueryTypes.SELECT }
      );

      const [engineAssetType] = await queryInterface.sequelize.query(
        `SELECT * FROM rf_asset_type WHERE code = 'ENGINE' LIMIT 1`,
        { type: Sequelize.QueryTypes.SELECT }
      );

      const [category] = await queryInterface.sequelize.query(
        `SELECT * FROM rf_aircraft_category WHERE code = 'FIXED_WING' LIMIT 1`,
        { type: Sequelize.QueryTypes.SELECT }
      );

      if (!airframeAssetType || !engineAssetType || !category) {
        throw new Error('❌ Missing reference data');
      }

      // =========================================
      // MANUFACTURERS (SAFE UPSERT)
      // =========================================

      let [airframeManufacturer] = await queryInterface.sequelize.query(
        `SELECT * FROM manufacturers WHERE name = 'Cessna' LIMIT 1`,
        { type: Sequelize.QueryTypes.SELECT }
      );

      if (!airframeManufacturer) {
        const [res] = await queryInterface.sequelize.query(
          `
          INSERT INTO manufacturers (id, name, code, is_active, created_at)
          VALUES (gen_random_uuid(), 'Cessna', 'CESSNA', true, NOW())
          RETURNING *;
          `,
          { type: Sequelize.QueryTypes.INSERT }
        );
        airframeManufacturer = res[0];
      }

      let [engineManufacturer] = await queryInterface.sequelize.query(
        `SELECT * FROM manufacturers WHERE name = 'Continental' LIMIT 1`,
        { type: Sequelize.QueryTypes.SELECT }
      );

      if (!engineManufacturer) {
        const [res] = await queryInterface.sequelize.query(
          `
          INSERT INTO manufacturers (id, name, code, is_active, created_at)
          VALUES (gen_random_uuid(), 'Continental', 'CONTINENTAL', true, NOW())
          RETURNING *;
          `,
          { type: Sequelize.QueryTypes.INSERT }
        );
        engineManufacturer = res[0];
      }

      // =========================================
      // COMPONENT MODELS
      // =========================================
      const [airframeModelRes] = await queryInterface.sequelize.query(
        `
        INSERT INTO component_models (
          id, manufacturer_id, model_name, asset_type_id,
          default_tbo_hours, default_tbo_months,
          is_life_limited, is_active, created_at
        )
        VALUES (
          gen_random_uuid(), :manufacturer_id, 'Cessna 150M', :asset_type_id,
          NULL, NULL, false, true, NOW()
        )
        RETURNING *;
        `,
        {
          replacements: {
            manufacturer_id: airframeManufacturer.id,
            asset_type_id: airframeAssetType.id
          },
          type: Sequelize.QueryTypes.INSERT
        }
      );

      const airframeModel = airframeModelRes[0];

      const [engineModelRes] = await queryInterface.sequelize.query(
        `
        INSERT INTO component_models (
          id, manufacturer_id, model_name, asset_type_id,
          default_tbo_hours, default_tbo_months,
          is_life_limited, is_active, created_at
        )
        VALUES (
          gen_random_uuid(), :manufacturer_id, 'O-200A', :asset_type_id,
          2000, NULL, false, true, NOW()
        )
        RETURNING *;
        `,
        {
          replacements: {
            manufacturer_id: engineManufacturer.id,
            asset_type_id: engineAssetType.id
          },
          type: Sequelize.QueryTypes.INSERT
        }
      );

      const engineModel = engineModelRes[0];

      // =========================================
      // AIRCRAFT
      // =========================================
      const [aircraftRes] = await queryInterface.sequelize.query(
        `
        INSERT INTO aircraft (
          id, registration, serial_number, category_id,
          model_id, status, total_time_hours, total_time_cycles,
          version, created_at, updated_at
        )
        VALUES (
          gen_random_uuid(), 'ZS-SWU', '15079011', :category_id,
          :model_id, 'REGISTERED', 1000, 500,
          0, NOW(), NOW()
        )
        RETURNING *;
        `,
        {
          replacements: {
            category_id: category.id,
            model_id: airframeModel.id
          },
          type: Sequelize.QueryTypes.INSERT
        }
      );

      const aircraft = aircraftRes[0];

      // =========================================
      // COMPONENT INSTALL
      // =========================================
      const [engineInstallRes] = await queryInterface.sequelize.query(
        `
        INSERT INTO aircraft_components (
          id, aircraft_id, model_id, serial_number,
          position_code, installation_date,
          install_af_hours, tso_at_install, tsn_at_install,
          current_status, created_at
        )
        VALUES (
          gen_random_uuid(), :aircraft_id, :model_id, '251893',
          'ENG-1', NOW(),
          500, 0, 0,
          'INSTALLED', NOW()
        )
        RETURNING *;
        `,
        {
          replacements: {
            aircraft_id: aircraft.id,
            model_id: engineModel.id
          },
          type: Sequelize.QueryTypes.INSERT
        }
      );

      const installedEngine = engineInstallRes[0];

      // =========================================
      // TASK CARDS
      // =========================================
      const tasks = [
        ['ENG-001','Remove spark plugs','Remove all spark plugs for inspection, cleaning, and gap check.'],
        ['ENG-002','Drain engine oil','Drain engine oil into an approved waste container and inspect for contamination.'],
        ['ENG-003','Remove oil filter','Remove the installed oil filter and inspect the filter media for debris.'],
        ['ENG-004','Fit new oil filter','Install a new approved oil filter and safety wire it in accordance with the maintenance manual.'],
        ['ENG-005','Replenish oil','Refill engine with the correct grade and quantity of oil.'],
        ['ENG-006','Refit spark plugs','Reinstall spark plugs and reconnect ignition leads.']
      ];

      for (const t of tasks) {
        await queryInterface.sequelize.query(
          `
          INSERT INTO task_cards (
            id, task_card_number, title, description,
            status, aircraft_id, component_id,
            version, created_at, updated_at
          )
          VALUES (
            gen_random_uuid(), :num, :title, :desc,
            'OPEN', :aircraft_id, :component_id,
            0, NOW(), NOW()
          );
          `,
          {
            replacements: {
              num: t[0],
              title: t[1],
              desc: t[2],
              aircraft_id: aircraft.id,
              component_id: installedEngine.id
            }
          }
        );
      }

      console.log('✈️ Operational seed complete');

    } catch (error) {
      console.error('❌ Operational Seed Error:', error);
      throw error;
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('task_cards', null, {});
    await queryInterface.bulkDelete('aircraft_components', null, {});
    await queryInterface.bulkDelete('aircraft', null, {});
    await queryInterface.bulkDelete('component_models', null, {});
  }
};