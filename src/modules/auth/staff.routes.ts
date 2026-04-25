import { Router } from 'express';
import { pool } from '../../config/database.js';

const router = Router();

// 2.4: Staff List View
router.get('/', async (req, res) => {
  const users = await pool.query(`
    SELECT u.id, u.email, u.full_name, u.is_active,
           array_agg(r.code) FILTER (WHERE r.code IS NOT NULL) as roles
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN rf_role r ON ur.role_id = r.id
    GROUP BY u.id
    ORDER BY u.full_name ASC
  `);

  const allRoles = await pool.query('SELECT id, code, label FROM rf_role ORDER BY label ASC');
  
  res.render('auth/staff-list', { users: users.rows, allRoles: allRoles.rows });
});

// 2.4: Role Toggle Action (Assign/Remove)
router.post('/toggle-role', async (req, res) => {
  const { userId, roleId } = req.body;

  // Check if link exists
  const existing = await pool.query(
    'SELECT id FROM user_roles WHERE user_id = $1 AND role_id = $2',
    [userId, roleId]
  );

  if ((existing.rowCount ?? 0) > 0) {
    await pool.query('DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [userId, roleId]);
  } else {
    await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [userId, roleId]);
  }

  res.status(200).send(); // HTMX handles the checkbox state locally or reloads
});

export default router;
