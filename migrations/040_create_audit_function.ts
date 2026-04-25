'use strict';

export default {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
      RETURNS trigger AS $$
      BEGIN
        -- Only set updated_at if the column exists
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = TG_TABLE_NAME
            AND column_name = 'updated_at'
        ) THEN
          NEW.updated_at = NOW();
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DROP FUNCTION IF EXISTS public.fn_audit_trigger CASCADE;
    `);
  },
};