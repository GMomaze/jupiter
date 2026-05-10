'use strict';

export default {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE maintenance_templates
      DROP CONSTRAINT IF EXISTS maintenance_templates_model_id_fkey1;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE maintenance_template_items
      DROP CONSTRAINT IF EXISTS maintenance_template_items_template_id_fkey1;
    `);
  },

  async down() {
    return;
  },
};
