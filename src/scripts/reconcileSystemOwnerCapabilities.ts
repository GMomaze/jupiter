import { pool } from "../config/database.js";
import { PlatformAuthorityRepository } from "../modules/platform-authority/platform-authority.repository.js";
import {
  SYSTEM_OWNER_USER_ID,
  SYSTEM_OWNER_EMAIL,
  buildSystemOwnerReconciliationToken,
} from "../config/systemOwnerCanonical.js";

const TARGET_DATABASE = "jupiter_test";

async function main() {
  if (process.env.NODE_ENV !== "test")
    throw new Error("SYSTEM_OWNER_RECONCILIATION_REQUIRES_TEST_ENV");
  if (process.env.ALLOW_SYSTEM_OWNER_CAPABILITY_RECONCILIATION !== "YES")
    throw new Error("SYSTEM_OWNER_RECONCILIATION_NOT_AUTHORIZED");
  const db = await pool.query(`SELECT current_database() name`);
  if (db.rows[0]?.name !== TARGET_DATABASE)
    throw new Error("SYSTEM_OWNER_RECONCILIATION_DB_MISMATCH");

  const repository = new PlatformAuthorityRepository(pool);

  // Authoritative persisted identity: the canonical fixed UUID + email.
  const owner = await repository.resolveHuman(SYSTEM_OWNER_USER_ID);
  if (!owner) throw new Error("SYSTEM_OWNER_RESOLUTION_FAILED");
  if (owner.principalType !== "HUMAN")
    throw new Error("SYSTEM_OWNER_HUMAN_REQUIRED");
  if (!owner.capabilities.has("PLATFORM_AUTHORITY_MANAGE"))
    throw new Error("SYSTEM_OWNER_FOUNDATION_CAPABILITY_MISSING");

  const user = await pool.query(
    `SELECT email,is_active,retired_at FROM users WHERE id=$1`,
    [SYSTEM_OWNER_USER_ID],
  );
  if (user.rowCount !== 1) throw new Error("SYSTEM_OWNER_USER_MISSING");
  const row = user.rows[0];
  if (
    row.email.toLowerCase() !== SYSTEM_OWNER_EMAIL.toLowerCase() ||
    row.is_active !== true ||
    row.retired_at !== null
  )
    throw new Error("SYSTEM_OWNER_IDENTITY_MISMATCH");

  const expected = buildSystemOwnerReconciliationToken(TARGET_DATABASE);
  if (process.env.SYSTEM_OWNER_RECONCILIATION_CONFIRMATION !== expected)
    throw new Error("SYSTEM_OWNER_RECONCILIATION_CONFIRMATION_MISMATCH");

  const reason =
    process.env.SYSTEM_OWNER_RECONCILIATION_REASON ||
    "System Owner full-capability reconciliation";

  const result = await repository.reconcileSystemOwnerCapabilities(owner, {
    expectedDatabase: TARGET_DATABASE,
    confirmationToken: expected,
    reason,
  });

  console.log(
    `Reconciled ${result.granted.length} missing capability(ies); ${result.alreadyGranted} already held.`,
  );
  if (result.granted.length)
    console.log(`Granted: ${[...result.granted].sort().join(", ")}`);
  console.log("System Owner capability reconciliation complete.");
}

main()
  .catch(async (error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "System Owner reconciliation failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
