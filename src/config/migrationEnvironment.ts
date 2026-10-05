import { resolve } from 'node:path';
import dotenv from 'dotenv';
import type { MigrationTarget } from './migrationSafety.js';

export interface MigrationEnvironmentLoadResult {
  path: string;
  override: boolean;
}

/**
 * Loads only the repository-established environment source for an already
 * validated migration target. Target parsing remains the runner's first gate.
 */
export function loadMigrationTargetEnvironment(
  target: MigrationTarget,
  environment: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd()
): MigrationEnvironmentLoadResult {
  const isTest = target === 'test';
  const path = resolve(cwd, isTest ? '.env.test' : '.env');
  const override = isTest;

  dotenv.config({
    path,
    override,
    quiet: true,
    processEnv: environment,
  });

  return { path, override };
}
