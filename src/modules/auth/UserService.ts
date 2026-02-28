import { User, Role, Permission } from '../../models/index.js';

export class UserService {
  /**
   * 2.1: Find user for Auth (Enforces is_active)
   */
  async findForAuth(email: string) {
    // Note: This raw query is kept for simplicity, but could also be converted
    // to Sequelize. The main fix is in findById for the RBAC structure.
    const query = `
      SELECT 
        u.id, 
        u.email, 
        u.password_hash, 
        u.is_active
      FROM users u
      WHERE u.email = $1 AND u.is_active = true
    `;
    const { rows } = await pool.query(query, [email.toLowerCase().trim()]);
    return rows[0] || null;
  }

  /**
   * Needed for Passport Session Deserialization.
   * Fetches the user along with their roles and permissions using Sequelize.
   */
  async findById(id: string) {
    const user = await User.findByPk(id, {
      include: [
        {
          model: Role,
          include: [
            {
              model: Permission,
            },
          ],
        },
      ],
    });
    return user;
  }
}

// Need to import pool for findForAuth
import { pool } from '../../config/database.js';