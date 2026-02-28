/**
 * PATH: C:\GMO\Projects\jupiter\src\database\seeds\02_library_seed.ts
 * PURPOSE: Seeds the library with a base model and its maintenance requirements.
 */

import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Clear existing data
  await knex('maintenance_requirements').del();

  // Get a model ID (Boeing 737-800 from 01_reference_seed)
  const model = await knex('component_models').where('model_name', '737-800').first();

  if (model) {
    await knex('maintenance_requirements').insert([
      {
        id: knex.raw('gen_random_uuid()'),
        model_id: model.id,
        title: 'Weekly Check',
        interval_hours: 150,
        interval_months: null,
        description: 'Routine visual inspection of flight controls and tires.'
      },
      {
        id: knex.raw('gen_random_uuid()'),
        model_id: model.id,
        title: 'A-Check',
        interval_hours: 500,
        interval_months: 6,
        description: 'Detailed inspection of internal systems and lubrication.'
      }
    ]);
  }

  console.log('✅ Library DNA: Maintenance Requirements Seeded.');
}