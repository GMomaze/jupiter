import { randomUUID } from 'node:crypto';
import { pool } from '../config/database.js';
import { PlatformAuthorityRepository } from '../modules/platform-authority/platform-authority.repository.js';
import { platformMutationEvidence } from '../modules/platform-authority/authoritative-platform-mutation.js';
import { TenantLifecycleCommandRepository } from '../modules/tenancy/tenant-lifecycle-command.repository.js';
import { createTenantQueryAuthority } from '../modules/tenancy/tenant-query-authority.js';
import { PostgresStaffTenantRepository } from '../modules/auth/staff-tenant.repository.js';

const results: Record<string, { status: string; detail: string }> = {};
function record(key: string, status: 'PASS' | 'FAIL', detail: string) { results[key] = { status, detail }; }

async function main() {
  if (process.env.NODE_ENV !== 'test') throw new Error('REQUIRES_TEST_ENV');
  if (process.env.ALLOW_SECTION_53 !== 'YES') throw new Error('SECTION_53_NOT_AUTHORIZED');
  const db = await pool.query(`SELECT current_database() name`);
  if (db.rows[0]?.name !== 'jupiter_test') throw new Error('DB_MISMATCH');

  const repository = new PlatformAuthorityRepository(pool);
  const lifecycle = new TenantLifecycleCommandRepository();

  const ownerUserId = (await pool.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, ['sec52-system-owner-sec52@example.test'])).rows[0].id;
  const operatorUserId = (await pool.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, ['sec52-operator-sec52@example.test'])).rows[0].id;
  const ownerAuthority = await repository.resolveHuman(ownerUserId);
  const operatorAuthority = await repository.resolveHuman(operatorUserId);
  if (!ownerAuthority || !operatorAuthority) throw new Error('SEC52_AUTHORITY_RESOLUTION_FAILED');

  const tenantA = (await pool.query(`SELECT id, public_id, status FROM tenants WHERE code='SEC52_A'`)).rows[0];
  const tenantB = (await pool.query(`SELECT id, public_id, status FROM tenants WHERE code='SEC52_B'`)).rows[0];
  const adminAUserId = (await pool.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, ['sec52-admin-a-sec52@example.test'])).rows[0].id;
  const adminBUserId = (await pool.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, ['sec52-admin-b-sec52@example.test'])).rows[0].id;
  const staffAUserId = (await pool.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, ['sec52-staff-a-sec52@example.test'])).rows[0].id;
  const staffBUserId = (await pool.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, ['sec52-staff-b-sec52@example.test'])).rows[0].id;

  async function authFor(tenantId: string, userId: string) {
    const c = await pool.connect();
    await c.query('BEGIN');
    await c.query(`SELECT set_config('jupiter.tenant_id',$1,true)`, [tenantId]);
    const m = (await c.query(`SELECT id FROM tenant_memberships WHERE tenant_id=$1 AND user_id=$2 AND status='ACTIVE'`, [tenantId, userId])).rows[0];
    await c.query('ROLLBACK'); c.release();
    const status = (await pool.query(`SELECT status FROM tenants WHERE id=$1`, [tenantId])).rows[0].status;
    return createTenantQueryAuthority({ state: 'VALID_ACTIVE_TENANT', tenant: { id: tenantId, publicId: tenantId, code: 'SEC52', displayName: 'SEC52', status }, membership: { id: m.id, tenantId, userId, status: 'ACTIVE' }, validatedAt: Date.now() });
  }

  // Restore baseline: a prior partial run may have left Tenant B ACTIVE.
  if (tenantB.status === 'ACTIVE') {
    await lifecycle.suspend(platformMutationEvidence(operatorAuthority, ['TENANT_SUSPEND'], { reason: 'Section 5.3 restore baseline SUSPENDED', correlationId: randomUUID(), source: { kind: 'SECTION_53_ACCEPTANCE' }, resourceType: 'tenant' }), tenantB.public_id, 'Section 5.3 restore baseline SUSPENDED');
    tenantB.status = 'SUSPENDED';
  }
  record('tenantB.before', tenantB.status === 'SUSPENDED' ? 'PASS' : 'FAIL', `Tenant B was ${tenantB.status}`);

  // Idempotent grant of TENANT_REINSTATE (a prior partial run may have granted it already).
  const reinstateGranted = (await pool.query(`SELECT 1 FROM platform_capability_grants pg JOIN platform_capabilities pc ON pc.id=pg.capability_id WHERE pg.principal_id=$1 AND pc.code='TENANT_REINSTATE' AND pg.revoked_at IS NULL`, [operatorAuthority.principalId])).rows[0];
  if (!reinstateGranted) {
    await repository.grant(ownerAuthority, operatorAuthority.principalId, 'TENANT_REINSTATE', 'Section 5.3 B->A verification');
  }
  // Idempotent reinstate (skip if already ACTIVE from a prior partial run).
  if (tenantB.status !== 'ACTIVE') {
    await lifecycle.reinstate(platformMutationEvidence(operatorAuthority, ['TENANT_REINSTATE'], { reason: 'Section 5.3 B->A verification', correlationId: randomUUID(), source: { kind: 'SECTION_53_ACCEPTANCE' }, resourceType: 'tenant' }), tenantB.public_id);
  }
  const tenantBReinstated = (await pool.query(`SELECT status FROM tenants WHERE id=$1`, [tenantB.id])).rows[0].status;
  record('tenantB.reinstated', tenantBReinstated === 'ACTIVE' ? 'PASS' : 'FAIL', `Tenant B after reinstate = ${tenantBReinstated}`);

  const authA = await authFor(tenantA.id, adminAUserId);
  const authB = await authFor(tenantB.id, adminBUserId);

  async function rlsMemberships(from: string, target: string, label: string) {
    const c = await pool.connect();
    await c.query('BEGIN');
    await c.query(`SELECT set_config('jupiter.tenant_id',$1,true)`, [from]);
    const n = (await c.query(`SELECT count(*)::int n FROM tenant_memberships WHERE tenant_id=$1`, [target])).rows[0].n;
    await c.query('ROLLBACK'); c.release();
    record(`rls.memberships.${label}`, n === 0 ? 'PASS' : 'FAIL', `${label} ctx sees ${n} foreign memberships`);
  }
  await rlsMemberships(tenantA.id, tenantB.id, 'A->B');
  await rlsMemberships(tenantB.id, tenantA.id, 'B->A');

  const staffRepo = new PostgresStaffTenantRepository(pool);
  const aStaffIds = (await staffRepo.listStaff(authA)).map(r => r.id);
  const bStaffIds = (await staffRepo.listStaff(authB)).map(r => r.id);
  record('staff.list.A->B', !aStaffIds.includes(staffBUserId) ? 'PASS' : 'FAIL', 'A list excludes B staff');
  record('staff.list.B->A', !bStaffIds.includes(staffAUserId) ? 'PASS' : 'FAIL', 'B list excludes A staff');

  const engineerRole = (await pool.query(`SELECT id FROM rf_role WHERE code='ENGINEER' AND is_active=true`)).rows[0].id;
  try { await staffRepo.toggleRole(authA, staffBUserId, engineerRole, adminAUserId); record('roles.toggle.A->B', 'FAIL', 'A admin toggled B staff role'); }
  catch (e) { record('roles.toggle.A->B', 'PASS', `rejected: ${(e as Error).message}`); }
  try { await staffRepo.toggleRole(authB, staffAUserId, engineerRole, adminBUserId); record('roles.toggle.B->A', 'FAIL', 'B admin toggled A staff role'); }
  catch (e) { record('roles.toggle.B->A', 'PASS', `rejected: ${(e as Error).message}`); }

  const customerA = { id: 'be193510-df71-4f5a-9f57-f1aefa6d3f2a' };
  const customerB = { id: '5103fc25-7e25-4e7f-8572-2080f48e4068' };
  async function rlsCustomer(from: string, targetCustomer: string, label: string) {
    const c = await pool.connect();
    await c.query('BEGIN'); await c.query(`SELECT set_config('jupiter.tenant_id',$1,true)`, [from]);
    const n = (await c.query(`SELECT count(*)::int n FROM customers WHERE id=$1`, [targetCustomer])).rows[0].n;
    await c.query('ROLLBACK'); c.release();
    record(`customer.ids.${label}`, n === 0 ? 'PASS' : 'FAIL', `${label} sees ${n} of foreign customer`);
  }
  await rlsCustomer(tenantA.id, customerB.id, 'A->B');
  await rlsCustomer(tenantB.id, customerA.id, 'B->A');

  await lifecycle.suspend(platformMutationEvidence(operatorAuthority, ['TENANT_SUSPEND'], { reason: 'Section 5.3 restore SUSPENDED', correlationId: randomUUID(), source: { kind: 'SECTION_53_ACCEPTANCE' }, resourceType: 'tenant' }), tenantB.public_id, 'Section 5.3 restore SUSPENDED');
  const tenantBFinal = (await pool.query(`SELECT status FROM tenants WHERE id=$1`, [tenantB.id])).rows[0].status;
  record('tenantB.final', tenantBFinal === 'SUSPENDED' ? 'PASS' : 'FAIL', `Tenant B final = ${tenantBFinal}`);
  const cm = await pool.connect();
  await cm.query('BEGIN');
  await cm.query(`SELECT set_config('jupiter.tenant_id',$1,true)`, [tenantB.id]);
  const bMemberships = (await cm.query(`SELECT count(*)::int n FROM tenant_memberships WHERE tenant_id=$1 AND status='ACTIVE'`, [tenantB.id])).rows[0].n;
  await cm.query('ROLLBACK'); cm.release();
  record('tenantB.memberships.preserved', bMemberships >= 2 ? 'PASS' : 'FAIL', `Tenant B retains ${bMemberships} active memberships`);

  console.log('SECTION_53_RESULTS=' + JSON.stringify(results, null, 2));
}

main().then(() => pool.end()).catch(async (e) => { console.error('SECTION_53_FAILED:', e instanceof Error ? e.message : e); await pool.end(); process.exitCode = 1; });

