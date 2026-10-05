'use strict';

import { QueryInterface } from 'sequelize';

const TABLES = ['workpack_snags', 'workpack_snag_audit_log'] as const;

export default {
  async up(queryInterface: QueryInterface) {
    for (const table of TABLES) {
      if (!await queryInterface.describeTable(table).catch(() => null)) {
        throw new Error(`${table.toUpperCase()}_TABLE_REQUIRED`);
      }
    }
    await queryInterface.sequelize.transaction(async transaction => {
      for (const table of TABLES) {
        await queryInterface.sequelize.query(
          `ALTER TABLE public.${table} ALTER COLUMN workpack_id DROP NOT NULL;`,
          { transaction },
        );
      }
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      for (const table of TABLES) {
        const [rows] = await queryInterface.sequelize.query(
          `SELECT EXISTS (
             SELECT 1 FROM public.${table} WHERE workpack_id IS NULL
           ) AS has_standalone_rows;`,
          { transaction },
        );
        if ((rows as Array<{ has_standalone_rows: boolean }>)[0]?.has_standalone_rows) {
          throw new Error(`STANDALONE_${table.toUpperCase()}_PREVENTS_NOT_NULL_ROLLBACK`);
        }
      }
      for (const table of TABLES) {
        await queryInterface.sequelize.query(
          `ALTER TABLE public.${table} ALTER COLUMN workpack_id SET NOT NULL;`,
          { transaction },
        );
      }
    });
  },
};
