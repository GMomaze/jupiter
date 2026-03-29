import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {

  await knex.transaction(async (trx) => {

    // 🔥 Drop view first
    await trx.raw(`DROP VIEW IF EXISTS vw_component_status;`);

    // 🔥 Create corrected view (MODEL_ID FIXED)
    await trx.raw(`
      CREATE VIEW vw_component_status AS
      SELECT 
        c.id,
        c.serial_number,
        COALESCE(m.model_name, 'UNKNOWN MODEL') AS model_name,
        COALESCE(cat.label, 'UNCATEGORIZED') AS category_name,
        a.registration AS tail_number,
        c.install_af_hours,

        a.total_time_hours AS current_airframe_hours,

        (COALESCE(a.total_time_hours, 0) - COALESCE(c.install_af_hours, 0)) AS current_actual_tso,

        COALESCE(m.default_tbo_hours, 0) AS tbo_hours,

        (
          COALESCE(m.default_tbo_hours, 0) -
          (COALESCE(a.total_time_hours, 0) - COALESCE(c.install_af_hours, 0))
        ) AS hours_remaining,

        CASE
          WHEN (
            COALESCE(m.default_tbo_hours, 0) -
            (COALESCE(a.total_time_hours, 0) - COALESCE(c.install_af_hours, 0))
          ) <= 0 THEN 'EXPIRED'
          WHEN (
            COALESCE(m.default_tbo_hours, 0) -
            (COALESCE(a.total_time_hours, 0) - COALESCE(c.install_af_hours, 0))
          ) <= 50 THEN 'CRITICAL'
          ELSE 'NORMAL'
        END AS maintenance_status,

        c.current_status AS component_status,
        c.aircraft_id

      FROM aircraft_components c
      LEFT JOIN component_models m ON c.model_id = m.id
      LEFT JOIN rf_asset_type cat ON m.asset_type_id = cat.id
      LEFT JOIN aircraft a ON c.aircraft_id = a.id;
    `);

  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP VIEW IF EXISTS vw_component_status;`);
}