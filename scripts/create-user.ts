import 'dotenv/config';
import { hashPassword } from '../src/modules/auth/password.util.js';
import { pool } from '../src/config/database.js';

async function run() {
  try {
    const email = 'qa@jupiter.local';
    const password = 'qa';
    const fullName = 'QA User';

    const passwordHash = await hashPassword(password);

    await pool.query(
      `
      INSERT INTO users (email, password_hash, full_name, is_active)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (email) DO NOTHING
      `,
      [email, passwordHash, fullName]
    );

    console.log('✅ Admin user created (or already exists)');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
  } catch (err) {
    console.error('❌ Failed to create user:', err);
  } finally {
    process.exit(0);
  }
}

run();