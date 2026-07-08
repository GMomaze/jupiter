'use strict';

async function getColumnInfo(queryInterface, tableName, columnName) {
  const definition = await queryInterface.describeTable(tableName).catch(() => null);
  return definition?.[columnName] || null;
}

export default {
  async up(queryInterface, Sequelize) {
    const tableName = 'compliance_items';
    const columnInfo = await getColumnInfo(queryInterface, tableName, 'title');

    if (!columnInfo) {
      return;
    }

    const currentType = String(columnInfo.type || '').toUpperCase();
    if (currentType === 'TEXT') {
      return;
    }

    await queryInterface.changeColumn(tableName, 'title', {
      type: Sequelize.TEXT,
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    const tableName = 'compliance_items';
    const columnInfo = await getColumnInfo(queryInterface, tableName, 'title');

    if (!columnInfo) {
      return;
    }

    const currentType = String(columnInfo.type || '').toUpperCase();
    if (currentType !== 'TEXT') {
      return;
    }

    const [{ rows_with_long_titles }] = await queryInterface.sequelize.query(
      `
        SELECT COUNT(*)::int AS rows_with_long_titles
        FROM public.compliance_items
        WHERE length(title) > 255
      `,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (Number(rows_with_long_titles || 0) > 0) {
      throw new Error(
        'Cannot safely revert compliance_items.title to VARCHAR(255) because rows longer than 255 characters exist.'
      );
    }

    await queryInterface.changeColumn(tableName, 'title', {
      type: Sequelize.STRING(255),
      allowNull: false,
    });
  },
};
