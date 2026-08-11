import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pool } from '../config/database.js';
import { assertTestDatabaseSafety } from '../config/testDatabaseSafety.js';

const actions = ['reset', 'migrate', 'migrate:undo', 'seed'] as const;
type TestDatabasePreparationAction = (typeof actions)[number];

function parseAction(value: string | undefined): TestDatabasePreparationAction {
  if (!actions.includes(value as TestDatabasePreparationAction)) {
    throw new Error(
      `TEST_DATABASE_PREPARATION: action must be one of ${actions.join(', ')}`
    );
  }

  return value as TestDatabasePreparationAction;
}

async function resetTestSchema(): Promise<void> {
  const client = await pool.connect();

  try {
    await assertTestDatabaseSafety(client);
    await client.query('BEGIN');
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public AUTHORIZATION jupiter_test');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function runSequelizeCli(command: string): Promise<void> {
  const cliPath = resolve('node_modules', 'sequelize-cli', 'lib', 'sequelize');

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(
      process.execPath,
      [cliPath, command, '--env', 'test'],
      {
        env: { ...process.env, NODE_ENV: 'test' },
        stdio: 'inherit',
      }
    );

    child.once('error', rejectPromise);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      rejectPromise(
        new Error(
          `TEST_DATABASE_PREPARATION: Sequelize CLI failed with ${
            signal ? `signal ${signal}` : `exit code ${String(code)}`
          }`
        )
      );
    });
  });
}

async function main(): Promise<void> {
  const action = parseAction(process.argv[2]);

  await assertTestDatabaseSafety(pool);

  if (action === 'reset') {
    await resetTestSchema();
    return;
  }

  const commandByAction: Record<
    Exclude<TestDatabasePreparationAction, 'reset'>,
    string
  > = {
    migrate: 'db:migrate',
    'migrate:undo': 'db:migrate:undo',
    seed: 'db:seed:all',
  };

  await runSequelizeCli(commandByAction[action]);
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
