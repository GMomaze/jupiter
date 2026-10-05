import { afterAll, describe, expect, it } from "vitest";
import { pool } from "../../config/database.js";
import { PlatformAuthorityRepository } from "./platform-authority.repository.js";
const userId = "59800000-0000-4000-8000-000000000001";
describe("L2-1 repair guarded jupiter_test", () => {
  afterAll(async () => {
    await pool.end();
  });
  it("bootstraps once inside an isolated outer transaction and leaves zero fixture residue", async () => {
    const client = await pool.connect();
    expect(
      (await client.query("SELECT current_database() name")).rows[0].name,
    ).toBe("jupiter_test");
    await client.query("BEGIN");
    try {
      await client.query(
        `INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES($1,'l2-repair-owner@example.test','not-used','L2 Repair Owner',true)`,
        [userId],
      );
      const adapter = {
        connect: async () => ({
          query: async (sql: string, values?: unknown[]) => {
            if (sql === "BEGIN") return client.query("SAVEPOINT l2_repository");
            if (sql === "COMMIT")
              return client.query("RELEASE SAVEPOINT l2_repository");
            if (sql === "ROLLBACK")
              return client.query("ROLLBACK TO SAVEPOINT l2_repository");
            return client.query(sql, values);
          },
          release: () => undefined,
        }),
      };
      const repository = new PlatformAuthorityRepository(adapter as any);
      const principalId = await repository.bootstrap({
        userId,
        expectedEmail: "l2-repair-owner@example.test",
        expectedDatabase: "jupiter_test",
        confirmationToken: `BOOTSTRAP:jupiter_test:${userId}:l2-repair-owner@example.test`,
        displayName: "L2 Repair Owner",
      });
      expect(
        (
          await client.query(
            `SELECT count(*)::int count FROM platform_capability_grants WHERE principal_id=$1 AND revoked_at IS NULL`,
            [principalId],
          )
        ).rows[0].count,
      ).toBe(2);
      expect(
        (
          await client.query(
            `SELECT count(*)::int count FROM platform_global_audit_log WHERE action='SYSTEM_OWNER_BOOTSTRAPPED' AND principal_id=$1`,
            [principalId],
          )
        ).rows[0].count,
      ).toBe(1);
      await expect(
        repository.bootstrap({
          userId,
          expectedEmail: "l2-repair-owner@example.test",
          expectedDatabase: "jupiter_test",
          confirmationToken: `BOOTSTRAP:jupiter_test:${userId}:l2-repair-owner@example.test`,
          displayName: "L2 Repair Owner",
        }),
      ).rejects.toThrow("SYSTEM_OWNER_BOOTSTRAP_ALREADY_COMPLETED");
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
    const state = await pool.query(
      `SELECT (SELECT count(*)::int FROM platform_principals) principals,(SELECT count(*)::int FROM platform_capability_grants) grants,(SELECT count(*)::int FROM platform_global_audit_log) audits,(SELECT count(*)::int FROM platform_capabilities) capabilities,(SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 1) ledger_head,(SELECT tgenabled FROM pg_trigger WHERE tgname='tr_platform_global_audit_immutable') audit_trigger`,
    );
    expect(state.rows[0]).toEqual({
      principals: 0,
      grants: 0,
      audits: 0,
      capabilities: 22,
      ledger_head: "603_remove_deferred_last_admin_enforcement.ts",
      audit_trigger: "O",
    });
  });
});
