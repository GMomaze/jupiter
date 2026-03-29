import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTaskCards = await knex.schema.hasTable('task_cards');

  if (!hasTaskCards) {
    return;
  }

  const hasWorkPerformed = await knex.schema.hasColumn('task_cards', 'work_performed');

  if (!hasWorkPerformed) {
    await knex.schema.alterTable('task_cards', (table) => {
      table.text('work_performed');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTaskCards = await knex.schema.hasTable('task_cards');

  if (!hasTaskCards) {
    return;
  }

  const hasWorkPerformed = await knex.schema.hasColumn('task_cards', 'work_performed');

  if (hasWorkPerformed) {
    await knex.schema.alterTable('task_cards', (table) => {
      table.dropColumn('work_performed');
    });
  }
}
