import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    REVOKE ALL ON TABLE audit_log FROM PUBLIC;
  `);

  await knex.raw(`
    GRANT SELECT, INSERT ON TABLE audit_log TO jupiter_app;
  `);

  await knex.raw(`
    GRANT SELECT, INSERT ON TABLE audit_log TO jupiter_test;
  `);

  await knex.raw(`
    REVOKE UPDATE, DELETE ON TABLE audit_log FROM jupiter_app;
  `);

  await knex.raw(`
    REVOKE UPDATE, DELETE ON TABLE audit_log FROM jupiter_test;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    GRANT ALL ON TABLE audit_log TO jupiter_app;
  `);

  await knex.raw(`
    GRANT ALL ON TABLE audit_log TO jupiter_test;
  `);
}