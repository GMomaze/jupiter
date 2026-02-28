import 'dotenv/config';

import app from './app.js';
import { pool } from './config/database.js';
import knex from 'knex';
import knexConfig from '../knexfile.js';
import { sequelize } from './models/index.js';

const PORT = process.env.PORT || 3000;
const db = knex(knexConfig);

async function startServer() {

  try {
    console.log('🚀 Checking for pending migrations...');
    const [batchNo, log] = await db.migrate.latest();

    if (log.length > 0) {
      console.log(`✅ Migrated batch ${batchNo}: ${log.join(', ')}`);
    } else {
      console.log('✅ Schema up to date.');
    }

    const result = await pool.query(
      'SELECT usesuper FROM pg_user WHERE usename = current_user'
    );

    if (result.rows[0]?.usesuper) {
      console.error(
        '🛡️ FATAL: Application connected as DB Superuser. Shutdown forced.'
      );
      process.exit(1);
    }


(async () => {
  try {
    const [rows] = await sequelize.query(
      'SELECT current_user, session_user'
    );

    console.log('DB IDENTITY:', rows);
  } catch (err) {
    console.error('DB identity check failed:', err);
  }
})();
    app.listen(PORT, () => {
      console.log(
        `🚀 JUPITER AMMS running on port ${PORT} as ${process.env.DB_USER}`
      );
      console.log(`📜 Audit Log: http://localhost:${PORT}/audit`);
      console.log(`🛠️  Workpacks: http://localhost:${PORT}/workpacks/planner`);
    });
  } catch (err) {
    console.error('❌ Failed to start server/migrate', err);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

startServer();