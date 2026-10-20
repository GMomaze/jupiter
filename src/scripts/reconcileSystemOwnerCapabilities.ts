import { readFileSync } from 'node:fs';
import { pool } from "../config/database.js";
import { PlatformAuthorityRepository } from "../modules/platform-authority/platform-authority.repository.js";
import {
  SYSTEM_OWNER_USER_ID,
  SYSTEM_OWNER_EMAIL,
  buildSystemOwnerReconciliationToken,
} from "../config/systemOwnerCanonical.js";
import {
  validateSystemOwnerReconciliationConfiguration,
  assertSystemOwnerReconciliationIdentityMatches,
  resolveSystemOwnerReconciliationHost,
  type SystemOwnerReconciliationIdentity,
} from "../config/systemOwnerReconciliationSafety.js";
import { DEFAULT_INSTALLATION_DESIGNATION_PATH } from "../config/systemOwnerReconciliationSafety.js";

const IDENTITY_SQL = `SELECT current_database() AS database_name,
  host(inet_server_addr()) AS server_address,
  inet_server_port() AS server_port`;

function readInstallationDesignation(): string | null {
  try {
    return readFileSync(DEFAULT_INSTALLATION_DESIGNATION_PATH, 'utf8');
  } catch {
    return null;
  }
}

async function main() {
  // Commissioning designation comes only from the marker file (never an
  // environment variable). It is required for the commissioning target and is
  // absent/invalid for every other environment.
  const designation = readInstallationDesignation();
  const target = validateSystemOwnerReconciliationConfiguration(
    process.env,
    designation,
  );

  const identity = (
    await pool.query(IDENTITY_SQL)
  ).rows[0] as SystemOwnerReconciliationIdentity | undefined;
  if (!identity) throw new Error("SYSTEM_OWNER_RECONCILIATION_IDENTITY_UNAVAILABLE");
  const addresses = await resolveSystemOwnerReconciliationHost(target.host);
  assertSystemOwnerReconciliationIdentityMatches(target, identity, addresses);

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

  const expected = buildSystemOwnerReconciliationToken(target.database);
  if (process.env.SYSTEM_OWNER_RECONCILIATION_CONFIRMATION !== expected)
    throw new Error("SYSTEM_OWNER_RECONCILIATION_CONFIRMATION_MISMATCH");

  const reason =
    process.env.SYSTEM_OWNER_RECONCILIATION_REASON ||
    "System Owner full-capability reconciliation";

  const result = await repository.reconcileSystemOwnerCapabilities(owner, {
    expectedDatabase: target.database,
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
