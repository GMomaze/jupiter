'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

export default {
  async up(queryInterface, Sequelize) {
    const adTable = 'airworthiness_directives';
    const relationshipTable = 'ad_relationships';

    if (!(await tableExists(queryInterface, adTable))) {
      await queryInterface.createTable(adTable, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        ad_number: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        revision: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        subject_heading: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        subject: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        summary: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        comments: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        status: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        cfr_part_reference: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        effective_date: {
          type: Sequelize.DATEONLY,
          allowNull: true,
        },
        authority: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        service_office: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        primary_responsibility_office: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        docket_number: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        citation: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        citation_publish_date: {
          type: Sequelize.DATEONLY,
          allowNull: true,
        },
        make: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        model: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        product_type: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        product_subtype: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        is_recurring: {
          type: Sequelize.BOOLEAN,
          allowNull: true,
        },
        interval_hours: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        interval_months: {
          type: Sequelize.INTEGER,
          allowNull: true,
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        created_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
    }

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS airworthiness_directives_ad_number_revision_unique
      ON airworthiness_directives (ad_number, revision);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS airworthiness_directives_ad_number_index
      ON airworthiness_directives (ad_number);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS airworthiness_directives_status_index
      ON airworthiness_directives (status);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS airworthiness_directives_effective_date_index
      ON airworthiness_directives (effective_date);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS airworthiness_directives_make_index
      ON airworthiness_directives (make);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS airworthiness_directives_model_index
      ON airworthiness_directives (model);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS airworthiness_directives_product_type_index
      ON airworthiness_directives (product_type);
    `);

    if (!(await tableExists(queryInterface, relationshipTable))) {
      await queryInterface.createTable(relationshipTable, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.literal('gen_random_uuid()'),
        },
        ad_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: adTable,
            key: 'id',
          },
          onUpdate: 'NO ACTION',
          onDelete: 'CASCADE',
        },
        related_ad_number: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        relationship_type: {
          type: Sequelize.STRING,
          allowNull: true,
        },
      });
    }

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS ad_relationships_ad_id_index
      ON ad_relationships (ad_id);
    `);
  },

  async down() {
    return;
  },
};
