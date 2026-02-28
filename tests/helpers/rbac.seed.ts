import { pool } from '../../src/config/database';

export async function seedRBAC() {

  const permissions = [
    { code: 'reference:view', label: 'Reference View' },
    { code: 'reference:create', label: 'Reference Create' },
    { code: 'reference:update', label: 'Reference Update' },
    { code: 'reference:deactivate', label: 'Reference Deactivate' }
  ];

  // Insert permissions (rf_permission requires module)
  for (const perm of permissions) {
    await pool.query(
      `
      INSERT INTO rf_permission (code, label, module)
      VALUES ($1, $2, $3)
      ON CONFLICT (code) DO NOTHING
      `,
      [perm.code, perm.label, 'REFERENCE']
    );
  }

  const roles = [
    'REFERENCE_ADMIN',
    'REFERENCE_EDITOR',
    'REFERENCE_VIEWER'
  ];

  // Insert roles (rf_role requires code + label)
  for (const role of roles) {
    await pool.query(
      `
      INSERT INTO rf_role (code, label)
      VALUES ($1, $2)
      ON CONFLICT (code) DO NOTHING
      `,
      [role, role.replace('_', ' ')]
    );
  }

  const mapping: Record<string, string[]> = {
    REFERENCE_ADMIN: permissions.map(p => p.code),
    REFERENCE_EDITOR: [
      'reference:view',
      'reference:create',
      'reference:update'
    ],
    REFERENCE_VIEWER: [
      'reference:view'
    ]
  };

  for (const roleCode of Object.keys(mapping)) {

    const roleRes = await pool.query(
      `SELECT id FROM rf_role WHERE code = $1`,
      [roleCode]
    );

    const roleId = roleRes.rows[0].id;

    for (const permCode of mapping[roleCode]) {

      const permRes = await pool.query(
        `SELECT id FROM rf_permission WHERE code = $1`,
        [permCode]
      );

      await pool.query(
        `
        INSERT INTO rf_role_permissions (role_id, permission_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [roleId, permRes.rows[0].id]
      );
    }
  }
}