'use strict';

export default {
  async up(queryInterface, Sequelize) {
    console.log('🌱 Library Seed Starting...');

    // =========================================
    // LOAD ASSET TYPES
    // =========================================
    const assetTypes = await queryInterface.sequelize.query(
      `SELECT * FROM rf_asset_type WHERE code IN ('AIRFRAME','ENGINE','PROPELLER')`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const assetTypeMap = Object.fromEntries(assetTypes.map((row) => [row.code, row]));

    if (!assetTypeMap.AIRFRAME || !assetTypeMap.ENGINE || !assetTypeMap.PROPELLER) {
      throw new Error('Missing required asset types for library seed');
    }

    // =========================================
    // MANUFACTURERS
    // =========================================
    const manufacturers = [
      ['Cessna', 'CESSNA', 'General aviation airframe manufacturer'],
      ['Piper', 'PIPER', 'General aviation airframe manufacturer'],
      ['Lycoming', 'LYCOMING', 'Piston aircraft engine manufacturer'],
      ['Continental', 'CONTINENTAL', 'Piston aircraft engine manufacturer'],
      ['McCauley', 'MCCAULEY', 'Aircraft propeller manufacturer'],
      ['Hartzell', 'HARTZELL', 'Aircraft propeller manufacturer'],
    ];

    for (const m of manufacturers) {
      await queryInterface.sequelize.query(
        `
        INSERT INTO manufacturers (id, name, code, description, is_active, created_at)
        VALUES (gen_random_uuid(), :name, :code, :description, true, NOW())
        ON CONFLICT (code)
        DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          is_active = true;
        `,
        {
          replacements: {
            name: m[0],
            code: m[1],
            description: m[2]
          }
        }
      );
    }

    const manufacturerRows = await queryInterface.sequelize.query(
      `SELECT * FROM manufacturers WHERE code IN ('CESSNA','PIPER','LYCOMING','CONTINENTAL','MCCAULEY','HARTZELL')`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const manufacturerMap = Object.fromEntries(
      manufacturerRows.map((row) => [row.code, row])
    );

    // =========================================
    // MODELS
    // =========================================
    const models = [
      {
        manufacturerCode: 'CESSNA',
        assetTypeCode: 'AIRFRAME',
        modelName: 'Cessna 150M',
        requirements: [
          ['Annual Inspection', null, 12, 'Complete annual airframe inspection'],
          ['100 Hour Inspection', 100, null, 'Recurring inspection for training and rental operations']
        ]
      },
      {
        manufacturerCode: 'PIPER',
        assetTypeCode: 'AIRFRAME',
        modelName: 'PA-28-181 Archer II',
        requirements: [
          ['Annual Inspection', null, 12, 'Complete annual airframe inspection']
        ]
      },
      {
        manufacturerCode: 'LYCOMING',
        assetTypeCode: 'ENGINE',
        modelName: 'O-320-D2J',
        defaultTboHours: 2000,
        requirements: [
          ['50 Hour Oil and Filter Service', 50, null, 'Oil, filter, and engine bay inspection'],
          ['Top Overhaul Evaluation', 1000, null, 'Compression, borescope, and valve train evaluation']
        ]
      },
      {
        manufacturerCode: 'CONTINENTAL',
        assetTypeCode: 'ENGINE',
        modelName: 'O-200-A',
        defaultTboHours: 1800,
        requirements: [
          ['50 Hour Oil and Filter Service', 50, null, 'Oil, filter, and engine bay inspection']
        ]
      },
      {
        manufacturerCode: 'MCCAULEY',
        assetTypeCode: 'PROPELLER',
        modelName: '1A102/OCM6948',
        defaultTboHours: 2000,
        defaultTboMonths: 72,
        isLifeLimited: true,
        requirements: [
          ['Propeller Inspection', 100, null, 'Blade, spinner, and tracking inspection']
        ]
      },
      {
        manufacturerCode: 'HARTZELL',
        assetTypeCode: 'PROPELLER',
        modelName: 'HC-C2YK-1BF/F7666A-2',
        defaultTboHours: 2400,
        defaultTboMonths: 72,
        isLifeLimited: true,
        requirements: [
          ['Propeller Inspection', 100, null, 'Blade, spinner, and tracking inspection']
        ]
      }
    ];

    for (const m of models) {
      const manufacturer = manufacturerMap[m.manufacturerCode];
      const assetType = assetTypeMap[m.assetTypeCode];

      if (!manufacturer || !assetType) continue;

      const [existing] = await queryInterface.sequelize.query(
        `
        SELECT * FROM component_models
        WHERE manufacturer_id = :manufacturer_id
        AND asset_type_id = :asset_type_id
        AND model_name = :model_name
        LIMIT 1
        `,
        {
          replacements: {
            manufacturer_id: manufacturer.id,
            asset_type_id: assetType.id,
            model_name: m.modelName
          },
          type: Sequelize.QueryTypes.SELECT
        }
      );

      let model = existing;

      if (!model) {
        const [res] = await queryInterface.sequelize.query(
          `
          INSERT INTO component_models (
            id, manufacturer_id, asset_type_id, model_name,
            default_tbo_hours, default_tbo_months,
            is_life_limited, is_active, created_at
          )
          VALUES (
            gen_random_uuid(), :manufacturer_id, :asset_type_id, :model_name,
            :hours, :months, :life, true, NOW()
          )
          RETURNING *;
          `,
          {
            replacements: {
              manufacturer_id: manufacturer.id,
              asset_type_id: assetType.id,
              model_name: m.modelName,
              hours: m.defaultTboHours ?? null,
              months: m.defaultTboMonths ?? null,
              life: m.isLifeLimited ?? false
            },
            type: Sequelize.QueryTypes.INSERT
          }
        );

        model = res[0];
      }

      for (const req of m.requirements ?? []) {
        const [existingReq] = await queryInterface.sequelize.query(
          `
          SELECT * FROM maintenance_requirements
          WHERE model_id = :model_id AND title = :title
          LIMIT 1
          `,
          {
            replacements: { model_id: model.id, title: req[0] },
            type: Sequelize.QueryTypes.SELECT
          }
        );

        if (!existingReq) {
          await queryInterface.sequelize.query(
            `
            INSERT INTO maintenance_requirements (
              id, model_id, title, interval_hours, interval_months, description
            )
            VALUES (
              gen_random_uuid(), :model_id, :title, :hours, :months, :desc
            );
            `,
            {
              replacements: {
                model_id: model.id,
                title: req[0],
                hours: req[1],
                months: req[2],
                desc: req[3]
              }
            }
          );
        }
      }
    }

    console.log('📚 Library seed complete');
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('maintenance_requirements', null, {});
    await queryInterface.bulkDelete('component_models', null, {});
    await queryInterface.bulkDelete('manufacturers', null, {});
  }
};