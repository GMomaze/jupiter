import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('task_templates');

  if (!hasTable) {
    return;
  }

  await knex('task_templates').del();

  const cessna172 = await knex('component_models')
    .where({ model_name: 'Cessna 172' })
    .first();

  const zsAbc = await knex('aircraft')
    .where({ registration: 'ZS-ABC' })
    .first();

  const templates = [
    {
      scope: 'GLOBAL',
      title: 'General post-maintenance housekeeping',
      description: 'Inspect work area, verify all tools and materials are accounted for, and record any outstanding observations.',
      aircraft_model_id: null,
      aircraft_id: null,
      is_active: true
    },
    {
      scope: 'GLOBAL',
      title: 'Maintenance documentation review',
      description: 'Confirm task paperwork is complete, legible, and matched to the correct work order and aircraft.',
      aircraft_model_id: null,
      aircraft_id: null,
      is_active: true
    },
    {
      scope: 'MODEL',
      title: 'Cessna 172 control run and freedom check',
      description: 'Carry out a full and free movement check of primary flight controls in accordance with the aircraft maintenance manual.',
      aircraft_model_id: cessna172?.id ?? null,
      aircraft_id: null,
      is_active: true
    },
    {
      scope: 'AIRCRAFT',
      title: 'ZS-ABC recurring cabin trim inspection',
      description: 'Inspect the known cabin side-panel trim area on ZS-ABC for looseness, missing fasteners, and wear.',
      aircraft_model_id: null,
      aircraft_id: zsAbc?.id ?? null,
      is_active: true
    }
  ].filter((template) => {
    if (template.scope === 'MODEL') return Boolean(template.aircraft_model_id);
    if (template.scope === 'AIRCRAFT') return Boolean(template.aircraft_id);
    return true;
  });

  if (templates.length > 0) {
    await knex('task_templates').insert(
      templates.map((template) => ({
        id: knex.raw('gen_random_uuid()'),
        ...template
      }))
    );
  }
}
