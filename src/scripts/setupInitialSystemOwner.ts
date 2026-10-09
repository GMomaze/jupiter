import 'dotenv/config';
import pg from 'pg';
import {
  ensureCanonicalSystemOwnerUser,
  establishCanonicalSystemOwnerPassword,
  promptMaskedPassword,
} from '../config/systemOwnerProvisioning.js';
import { SYSTEM_OWNER_EMAIL } from '../config/systemOwnerCanonical.js';
import { verifyRepositoryMigrationLedger } from './migrationLedgerComparison.js';

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

/**
 * PRODUCTION initial System Owner provisioning: create the canonical System
 * Owner user and establish its browser-login password through a masked prompt.
 * This is the explicitly-authorized production equivalent of the
 * DEVELOPMENT-only createInitialSystemOwnerUser/setDevelopmentSystemOwnerPassword
 * scripts. The guarded platform bootstrap (principal + six capabilities +
 * immutable audit) remains a separate, already-production-capable step via
 * `platform:bootstrap:preflight` / `platform:bootstrap:execute`.
 */
async function main(): Promise<void> {
  if (process.env.ALLOW_PRODUCTION_SYSTEM_OWNER_SETUP !== 'YES') {
    throw new Error('PRODUCTION_SYSTEM_OWNER_SETUP_NOT_AUTHORIZED');
  }

  const db = await pool.query('SELECT current_database() AS name');
  if (db.rows[0]?.name !== 'jupiter_db') {
    throw new Error('PRODUCTION_SYSTEM_OWNER_SETUP_DB_MISMATCH');
  }

  // Migration readiness: the schema (users, platform tables) must be complete.
  const ledger = await pool.query('SELECT name FROM "SequelizeMeta" ORDER BY name');
  try {
    verifyRepositoryMigrationLedger(
      ledger.rows.map((row) => String((row as { name: string }).name)),
    );
  } catch {
    throw new Error('PRODUCTION_SYSTEM_OWNER_SETUP_MIGRATION_NOT_READY');
  }

  const outcome = await ensureCanonicalSystemOwnerUser(pool);

  await establishCanonicalSystemOwnerPassword(pool, {
    prompt: promptMaskedPassword,
  });

  console.log(
    JSON.stringify({ outcome: 'READY', user: outcome, email: SYSTEM_OWNER_EMAIL }),
  );
  await pool.end();
}

main().catch(async (error) => {
  console.error(
    error instanceof Error ? error.message : 'Production System Owner setup failed.',
  );
  await pool.end().catch(() => undefined);
  process.exitCode = 1;
});
