import 'dotenv/config';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const SEEDER_PATHS: Readonly<Record<string, string>> = Object.freeze({
  required: 'seeders/required',
  optional: 'seeders/optional',
  demo: 'seeders/demo',
});

function runSequelizeCli(seedersPath: string): Promise<void> {
  const cliPath = resolve('node_modules', 'sequelize-cli', 'lib', 'sequelize');
  return new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(
      process.execPath,
      [cliPath, 'db:seed:all', '--env', 'migration-development', '--seeders-path', seedersPath],
      { cwd: process.cwd(), env: { ...process.env }, stdio: 'inherit' },
    );
    child.once('error', rejectPromise);
    child.once('exit', (code, signal) => {
      if (code === 0) return resolvePromise();
      rejectPromise(
        new Error(
          `SEED_DEVELOPMENT: sequelize-cli failed with ${
            signal ? `signal ${signal}` : `exit code ${String(code)}`
          }`,
        ),
      );
    });
  });
}

async function main(): Promise<void> {
  const kind = process.argv[2];
  const seedersPath = kind ? SEEDER_PATHS[kind] : undefined;
  if (!seedersPath) {
    throw new Error(
      'SEED_DEVELOPMENT: kind must be exactly one of required, optional, demo',
    );
  }
  if (kind === 'demo' && process.env.NODE_ENV === 'production') {
    throw new Error('SEED_DEVELOPMENT: demo data is development-only');
  }
  if (process.env.DB_MIGRATION_USER !== 'postgres') {
    throw new Error('SEED_DEVELOPMENT: DB_MIGRATION_USER must be exactly postgres');
  }
  if (process.env.DB_MIGRATION_NAME === 'jupiter_test') {
    throw new Error('SEED_DEVELOPMENT: refuses the jupiter_test database');
  }

  await runSequelizeCli(seedersPath);
  console.log(`SEED_DEVELOPMENT: ${kind} seed complete.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'SEED_DEVELOPMENT failed');
  process.exitCode = 1;
});
