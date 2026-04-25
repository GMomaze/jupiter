'use strict';

export default {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
          -- Only run if BOTH columns exist
          IF EXISTS (
              SELECT 1 
              FROM information_schema.columns 
              WHERE table_name = 'aircraft'
                AND column_name = 'model_id'
          )
          AND EXISTS (
              SELECT 1 
              FROM information_schema.columns 
              WHERE table_name = 'aircraft'
                AND column_name = 'model'
          )
          THEN

              -- Backfill safely
              UPDATE aircraft a
              SET model_id = cm.id
              FROM component_models cm
              WHERE a.model = cm.model_name
                AND a.model_id IS NULL;

          END IF;
      END
      $$;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
          IF EXISTS (
              SELECT 1 
              FROM information_schema.columns 
              WHERE table_name = 'aircraft'
                AND column_name = 'model_id'
          ) THEN

              UPDATE aircraft
              SET model_id = NULL;

          END IF;
      END
      $$;
    `);
  },
};