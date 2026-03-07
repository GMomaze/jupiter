import type { Knex } from "knex";

export async function seed(knex: Knex): Promise<void> {

  console.log("🌱 Seeding component models...");

  /**
   * Lookup asset types
   */
  const aircraft = await knex("rf_asset_type")
    .where({ code: "AIRCRAFT" })
    .first();

  const engine = await knex("rf_asset_type")
    .where({ code: "ENGINE" })
    .first();

  const propeller = await knex("rf_asset_type")
    .where({ code: "PROPELLER" })
    .first();

  /**
   * Lookup manufacturers
   */
  const cessna = await knex("manufacturers")
    .where({ code: "CESSNA" })
    .first();

  const piper = await knex("manufacturers")
    .where({ code: "PIPER" })
    .first();

  const beechcraft = await knex("manufacturers")
    .where({ code: "BEECHCRAFT" })
    .first();

  const continental = await knex("manufacturers")
    .where({ code: "CONTINENTAL" })
    .first();

  const lycoming = await knex("manufacturers")
    .where({ code: "LYCOMING" })
    .first();

  const hartzell = await knex("manufacturers")
    .where({ code: "HARTZELL" })
    .first();

  const mccauley = await knex("manufacturers")
    .where({ code: "MCCAULEY" })
    .first();

  /**
   * Safety checks so seeds fail early if reference data missing
   */
  if (!aircraft || !engine || !propeller) {
    throw new Error("Required asset types missing from rf_asset_type seed");
  }

  if (!cessna || !piper || !beechcraft || !continental || !lycoming || !hartzell || !mccauley) {
    throw new Error("Required manufacturers missing from manufacturers seed");
  }

  /**
   * Insert component models
   * THIS DEFINES WHICH OEM BELONGS TO WHICH ASSET TYPE
   */
  await knex("component_models").insert([

    /**
     * Aircraft
     */
    {
      manufacturer_id: cessna.id,
      asset_type_id: aircraft.id,
      model_name: "172A"
    },
    {
      manufacturer_id: cessna.id,
      asset_type_id: aircraft.id,
      model_name: "172M"
    },
    {
      manufacturer_id: piper.id,
      asset_type_id: aircraft.id,
      model_name: "PA-28-235"
    },
    {
      manufacturer_id: beechcraft.id,
      asset_type_id: aircraft.id,
      model_name: "A36 Bonanza"
    },

    /**
     * Engines
     */
    {
      manufacturer_id: continental.id,
      asset_type_id: engine.id,
      model_name: "O-300C"
    },
    {
      manufacturer_id: lycoming.id,
      asset_type_id: engine.id,
      model_name: "O-540-B4B5"
    },
    {
      manufacturer_id: continental.id,
      asset_type_id: engine.id,
      model_name: "IO-520-BA"
    },

    /**
     * Propellers
     */
    {
      manufacturer_id: hartzell.id,
      asset_type_id: propeller.id,
      model_name: "PHC-C3YF-1RF/F7691"
    },
    {
      manufacturer_id: hartzell.id,
      asset_type_id: propeller.id,
      model_name: "HC-C3YF-1RF/F7693F"
    },
    {
      manufacturer_id: mccauley.id,
      asset_type_id: propeller.id,
      model_name: "1C172EM7654"
    }

  ]);

  console.log("✅ Component models seeded");
}