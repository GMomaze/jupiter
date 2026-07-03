'use strict';

import { QueryInterface } from 'sequelize';

const permissionCodes = ['AD_COMPLIANCE_STATUS_UPDATE'];

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO public.rf_permission (code, label, description, module, system_locked)
      VALUES (
        'AD_COMPLIANCE_STATUS_UPDATE',
        'AD Compliance Status Update',
        'Update operational status on AD aircraft compliance records',
        'AD_COMPLIANCE',
        true
      )
      ON CONFLICT (code) DO UPDATE SET
        label = EXCLUDED.label,
        description = EXCLUDED.description,
        module = EXCLUDED.module,
        system_locked = EXCLUDED.system_locked;

      INSERT INTO public.rf_role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM public.rf_role r
      JOIN public.rf_permission p
        ON p.code = 'AD_COMPLIANCE_STATUS_UPDATE'
      WHERE r.code IN ('ADMIN', 'QA')
      ON CONFLICT DO NOTHING;
    `);
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(
      `
      DELETE FROM public.rf_role_permissions rp
      USING public.rf_permission p
      WHERE rp.permission_id = p.id
        AND p.code IN (:permissionCodes);

      DELETE FROM public.rf_permission
      WHERE code IN (:permissionCodes);
      `,
      {
        replacements: {
          permissionCodes,
        },
      }
    );
  },
};
