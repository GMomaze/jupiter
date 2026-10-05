'use strict';

import { DataTypes, QueryInterface, literal } from 'sequelize';

const TABLE = 'manufacturer_source_names';

async function tableExists(queryInterface: QueryInterface, table: string) {
  return Boolean(await queryInterface.describeTable(table).catch(() => null));
}

async function ensureConstraint(
  queryInterface: QueryInterface,
  constraintName: string,
  definition: string
) {
  await queryInterface.sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
          FROM information_schema.table_constraints
         WHERE table_schema = 'public'
           AND table_name = '${TABLE}'
           AND constraint_name = '${constraintName}'
      ) THEN
        ALTER TABLE public.${TABLE}
        ADD CONSTRAINT ${constraintName} ${definition};
      END IF;
    END
    $$;
  `);
}

export default {
  async up(queryInterface: QueryInterface) {
    if (!(await tableExists(queryInterface, 'manufacturers'))) {
      throw new Error('MANUFACTURERS_TABLE_REQUIRED');
    }

    if (!(await tableExists(queryInterface, TABLE))) {
      await queryInterface.createTable(TABLE, {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: literal('gen_random_uuid()'),
        },
        manufacturer_id: {
          type: DataTypes.UUID,
          allowNull: false,
          references: { model: 'manufacturers', key: 'id' },
          onUpdate: 'NO ACTION',
          onDelete: 'RESTRICT',
        },
        source_type: {
          type: DataTypes.STRING(50),
          allowNull: false,
        },
        source_name: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        normalized_source_name: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        is_active: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: literal('CURRENT_TIMESTAMP'),
        },
      });
    }

    await ensureConstraint(
      queryInterface,
      'manufacturer_source_names_source_type_check',
      "CHECK (source_type IN ('FAA_AD'))"
    );
    await ensureConstraint(
      queryInterface,
      'manufacturer_source_names_source_name_nonblank_check',
      'CHECK (length(trim(source_name)) > 0)'
    );
    await ensureConstraint(
      queryInterface,
      'manufacturer_source_names_normalized_nonblank_check',
      'CHECK (length(normalized_source_name) > 0)'
    );
    await ensureConstraint(
      queryInterface,
      'manufacturer_source_names_normalization_check',
      `CHECK (
        normalized_source_name = upper(
          regexp_replace(
            translate(trim(source_name), '‐‑‒–—―', '------'),
            '[^A-Za-z0-9]+',
            '',
            'g'
          )
        )
      )`
    );

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS manufacturer_source_names_source_identity_unique
      ON public.${TABLE} (source_type, normalized_source_name);
    `);
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS manufacturer_source_names_administration_index
      ON public.${TABLE} (manufacturer_id, source_type, is_active);
    `);
  },

  async down(queryInterface: QueryInterface) {
    if (await tableExists(queryInterface, TABLE)) {
      await queryInterface.dropTable(TABLE);
    }
  },
};
