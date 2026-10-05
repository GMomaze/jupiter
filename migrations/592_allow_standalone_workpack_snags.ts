'use strict';

import { DataTypes, QueryInterface } from 'sequelize';

const TABLE = 'workpack_snags';

export default {
  async up(queryInterface: QueryInterface) {
    const table = await queryInterface.describeTable(TABLE).catch(() => null);
    if (!table) throw new Error('WORKPACK_SNAGS_TABLE_REQUIRED');

    await queryInterface.changeColumn(TABLE, 'workpack_id', {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'workpacks', key: 'id' },
      onUpdate: 'NO ACTION',
      onDelete: 'CASCADE',
    });
  },

  async down(queryInterface: QueryInterface) {
    const [rows] = await queryInterface.sequelize.query(
      `SELECT EXISTS (
         SELECT 1 FROM public.${TABLE} WHERE workpack_id IS NULL
       ) AS has_standalone_snags;`
    );
    if ((rows as Array<{ has_standalone_snags: boolean }>)[0]?.has_standalone_snags) {
      throw new Error('STANDALONE_SNAGS_PREVENT_NOT_NULL_ROLLBACK');
    }

    await queryInterface.changeColumn(TABLE, 'workpack_id', {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'workpacks', key: 'id' },
      onUpdate: 'NO ACTION',
      onDelete: 'CASCADE',
    });
  },
};
