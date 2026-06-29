'use strict';

import { QueryInterface } from 'sequelize';

const permissionCodes = [
  'AD_APPLICABILITY_REVIEW_VIEW',
  'AD_APPLICABILITY_REVIEW_REFRESH',
  'AD_APPLICABILITY_REVIEW_ACCEPT',
  'AD_APPLICABILITY_REVIEW_IGNORE',
  'AD_APPLICABILITY_REVIEW_RESTORE',
  'AD_APPLICABILITY_REVIEW_LINK_MODEL',
  'AD_APPLICABILITY_REVIEW_LINK_MANUFACTURER',
];

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO public.rf_permission (code, label, description, module, system_locked)
      VALUES
        (
          'AD_APPLICABILITY_REVIEW_VIEW',
          'AD Applicability Review View',
          'View AD applicability review allocations',
          'AD_APPLICABILITY',
          true
        ),
        (
          'AD_APPLICABILITY_REVIEW_REFRESH',
          'AD Applicability Review Refresh',
          'Refresh AD applicability suggestion allocations',
          'AD_APPLICABILITY',
          true
        ),
        (
          'AD_APPLICABILITY_REVIEW_ACCEPT',
          'AD Applicability Review Accept',
          'Accept AD applicability review allocations',
          'AD_APPLICABILITY',
          true
        ),
        (
          'AD_APPLICABILITY_REVIEW_IGNORE',
          'AD Applicability Review Ignore',
          'Ignore AD applicability review allocations',
          'AD_APPLICABILITY',
          true
        ),
        (
          'AD_APPLICABILITY_REVIEW_RESTORE',
          'AD Applicability Review Restore',
          'Restore ignored AD applicability review allocations',
          'AD_APPLICABILITY',
          true
        ),
        (
          'AD_APPLICABILITY_REVIEW_LINK_MODEL',
          'AD Applicability Review Link Model',
          'Manually link an AD applicability allocation to a component model',
          'AD_APPLICABILITY',
          true
        ),
        (
          'AD_APPLICABILITY_REVIEW_LINK_MANUFACTURER',
          'AD Applicability Review Link Manufacturer',
          'Manually link an AD applicability allocation to a manufacturer',
          'AD_APPLICABILITY',
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
        ON p.code IN (
          'AD_APPLICABILITY_REVIEW_VIEW',
          'AD_APPLICABILITY_REVIEW_REFRESH',
          'AD_APPLICABILITY_REVIEW_ACCEPT',
          'AD_APPLICABILITY_REVIEW_IGNORE',
          'AD_APPLICABILITY_REVIEW_RESTORE',
          'AD_APPLICABILITY_REVIEW_LINK_MODEL',
          'AD_APPLICABILITY_REVIEW_LINK_MANUFACTURER'
        )
      WHERE r.code IN ('ADMIN', 'QA')
      ON CONFLICT DO NOTHING;

      INSERT INTO public.rf_role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM public.rf_role r
      JOIN public.rf_permission p
        ON p.code = 'AD_APPLICABILITY_REVIEW_VIEW'
      WHERE r.code IN ('ENGINEER', 'PLANNER', 'VIEWER')
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
