/**
 * PATH: C:\GMO\Projects\jupiter\src\database\seeds\02_library_seed.ts
 * PURPOSE: Seeds the library with a base model and its maintenance requirements.
 */

import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Clear existing data
  await knex('maintenance_requirements').del();

  // Get a model ID (Cessna from 01_reference_seed)
  const model = await knex('component_models').where('model_name', '172A').first();

  if (model) {
    await knex('maintenance_requirements').insert([
      {
        id: knex.raw('gen_random_uuid()'),
        model_id: model.id,
        title: '50Hr Inspection',
        interval_hours: 50,
        interval_months: null,
        description: 'Oil Change.Routine visual inspection of flight controls and tires.'
      },
      {
        id: knex.raw('gen_random_uuid()'),
        model_id: model.id,
        title: 'MPI',
        interval_hours: 100,
        interval_months: 12,
        description: 'Detailed inspection of internal systems and lubrication.'
      }
    ]);
  }

  console.log('✅ Library DNA: Maintenance Requirements Seeded.');
}