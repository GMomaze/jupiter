import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasTaskCards = await knex.schema.hasTable('task_cards');
  const hasWorkpacks = await knex.schema.hasTable('workpacks');

  if (hasTaskCards) {
    const hasMechanicCompletedBy = await knex.schema.hasColumn('task_cards', 'mechanic_completed_by');
    const hasMechanicCompletedAt = await knex.schema.hasColumn('task_cards', 'mechanic_completed_at');
    const hasEngineerCertifiedBy = await knex.schema.hasColumn('task_cards', 'engineer_certified_by');
    const hasEngineerCertifiedAt = await knex.schema.hasColumn('task_cards', 'engineer_certified_at');

    await knex.schema.alterTable('task_cards', (table) => {
      if (!hasMechanicCompletedBy) {
        table.uuid('mechanic_completed_by').references('id').inTable('users').onDelete('SET NULL');
      }

      if (!hasMechanicCompletedAt) {
        table.timestamp('mechanic_completed_at', { useTz: true });
      }

      if (!hasEngineerCertifiedBy) {
        table.uuid('engineer_certified_by').references('id').inTable('users').onDelete('SET NULL');
      }

      if (!hasEngineerCertifiedAt) {
        table.timestamp('engineer_certified_at', { useTz: true });
      }
    });
  }

  if (hasWorkpacks) {
    const hasQaRequired = await knex.schema.hasColumn('workpacks', 'qa_required');
    const hasCertifiedBy = await knex.schema.hasColumn('workpacks', 'certified_by');
    const hasCertifiedAt = await knex.schema.hasColumn('workpacks', 'certified_at');
    const hasQaReviewedBy = await knex.schema.hasColumn('workpacks', 'qa_reviewed_by');
    const hasQaReviewedAt = await knex.schema.hasColumn('workpacks', 'qa_reviewed_at');
    const hasReleasedBy = await knex.schema.hasColumn('workpacks', 'released_by');
    const hasReleasedAt = await knex.schema.hasColumn('workpacks', 'released_at');

    await knex.schema.alterTable('workpacks', (table) => {
      if (!hasQaRequired) {
        table.boolean('qa_required').notNullable().defaultTo(false);
      }

      if (!hasCertifiedBy) {
        table.uuid('certified_by').references('id').inTable('users').onDelete('SET NULL');
      }

      if (!hasCertifiedAt) {
        table.timestamp('certified_at', { useTz: true });
      }

      if (!hasQaReviewedBy) {
        table.uuid('qa_reviewed_by').references('id').inTable('users').onDelete('SET NULL');
      }

      if (!hasQaReviewedAt) {
        table.timestamp('qa_reviewed_at', { useTz: true });
      }

      if (!hasReleasedBy) {
        table.uuid('released_by').references('id').inTable('users').onDelete('SET NULL');
      }

      if (!hasReleasedAt) {
        table.timestamp('released_at', { useTz: true });
      }
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTaskCards = await knex.schema.hasTable('task_cards');
  const hasWorkpacks = await knex.schema.hasTable('workpacks');

  if (hasTaskCards) {
    await knex.schema.alterTable('task_cards', (table) => {
      table.dropColumn('mechanic_completed_by');
      table.dropColumn('mechanic_completed_at');
      table.dropColumn('engineer_certified_by');
      table.dropColumn('engineer_certified_at');
    });
  }

  if (hasWorkpacks) {
    await knex.schema.alterTable('workpacks', (table) => {
      table.dropColumn('qa_required');
      table.dropColumn('certified_by');
      table.dropColumn('certified_at');
      table.dropColumn('qa_reviewed_by');
      table.dropColumn('qa_reviewed_at');
      table.dropColumn('released_by');
      table.dropColumn('released_at');
    });
  }
}
