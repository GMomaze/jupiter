'use strict';

import { DataTypes, QueryInterface, QueryTypes } from 'sequelize';

const TABLE = 'component_models';
const OBSOLETE_HOURS = 'overhaul_interval_hours';
const OBSOLETE_MONTHS = 'overhaul_interval_months';

type SchemaState = {
  table_count: number;
  service_hours_ok: boolean;
  service_months_ok: boolean;
  tbo_hours_ok: boolean;
  tbo_months_ok: boolean;
  obsolete_hours_exists: boolean;
  obsolete_months_exists: boolean;
  obsolete_hours_ok: boolean;
  obsolete_months_ok: boolean;
};

async function readSchemaState(queryInterface: QueryInterface, transaction: unknown) {
  const [state] = await queryInterface.sequelize.query<SchemaState>(
    `SELECT
       (SELECT count(*)::int FROM information_schema.tables
          WHERE table_schema='public' AND table_name='component_models') AS table_count,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='component_models'
          AND column_name='service_interval_hours' AND data_type='numeric' AND numeric_precision=10 AND numeric_scale=2) AS service_hours_ok,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='component_models'
          AND column_name='service_interval_months' AND data_type='integer') AS service_months_ok,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='component_models'
          AND column_name='default_tbo_hours' AND data_type='numeric' AND numeric_precision=10 AND numeric_scale=2) AS tbo_hours_ok,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='component_models'
          AND column_name='default_tbo_months' AND data_type='integer') AS tbo_months_ok,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='component_models'
          AND column_name='overhaul_interval_hours') AS obsolete_hours_exists,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='component_models'
          AND column_name='overhaul_interval_months') AS obsolete_months_exists,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='component_models'
          AND column_name='overhaul_interval_hours' AND data_type='numeric' AND numeric_precision=10 AND numeric_scale=2) AS obsolete_hours_ok,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='component_models'
          AND column_name='overhaul_interval_months' AND data_type='integer') AS obsolete_months_ok;`,
    { type: QueryTypes.SELECT, transaction: transaction as never }
  );
  return state;
}

function requireAuthoritativeSchema(state: SchemaState | undefined) {
  if (!state || state.table_count !== 1) throw new Error('COMPONENT_MODELS_TABLE_REQUIRED');
  if (!state.service_hours_ok || !state.service_months_ok || !state.tbo_hours_ok || !state.tbo_months_ok) {
    throw new Error('COMPONENT_MODEL_AUTHORITATIVE_INTERVAL_SCHEMA_INVALID');
  }
}

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      const state = await readSchemaState(queryInterface, transaction);
      requireAuthoritativeSchema(state);
      if (!state.obsolete_hours_ok || !state.obsolete_months_ok) {
        throw new Error('COMPONENT_MODEL_OBSOLETE_INTERVAL_COLUMNS_REQUIRED');
      }

      const [legacy] = await queryInterface.sequelize.query<{ populated_count: number }>(
        `SELECT count(*)::int AS populated_count
           FROM public.component_models
          WHERE overhaul_interval_hours IS NOT NULL
             OR overhaul_interval_months IS NOT NULL;`,
        { type: QueryTypes.SELECT, transaction }
      );
      if (!legacy || legacy.populated_count !== 0) {
        throw new Error('COMPONENT_MODEL_OBSOLETE_INTERVAL_DATA_PRESENT');
      }

      await queryInterface.removeColumn(TABLE, OBSOLETE_HOURS, { transaction });
      await queryInterface.removeColumn(TABLE, OBSOLETE_MONTHS, { transaction });
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      const state = await readSchemaState(queryInterface, transaction);
      requireAuthoritativeSchema(state);
      if (state.obsolete_hours_exists || state.obsolete_months_exists) {
        throw new Error('COMPONENT_MODEL_OBSOLETE_INTERVAL_COLUMNS_ALREADY_EXIST');
      }

      // Slice A proved these columns held no values. Rollback recreates their historical
      // nullable types but intentionally cannot reconstruct values after the columns drop.
      await queryInterface.addColumn(TABLE, OBSOLETE_HOURS, {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      }, { transaction });
      await queryInterface.addColumn(TABLE, OBSOLETE_MONTHS, {
        type: DataTypes.INTEGER,
        allowNull: true,
      }, { transaction });
    });
  },
};
