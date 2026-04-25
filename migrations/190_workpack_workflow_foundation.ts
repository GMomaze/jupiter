'use strict';

async function tableExists(queryInterface, table) {
  return await queryInterface.describeTable(table).catch(() => null);
}

async function columnExists(queryInterface, table, column) {
  const def = await queryInterface.describeTable(table).catch(() => null);
  return def && def[column];
}

export default {
  up: async (queryInterface, Sequelize) => {
    const hasTaskCards = await tableExists(queryInterface, 'task_cards');
    const hasWorkpacks = await tableExists(queryInterface, 'workpacks');

    // =========================================
    // TASK_CARDS
    // =========================================
    if (hasTaskCards) {
      if (!(await columnExists(queryInterface, 'task_cards', 'mechanic_completed_by'))) {
        await queryInterface.addColumn('task_cards', 'mechanic_completed_by', {
          type: Sequelize.UUID,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        });
      }

      if (!(await columnExists(queryInterface, 'task_cards', 'mechanic_completed_at'))) {
        await queryInterface.addColumn('task_cards', 'mechanic_completed_at', {
          type: Sequelize.DATE,
        });
      }

      if (!(await columnExists(queryInterface, 'task_cards', 'engineer_certified_by'))) {
        await queryInterface.addColumn('task_cards', 'engineer_certified_by', {
          type: Sequelize.UUID,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        });
      }

      if (!(await columnExists(queryInterface, 'task_cards', 'engineer_certified_at'))) {
        await queryInterface.addColumn('task_cards', 'engineer_certified_at', {
          type: Sequelize.DATE,
        });
      }
    }

    // =========================================
    // WORKPACKS
    // =========================================
    if (hasWorkpacks) {
      if (!(await columnExists(queryInterface, 'workpacks', 'qa_required'))) {
        await queryInterface.addColumn('workpacks', 'qa_required', {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        });
      }

      if (!(await columnExists(queryInterface, 'workpacks', 'certified_by'))) {
        await queryInterface.addColumn('workpacks', 'certified_by', {
          type: Sequelize.UUID,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        });
      }

      if (!(await columnExists(queryInterface, 'workpacks', 'certified_at'))) {
        await queryInterface.addColumn('workpacks', 'certified_at', {
          type: Sequelize.DATE,
        });
      }

      if (!(await columnExists(queryInterface, 'workpacks', 'qa_reviewed_by'))) {
        await queryInterface.addColumn('workpacks', 'qa_reviewed_by', {
          type: Sequelize.UUID,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        });
      }

      if (!(await columnExists(queryInterface, 'workpacks', 'qa_reviewed_at'))) {
        await queryInterface.addColumn('workpacks', 'qa_reviewed_at', {
          type: Sequelize.DATE,
        });
      }

      if (!(await columnExists(queryInterface, 'workpacks', 'released_by'))) {
        await queryInterface.addColumn('workpacks', 'released_by', {
          type: Sequelize.UUID,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        });
      }

      if (!(await columnExists(queryInterface, 'workpacks', 'released_at'))) {
        await queryInterface.addColumn('workpacks', 'released_at', {
          type: Sequelize.DATE,
        });
      }
    }
  },

  down: async (queryInterface) => {
    // =========================================
    // TASK_CARDS
    // =========================================
    const hasTaskCards = await queryInterface.describeTable('task_cards').catch(() => null);

    if (hasTaskCards) {
      await queryInterface.removeColumn('task_cards', 'mechanic_completed_by').catch(() => {});
      await queryInterface.removeColumn('task_cards', 'mechanic_completed_at').catch(() => {});
      await queryInterface.removeColumn('task_cards', 'engineer_certified_by').catch(() => {});
      await queryInterface.removeColumn('task_cards', 'engineer_certified_at').catch(() => {});
    }

    // =========================================
    // WORKPACKS
    // =========================================
    const hasWorkpacks = await queryInterface.describeTable('workpacks').catch(() => null);

    if (hasWorkpacks) {
      await queryInterface.removeColumn('workpacks', 'qa_required').catch(() => {});
      await queryInterface.removeColumn('workpacks', 'certified_by').catch(() => {});
      await queryInterface.removeColumn('workpacks', 'certified_at').catch(() => {});
      await queryInterface.removeColumn('workpacks', 'qa_reviewed_by').catch(() => {});
      await queryInterface.removeColumn('workpacks', 'qa_reviewed_at').catch(() => {});
      await queryInterface.removeColumn('workpacks', 'released_by').catch(() => {});
      await queryInterface.removeColumn('workpacks', 'released_at').catch(() => {});
    }
  },
};