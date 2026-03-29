import type { Knex } from 'knex';

type ManufacturerSeed = {
  name: string;
  code: string;
  description?: string;
};

type ModelSeed = {
  manufacturerCode: string;
  assetTypeCode: string;
  modelName: string;
  defaultTboHours?: number | null;
  defaultTboMonths?: number | null;
  isLifeLimited?: boolean;
  requirements?: Array<{
    title: string;
    intervalHours?: number | null;
    intervalMonths?: number | null;
    description?: string | null;
  }>;
};

export async function seed(knex: Knex): Promise<void> {
  const assetTypes = await knex('rf_asset_type')
    .whereIn('code', ['AIRFRAME', 'ENGINE', 'PROPELLER']);

  const assetTypeMap = Object.fromEntries(assetTypes.map((row) => [row.code, row]));

  if (!assetTypeMap.AIRFRAME || !assetTypeMap.ENGINE || !assetTypeMap.PROPELLER) {
    throw new Error('Missing required asset types for library seed');
  }

  const manufacturers: ManufacturerSeed[] = [
    {
      name: 'Cessna',
      code: 'CESSNA',
      description: 'General aviation airframe manufacturer',
    },
    {
      name: 'Piper',
      code: 'PIPER',
      description: 'General aviation airframe manufacturer',
    },
    {
      name: 'Lycoming',
      code: 'LYCOMING',
      description: 'Piston aircraft engine manufacturer',
    },
    {
      name: 'Continental',
      code: 'CONTINENTAL',
      description: 'Piston aircraft engine manufacturer',
    },
    {
      name: 'McCauley',
      code: 'MCCAULEY',
      description: 'Aircraft propeller manufacturer',
    },
    {
      name: 'Hartzell',
      code: 'HARTZELL',
      description: 'Aircraft propeller manufacturer',
    },
  ];

  for (const manufacturer of manufacturers) {
    await knex('manufacturers')
      .insert({
        id: knex.raw('gen_random_uuid()'),
        name: manufacturer.name,
        code: manufacturer.code,
        description: manufacturer.description ?? null,
        is_active: true,
      })
      .onConflict('code')
      .merge({
        name: manufacturer.name,
        description: manufacturer.description ?? null,
        is_active: true,
      });
  }

  const manufacturerRows = await knex('manufacturers')
    .whereIn('code', manufacturers.map((item) => item.code));

  const manufacturerMap = Object.fromEntries(
    manufacturerRows.map((row) => [row.code, row])
  );

  const models: ModelSeed[] = [
    {
      manufacturerCode: 'CESSNA',
      assetTypeCode: 'AIRFRAME',
      modelName: 'Cessna 172',
      requirements: [
        {
          title: 'Annual Inspection',
          intervalMonths: 12,
          description: 'Complete annual airframe inspection',
        },
        {
          title: '100 Hour Inspection',
          intervalHours: 100,
          description: 'Recurring inspection for training and rental operations',
        },
      ],
    },
    {
      manufacturerCode: 'PIPER',
      assetTypeCode: 'AIRFRAME',
      modelName: 'PA-28-181 Archer II',
      requirements: [
        {
          title: 'Annual Inspection',
          intervalMonths: 12,
          description: 'Complete annual airframe inspection',
        },
      ],
    },
    {
      manufacturerCode: 'LYCOMING',
      assetTypeCode: 'ENGINE',
      modelName: 'O-320-D2J',
      defaultTboHours: 2000,
      requirements: [
        {
          title: '50 Hour Oil and Filter Service',
          intervalHours: 50,
          description: 'Oil, filter, and engine bay inspection',
        },
        {
          title: 'Top Overhaul Evaluation',
          intervalHours: 1000,
          description: 'Compression, borescope, and valve train evaluation',
        },
      ],
    },
    {
      manufacturerCode: 'CONTINENTAL',
      assetTypeCode: 'ENGINE',
      modelName: 'O-200-A',
      defaultTboHours: 1800,
      requirements: [
        {
          title: '50 Hour Oil and Filter Service',
          intervalHours: 50,
          description: 'Oil, filter, and engine bay inspection',
        },
      ],
    },
    {
      manufacturerCode: 'MCCAULEY',
      assetTypeCode: 'PROPELLER',
      modelName: '1A170E/JHA7660',
      defaultTboHours: 2000,
      defaultTboMonths: 72,
      isLifeLimited: true,
      requirements: [
        {
          title: 'Propeller Inspection',
          intervalHours: 100,
          description: 'Blade, spinner, and tracking inspection',
        },
      ],
    },
    {
      manufacturerCode: 'HARTZELL',
      assetTypeCode: 'PROPELLER',
      modelName: 'HC-C2YK-1BF/F7666A-2',
      defaultTboHours: 2400,
      defaultTboMonths: 72,
      isLifeLimited: true,
      requirements: [
        {
          title: 'Propeller Inspection',
          intervalHours: 100,
          description: 'Blade, spinner, and tracking inspection',
        },
      ],
    },
  ];

  for (const modelSeed of models) {
    const manufacturer = manufacturerMap[modelSeed.manufacturerCode];
    const assetType = assetTypeMap[modelSeed.assetTypeCode];

    if (!manufacturer || !assetType) {
      continue;
    }

    let model = await knex('component_models')
      .where({
        manufacturer_id: manufacturer.id,
        asset_type_id: assetType.id,
        model_name: modelSeed.modelName,
      })
      .first();

    if (!model) {
      [model] = await knex('component_models')
        .insert({
          id: knex.raw('gen_random_uuid()'),
          manufacturer_id: manufacturer.id,
          asset_type_id: assetType.id,
          model_name: modelSeed.modelName,
          default_tbo_hours: modelSeed.defaultTboHours ?? null,
          default_tbo_months: modelSeed.defaultTboMonths ?? null,
          is_life_limited: modelSeed.isLifeLimited ?? false,
          is_active: true,
        })
        .returning('*');
    }

    if (!model || !modelSeed.requirements?.length) {
      continue;
    }

    for (const requirement of modelSeed.requirements) {
      const existing = await knex('maintenance_requirements')
        .where({
          model_id: model.id,
          title: requirement.title,
        })
        .first();

      if (!existing) {
        await knex('maintenance_requirements').insert({
          id: knex.raw('gen_random_uuid()'),
          model_id: model.id,
          title: requirement.title,
          interval_hours: requirement.intervalHours ?? null,
          interval_months: requirement.intervalMonths ?? null,
          description: requirement.description ?? null,
        });
      }
    }
  }
}
