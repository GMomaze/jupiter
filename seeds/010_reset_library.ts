import type { Knex } from "knex";

export async function seed(knex: Knex): Promise<void> {

  console.log("🌱 Resetting library tables...");

  /**
   * Delete in correct FK order
   * (children → parents)
   */

  await knex("workpack_tasks").del();

  await knex("workpacks").del();

  await knex("maintenance_requirements").del();

  await knex("aircraft").del();

  await knex("component_models").del();

  await knex("manufacturers").del();

  console.log("✅ Library reset complete");

}