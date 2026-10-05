import { randomUUID } from 'node:crypto';
import { pool } from '../config/database.js';
import { PlatformAuthorityRepository } from '../modules/platform-authority/platform-authority.repository.js';
import { platformMutationEvidence } from '../modules/platform-authority/authoritative-platform-mutation.js';
import { TenantLifecycleCommandRepository } from '../modules/tenancy/tenant-lifecycle-command.repository.js';
import {
  StaffInvitationService,
  StaffMembershipAdministrationRepository,
  type InvitationDeliveryMessage,
} from '../modules/auth/staff-membership-administration.js';
import { createTenantQueryAuthority } from '../modules/tenancy/tenant-query-authority.js';
import { withTenantTransaction } from '../modules/tenancy/tenant-transaction.js';
import { Customer, CustomerUser } from '../models/index.js';

const FIXTURE_ROOT = `SEC52-FIXTURE-${new Date().toISOString().replace(/[-:.Z]/g, '')}`;
const SUFFIX = 'SEC52';
const manifest: Record<string, any> = { fixtureRoot: FIXTURE_ROOT, systemOwner: {}, tenantA: {}, tenantB: {}, scheduler: {} };

function evidence(authority: any, operations: string[], resourceType: string, reason: string) {
  return platformMutationEvidence(authority, operations as any, {
    reason, correlationId: randomUUID(),
    source: { kind: 'SECTION_52_ACCEPTANCE_FIXTURE' }, resourceType,
  });
}

async function main() {
  if (process.env.NODE_ENV !== 'test') throw new Error('SECTION_52_FIXTURE_REQUIRES_TEST_ENV');
  if (process.env.ALLOW_SECTION_52_FIXTURE !== 'YES') throw new Error('SECTION_52_FIXTURE_NOT_AUTHORIZED');
  const db = await pool.query(`SELECT current_database() name`);
  if (db.rows[0]?.name !== 'jupiter_test') throw new Error('SECTION_52_FIXTURE_DB_MISMATCH');
  console.log(`[1/9] Fixture root ${FIXTURE_ROOT} targeting jupiter_test`);

  const repository = new PlatformAuthorityRepository(pool);
  const lifecycle = new TenantLifecycleCommandRepository();

  // Step 1: disposable System Owner user + bootstrap (resume if already created)
  const ownerEmail = `sec52-system-owner-${SUFFIX}@example.test`.toLowerCase();
  let ownerUserId = (await pool.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, [ownerEmail])).rows[0]?.id;
  let ownerAuthority;
  if (ownerUserId) {
    ownerAuthority = await repository.resolveHuman(ownerUserId);
    if (!ownerAuthority) throw new Error('SECTION_52_SYSTEM_OWNER_RESOLUTION_FAILED');
    manifest.systemOwner.userId = ownerUserId;
    manifest.systemOwner.email = ownerEmail;
    console.log(`[2/9] Resumed existing System Owner (principal ${ownerAuthority.principalId})`);
  } else {
    ownerUserId = randomUUID();
    await pool.query(
      `INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES($1,$2,$3,'Section 5.2 System Owner',true)`,
      [ownerUserId, ownerEmail, 'unused-placeholder-hash'],
    );
    manifest.systemOwner.userId = ownerUserId;
    manifest.systemOwner.email = ownerEmail;
    const confirmation = `BOOTSTRAP:jupiter_test:${ownerUserId}:${ownerEmail}`;
    await repository.bootstrap({
      userId: ownerUserId, expectedEmail: ownerEmail, expectedDatabase: 'jupiter_test',
      confirmationToken: confirmation, displayName: 'Section 5.2 System Owner',
    });
    ownerAuthority = await repository.resolveHuman(ownerUserId);
    if (!ownerAuthority) throw new Error('SECTION_52_SYSTEM_OWNER_RESOLUTION_FAILED');
    console.log(`[2/9] System Owner bootstrapped (principal ${ownerAuthority.principalId})`);
  }
  manifest.systemOwner.principalId = ownerAuthority!.principalId;
  const ownerGrants = await pool.query(
    `SELECT pg.id FROM platform_capability_grants pg WHERE pg.principal_id=$1 AND pg.revoked_at IS NULL`,
    [ownerAuthority!.principalId],
  );
  manifest.systemOwner.grantIds = ownerGrants.rows.map((r: any) => r.id);

  // Step 1.5: lifecycle operator principal (self-grant is forbidden; separate operator)
  const operatorEmail = `sec52-operator-${SUFFIX}@example.test`;
  let operatorUserId = (await pool.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, [operatorEmail])).rows[0]?.id;
  let operatorAuthority;
  if (operatorUserId) {
    operatorAuthority = await repository.resolveHuman(operatorUserId);
    if (!operatorAuthority) throw new Error('SECTION_52_OPERATOR_RESOLUTION_FAILED');
    manifest.operator = { userId: operatorUserId, principalId: operatorAuthority.principalId };
    console.log(`[2.5/9] Resumed lifecycle operator (principal ${operatorAuthority.principalId})`);
  } else {
    operatorUserId = randomUUID();
    await pool.query(
      `INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES($1,$2,$3,'Section 5.2 Lifecycle Operator',true)`,
      [operatorUserId, operatorEmail, 'unused-placeholder-hash'],
    );
    const operatorPrincipalId = await repository.createPrincipal(ownerAuthority!, {
      principalType: 'HUMAN', userId: operatorUserId, displayName: 'Section 5.2 Lifecycle Operator', reason: 'Section 5.2 lifecycle operator fixture',
    });
    await repository.grant(ownerAuthority!, operatorPrincipalId, 'TENANT_PROVISION', 'Section 5.2 lifecycle fixture');
    await repository.grant(ownerAuthority!, operatorPrincipalId, 'TENANT_ACTIVATE', 'Section 5.2 lifecycle fixture');
    await repository.grant(ownerAuthority!, operatorPrincipalId, 'TENANT_SUSPEND', 'Section 5.2 lifecycle fixture');
    operatorAuthority = await repository.resolveHuman(operatorUserId);
    if (!operatorAuthority) throw new Error('SECTION_52_OPERATOR_RESOLUTION_FAILED');
    manifest.operator = { userId: operatorUserId, principalId: operatorPrincipalId };
    console.log(`[2.5/9] Lifecycle operator principal (${operatorPrincipalId})`);
  }


  // Step 2/3: provision + activate Tenant A and Tenant B (resumable by code)
  async function provisionTenant(code: string, displayName: string, adminEmail: string, adminName: string) {
    let adminUserId = (await pool.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, [adminEmail])).rows[0]?.id;
    if (!adminUserId) {
      adminUserId = randomUUID();
      await pool.query(
        `INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES($1,$2,$3,$4,true)`,
        [adminUserId, adminEmail, 'unused-placeholder-hash', adminName],
      );
    }
    const existing = (await pool.query(`SELECT id,public_id,code,status FROM tenants WHERE code=$1`, [code])).rows[0];
    if (existing) {
      return { tenantId: existing.id, publicId: existing.public_id, code: existing.code, adminUserId };
    }
    const provisioned = await lifecycle.provision(
      evidence(operatorAuthority!, ['TENANT_PROVISION'], 'tenant', `Section 5.2 provision ${displayName}`),
      { code, displayName, initialUserId: adminUserId },
    );
    await lifecycle.activate(
      evidence(operatorAuthority!, ['TENANT_ACTIVATE'], 'tenant', `Section 5.2 activate ${displayName}`),
      provisioned.publicId,
    );
    return { tenantId: provisioned.tenantId, publicId: provisioned.publicId, code: provisioned.code, adminUserId };
  }

  const tenantA = await provisionTenant('SEC52_A', 'Section 5.2 Tenant A', `sec52-admin-a-${SUFFIX}@example.test`, 'Section 5.2 Tenant A Admin');
  manifest.tenantA = tenantA;
  console.log(`[3/9] Tenant A ACTIVE (${tenantA.tenantId})`);

  const tenantB = await provisionTenant('SEC52_B', 'Section 5.2 Tenant B', `sec52-admin-b-${SUFFIX}@example.test`, 'Section 5.2 Tenant B Admin');
  manifest.tenantB = tenantB;
  console.log(`[4/9] Tenant B ACTIVE (${tenantB.tenantId}); suspend later`);

  // Step 4: normal staff memberships (invite + accept)
  const mkAuth = (id: string, publicId: string, code: string, adminUserId: string) => createTenantQueryAuthority({
    state: 'VALID_ACTIVE_TENANT',
    tenant: { id, publicId, code, displayName: 'Section 5.2', status: 'ACTIVE' },
    membership: { id: randomUUID(), tenantId: id, userId: adminUserId, status: 'ACTIVE' },
    validatedAt: Date.now(),
  });
  const authA = mkAuth(tenantA.tenantId, tenantA.publicId, tenantA.code, tenantA.adminUserId);
  const authB = mkAuth(tenantB.tenantId, tenantB.publicId, tenantB.code, tenantB.adminUserId);
  const captured: Record<string, string> = {};
  const delivery = (label: string) => ({ async deliver(msg: InvitationDeliveryMessage) { captured[label] = msg.token; } });
  const staffAEmail = `sec52-staff-a-${SUFFIX}@example.test`;
  const staffBEmail = `sec52-staff-b-${SUFFIX}@example.test`;
  const staffAUser = (await pool.query(`SELECT id, is_active FROM users WHERE lower(email)=lower($1)`, [staffAEmail])).rows[0];
  const staffBUser = (await pool.query(`SELECT id, is_active FROM users WHERE lower(email)=lower($1)`, [staffBEmail])).rows[0];
  if (staffAUser?.is_active && staffBUser?.is_active) {
    manifest.tenantA.staffUserId = staffAUser.id;
    manifest.tenantB.staffUserId = staffBUser.id;
    console.log(`[5/9] Normal staff already active (A ${staffAUser.id}, B ${staffBUser.id})`);
  } else {
    await new StaffInvitationService(new StaffMembershipAdministrationRepository(pool), delivery('a'))
      .invite(authA, { email: staffAEmail, fullName: 'Section 5.2 Tenant A Staff', actorUserId: tenantA.adminUserId, reason: 'Section 5.2 staff fixture' });
    await new StaffInvitationService(new StaffMembershipAdministrationRepository(pool), delivery('b'))
      .invite(authB, { email: staffBEmail, fullName: 'Section 5.2 Tenant B Staff', actorUserId: tenantB.adminUserId, reason: 'Section 5.2 staff fixture' });
    await new StaffInvitationService(new StaffMembershipAdministrationRepository(pool), { async deliver() {} })
      .accept({ token: captured['a']!, tenantId: tenantA.tenantId, password: 'section52-password-123' });
    await new StaffInvitationService(new StaffMembershipAdministrationRepository(pool), { async deliver() {} })
      .accept({ token: captured['b']!, tenantId: tenantB.tenantId, password: 'section52-password-123' });
    manifest.tenantA.staffUserId = (await pool.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, [staffAEmail])).rows[0].id;
    manifest.tenantB.staffUserId = (await pool.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, [staffBEmail])).rows[0].id;
    console.log(`[5/9] Normal staff created (A ${manifest.tenantA.staffUserId}, B ${manifest.tenantB.staffUserId})`);
  }

  // Step 5: Customer Portal identities
  await withTenantTransaction(authA, async (tx) => {
    const existing = await Customer.findOne({ where: { email: `sec52-customer-a-${SUFFIX}@example.test` }, transaction: tx });
    const customer = existing ?? await Customer.create({ tenant_id: tenantA.tenantId, name: 'SEC52 Customer A', contact_person: 'A', email: `sec52-customer-a-${SUFFIX}@example.test`, phone: '1', status: 'ACTIVE' }, { transaction: tx });
    const existingPortal = await CustomerUser.findOne({ where: { email: `sec52-portal-a-${SUFFIX}@example.test` }, transaction: tx });
    const portalUser = existingPortal ?? await CustomerUser.create({ customer_id: customer.id, email: `sec52-portal-a-${SUFFIX}@example.test`, display_name: 'Portal A', password_hash: 'unused', status: 'ACTIVE' }, { transaction: tx });
    manifest.tenantA.customerId = customer.id;
    manifest.tenantA.portalUserId = portalUser.id;
  });
  await withTenantTransaction(authB, async (tx) => {
    const existing = await Customer.findOne({ where: { email: `sec52-customer-b-${SUFFIX}@example.test` }, transaction: tx });
    const customer = existing ?? await Customer.create({ tenant_id: tenantB.tenantId, name: 'SEC52 Customer B', contact_person: 'B', email: `sec52-customer-b-${SUFFIX}@example.test`, phone: '1', status: 'ACTIVE' }, { transaction: tx });
    const existingPortal = await CustomerUser.findOne({ where: { email: `sec52-portal-b-${SUFFIX}@example.test` }, transaction: tx });
    const portalUser = existingPortal ?? await CustomerUser.create({ customer_id: customer.id, email: `sec52-portal-b-${SUFFIX}@example.test`, display_name: 'Portal B', password_hash: 'unused', status: 'ACTIVE' }, { transaction: tx });
    manifest.tenantB.customerId = customer.id;
    manifest.tenantB.portalUserId = portalUser.id;
  });
  console.log(`[6/9] Customer Portal identities created`);

  // Step 6: scheduler SERVICE principal (historical R4-3 scheduler occupies the exact service code)
  let schedulerPrincipal = await repository.resolveService('SB_SYNC_SCHEDULER');
  if (!schedulerPrincipal) {
    const existing = await pool.query(`SELECT id, status FROM platform_principals WHERE service_code='SB_SYNC_SCHEDULER'`);
    if (existing.rows.length > 0) {
      console.log(`[7/9] Scheduler skipped: historical R4-3 SB_SYNC_SCHEDULER principal exists (${existing.rows[0].id}, ${existing.rows[0].status})`);
      manifest.scheduler = { skipped: true, reason: 'R4-3 SB_SYNC_SCHEDULER principal occupies service code', historicalId: existing.rows[0].id };
    } else {
      await repository.provisionSbSyncScheduler(ownerAuthority, 'Section 5.2 scheduler fixture');
      schedulerPrincipal = await repository.resolveService('SB_SYNC_SCHEDULER');
      manifest.scheduler.principalId = schedulerPrincipal?.principalId ?? '';
      const schedulerGrant = await pool.query(
        `SELECT pg.id FROM platform_capability_grants pg JOIN platform_capabilities pc ON pc.id=pg.capability_id
          WHERE pg.principal_id=$1 AND pc.code='SERVICE_BULLETIN_SYNC_EXECUTE' AND pg.revoked_at IS NULL`,
        [manifest.scheduler.principalId],
      );
      manifest.scheduler.grantId = schedulerGrant.rows[0]?.id ?? '';
      console.log(`[7/9] Scheduler SERVICE principal (${manifest.scheduler.principalId})`);
    }
  } else {
    manifest.scheduler.principalId = schedulerPrincipal.principalId;
    console.log(`[7/9] Scheduler SERVICE principal already active (${schedulerPrincipal.principalId})`);
  }

  // Step 7: suspend Tenant B
  const tenantBStatus = (await pool.query(`SELECT status FROM tenants WHERE code='SEC52_B'`)).rows[0]?.status;
  if (tenantBStatus === 'ACTIVE') {
    await lifecycle.suspend(
      evidence(operatorAuthority, ['TENANT_SUSPEND'], 'tenant', 'Section 5.2 suspend Tenant B'),
      tenantB.publicId, 'Section 5.2 acceptance fixture suspension',
    );
    console.log(`[8/9] Tenant B SUSPENDED`);
  } else {
    console.log(`[8/9] Tenant B already ${tenantBStatus}`);
  }

  console.log(`[9/9] MANIFEST=${JSON.stringify(manifest, null, 2)}`);
}

main().then(() => pool.end()).catch(async (error) => {
  console.error('SECTION_52_FIXTURE_FAILED:', error instanceof Error ? error.message : error);
  console.error('PARTIAL_MANIFEST=' + JSON.stringify(manifest, null, 2));
  await pool.end();
  process.exitCode = 1;
});


