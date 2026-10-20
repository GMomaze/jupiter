import { describe, expect, it, vi } from "vitest";
import { PlatformAuthorityRepository } from "./platform-authority.repository.js";
import {
  SYSTEM_OWNER_USER_ID,
  SYSTEM_OWNER_EMAIL,
  SYSTEM_OWNER_CAPABILITY_CODES,
  buildSystemOwnerReconciliationToken,
} from "../../config/systemOwnerCanonical.js";

const FOUNDATION = ["PLATFORM_AUTHORITY_MANAGE", "PLATFORM_AUDIT_VIEW"];
const canonicalPrincipal = {
  id: "principal-owner",
  principal_type: "HUMAN",
  principal_code: SYSTEM_OWNER_USER_ID,
  capabilities: FOUNDATION,
};

interface Fixture {
  db?: string;
  canonical?: Record<string, unknown> | null;
  heldCodes?: string[];
}

function makeRepo(fixture: Fixture = {}) {
  const heldCodes = fixture.heldCodes ?? FOUNDATION;
  const clientQuery = vi.fn(async (sql: string, params?: unknown[]) => {
    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK")
      return { rows: [], rowCount: 0 };
    if (sql.includes("pg_advisory_xact_lock"))
      return { rows: [], rowCount: 0 };
    if (sql.includes("SELECT 1 FROM platform_principals"))
      return { rows: [{}], rowCount: 1 };
    if (sql.includes("current_database"))
      return { rows: [{ name: fixture.db ?? "jupiter_test" }], rowCount: 1 };
    if (sql.includes("JOIN users u ON u.id=pp.user_id"))
      return fixture.canonical === null
        ? { rows: [], rowCount: 0 }
        : {
            rows: [
              fixture.canonical ?? {
                id: SYSTEM_OWNER_USER_ID,
                email: SYSTEM_OWNER_EMAIL,
                is_active: true,
                retired_at: null,
              },
            ],
            rowCount: 1,
          };
    if (sql.includes("SELECT pc.code FROM platform_capability_grants"))
      return { rows: heldCodes.map((code) => ({ code })), rowCount: heldCodes.length };
    if (sql.includes("FROM platform_capabilities WHERE code=ANY")) {
      const codes = (params as unknown[][])[0] as string[];
      return {
        rows: codes.map((code, i) => ({ id: `cap-${i}`, code })),
        rowCount: codes.length,
      };
    }
    if (sql.includes("INSERT INTO platform_capability_grants"))
      return { rows: [], rowCount: 1 };
    if (sql.includes("INSERT INTO platform_global_audit_log"))
      return { rows: [], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
  const client = { query: clientQuery, release: vi.fn() };
  const pool = {
    query: vi.fn(async () => ({ rows: [canonicalPrincipal], rowCount: 1 })),
    connect: vi.fn().mockResolvedValue(client),
  };
  const repo = new PlatformAuthorityRepository(pool as never);
  return { repo, clientQuery, pool };
}

async function resolveOwner(repo: PlatformAuthorityRepository) {
  const owner = await repo.resolveHuman(SYSTEM_OWNER_USER_ID);
  if (!owner) throw new Error("OWNER_RESOLUTION_FAILED");
  return owner;
}


describe("System Owner capability reconciliation", () => {
  it("grants only the missing canonical capabilities with immutable audit", async () => {
    const { repo, clientQuery } = makeRepo();
    const owner = await resolveOwner(repo);
    const result = await repo.reconcileSystemOwnerCapabilities(owner, {
      expectedDatabase: "jupiter_test",
      confirmationToken: buildSystemOwnerReconciliationToken("jupiter_test"),
      reason,
    });
    expect(result.granted.sort()).toEqual(
      SYSTEM_OWNER_CAPABILITY_CODES.filter((c) => !FOUNDATION.includes(c)).sort(),
    );
    expect(result.alreadyGranted).toBe(FOUNDATION.length);
    const grantInserts = clientQuery.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO platform_capability_grants"),
    );
    const auditInserts = clientQuery.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO platform_global_audit_log"),
    );
    expect(grantInserts).toHaveLength(21);
    expect(auditInserts).toHaveLength(21);
  });

  it("reconciles the commissioning database target with the same idempotent grant set", async () => {
    const { repo, clientQuery } = makeRepo({ db: "jupiter_db" });
    const owner = await resolveOwner(repo);
    const result = await repo.reconcileSystemOwnerCapabilities(owner, {
      expectedDatabase: "jupiter_db",
      confirmationToken: buildSystemOwnerReconciliationToken("jupiter_db"),
      reason,
    });
    expect(result.granted.sort()).toEqual(
      SYSTEM_OWNER_CAPABILITY_CODES.filter((c) => !FOUNDATION.includes(c)).sort(),
    );
    expect(result.alreadyGranted).toBe(FOUNDATION.length);
    const grantInserts = clientQuery.mock.calls.filter(([sql]) =>
      String(sql).includes("INSERT INTO platform_capability_grants"),
    );
    expect(grantInserts).toHaveLength(21);
  });

  it("is idempotent and grants nothing when the full set is already held", async () => {
    const { repo, clientQuery } = makeRepo({ heldCodes: [...SYSTEM_OWNER_CAPABILITY_CODES] });
    const owner = await resolveOwner(repo);
    const result = await repo.reconcileSystemOwnerCapabilities(owner, {
      expectedDatabase: "jupiter_test",
      confirmationToken: buildSystemOwnerReconciliationToken("jupiter_test"),
      reason,
    });
    expect(result.granted).toEqual([]);
    expect(result.alreadyGranted).toBe(23);
    expect(
      clientQuery.mock.calls.filter(([sql]) =>
        String(sql).includes("INSERT INTO platform_capability_grants"),
      ),
    ).toHaveLength(0);
  });

  it("rejects a wrong database", async () => {
    const { repo } = makeRepo({ db: "jupiter_db" });
    const owner = await resolveOwner(repo);
    await expect(
      repo.reconcileSystemOwnerCapabilities(owner, {
        expectedDatabase: "jupiter_test",
        confirmationToken: buildSystemOwnerReconciliationToken("jupiter_test"),
        reason,
      }),
    ).rejects.toThrow("RECONCILIATION_DATABASE_MISMATCH");
  });

  it("rejects a mismatched confirmation token", async () => {
    const { repo } = makeRepo();
    const owner = await resolveOwner(repo);
    await expect(
      repo.reconcileSystemOwnerCapabilities(owner, {
        expectedDatabase: "jupiter_test",
        confirmationToken: "RECONCILE:jupiter_test:WRONG",
        reason,
      }),
    ).rejects.toThrow("RECONCILIATION_CONFIRMATION_MISMATCH");
  });

  it("refuses any principal that is not the canonical System Owner", async () => {
    const { repo } = makeRepo({
      canonical: {
        id: "other-user",
        email: "someone@example.com",
        is_active: true,
        retired_at: null,
      },
    });
    const owner = await resolveOwner(repo);
    await expect(
      repo.reconcileSystemOwnerCapabilities(owner, {
        expectedDatabase: "jupiter_test",
        confirmationToken: buildSystemOwnerReconciliationToken("jupiter_test"),
        reason,
      }),
    ).rejects.toThrow("RECONCILIATION_CANONICAL_OWNER_MISMATCH");
  });

  it("refuses when the canonical owner is absent", async () => {
    const { repo } = makeRepo({ canonical: null });
    const owner = await resolveOwner(repo);
    await expect(
      repo.reconcileSystemOwnerCapabilities(owner, {
        expectedDatabase: "jupiter_test",
        confirmationToken: buildSystemOwnerReconciliationToken("jupiter_test"),
        reason,
      }),
    ).rejects.toThrow("RECONCILIATION_CANONICAL_OWNER_REQUIRED");
  });
});

const reason = "System Owner full-capability reconciliation";
