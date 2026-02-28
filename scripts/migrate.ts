import 'dotenv/config';
import knex from 'knex';
import knexConfig from './knexfile.js';

const db = knex(knexConfig);

async function runMigration() {
  console.log('🚀 Checking for pending migrations in ./migrations...');
  
  try {
    const [batchNo, log] = await db.migrate.latest();
    
    if (log.length === 0) {
      console.log('✅ Database is already up to date. No new migrations found.');
    } else {
      console.log(`✅ Success! Batch ${batchNo} executed ${log.length} migrations:`);
      log.forEach((file: string) => console.log(`   - ${file}`));
    }
  } catch (err) {
    console.error('❌ Migration failed!');
    console.error(err);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

runMigration();