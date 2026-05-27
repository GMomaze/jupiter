'use strict';

async function getColumnInfo(queryInterface, tableName, columnName) {
  const definition = await queryInterface.describeTable(tableName).catch(() => null);
  return definition?.[columnName] || null;
}

export default {
  async up(queryInterface, Sequelize) {
    const tableName = 'airworthiness_directives';
    const columnName = 'model';
    const columnInfo = await getColumnInfo(queryInterface, tableName, columnName);

    if (!columnInfo) {
      return;
    }

    const currentType = String(columnInfo.type || '').toUpperCase();
    if (currentType === 'TEXT') {
      return;
    }

    await queryInterface.changeColumn(tableName, columnName, {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    const tableName = 'airworthiness_directives';
    const columnName = 'model';
    const columnInfo = await getColumnInfo(queryInterface, tableName, columnName);

    if (!columnInfo) {
      return;
    }

    const [{ rows_with_long_values }] = await queryInterface.sequelize.query(
      `
        SELECT COUNT(*)::int AS rows_with_long_values
        FROM public.airworthiness_directives
        WHERE length(model) > 255
      `,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (Number(rows_with_long_values || 0) > 0) {
      throw new Error(
        'Cannot safely revert airworthiness_directives.model to VARCHAR(255) because rows longer than 255 characters exist.'
      );
    }

    await queryInterface.changeColumn(tableName, columnName, {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },
};
