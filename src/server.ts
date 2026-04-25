import 'dotenv/config';

import app from './app.js';
import { pool } from './config/database.js';
import { sequelize } from './models/index.js';
import { ServiceBulletinSyncService } from './modules/service-bulletins/service-bulletin-sync.service.js';

const PORT = process.env.PORT || 3000;

let server: any;

async function startServer() {
  try {
    console.log('🚀 Starting server...');

    // =========================================
    // 1. VERIFY DB CONNECTION
    // =========================================
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // =========================================
    // 2. PREVENT SUPERUSER USAGE (CRITICAL)
    // =========================================
    const result = await pool.query(
      'SELECT usesuper FROM pg_user WHERE usename = current_user'
    );

    if (result.rows[0]?.usesuper) {
      console.error(
        '🛡️ FATAL: Application connected as DB Superuser. Shutdown forced.'
      );
      process.exit(1);
    }

    // =========================================
    // 3. VERIFY SESSIONS TABLE
    // =========================================
    try {
      await pool.query('SELECT 1 FROM sessions LIMIT 1');
      console.log('✅ Sessions table verified.');
    } catch (err) {
      console.error('❌ FATAL: Sessions table not accessible or missing:', err);
      process.exit(1);
    }

    // =========================================
    // 4. DB IDENTITY CHECK (DEBUG)
    // =========================================
    try {
      const [rows] = await sequelize.query(
        'SELECT current_user, session_user'
      );
      console.log('DB IDENTITY:', rows);
    } catch (err) {
      console.error('DB identity check failed:', err);
    }

    // =========================================
    // 5. START SERVER
    // =========================================
    server = app.listen(PORT, () => {
      console.log(
        `🚀 JUPITER AMMS running on port ${PORT} as ${process.env.DB_USER}`
      );
      console.log(`📜 Audit Log: http://localhost:${PORT}/audit`);
      console.log(`🛠️  Workpacks: http://localhost:${PORT}/workpacks/planner`);

      // Start background services
      try {
        ServiceBulletinSyncService.startCronJob();
        console.log('🔄 Service Bulletin sync cron started');
      } catch (err) {
        console.error('⚠️ Failed to start cron job:', err);
      }
    });

    // =========================================
    // 6. HANDLE SERVER ERRORS (PORT IN USE, ETC.)
    // =========================================
    server.on('error', (err: any) => {
      console.error('❌ Server error:', err);

      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} already in use`);
      }

      process.exit(1);
    });

  } catch (err) {
    console.error('❌ Failed to start server', err);
    await shutdown();
    process.exit(1);
  }
}

// =========================================
// GRACEFUL SHUTDOWN (VERY IMPORTANT)
// =========================================
async function shutdown() {
  console.log('🛑 Shutting down server...');

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err: any) => {
          if (err) return reject(err);
          resolve(true);
        });
      });
      console.log('✅ HTTP server closed');
    }

    await sequelize.close();
    console.log('✅ Sequelize connection closed');

    await pool.end();
    console.log('✅ PG pool closed');

  } catch (err) {
    console.error('⚠️ Error during shutdown:', err);
  }
}

// =========================================
// PROCESS SIGNAL HANDLING
// =========================================
process.on('SIGINT', async () => {
  console.log('\nSIGINT received');
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nSIGTERM received');
  await shutdown();
  process.exit(0);
});

process.on('uncaughtException', async (err) => {
  console.error('❌ Uncaught Exception:', err);
  await shutdown();
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
  await shutdown();
  process.exit(1);
});

// =========================================
// START
// =========================================
startServer();