import { pool } from '../../config/database';

export async function getUserPermissions(userId: string): Promise<Set<string>> {
  const result = await pool.query(
    `
    SELECT p.code
    FROM rf_permission p
    JOIN rf_role_permissions rp ON rp.permission_id = p.id
    JOIN user_roles ur ON ur.role_id = rp.role_id
    WHERE ur.user_id = $1
    `,
    [userId]
  );

  return new Set(result.rows.map(r => r.code));
}