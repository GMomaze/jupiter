import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Silence triggers using replica role to allow clean wipe
  await knex.raw('SET session_replication_role = "replica";');

  try {
    // 1. Wipe operational data in correct FK order
    await knex('workpack_tasks').del();
    await knex('workpacks').del();
    await knex('task_cards').del();
    await knex('aircraft').del();
    await knex('component_models').del();
    await knex('rf_aircraft_category').del();

    // 2. Reference Statuses
    await knex('rf_workpack_status').insert([
      { code: 'DRAFT', label: 'Draft', description: 'Initial Planning' },
      { code: 'ISSUED', label: 'Issued', description: 'Released to Hangar' },
      { code: 'IN_PROGRESS', label: 'In Progress', description: 'Work in Progress' },
      { code: 'CLOSED', label: 'Closed', description: 'Maintenance Completed' }
    ]).onConflict('code').ignore();

    // 3. Aircraft Category
    const [category] = await knex('rf_aircraft_category').insert({
      id: knex.fn.uuid(),
      code: 'GA',
      label: 'General Aviation',
      description: 'Small aircraft for non-commercial use'
    }).returning('id');

    // 4. Create a Component Model (Mandatory Parent for Aircraft)
    const [model] = await knex('component_models').insert({
      id: knex.fn.uuid(),
      model_name: 'Cessna 172A',
      is_active: true
    }).returning('id');

    // 5. Test Aircraft (Using model_id, not model)
    const aircraftId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    await knex('aircraft').insert({
      id: aircraftId,
      registration: 'ZS-COE',
      serial_number: '2108-9934',
      category_id: category.id,
      model_id: model.id,
      status: 'REGISTERED',
      version: 0
    });

    // 6. Task Cards
    await knex('task_cards').insert([
      { 
        id: knex.fn.uuid(), 
        aircraft_id: aircraftId,
        title: 'Engine Oil Filter', 
        description: 'Remove and inspect engine oil scavenge filter.', 
        status: 'OPEN' 
      },
      { 
        id: knex.fn.uuid(), 
        aircraft_id: aircraftId,
        title: 'Tire Pressure Check', 
        description: 'Check MLG tire pressures.', 
        status: 'OPEN' 
      }
    ]);

    console.log('✅ Success: Tables seeded with DDL-compliant data.');

  } catch (error) {
    console.error('❌ Seed Error:', error);
    throw error;
  } finally {
    // Restore triggers
    await knex.raw('SET session_replication_role = "origin";');
  }
}