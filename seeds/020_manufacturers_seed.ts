import type { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {

  console.log("🌱 Seeding manufacturers...");

  await knex('manufacturers')
    .insert([

      /**
       * Engine OEMs
       */
      {
        name: 'Pratt & Whitney',
        code: 'PW',
        is_active: true
      },
      {
        name: 'Honeywell',
        code: 'HONEYWELL',
        is_active: true
      },

      /**
       * General aviation aircraft OEMs
       */
      {
        name: 'Cessna',
        code: 'CESSNA',
        is_active: true
      },
      {
        name: 'Piper Aircraft',
        code: 'PIPER',
        is_active: true
      },
      {
        name: 'Beechcraft',
        code: 'BEECHCRAFT',
        is_active: true
      },

      /**
       * GA engine OEMs
       */
      {
        name: 'Continental Aerospace Technologies',
        code: 'CONTINENTAL',
        is_active: true
      },
      {
        name: 'Lycoming Engines',
        code: 'LYCOMING',
        is_active: true
      },

      /**
       * Propeller OEMs
       */
      {
        name: 'Hartzell Propeller',
        code: 'HARTZELL',
        is_active: true
      },
      {
        name: 'McCauley Propeller Systems',
        code: 'MCCAULEY',
        is_active: true
      }

    ])
    .onConflict('code')
    .ignore();

  console.log("✅ Manufacturers seeded");

}