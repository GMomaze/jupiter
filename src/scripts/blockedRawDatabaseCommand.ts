import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export type BlockedRawDatabaseAction = 'seed' | 'migrate:undo';

export function rejectRawDatabaseCommand(
  action: BlockedRawDatabaseAction
): never {
  if (action === 'seed') {
    throw new Error(
      'RAW_DATABASE_COMMAND_BLOCKED: db:seed is disabled; canonical destructive seeding is available only through the guarded db:test:seed procedure'
    );
  }
  throw new Error(
    'RAW_DATABASE_COMMAND_BLOCKED: db:migrate:undo is disabled; use the guarded db:test:migrate:undo procedure for an explicitly authorized jupiter_test rollback, or a separately controlled operational procedure'
  );
}

function parseAction(value: string | undefined): BlockedRawDatabaseAction {
  if (value !== 'seed' && value !== 'migrate:undo') {
    throw new Error(
      'RAW_DATABASE_COMMAND_BLOCKED: action must be exactly seed or migrate:undo'
    );
  }
  return value;
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  try {
    rejectRawDatabaseCommand(parseAction(process.argv[2]));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
