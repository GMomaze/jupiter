import 'dotenv/config';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import pg from 'pg';
import {
  DEVELOPMENT_REBUILD_TARGET,
  assertDevelopmentRebuildCommandTarget,
  validateDevelopmentRebuildConfirmation,
  buildDevelopmentRebuildPrompt,
  buildDevelopmentRebuildCommandEnvironment,
  buildSystemOwnerBootstrapEnvironment,
  formatDevelopmentRebuildSummary,
  type DevelopmentRebuildSummary,
} from '../config/dbDevelopmentRebuildCommand.js';
import {
  SYSTEM_OWNER_USER_ID,
  SYSTEM_OWNER_EMAIL,
  SYSTEM_OWNER_DISPLAY_NAME,
  SYSTEM_OWNER_CAPABILITY_CODES,
} from '../config/systemOwnerCanonical.js';

function promptConfirmation(): Promise<string> {
  return new Promise((resolvePromise) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(buildDevelopmentRebuildPrompt(), (answer) => {
      rl.close();
      resolvePromise(answer);
    });
  });
}

function runTsxScript(
  scriptRelative: string,
  environment: Record<string, string>,
): Promise<void> {
  const tsxCli = resolve('node_modules', 'tsx', 'dist', 'cli.mjs');
  const script = resolve(scriptRelative);
  return new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [tsxCli, script], {
      cwd: process.cwd(),
      env: { ...process.env, ...environment },
      stdio: 'inherit',
    });
    child.once('error', rejectPromise);
    child.once('exit', (code, signal) => {
      if (code === 0) return resolvePromise();
      rejectPromise(
        new Error(
          `DEVELOPMENT_REBUILD_COMMAND: ${scriptRelative} failed with ${
            signal ? `signal ${signal}` : `exit code ${String(code)}`
          }`,
        ),
      );
    });
  });
}

async function verifyResult(
  environment: Record<string, string>,
): Promise<DevelopmentRebuildSummary> {
  const client = new pg.Client({
    host: environment.DB_MIGRATION_HOST,
    port: Number(environment.DB_MIGRATION_PORT),
    user: environment.DB_MIGRATION_USER,
    password: environment.DB_MIGRATION_PASSWORD,
    database: environment.DB_MIGRATION_NAME,
  });
  try {
    await client.connect();
    const head = (
      await client.query(
        `SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 1`,
      )
    ).rows[0]?.name as string | undefined;

    const roles = (
      await client.query(
        `SELECT count(*)::int AS c FROM rf_role WHERE code IN ('ADMIN','ENGINEER','MECHANIC','SUPERVISOR','QA','PLANNER','VIEWER')`,
      )
    ).rows[0].c as number;
    const mappings = (
      await client.query(`SELECT count(*)::int AS c FROM rf_role_permissions`)
    ).rows[0].c as number;

    const hardening = (
      await client.query(
        `SELECT NOT has_schema_privilege('public','public','CREATE') AS no_public_create, has_schema_privilege('jupiter_app','public','USAGE') AS app_usage`,
      )
    ).rows[0] as { no_public_create: boolean; app_usage: boolean };

    const user = (
      await client.query(
        `SELECT id, lower(email) AS email, full_name, is_active FROM users WHERE id=$1`,
        [SYSTEM_OWNER_USER_ID],
      )
    ).rows[0] as
      | { id: string; email: string; full_name: string; is_active: boolean }
      | undefined;
    const userCount = (
      await client.query(`SELECT count(*)::int AS c FROM users`)
    ).rows[0].c as number;
    const principalCount = (
      await client.query(
        `SELECT count(*)::int AS c FROM platform_principals WHERE user_id=$1 AND principal_type='HUMAN' AND status='ACTIVE'`,
        [SYSTEM_OWNER_USER_ID],
      )
    ).rows[0].c as number;
    const grantCodes = (
      await client.query(
        `SELECT array_agg(pc.code ORDER BY pc.code) AS codes FROM platform_capability_grants pg JOIN platform_capabilities pc ON pc.id=pg.capability_id WHERE pg.revoked_at IS NULL`,
      )
    ).rows[0].codes as string[] | null;

    const userOk =
      userCount === 1 &&
      !!user &&
      user.is_active === true &&
      user.email === SYSTEM_OWNER_EMAIL &&
      user.full_name === SYSTEM_OWNER_DISPLAY_NAME;
    const canonical = [...SYSTEM_OWNER_CAPABILITY_CODES].sort();
    const grants = [...(grantCodes ?? [])].sort();
    const grantsOk =
      grants.length === canonical.length &&
      grants.every((code, index) => code === canonical[index]);

    return {
      migrationHead: head ?? 'unknown',
      requiredSeeds: roles === 7 && mappings > 0,
      hardening: hardening.no_public_create === true && hardening.app_usage === true,
      systemOwnerReady: userOk && principalCount === 1 && grantsOk,
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main(): Promise<void> {
  // 1. Independent target gate — before any authorization is established.
  assertDevelopmentRebuildCommandTarget(process.env.NODE_ENV, DEVELOPMENT_REBUILD_TARGET);

  // 2. Interactive confirmation — anything other than the exact phrase aborts.
  const answer = await promptConfirmation();
  if (!validateDevelopmentRebuildConfirmation(answer)) {
    throw new Error(
      'DEVELOPMENT_REBUILD_COMMAND: confirmation mismatch — aborted without mutation',
    );
  }

  // 3. Establish connection + authorizations for the existing guarded rebuild.
  const environment = buildDevelopmentRebuildCommandEnvironment(process.env);

  // 4. Run the existing guarded rebuild (RESET → MIGRATE → REQUIRED SEEDS → HARDEN).
  await runTsxScript('src/scripts/developmentRebuild.ts', environment);

  // 5. Establish the canonical development System Owner
  //    (create user → preflight → bootstrap principal + six grants → password).
  const ownerEnvironment = buildSystemOwnerBootstrapEnvironment();
  await runTsxScript('src/scripts/createInitialSystemOwnerUser.ts', ownerEnvironment);
  await runTsxScript('src/scripts/preflightInitialSystemOwner.ts', ownerEnvironment);
  await runTsxScript('src/scripts/bootstrapInitialSystemOwner.ts', ownerEnvironment);
  await runTsxScript('src/scripts/setDevelopmentSystemOwnerPassword.ts', ownerEnvironment);

  // 6. Final verification + summary.
  const summary = await verifyResult(environment);
  console.log(formatDevelopmentRebuildSummary(summary));
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'DEVELOPMENT_REBUILD_COMMAND failed',
  );
  process.exitCode = 1;
});
