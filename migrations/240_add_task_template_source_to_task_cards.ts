import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTaskCards = await knex.schema.hasTable('task_cards');

  if (!hasTaskCards) {
    return;
  }

  const hasTemplateSourceId = await knex.schema.hasColumn('task_cards', 'template_source_id');

  if (!hasTemplateSourceId) {
    await knex.schema.alterTable('task_cards', (table) => {
      table
        .uuid('template_source_id')
        .references('id')
        .inTable('task_templates')
        .onDelete('SET NULL');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTaskCards = await knex.schema.hasTable('task_cards');

  if (!hasTaskCards) {
    return;
  }

  const hasTemplateSourceId = await knex.schema.hasColumn('task_cards', 'template_source_id');

  if (hasTemplateSourceId) {
    await knex.schema.alterTable('task_cards', (table) => {
      table.dropColumn('template_source_id');
    });
  }
}
