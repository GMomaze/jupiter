import { randomUUID } from 'node:crypto';
import { pool } from '../config/database.js';
import { PlatformAuthorityRepository } from '../modules/platform-authority/platform-authority.repository.js';
import { platformMutationEvidence } from '../modules/platform-authority/authoritative-platform-mutation.js';
import { TenantLifecycleCommandRepository } from '../modules/tenancy/tenant-lifecycle-command.repository.js';
import { createTenantQueryAuthority } from '../modules/tenancy/tenant-query-authority.js';
import { withTenantTransaction } from '../modules/tenancy/tenant-transaction.js';
import { Customer } from '../models/index.js';

const results: Record<string, { status: string; detail: string }> = {};
function record(key: string, status: 'PASS' | 'FAIL', detail: string) { results[key] = { status, detail }; }

async function main() {
  if (process.env.NODE_ENV !== 'test') throw new Error('REQUIRES_TEST_ENV');
  if (process.env.ALLOW_SECTION_54 !== 'YES') throw new Error('SECTION_54_NOT_AUTHORIZED');
  const db = await pool.query(`SELECT current_database() name`);
  if (db.rows[0]?.name !== 'jupiter_test') throw new Error('DB_MISMATCH');

  const repository = new PlatformAuthorityRepository(pool);
  const lifecycle = new TenantLifecycleCommandRepository();

  const ownerUserId = (await pool.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, ['sec52-system-owner-sec52@example.test'])).rows[0].id;
  const operatorUserId = (await pool.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, ['sec52-operator-sec52@example.test'])).rows[0].id;
  const ownerAuthority = await repository.resolveHuman(ownerUserId);
  const operatorAuthority = await repository.resolveHuman(operatorUserId);
  if (!ownerAuthority || !operatorAuthority) throw new Error('SEC52_AUTHORITY_RESOLUTION_FAILED');

  // Lifecycle-test company: SEC52_C
  const codeC = 'SEC52_C';
  const existingC = (await pool.query(`SELECT id, public_id, status FROM tenants WHERE code=$1`, [codeC])).rows[0];
  let tenantCId = existingC?.id;
  let tenantCPublic = existingC?.public_id;
  let adminCUserId = (await pool.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, ['sec52-admin-c-sec52@example.test'])).rows[0]?.id;
  const tenantAId = (await pool.query(`SELECT id FROM tenants WHERE code='SEC52_A'`)).rows[0].id;

  // --- Row 1/2: create/authorize company + nominate initial admin ---
  if (!existingC) {
    if (!adminCUserId) {
      adminCUserId = randomUUID();
      await pool.query(`INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES($1,$2,'unused-placeholder','Section 5.4 Lifecycle Admin',true)`, [adminCUserId, 'sec52-admin-c-sec52@example.test']);
    }
    const evidence = (op: string) => platformMutationEvidence(operatorAuthority, [op as any], { reason: `Section 5.4 ${op}`, correlationId: randomUUID(), source: { kind: 'SECTION_54_ACCEPTANCE' }, resourceType: 'tenant' });
    const provisioned = await lifecycle.provision(evidence('TENANT_PROVISION'), { code: codeC, displayName: 'Section 5.4 Lifecycle Company', initialUserId: adminCUserId });
    tenantCId = provisioned.tenantId;
    tenantCPublic = provisioned.publicId;
    record('provision.initial', provisioned.status === 'PROVISIONING' ? 'PASS' : 'FAIL', `provisioned status = ${provisioned.status}`);
  } else {
    record('provision.initial', 'PASS', 'SEC52_C already provisioned');
  }

  // Verify initial admin nomination: admin user has an ACTIVE membership + ADMIN role in SEC52_C.
  async function adminRoleIn(tenantId: string, userId: string) {
    const c = await pool.connect();
    await c.query('BEGIN');
    await c.query(`SELECT set_config('jupiter.tenant_id',$1,true)`, [tenantId]);
    const r = await c.query(`SELECT count(*)::int n FROM tenant_memberships tm JOIN tenant_membership_roles tmr ON tmr.membership_id=tm.id AND tmr.revoked_at IS NULL JOIN rf_role ro ON ro.id=tmr.role_id AND ro.code='ADMIN' WHERE tm.tenant_id=$1 AND tm.user_id=$2 AND tm.status='ACTIVE'`, [tenantId, userId]);
    await c.query('ROLLBACK'); c.release();
    return r.rows[0].n;
  }
  const adminRoleCount = await adminRoleIn(tenantCId, adminCUserId);
  record('admin.nominated', adminRoleCount === 1 ? 'PASS' : 'FAIL', `initial admin has ${adminRoleCount} ACTIVE ADMIN role`);

  // --- Row 3: activate company ---
  const statusBeforeActivate = (await pool.query(`SELECT status FROM tenants WHERE id=$1`, [tenantCId])).rows[0].status;
  if (statusBeforeActivate === 'PROVISIONING') {
    await lifecycle.activate(platformMutationEvidence(operatorAuthority, ['TENANT_ACTIVATE'], { reason: 'Section 5.4 activate', correlationId: randomUUID(), source: { kind: 'SECTION_54_ACCEPTANCE' }, resourceType: 'tenant' }), tenantCPublic);
  }
  const statusAfterActivate = (await pool.query(`SELECT status FROM tenants WHERE id=$1`, [tenantCId])).rows[0].status;
  const activationAudited = (await pool.query(`SELECT count(*)::int n FROM platform_global_audit_log WHERE resource_id=$1 AND action='TENANT_ACTIVATE'`, [tenantCId])).rows[0].n;
  record('activate', activationAudited >= 1 ? 'PASS' : 'FAIL', `activation evidenced by ${activationAudited} TENANT_ACTIVATE audit record(s); current status = ${statusAfterActivate}`);

  // Build admin authority for SEC52_C (ACTIVE).
  async function authFor(tenantId: string, userId: string) {
    const c = await pool.connect();
    await c.query('BEGIN');
    await c.query(`SELECT set_config('jupiter.tenant_id',$1,true)`, [tenantId]);
    const m = (await c.query(`SELECT id FROM tenant_memberships WHERE tenant_id=$1 AND user_id=$2 AND status='ACTIVE'`, [tenantId, userId])).rows[0];
    await c.query('ROLLBACK'); c.release();
    return createTenantQueryAuthority({ state: 'VALID_ACTIVE_TENANT', tenant: { id: tenantId, publicId: tenantId, code: 'SEC52', displayName: 'SEC52', status: 'ACTIVE' }, membership: { id: m.id, tenantId, userId, status: 'ACTIVE' }, validatedAt: Date.now() });
  }
  const authC = await authFor(tenantCId, adminCUserId);

  // Create a representative customer (data) in SEC52_C (idempotent via CTX-scoped lookup).
  let customerCId = await (async () => {
    const c = await pool.connect();
    await c.query('BEGIN');
    await c.query(`SELECT set_config('jupiter.tenant_id',$1,true)`, [tenantCId]);
    const r = await c.query(`SELECT id FROM customers WHERE tenant_id=$1 AND email='sec52-customer-c-sec52@example.test'`, [tenantCId]);
    await c.query('ROLLBACK'); c.release();
    return r.rows[0]?.id;
  })();
  if (!customerCId) {
    await withTenantTransaction(authC, async (tx) => {
      const customer = await Customer.create({ tenant_id: tenantCId, name: 'SEC52 Lifecycle Customer', contact_person: 'C', email: 'sec52-customer-c-sec52@example.test', phone: '1', status: 'ACTIVE' }, { transaction: tx });
      customerCId = customer.id;
    });
  }

  // Record data snapshot (memberships + roles + customers) in SEC52_C.
  async function dataSnapshot(tenantId: string) {
    const c = await pool.connect();
    await c.query('BEGIN');
    await c.query(`SELECT set_config('jupiter.tenant_id',$1,true)`, [tenantId]);
    const m = (await c.query(`SELECT count(*)::int n FROM tenant_memberships WHERE tenant_id=$1 AND status='ACTIVE'`, [tenantId])).rows[0].n;
    const cust = (await c.query(`SELECT count(*)::int n FROM customers WHERE tenant_id=$1`, [tenantId])).rows[0].n;
    await c.query('ROLLBACK'); c.release();
    return { memberships: m, customers: cust };
  }
  const snapshotBefore = await dataSnapshot(tenantCId);
  record('data.snapshot', 'PASS', `before suspend: ${snapshotBefore.memberships} memberships, ${snapshotBefore.customers} customers`);

  // --- Row 4/5: suspend company + fail closed ---
  const statusBeforeSuspend = (await pool.query(`SELECT status FROM tenants WHERE id=$1`, [tenantCId])).rows[0].status;
  if (statusBeforeSuspend === 'ACTIVE') {
    await lifecycle.suspend(platformMutationEvidence(operatorAuthority, ['TENANT_SUSPEND'], { reason: 'Section 5.4 suspend', correlationId: randomUUID(), source: { kind: 'SECTION_54_ACCEPTANCE' }, resourceType: 'tenant' }), tenantCPublic, 'Section 5.4 suspension');
  }
  const statusAfterSuspend = (await pool.query(`SELECT status FROM tenants WHERE id=$1`, [tenantCId])).rows[0].status;
  record('suspend', statusAfterSuspend === 'SUSPENDED' ? 'PASS' : 'FAIL', `after suspend = ${statusAfterSuspend}`);

  // Fail closed: createTenantQueryAuthority refuses a SUSPENDED tenant.
  try {
    createTenantQueryAuthority({ state: 'VALID_ACTIVE_TENANT', tenant: { id: tenantCId, publicId: tenantCId, code: 'SEC52_C', displayName: 'C', status: 'SUSPENDED' as any }, membership: { id: randomUUID(), tenantId: tenantCId, userId: adminCUserId, status: 'ACTIVE' }, validatedAt: Date.now() });
    record('suspend.failclosed', 'FAIL', 'SUSPENDED tenant produced a TenantQueryAuthority');
  } catch (e) {
    record('suspend.failclosed', 'PASS', `rejected: ${(e as Error).message}`);
  }

  // RLS isolation: a DIFFERENT tenant's context (Tenant A) cannot see SEC52_C's data.
  const cs = await pool.connect();
  await cs.query('BEGIN');
  await cs.query(`SELECT set_config('jupiter.tenant_id',$1,true)`, [tenantAId]);
  const aSeesC = (await cs.query(`SELECT count(*)::int n FROM customers WHERE tenant_id=$1`, [tenantCId])).rows[0].n;
  await cs.query('ROLLBACK'); cs.release();
  record('suspend.rls.isolation', aSeesC === 0 ? 'PASS' : 'FAIL', `Tenant A ctx sees ${aSeesC} of SEC52_C customers (RLS isolates by tenant_id; suspension is application-layer via authority gate)`);

  // --- Row 6: data intact while suspended ---
  const snapshotSuspended = await dataSnapshot(tenantCId);
  record('data.intact.suspended', (snapshotSuspended.memberships === snapshotBefore.memberships && snapshotSuspended.customers === snapshotBefore.customers) ? 'PASS' : 'FAIL', `suspended: ${snapshotSuspended.memberships} memberships, ${snapshotSuspended.customers} customers`);

  // --- Row 7: other tenants unaffected (Tenant A) ---
  const aStatus = (await pool.query(`SELECT status FROM tenants WHERE id=$1`, [tenantAId])).rows[0].status;
  const aData = await dataSnapshot(tenantAId);
  record('other.tenantA', aStatus === 'ACTIVE' ? 'PASS' : 'FAIL', `Tenant A = ${aStatus}, ${aData.memberships} memberships, ${aData.customers} customers`);

  // --- Row 8/9: reinstate + data available ---
  const statusBeforeReinstate = (await pool.query(`SELECT status FROM tenants WHERE id=$1`, [tenantCId])).rows[0].status;
  if (statusBeforeReinstate === 'SUSPENDED') {
    await lifecycle.reinstate(platformMutationEvidence(operatorAuthority, ['TENANT_REINSTATE'], { reason: 'Section 5.4 reinstate', correlationId: randomUUID(), source: { kind: 'SECTION_54_ACCEPTANCE' }, resourceType: 'tenant' }), tenantCPublic);
  }
  const statusAfterReinstate = (await pool.query(`SELECT status FROM tenants WHERE id=$1`, [tenantCId])).rows[0].status;
  record('reinstate', statusAfterReinstate === 'ACTIVE' ? 'PASS' : 'FAIL', `after reinstate = ${statusAfterReinstate}`);
  const snapshotReinstated = await dataSnapshot(tenantCId);
  record('data.available.reinstated', (snapshotReinstated.memberships === snapshotBefore.memberships && snapshotReinstated.customers === snapshotBefore.customers) ? 'PASS' : 'FAIL', `reinstated: ${snapshotReinstated.memberships} memberships, ${snapshotReinstated.customers} customers`);

  // --- Row 10: immutable audit ---
  const auditRows = (await pool.query(`SELECT action FROM platform_global_audit_log WHERE resource_id=$1 AND action IN ('TENANT_PROVISION','TENANT_ACTIVATE','TENANT_SUSPEND','TENANT_REINSTATE') ORDER BY action`, [tenantCId])).rows.map(r => r.action);
  const auditTrigger = (await pool.query(`SELECT count(*)::int n FROM pg_trigger WHERE tgname='tr_platform_global_audit_immutable' AND tgenabled <> 'D'`)).rows[0].n;
  const allAudited = ['TENANT_PROVISION','TENANT_ACTIVATE','TENANT_SUSPEND','TENANT_REINSTATE'].every(a => auditRows.includes(a));
  record('audit.lifecycle', allAudited ? 'PASS' : 'FAIL', `audited actions = ${auditRows.join(',')}`);
  record('audit.immutable', auditTrigger >= 1 ? 'PASS' : 'FAIL', `immutable audit trigger enabled = ${auditTrigger >= 1}`);

  // --- Row 11: Tenant ADMIN cannot perform platform operations ---
  const tenantAAdminId = (await pool.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, ['sec52-admin-a-sec52@example.test'])).rows[0].id;
  const tenantAAdminAuth = await authFor(tenantAId, tenantAAdminId);
  // Attempt platform lifecycle evidence construction with a tenant ADMIN authority.
  try {
    platformMutationEvidence(tenantAAdminAuth as any, ['TENANT_PROVISION'], { reason: 'negative', correlationId: randomUUID(), source: { kind: 'SECTION_54_ACCEPTANCE' }, resourceType: 'tenant' });
    record('negative.admin.platform', 'FAIL', 'tenant ADMIN produced platform mutation evidence');
  } catch (e) {
    record('negative.admin.platform', 'PASS', `rejected: ${(e as Error).message}`);
  }
  // Attempt to grant a platform capability using tenant ADMIN authority.
  try {
    await repository.grant(tenantAAdminAuth as any, operatorAuthority.principalId, 'TENANT_PROVISION', 'negative');
    record('negative.admin.grant', 'FAIL', 'tenant ADMIN granted a platform capability');
  } catch (e) {
    record('negative.admin.grant', 'PASS', `rejected: ${(e as Error).message}`);
  }

  console.log('SECTION_54_RESULTS=' + JSON.stringify(results, null, 2));
}

main().then(() => pool.end()).catch(async (e) => { console.error('SECTION_54_FAILED:', e instanceof Error ? e.message : e); await pool.end(); process.exitCode = 1; });



