import { randomUUID } from 'node:crypto';
import { pool } from '../config/database.js';
import { PlatformAuthorityRepository } from '../modules/platform-authority/platform-authority.repository.js';

const OWNER_USER_ID = '95e16523-7db0-43b0-b76e-637c3a921e63';
const OWNER_PRINCIPAL_ID = '3115e26d-d04a-4be6-b4a4-722a29e73a25';
const ADDITIONAL_CAPABILITIES = ['TENANT_PROVISION', 'TENANT_ACTIVATE', 'TENANT_SUSPEND', 'TENANT_REINSTATE'] as const;
const REQUIRED_CAPABILITIES = ['PLATFORM_AUTHORITY_MANAGE', 'PLATFORM_AUDIT_VIEW', 'TENANT_PROVISION', 'TENANT_ACTIVATE', 'TENANT_SUSPEND', 'TENANT_REINSTATE'] as const;

async function main() {
  if (process.env.NODE_ENV !== 'test') throw new Error('SEC52_RECONCILIATION_REQUIRES_TEST_ENV');
  if (process.env.ALLOW_SEC52_SYSTEM_OWNER_RECONCILIATION !== 'YES') throw new Error('SEC52_RECONCILIATION_NOT_AUTHORIZED');
  const db = await pool.query(`SELECT current_database() name`);
  if (db.rows[0]?.name !== 'jupiter_test') throw new Error('SEC52_RECONCILIATION_DB_MISMATCH');

  const repository = new PlatformAuthorityRepository(pool);

  const owner = await repository.resolveHuman(OWNER_USER_ID);
  if (!owner) throw new Error('SEC52_OWNER_RESOLUTION_FAILED');
  if (owner.principalId !== OWNER_PRINCIPAL_ID) throw new Error('SEC52_OWNER_PRINCIPAL_MISMATCH');
  console.log(`Owner principal ${owner.principalId} current capabilities: ${[...owner.capabilities].sort().join(', ')}`);

  if (!owner.capabilities.has('PLATFORM_AUTHORITY_MANAGE') || !owner.capabilities.has('PLATFORM_AUDIT_VIEW')) {
    throw new Error('SEC52_OWNER_FOUNDATION_CAPABILITIES_MISSING');
  }

  const missing = ADDITIONAL_CAPABILITIES.filter((c) => !owner.capabilities.has(c));
  if (missing.length === 0) {
    console.log('SEC52 owner already holds all six canonical capabilities; nothing to reconcile.');
    await pool.end();
    return;
  }
  console.log(`Missing capabilities to reconcile: ${missing.join(', ')}`);

  // 1. Disposable temporary grantor user (placeholder hash; never logs in).
  const tempUserId = randomUUID();
  const tempEmail = `sec52-reconciliation-grantor-${Date.now()}@example.test`;
  await pool.query(
    `INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES($1,$2,'unused-placeholder-hash','SEC52 reconciliation grantor',true)`,
    [tempUserId, tempEmail],
  );

  try {
    // 2. Temporary grantor principal.
    const tempPrincipalId = await repository.createPrincipal(owner, {
      principalType: 'HUMAN', userId: tempUserId, displayName: 'SEC52 reconciliation grantor', reason: 'SEC52 System Owner six-capability reconciliation',
    });

    // 3. Grant PLATFORM_AUTHORITY_MANAGE to the grantor.
    await repository.grant(owner, tempPrincipalId, 'PLATFORM_AUTHORITY_MANAGE', 'SEC52 reconciliation grantor');

    // 4. Resolve the grantor's fresh authority.
    const grantor = await repository.resolveHuman(tempUserId);
    if (!grantor) throw new Error('SEC52_GRANTOR_RESOLUTION_FAILED');

    // 5. Grantor grants the four TENANT_* capabilities to the owner (self-grant remains forbidden).
    for (const capability of ADDITIONAL_CAPABILITIES) {
      await repository.grant(grantor, OWNER_PRINCIPAL_ID, capability, 'SEC52 System Owner six-capability reconciliation');
    }

    // 6. Retire the grantor: revoke PLATFORM_AUTHORITY_MANAGE then disable.
    await repository.revoke(owner, tempPrincipalId, 'PLATFORM_AUTHORITY_MANAGE', 'SEC52 reconciliation grantor retirement');
    await repository.disablePrincipal(owner, tempPrincipalId, 'SEC52 reconciliation grantor retirement');
    console.log(`Temporary grantor ${tempPrincipalId} retired (revoked + disabled).`);
  } finally {
    // 7. Deactivate the disposable grantor user regardless of outcome.
    await pool.query(`UPDATE users SET is_active=false WHERE id=$1`, [tempUserId]);
  }

  // 8. Verify the owner ends with exactly the six canonical capabilities.
  const finalOwner = await repository.resolveHuman(OWNER_USER_ID);
  if (!finalOwner) throw new Error('SEC52_OWNER_FINAL_RESOLUTION_FAILED');
  const finalCaps = [...finalOwner.capabilities].sort();
  const expected = [...REQUIRED_CAPABILITIES].sort();
  if (JSON.stringify(finalCaps) !== JSON.stringify(expected)) {
    throw new Error(`SEC52_OWNER_CAPABILITY_MISMATCH: got ${finalCaps.join(', ')}`);
  }
  console.log(`Reconciled owner capabilities: ${finalCaps.join(', ')}`);
  console.log('SEC52 reconciliation complete.');
  await pool.end();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : 'SEC52 reconciliation failed.');
  await pool.end();
  process.exitCode = 1;
});
