import type { Knex } from 'knex';

/**
 * 013b_backfill_aircraft_model_id
 *
 * Purpose:
 * - Backfill aircraft.model_id from legacy aircraft.model string
 * - Must execute before 014_enforce_aircraft_model_fk_and_version
 *
 * This ensures NOT NULL enforcement does not fail.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {

    await trx.raw(`
      UPDATE aircraft a
      SET model_id = cm.id
      FROM component_models cm
      WHERE a.model = cm.model_name
      AND a.model_id IS NULL;
    `);

  });
}

export async function down(_: Knex): Promise<void> {
  // No rollback required.
  // This migration only backfills data.
}
