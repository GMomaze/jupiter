import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runFirstOrganisationBootstrap, type FirstOrganisationBootstrapDependencies } from './provisionFirstOrganisation.js';

const environment = (): NodeJS.ProcessEnv => ({ ALLOW_FIRST_ORGANISATION_PROVISIONING:'YES',CONFIRM_FIRST_ORGANISATION_TARGET:'test',FIRST_ORGANISATION_ACTOR_USER_ID:'00000000-0000-4000-8000-000000000001',FIRST_ORGANISATION_INITIAL_USER_ID:'00000000-0000-4000-8000-000000000002',FIRST_ORGANISATION_CODE:'FIRST_ORG',CONFIRM_FIRST_ORGANISATION_CODE:'FIRST_ORG',FIRST_ORGANISATION_DISPLAY_NAME:'First Org',DB_NAME:'jupiter_test',DB_USER:'jupiter_test',DB_PASSWORD:'unused',DB_HOST:'127.0.0.1',DB_PORT:'5432' });

function harness() {
  let transactionQuery = 0;
  const database = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('current_database')) return { rows:[{database_name:'jupiter_test',current_user:'jupiter_test',session_user:'jupiter_test',server_address:'127.0.0.1',server_port:5432,transaction_read_only:'off'}],rowCount:1 };
      if (sql.includes('SequelizeMeta')) return { rows:[{name:'588_create_tenant_membership_foundation.ts',copies:1},{name:'589_create_tenant_context_switch_attempts.ts',copies:1}],rowCount:2 };
      return { rows:[{count:0,matching:0}],rowCount:1 };
    }),
    transaction: vi.fn(async (work: any) => work({ query: vi.fn(async () => { transactionQuery++; if (transactionQuery===2) return {rows:[],rowCount:0}; if(transactionQuery===3)return{rows:[{id:'00000000-0000-4000-8000-000000000001'},{id:'00000000-0000-4000-8000-000000000002'}],rowCount:2}; return {rows:[],rowCount:1}; }) })),
    close: vi.fn(async()=>undefined),
  };
  const dependencies: FirstOrganisationBootstrapDependencies = { loadEnvironment:vi.fn(),createDatabase:vi.fn(()=>database),resolveHost:vi.fn(async()=>['127.0.0.1']),ids:()=>({tenantId:'t',tenantPublicId:'p',membershipId:'m',tenantAuditId:'ta',membershipAuditId:'ma'}),clock:()=>new Date('2026-08-26T00:00:00Z') };
  return { database, dependencies };
}

describe('guarded first Organisation bootstrap command', () => {
  it('validates before creating a database connection', async () => {
    const h=harness();const env=environment();delete env.ALLOW_FIRST_ORGANISATION_PROVISIONING;
    await expect(runFirstOrganisationBootstrap('test',env,h.dependencies)).rejects.toThrow('authorization or configuration is invalid');
    expect(h.dependencies.createDatabase).not.toHaveBeenCalled();
  });

  it('fails closed at the superseded service path without a transaction', async () => {
    const h=harness();
    await expect(runFirstOrganisationBootstrap('test',environment(),h.dependencies)).rejects.toThrow('LEVEL3_PLATFORM_AUTHORITY_REQUIRED');
    expect(h.database.transaction).not.toHaveBeenCalled();expect(h.database.close).toHaveBeenCalledOnce();
  });

  it('fails closed on identity, migration, or first-Organisation preflight mismatch', async () => {
    const h=harness();h.database.query.mockResolvedValueOnce({rows:[{database_name:'jupiter_db'}],rowCount:1});
    await expect(runFirstOrganisationBootstrap('test',environment(),h.dependencies)).rejects.toThrow();
    expect(h.database.transaction).not.toHaveBeenCalled();expect(h.database.close).toHaveBeenCalledOnce();
  });

  it('contains no provisioning SQL, role inference, route, session, or platform authority', () => {
    const source=readFileSync('src/scripts/provisionFirstOrganisation.ts','utf8');
    expect(source).toContain('OrganisationProvisioningService');
    expect(readFileSync('src/modules/tenancy/organisation-provisioning.repository.ts','utf8')).toContain('LEVEL3_PLATFORM_AUTHORITY_REQUIRED');
    expect(source).not.toMatch(/INSERT INTO public\.(tenants|tenant_memberships|audit_log)|ADMIN|user_roles|tenant_membership_roles|activeTenantContext|express|Router|RLS/);
  });
});
