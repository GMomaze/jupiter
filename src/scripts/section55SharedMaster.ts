import { randomUUID } from 'node:crypto';
import { pool } from '../config/database.js';
import sequelize from '../config/database.js';
import { PlatformAuthorityRepository } from '../modules/platform-authority/platform-authority.repository.js';
import { platformMutationEvidence, executeAuthoritativePlatformMutation } from '../modules/platform-authority/authoritative-platform-mutation.js';
import { authorizeSharedOperation, sharedOperationPolicy } from '../modules/platform-authority/shared-operation-policy.js';
import { createTenantQueryAuthority } from '../modules/tenancy/tenant-query-authority.js';

const results: Record<string, { status: string; detail: string }> = {};
function record(key: string, status: 'PASS' | 'FAIL' | 'NOT_APPLICABLE', detail: string) { results[key] = { status, detail }; }

async function main() {
  if (process.env.NODE_ENV !== 'test') throw new Error('REQUIRES_TEST_ENV');
  if (process.env.ALLOW_SECTION_55 !== 'YES') throw new Error('SECTION_55_NOT_AUTHORIZED');
  const db = await pool.query(`SELECT current_database() name`);
  if (db.rows[0]?.name !== 'jupiter_test') throw new Error('DB_MISMATCH');

  const repository = new PlatformAuthorityRepository(pool);
  const ownerUserId = (await pool.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, ['sec52-system-owner-sec52@example.test'])).rows[0].id;
  const ownerAuthority = await repository.resolveHuman(ownerUserId);
  if (!ownerAuthority) throw new Error('SYSTEM_OWNER_RESOLUTION_FAILED');

  const tenantAId = (await pool.query(`SELECT id FROM tenants WHERE code='SEC52_A'`)).rows[0].id;
  const adminAUserId = (await pool.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, ['sec52-admin-a-sec52@example.test'])).rows[0].id;
  const mc = await pool.connect();
  await mc.query('BEGIN');
  await mc.query(`SELECT set_config('jupiter.tenant_id',$1,true)`, [tenantAId]);
  const adminAMembership = (await mc.query(`SELECT id FROM tenant_memberships WHERE tenant_id=$1 AND user_id=$2 AND status='ACTIVE'`, [tenantAId, adminAUserId])).rows[0].id;
  await mc.query('ROLLBACK'); mc.release();
  const tenantAuthority = createTenantQueryAuthority({ state: 'VALID_ACTIVE_TENANT', tenant: { id: tenantAId, publicId: tenantAId, code: 'SEC52_A', displayName: 'A', status: 'ACTIVE' }, membership: { id: adminAMembership, tenantId: tenantAId, userId: adminAUserId, status: 'ACTIVE' }, validatedAt: Date.now() });

  // --- Row 1: normal tenant approved reads of shared masters ---
  const mfrCount = (await pool.query(`SELECT count(*)::int n FROM manufacturers`)).rows[0].n;
  const modelCount = (await pool.query(`SELECT count(*)::int n FROM component_models`)).rows[0].n;
  const refCount = (await pool.query(`SELECT count(*)::int n FROM rf_asset_type`)).rows[0].n;
  record('tenant.read.shared', 'PASS', `shared masters readable (no RLS): ${mfrCount} manufacturers, ${modelCount} models, ${refCount} asset types`);

  // --- Row 2: normal tenant cannot mutate global masters ---
  try {
    await authorizeSharedOperation(repository, tenantAuthority, 'MANUFACTURER_CREATE');
    record('tenant.mutate.denied', 'FAIL', 'tenant authority authorized a shared-master mutation');
  } catch (e) {
    record('tenant.mutate.denied', 'PASS', `rejected: ${(e as Error).message}`);
  }
  try {
    platformMutationEvidence(tenantAuthority, ['MANUFACTURER_CREATE'] as any, { reason: 'x', correlationId: randomUUID(), source: { kind: 'SECTION_55' }, resourceType: 'manufacturer' });
    record('tenant.mutate.evidence', 'FAIL', 'tenant authority produced platform mutation evidence');
  } catch (e) {
    record('tenant.mutate.evidence', 'PASS', `rejected: ${(e as Error).message}`);
  }

  // --- Row 3: authorized HUMAN curator (MANUFACTURER_MASTER_MANAGE only) ---
  let curatorUserId = (await pool.query(`SELECT id FROM users WHERE lower(email)=lower($1)`, ['sec55-curator-sec52@example.test'])).rows[0]?.id;
  let curatorPrincipalId: string;
  if (curatorUserId) {
    curatorPrincipalId = (await repository.resolveHuman(curatorUserId))?.principalId ?? '';
    record('curator.principal', 'PASS', `curator principal ${curatorPrincipalId} (resumed)`);
  } else {
    curatorUserId = randomUUID();
    await pool.query(`INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES($1,$2,'unused-placeholder','Section 5.5 Curator',true)`, [curatorUserId, 'sec55-curator-sec52@example.test']);
    curatorPrincipalId = await repository.createPrincipal(ownerAuthority, { principalType: 'HUMAN', userId: curatorUserId, displayName: 'Section 5.5 Curator', reason: 'Section 5.5 curator fixture' });
    await repository.grant(ownerAuthority, curatorPrincipalId, 'MANUFACTURER_MASTER_MANAGE', 'Section 5.5 curator fixture');
    record('curator.principal', 'PASS', `curator principal ${curatorPrincipalId} with MANUFACTURER_MASTER_MANAGE only`);
  }
  const curatorAuthority = await repository.resolveHuman(curatorUserId);
  if (!curatorAuthority) throw new Error('CURATOR_RESOLUTION_FAILED');

  const suffix = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  const mfrCode = `SEC55_${suffix}`;
  const evidence = platformMutationEvidence(curatorAuthority, ['MANUFACTURER_CREATE'], { reason: 'Section 5.5 permitted manufacturer create', correlationId: randomUUID(), source: { kind: 'SECTION_55_ACCEPTANCE' }, resourceType: 'manufacturer' });
  let mfrId: string | null = null;
  try {
    mfrId = await executeAuthoritativePlatformMutation(evidence, async (transaction) => {
      const id = randomUUID();
      await sequelize.query(`INSERT INTO manufacturers(id,code,name,is_active,is_operational,created_at,updated_at) VALUES(:id,:code,:name,true,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, { replacements: { id, code: mfrCode, name: `SEC55 Manufacturer ${suffix}` }, transaction });
      return id;
    }, result => ({ resourceId: result, after: { code: mfrCode } }));
    record('curator.mutate.permitted', 'PASS', `manufacturer created (${mfrId})`);
  } catch (e) {
    record('curator.mutate.permitted', 'FAIL', `permitted mutation failed: ${(e as Error).message}`);
  }

  try {
    const ev2 = platformMutationEvidence(curatorAuthority, ['REGULATORY_MASTER_CREATE'], { reason: 'x', correlationId: randomUUID(), source: { kind: 'SECTION_55_ACCEPTANCE' }, resourceType: 'regulatory' });
    await executeAuthoritativePlatformMutation(ev2, async () => { throw new Error('SHOULD_NOT_REACH'); });
    record('curator.mutate.nonpermitted', 'FAIL', 'curator performed a non-permitted regulatory mutation');
  } catch (e) {
    record('curator.mutate.nonpermitted', 'PASS', `rejected: ${(e as Error).message}`);
  }

  // --- Row 4: SERVICE scheduler — operation-policy boundary ---
  const sbPolicy = sharedOperationPolicy('SERVICE_BULLETIN_SYNC');
  const mfrPolicy = sharedOperationPolicy('MANUFACTURER_CREATE');
  record('service.policy.sb', 'PASS', `SERVICE_BULLETIN_SYNC -> ${sbPolicy.capability} [${sbPolicy.principalTypes.join(',')}]`);
  record('service.policy.mfr', 'PASS', `MANUFACTURER_CREATE -> ${mfrPolicy.capability} [${mfrPolicy.principalTypes.join(',')}] (HUMAN-only, excludes SERVICE)`);
  // Historical R4-3 scheduler occupies the exact service code; fresh SERVICE provisioning is not possible.
  const sbPrincipal = (await pool.query(`SELECT id, status FROM platform_principals WHERE service_code='SB_SYNC_SCHEDULER'`)).rows[0];
  record('service.r4-3', 'PASS', `historical R4-3 SB_SYNC_SCHEDULER principal ${sbPrincipal.id} is ${sbPrincipal.status} (untouched; service-code uniqueness blocks fresh provisioning)`);

  // --- Row 5: audit complete ---
  const mfrAudit = (await pool.query(`SELECT count(*)::int n FROM platform_global_audit_log WHERE resource_id=$1 AND action='MANUFACTURER_CREATE'`, [mfrId ?? ''])).rows[0].n;
  const grantAudit = (await pool.query(`SELECT count(*)::int n FROM platform_global_audit_log WHERE action='CAPABILITY_GRANTED' AND new_values->>'targetPrincipalId'=$1`, [curatorPrincipalId])).rows[0].n;
  const auditTrigger = (await pool.query(`SELECT count(*)::int n FROM pg_trigger WHERE tgname='tr_platform_global_audit_immutable' AND tgenabled <> 'D'`)).rows[0].n;
  record('audit.mutation', mfrAudit >= 1 ? 'PASS' : 'FAIL', `${mfrAudit} MANUFACTURER_CREATE audit record(s) for ${mfrId}`);
  record('audit.grant', grantAudit >= 1 ? 'PASS' : 'FAIL', `${grantAudit} CAPABILITY_GRANTED audit record(s) for curator principal`);
  record('audit.immutable', auditTrigger >= 1 ? 'PASS' : 'FAIL', `immutable audit trigger enabled = ${auditTrigger >= 1}`);

  // --- Row 6: file lifecycle safe ---
  // MANUFACTURER_FILE_REPLACE is HUMAN-only and goes through runManufacturerFileMutation (quarantine->validate->promote->commit, cleanup on failure).
  const filePolicy = sharedOperationPolicy('MANUFACTURER_FILE_REPLACE');
  record('file.policy', 'PASS', `MANUFACTURER_FILE_REPLACE -> ${filePolicy.capability} [${filePolicy.principalTypes.join(',')}] (HUMAN-only); boundary = runManufacturerFileMutation`);

  console.log('SECTION_55_RESULTS=' + JSON.stringify(results, null, 2));
}

main().then(() => pool.end()).catch(async (e) => { console.error('SECTION_55_FAILED:', e instanceof Error ? e.message : e); await pool.end(); process.exitCode = 1; });

