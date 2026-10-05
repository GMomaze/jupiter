/**
 * Convenience command surface over the existing guarded development rebuild
 * (src/scripts/developmentRebuild.ts). This module owns ONLY the
 * operator-interface decisions — the fixed target, the refusal list, the
 * confirmation phrase, the environment assembly, and the result summary. It
 * never re-implements the rebuild, migrations, seeding, or hardening.
 */

import {
  SYSTEM_OWNER_USER_ID,
  SYSTEM_OWNER_EMAIL,
  SYSTEM_OWNER_DISPLAY_NAME,
  buildSystemOwnerConfirmationToken,
} from './systemOwnerCanonical.js';

export const DEVELOPMENT_REBUILD_TARGET = 'jupiter_db';

export const DEVELOPMENT_REBUILD_CONFIRMATION = `REBUILD ${DEVELOPMENT_REBUILD_TARGET}`;

export const REFUSED_REBUILD_TARGETS: readonly string[] = Object.freeze([
  'jupiter_test',
  'postgres',
  'template0',
  'template1',
]);

export class DevelopmentRebuildCommandError extends Error {}

/**
 * Independent target gate. Establishes, before any authorization is
 * established, that the execution context is development and the target is
 * exactly jupiter_db (and not a refused system/test database).
 */
export function assertDevelopmentRebuildCommandTarget(
  nodeEnv: string | undefined,
  target: string,
): string {
  if (nodeEnv !== 'development') {
    throw new DevelopmentRebuildCommandError(
      'DEVELOPMENT_REBUILD_COMMAND: NODE_ENV must be exactly development',
    );
  }
  if (target !== DEVELOPMENT_REBUILD_TARGET || REFUSED_REBUILD_TARGETS.includes(target)) {
    throw new DevelopmentRebuildCommandError(
      'DEVELOPMENT_REBUILD_COMMAND: target must be exactly jupiter_db',
    );
  }
  return target;
}

export function validateDevelopmentRebuildConfirmation(input: string): boolean {
  return input.trim() === DEVELOPMENT_REBUILD_CONFIRMATION;
}

export function buildDevelopmentRebuildPrompt(): string {
  return (
    `WARNING: This will completely erase ${DEVELOPMENT_REBUILD_TARGET}.\n` +
    `Type ${DEVELOPMENT_REBUILD_CONFIRMATION} to continue: `
  );
}

/**
 * Establishes the connection and authorization environment required by the
 * existing guarded rebuild (developmentRebuildSafety.ts + developmentRebuild.ts).
 * It is intended to be called only AFTER the target gate and interactive
 * confirmation have already passed.
 */
export function buildDevelopmentRebuildCommandEnvironment(
  environment: NodeJS.ProcessEnv,
): Record<string, string> {
  const host = environment.DB_HOST?.trim() || '127.0.0.1';
  const port = environment.DB_PORT?.trim() || '5432';
  const password = environment.DB_ADMIN_PASSWORD?.trim();
  if (!password) {
    throw new DevelopmentRebuildCommandError(
      'DEVELOPMENT_REBUILD_COMMAND: DB_ADMIN_PASSWORD is required',
    );
  }
  return {
    NODE_ENV: 'development',
    DB_MIGRATION_NAME: DEVELOPMENT_REBUILD_TARGET,
    CONFIRM_DEVELOPMENT_REBUILD_DATABASE: DEVELOPMENT_REBUILD_TARGET,
    DB_MIGRATION_USER: 'postgres',
    DB_MIGRATION_PASSWORD: password,
    DB_MIGRATION_HOST: host,
    DB_MIGRATION_PORT: port,
    ALLOW_DEVELOPMENT_REBUILD: 'YES',
    ALLOW_UNIFIED_DATABASE_MIGRATION: 'YES',
    ALLOW_JUPITER_DB_REBUILD: 'YES',
  };
}

export interface DevelopmentRebuildSummary {
  readonly migrationHead: string;
  readonly requiredSeeds: boolean;
  readonly hardening: boolean;
  readonly systemOwnerReady: boolean;
}

export function formatDevelopmentRebuildSummary(
  summary: DevelopmentRebuildSummary,
): string {
  return [
    `${DEVELOPMENT_REBUILD_TARGET} REBUILD COMPLETE`,
    `Migration head: ${summary.migrationHead}`,
    `Required seeds: ${summary.requiredSeeds ? 'PASS' : 'FAIL'}`,
    `Hardening: ${summary.hardening ? 'PASS' : 'FAIL'}`,
    `System owner: ${summary.systemOwnerReady ? `READY FOR LOGIN (${SYSTEM_OWNER_EMAIL})` : 'FAIL'}`,
  ].join('\n');
}

/**
 * Establishes the environment required by the existing guarded System Owner
 * bootstrap tooling (user creation, preflight, execute, and password). Intended
 * to be called only AFTER the target gate, confirmation, and the guarded
 * rebuild have already completed. The canonical identity is fixed (never
 * operator-nominated); no password value is ever present in this environment.
 */
export function buildSystemOwnerBootstrapEnvironment(): Record<string, string> {
  return {
    NODE_ENV: 'development',
    DB_NAME: DEVELOPMENT_REBUILD_TARGET,
    PLATFORM_OWNER_USER_ID: SYSTEM_OWNER_USER_ID,
    PLATFORM_OWNER_EMAIL: SYSTEM_OWNER_EMAIL,
    PLATFORM_OWNER_DISPLAY_NAME: SYSTEM_OWNER_DISPLAY_NAME,
    PLATFORM_OWNER_CONFIRMATION: buildSystemOwnerConfirmationToken(
      DEVELOPMENT_REBUILD_TARGET,
    ),
    ALLOW_CREATE_SYSTEM_OWNER_USER: 'YES',
    ALLOW_INITIAL_SYSTEM_OWNER_PREFLIGHT: 'YES',
    ALLOW_INITIAL_SYSTEM_OWNER_BOOTSTRAP: 'YES',
    ALLOW_SET_SYSTEM_OWNER_PASSWORD: 'YES',
  };
}
