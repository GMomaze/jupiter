'use strict';

export default {
  async up(queryInterface, Sequelize) {
    console.log('🧩 Task Template Seed Starting...');

    // =========================================
    // CHECK TABLE EXISTS
    // =========================================
    const table = await queryInterface.describeTable('task_templates').catch(() => null);
    if (!table) return;

    // =========================================
    // CLEAN
    // =========================================
    await queryInterface.bulkDelete('task_templates', null, {});

    // =========================================
    // LOAD REFERENCES
    // =========================================
    const [cessna150m] = await queryInterface.sequelize.query(
      `SELECT * FROM component_models WHERE model_name = 'Cessna 150M' LIMIT 1`,
      { type: Sequelize.QueryTypes.SELECT }
    );

  /*  const [zsSwu] = await queryInterface.sequelize.query(
      `SELECT * FROM aircraft WHERE registration = 'ZS-SWU' LIMIT 1`,
      { type: Sequelize.QueryTypes.SELECT }
    );
*/
    // =========================================
    // TEMPLATES
    // =========================================
    const templates = []/*
      {
        scope: 'GLOBAL',
        task_card_number: 'TPL-GLOBAL-001',
        sort_order: 10,
        title: 'General post-maintenance housekeeping',
        description: 'Inspect work area, verify all tools and materials are accounted for, and record any outstanding observations.',
        aircraft_model_id: null,
        aircraft_id: null,
        is_active: true
      },
      {
        scope: 'GLOBAL',
        task_card_number: 'TPL-GLOBAL-002',
        sort_order: 20,
        title: 'Maintenance documentation review',
        description: 'Confirm task paperwork is complete, legible, and matched to the correct work order and aircraft.',
        aircraft_model_id: null,
        aircraft_id: null,
        is_active: true
      },
      {
        scope: 'MODEL',
        task_card_number: 'TPL-C150M-001',
        sort_order: 100,
        title: 'Cessna 150M control run and freedom check',
        description: 'Carry out a full and free movement check of primary flight controls in accordance with the aircraft maintenance manual.',
        aircraft_model_id: cessna150m?.id ?? null,
        aircraft_id: null,
        is_active: true
      },
      {
        scope: 'AIRCRAFT',
        task_card_number: 'TPL-ZS-SWU-001',
        sort_order: 200,
        title: 'ZS-SWU recurring cabin trim inspection',
        description: 'Inspect the known cabin side-panel trim area on ZS-SWU for looseness, missing fasteners, and wear.',
        aircraft_model_id: null,
        aircraft_id: zsSwu?.id ?? null,
        is_active: true
      }
    ].filter((t) => {
      if (t.scope === 'MODEL') return Boolean(t.aircraft_model_id);
      if (t.scope === 'AIRCRAFT') return Boolean(t.aircraft_id);
      return true;
    });
*/
    // =========================================
    // INSERT
    // =========================================
    for (const t of templates) {
      await queryInterface.sequelize.query(
        `
        INSERT INTO task_templates (
          id, scope, task_card_number, sort_order,
          title, description,
          aircraft_model_id, aircraft_id,
          is_active, created_at, updated_at
        )
        VALUES (
          gen_random_uuid(), :scope, :task_card_number, :sort_order,
          :title, :description,
          :aircraft_model_id, :aircraft_id,
          :is_active, NOW(), NOW()
        );
        `,
        { replacements: t }
      );
    }

    console.log('✅ Task Template Seed Complete');
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('task_templates', null, {});
  }
};