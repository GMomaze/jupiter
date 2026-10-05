import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { pool } from "../../config/database.js";
import { PlatformAuthorityRepository } from "./platform-authority.repository.js";
describe("MP2-R2 guarded platform operations", () => {
  afterAll(() => pool.end());
  it("keeps HUMAN administration, scheduler purpose, audit and rollback atomic", async () => {
    const client = await pool.connect();
    const ids = {
      ownerUser: randomUUID(),
      owner: randomUUID(),
      manage: randomUUID(),
      audit: randomUUID(),
      targetUser: randomUUID(),
      duplicateScheduler: randomUUID(),
    };
    let savepoint = 0;
    const adapter: any = {
      query: (sql: string, params?: unknown[]) =>
        client.query(sql, params as any),
      connect: async () => ({
        query: (sql: string, params?: unknown[]) => {
          if (sql === "BEGIN")
            return client.query(`SAVEPOINT mp2r2_${++savepoint}`);
          if (sql === "COMMIT")
            return client.query(`RELEASE SAVEPOINT mp2r2_${savepoint}`);
          if (sql === "ROLLBACK")
            return client.query(`ROLLBACK TO SAVEPOINT mp2r2_${savepoint}`);
          return client.query(sql, params as any);
        },
        release: () => {},
      }),
    };
    try {
      expect(
        (await client.query("SELECT current_database() name")).rows[0].name,
      ).toBe("jupiter_test");
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO users(id,email,password_hash,full_name,is_active) VALUES($1,$2,'unused','Owner',true),($3,$4,'unused','Target',true)`,
        [
          ids.ownerUser,
          `${ids.ownerUser}@example.test`,
          ids.targetUser,
          `${ids.targetUser}@example.test`,
        ],
      );
      await client.query(
        `INSERT INTO platform_principals(id,principal_type,user_id,display_name,status) VALUES($1,'HUMAN',$2,'Owner','ACTIVE')`,
        [ids.owner, ids.ownerUser],
      );
      await client.query(
        `INSERT INTO platform_capability_grants(id,principal_id,capability_id,granted_by_principal_id,grant_reason) SELECT $1,$2,id,$2,'fixture' FROM platform_capabilities WHERE code='PLATFORM_AUTHORITY_MANAGE'`,
        [ids.manage, ids.owner],
      );
      await client.query(
        `INSERT INTO platform_capability_grants(id,principal_id,capability_id,granted_by_principal_id,grant_reason) SELECT $1,$2,id,$2,'fixture' FROM platform_capabilities WHERE code='PLATFORM_AUDIT_VIEW'`,
        [ids.audit, ids.owner],
      );
      const repository = new PlatformAuthorityRepository(adapter);
      const authority = await repository.resolveHuman(ids.ownerUser);
      expect(authority?.principalType).toBe("HUMAN");
      expect((await repository.inspect(authority!)).capabilities).toHaveLength(
        22,
      );
      const target = await repository.createPrincipal(authority!, {
        principalType: "HUMAN",
        userId: ids.targetUser,
        displayName: "Target",
        reason: "MP2 R2 test",
      });
      await repository.grant(
        authority!,
        target,
        "PLATFORM_AUDIT_VIEW",
        "MP2 R2 grant",
      );
      await repository.revoke(
        authority!,
        target,
        "PLATFORM_AUDIT_VIEW",
        "MP2 R2 revoke",
      );
      await expect(
        repository.revoke(
          authority!,
          ids.owner,
          "PLATFORM_AUTHORITY_MANAGE",
          "deny last",
        ),
      ).rejects.toThrow("LAST_SYSTEM_OWNER_REQUIRED");
      await expect(
        repository.recoverSbSyncScheduler(authority!, "missing scheduler"),
      ).rejects.toThrow("SB_SYNC_SCHEDULER_REQUIRED");
      const scheduler = await repository.provisionSbSyncScheduler(
        authority!,
        "MP2 R2 scheduler",
      );
      await expect(
        repository.grant(
          authority!,
          scheduler,
          "PLATFORM_AUDIT_VIEW",
          "must remain single purpose",
        ),
      ).rejects.toThrow("SERVICE_CAPABILITY_BOUNDARY_REQUIRED");
      expect(
        (
          await client.query(
            `SELECT pp.principal_type,array_agg(pc.code ORDER BY pc.code) capabilities FROM platform_principals pp JOIN platform_capability_grants pg ON pg.principal_id=pp.id AND pg.revoked_at IS NULL JOIN platform_capabilities pc ON pc.id=pg.capability_id WHERE pp.id=$1 GROUP BY pp.id`,
            [scheduler],
          )
        ).rows[0],
      ).toEqual({
        principal_type: "SERVICE",
        capabilities: ["SERVICE_BULLETIN_SYNC_EXECUTE"],
      });
      await repository.disablePrincipal(
        authority!,
        scheduler,
        "MP2 R4 recovery fixture",
      );
      expect(await repository.resolveService("SB_SYNC_SCHEDULER")).toBeNull();
      await client.query(
        `INSERT INTO platform_principals(id,principal_type,service_code,display_name,status,disabled_at,disabled_by_principal_id) VALUES($1,'SERVICE','SB_SYNC_SCHEDULER','Duplicate disabled scheduler','DISABLED',CURRENT_TIMESTAMP,$2)`,
        [ids.duplicateScheduler, ids.owner],
      );
      const duplicateBefore = (
        await client.query(
          `SELECT
            (SELECT count(*)::int FROM platform_principals WHERE service_code='SB_SYNC_SCHEDULER' AND status='DISABLED') disabled,
            (SELECT count(*)::int FROM platform_capability_grants WHERE principal_id::text IN ($1,$2) AND revoked_at IS NULL) grants,
            (SELECT count(*)::int FROM platform_global_audit_log WHERE action='SB_SYNC_SCHEDULER_RECOVERED' AND resource_id IN ($1,$2)) audits`,
          [scheduler, ids.duplicateScheduler],
        )
      ).rows[0];
      expect(duplicateBefore).toEqual({ disabled: 2, grants: 1, audits: 0 });
      await expect(
        repository.recoverSbSyncScheduler(authority!, "refuse duplicates"),
      ).rejects.toThrow("SB_SYNC_SCHEDULER_STATE_INVALID");
      expect(
        (
          await client.query(
            `SELECT
              (SELECT count(*)::int FROM platform_principals WHERE service_code='SB_SYNC_SCHEDULER' AND status='DISABLED') disabled,
              (SELECT count(*)::int FROM platform_capability_grants WHERE principal_id::text IN ($1,$2) AND revoked_at IS NULL) grants,
              (SELECT count(*)::int FROM platform_global_audit_log WHERE action='SB_SYNC_SCHEDULER_RECOVERED' AND resource_id IN ($1,$2)) audits`,
            [scheduler, ids.duplicateScheduler],
          )
        ).rows[0],
      ).toEqual(duplicateBefore);
      await client.query(`DELETE FROM platform_principals WHERE id=$1`, [
        ids.duplicateScheduler,
      ]);
      expect(
        await repository.recoverSbSyncScheduler(
          authority!,
          "MP2 R4 recover existing grant",
        ),
      ).toBe(scheduler);
      await expect(
        repository.recoverSbSyncScheduler(authority!, "deny healthy"),
      ).rejects.toThrow("SB_SYNC_SCHEDULER_ALREADY_ACTIVE");
      await repository.revoke(
        authority!,
        scheduler,
        "SERVICE_BULLETIN_SYNC_EXECUTE",
        "MP2 R4 revoke",
      );
      await repository.disablePrincipal(
        authority!,
        scheduler,
        "MP2 R4 disabled without grant",
      );
      expect(
        await repository.recoverSbSyncScheduler(
          authority!,
          "MP2 R4 recreate exact grant",
        ),
      ).toBe(scheduler);
      expect(
        (await repository.resolveService("SB_SYNC_SCHEDULER"))?.capabilities,
      ).toEqual(new Set(["SERVICE_BULLETIN_SYNC_EXECUTE"]));
      await repository.revoke(
        authority!,
        scheduler,
        "SERVICE_BULLETIN_SYNC_EXECUTE",
        "MP2 R4 post-recovery revoke",
      );
      expect(
        (await repository.resolveService("SB_SYNC_SCHEDULER"))?.capabilities,
      ).toEqual(new Set());
      expect(
        (
          await client.query(
            `SELECT count(*)::int count FROM platform_global_audit_log WHERE resource_id=$1 AND action='SB_SYNC_SCHEDULER_RECOVERED'`,
            [scheduler],
          )
        ).rows[0].count,
      ).toBe(2);
      expect(
        (
          await client.query(
            `SELECT count(*)::int count FROM platform_global_audit_log WHERE principal_id=$1`,
            [ids.owner],
          )
        ).rows[0].count,
      ).toBeGreaterThanOrEqual(5);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
    const residue = await pool.query(
      `SELECT (SELECT count(*)::int FROM platform_principals) principals,(SELECT count(*)::int FROM platform_capability_grants) grants,(SELECT count(*)::int FROM platform_global_audit_log) audits,(SELECT count(*)::int FROM users WHERE id=ANY($1::uuid[])) users`,
      [[ids.ownerUser, ids.targetUser]],
    );
    expect(residue.rows[0]).toEqual({
      principals: 0,
      grants: 0,
      audits: 0,
      users: 0,
    });
  });
});
