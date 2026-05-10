'use strict';

const LINKS_TABLE = 'customer_aircraft_links';
const OLD_UNIQUE_INDEX = 'customer_aircraft_links_one_current_per_aircraft';
const NEW_UNIQUE_INDEX = 'customer_aircraft_links_one_current_per_role';
const RELATIONSHIP_TYPE_CHECK = 'customer_aircraft_links_relationship_type_check';
const ALLOWED_RELATIONSHIP_TYPES = [
  'OWNER',
  'CO_OWNER',
  'OPERATOR',
  'BILLING_CUSTOMER',
  'MANAGEMENT_COMPANY',
  'CONTACT_ONLY',
];

function relationshipTypeList() {
  return ALLOWED_RELATIONSHIP_TYPES.map((value) => `'${value}'`).join(', ');
}

export default {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS ${OLD_UNIQUE_INDEX};
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE ${LINKS_TABLE}
      DROP CONSTRAINT IF EXISTS ${RELATIONSHIP_TYPE_CHECK};
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE ${LINKS_TABLE}
      ADD CONSTRAINT ${RELATIONSHIP_TYPE_CHECK}
      CHECK (relationship_type IN (${relationshipTypeList()}));
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS customer_aircraft_links_relationship_type_index
      ON ${LINKS_TABLE} (relationship_type);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS customer_aircraft_links_is_current_index
      ON ${LINKS_TABLE} (is_current);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS customer_aircraft_links_aircraft_role_current_index
      ON ${LINKS_TABLE} (aircraft_id, relationship_type, is_current);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS customer_aircraft_links_customer_role_current_index
      ON ${LINKS_TABLE} (customer_id, relationship_type, is_current);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS customer_aircraft_links_aircraft_customer_role_index
      ON ${LINKS_TABLE} (aircraft_id, customer_id, relationship_type);
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ${NEW_UNIQUE_INDEX}
      ON ${LINKS_TABLE} (aircraft_id, customer_id, relationship_type)
      WHERE is_current = true;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS ${NEW_UNIQUE_INDEX};
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS customer_aircraft_links_aircraft_customer_role_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS customer_aircraft_links_customer_role_current_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS customer_aircraft_links_aircraft_role_current_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS customer_aircraft_links_is_current_index;
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS customer_aircraft_links_relationship_type_index;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE ${LINKS_TABLE}
      DROP CONSTRAINT IF EXISTS ${RELATIONSHIP_TYPE_CHECK};
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ${OLD_UNIQUE_INDEX}
      ON ${LINKS_TABLE} (aircraft_id)
      WHERE is_current = true;
    `);
  },
};
