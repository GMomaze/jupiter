// migrate.js
import knex from 'knex';
import config from './knexfile.js'; // Use the .js config we created

const db = knex(config);

async function run() {
  try {
    console.log('🚀 Starting Aircraft Module Migration...');
    const [batchNo, log] = await db.migrate.latest();
    if (log.length === 0) {
      console.log('✅ Database is already up to date.');
    } else {
      console.log(`✅ Batch ${batchNo} run: ${log.length} migrations`);
      console.log(log.join('\n'));
    }
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await db.destroy();
    process.exit();
  }
}

run();