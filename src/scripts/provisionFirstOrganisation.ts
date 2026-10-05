import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { lookup } from 'node:dns/promises';
import dotenv from 'dotenv';
import pg from 'pg';
import {
  parseFirstOrganisationTarget,
  validateFirstOrganisationLiveIdentity,
  validateFirstOrganisationProvisioningConfiguration,
  type FirstOrganisationProvisioningConfig,
  type FirstOrganisationProvisioningTarget,
} from '../config/firstOrganisationProvisioningSafety.js';
import { OrganisationProvisioningRepository } from '../modules/tenancy/organisation-provisioning.repository.js';
import { OrganisationProvisioningService } from '../modules/tenancy/organisation-provisioning.service.js';
import type { ProvisioningTransactionAuthority } from '../modules/tenancy/organisation-provisioning.repository.js';
import type { ProvisionOrganisationResult } from '../modules/tenancy/organisation-provisioning.contracts.js';

interface QueryResult<Row extends Record<string, unknown>> {
  readonly rows: readonly Row[];
  readonly rowCount: number | null;
}

export interface FirstOrganisationBootstrapDatabase extends ProvisioningTransactionAuthority {
  query<Row extends Record<string, unknown>>(sql: string, values?: readonly unknown[]): Promise<QueryResult<Row>>;
  close(): Promise<void>;
}

export interface FirstOrganisationBootstrapDependencies {
  readonly loadEnvironment: (target: FirstOrganisationProvisioningTarget, environment: NodeJS.ProcessEnv) => void;
  readonly createDatabase: (config: FirstOrganisationProvisioningConfig) => FirstOrganisationBootstrapDatabase;
  readonly resolveHost: (host: string) => Promise<readonly string[]>;
  readonly ids: () => { tenantId: string; tenantPublicId: string; membershipId: string; tenantAuditId: string; membershipAuditId: string };
  readonly clock: () => Date;
}

function loadEnvironment(target: FirstOrganisationProvisioningTarget, environment: NodeJS.ProcessEnv): void {
  dotenv.config({ path: resolve(process.cwd(), target === 'test' ? '.env.test' : '.env'), override: target === 'test', quiet: true, processEnv: environment });
}

function createPgDatabase(config: FirstOrganisationProvisioningConfig): FirstOrganisationBootstrapDatabase {
  const pool = new pg.Pool({ host: config.host, port: config.port, database: config.database, user: config.username, password: config.password });
  return {
    async query(sql, values = []) { const result = await pool.query(sql, [...values]); return { rows: result.rows, rowCount: result.rowCount }; },
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await work({ async query(sql, values) { const query = await client.query(sql, [...values]); return { rows: query.rows, rowCount: query.rowCount }; } });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally { client.release(); }
    },
    async close() { await pool.end(); },
  };
}

const defaults: FirstOrganisationBootstrapDependencies = {
  loadEnvironment,
  createDatabase: createPgDatabase,
  async resolveHost(host) { return [...new Set((await lookup(host, { all: true, verbatim: true })).map(result => result.address))]; },
  ids: () => ({ tenantId: randomUUID(), tenantPublicId: randomUUID(), membershipId: randomUUID(), tenantAuditId: randomUUID(), membershipAuditId: randomUUID() }),
  clock: () => new Date(),
};

export async function runFirstOrganisationBootstrap(
  targetValue: string | undefined,
  environment: NodeJS.ProcessEnv = process.env,
  dependencies: FirstOrganisationBootstrapDependencies = defaults,
): Promise<ProvisionOrganisationResult> {
  const target = parseFirstOrganisationTarget(targetValue);
  dependencies.loadEnvironment(target, environment);
  const config = validateFirstOrganisationProvisioningConfiguration(target, environment);
  const database = dependencies.createDatabase(config);
  try {
    const identityResult = await database.query<{
      database_name: string; current_user: string; session_user: string;
      server_address: string; server_port: number; transaction_read_only: string;
    }>(`SELECT current_database() database_name,current_user,session_user,
               host(inet_server_addr()) server_address,inet_server_port() server_port,
               current_setting('transaction_read_only') transaction_read_only`);
    const identity = identityResult.rows[0];
    if (!identity) throw new Error('FIRST_ORGANISATION_PROVISIONING: live identity unavailable');
    validateFirstOrganisationLiveIdentity(config, identity, await dependencies.resolveHost(config.host));

    const ledger = await database.query<{ name: string; copies: number }>(
      `SELECT name,count(*)::int copies FROM public."SequelizeMeta"
        WHERE name IN ('588_create_tenant_membership_foundation.ts','589_create_tenant_context_switch_attempts.ts')
        GROUP BY name ORDER BY name`,
    );
    if (ledger.rows.length !== 2 || ledger.rows.some(row => row.copies !== 1)) {
      throw new Error('FIRST_ORGANISATION_PROVISIONING: migration baseline is not ready');
    }
    const existing = await database.query<{ count: number; matching: number }>(
      `SELECT count(*)::int count,
              count(*) FILTER (WHERE code=$1)::int matching
         FROM public.tenants`,
      [config.code],
    );
    const tenantState = existing.rows[0];
    if (!tenantState || tenantState.count > 1 || (tenantState.count === 1 && tenantState.matching !== 1)) {
      throw new Error('FIRST_ORGANISATION_PROVISIONING: database is not eligible for first Organisation bootstrap');
    }

    const repository = new OrganisationProvisioningRepository({ database, ids: dependencies.ids, clock: dependencies.clock });
    const service = new OrganisationProvisioningService(repository);
    return await service.provision({ actorUserId: config.actorUserId, initialUserId: config.initialUserId, code: config.code, displayName: config.displayName, legalName: config.legalName });
  } finally { await database.close(); }
}

const isDirectExecution = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  runFirstOrganisationBootstrap(process.argv[2]).then(result => {
    console.log(JSON.stringify({ outcome: result.outcome, ...(result.outcome === 'CONFLICT' ? { message: result.message } : { organisationPublicId: result.organisation.tenantPublicId }) }));
  }).catch(error => {
    console.error(error instanceof Error ? error.message : 'FIRST_ORGANISATION_PROVISIONING: failed');
    process.exitCode = 1;
  });
}
