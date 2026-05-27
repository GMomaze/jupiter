'use strict';

export default {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS public.airworthiness_directives_model_index;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS public.airworthiness_directives_make_index;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS airworthiness_directives_make_index
      ON public.airworthiness_directives USING btree (make);
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS airworthiness_directives_model_index
      ON public.airworthiness_directives USING btree (model);
    `);
  },
};
