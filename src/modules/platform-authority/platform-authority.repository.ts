import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { verifyRepositoryMigrationLedger } from "../../scripts/migrationLedgerComparison.js";
import {
  type PlatformAuthority,
  PLATFORM_AUDIT_VIEW,
  PLATFORM_AUTHORITY_MANAGE,
  type PlatformPrincipalType,
} from "./platform-authority.js";
type Queryable = Pick<PoolClient, "query">;
const BOOTSTRAP_CAPABILITIES = Object.freeze([
  "COMPONENT_MODEL_MASTER_MANAGE",
  "LIFE_LIMIT_ACTIVATE",
  "LIFE_LIMIT_APPROVE",
  "LIFE_LIMIT_PROPOSE",
  "MAINTENANCE_MASTER_MANAGE",
  "MANUFACTURER_FILE_REPLACE",
  "MANUFACTURER_MASTER_MANAGE",
  "PLATFORM_AUDIT_VIEW",
  "PLATFORM_AUTHORITY_MANAGE",
  "RBAC_DEFINITION_MANAGE",
  "REFERENCE_DATA_CREATE",
  "REFERENCE_DATA_DEACTIVATE",
  "REFERENCE_DATA_UPDATE",
  "REGULATORY_MASTER_MANAGE",
  "REGULATORY_RELATIONSHIP_MANAGE",
  "SERVICE_BULLETIN_SYNC_EXECUTE",
  "SHARED_MASTER_IMPORT",
  "TENANT_ACTIVATE",
  "TENANT_ADMIN_RECOVER",
  "TENANT_EXPORT",
  "TENANT_PROVISION",
  "TENANT_REINSTATE",
  "TENANT_SUSPEND",
] as const);
const SYSTEM_OWNER_CAPABILITIES = Object.freeze([
  PLATFORM_AUTHORITY_MANAGE,
  PLATFORM_AUDIT_VIEW,
  "TENANT_PROVISION",
  "TENANT_ACTIVATE",
  "TENANT_SUSPEND",
  "TENANT_REINSTATE",
] as const);
const repositoryIssuedAuthorities = new WeakSet<object>();
export type TerminalBootstrapCleanupInput = Readonly<{
  fixtureRootId: string; expectedDatabase: "jupiter_test"; confirmationToken: string;
  bootstrapPrincipalId: string; bootstrapAuditId: string;
  principalIds: readonly string[]; grantIds: readonly string[];
}>;
export function assertRepositoryIssuedPlatformAuthority(
  value: unknown,
): asserts value is PlatformAuthority {
  if (
    !value ||
    typeof value !== "object" ||
    !repositoryIssuedAuthorities.has(value as object)
  )
    throw new Error("PLATFORM_AUTHORITY_REQUIRED");
}
export class PlatformAuthorityRepository {
  constructor(private readonly pool: Pool) {}
  private issue(
    principalId: string,
    principalType: PlatformPrincipalType,
    principalCode: string,
    capabilities: readonly string[],
  ): PlatformAuthority {
    const value = Object.freeze({
      principalId,
      principalType,
      principalCode,
      capabilities: new Set(capabilities),
    }) as unknown as PlatformAuthority;
    repositoryIssuedAuthorities.add(value);
    return value;
  }
  private async transaction<T>(work: (c: PoolClient) => Promise<T>) {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      const out = await work(c);
      await c.query("COMMIT");
      return out;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  private async resolve(q: Queryable, clause: string, value: string) {
    const result = await q.query(
      `SELECT pp.id,pp.principal_type,COALESCE(pp.user_id::text,pp.service_code) principal_code,
      COALESCE(array_agg(pc.code) FILTER (WHERE pc.code IS NOT NULL),'{}') capabilities
      FROM platform_principals pp LEFT JOIN platform_capability_grants pg ON pg.principal_id=pp.id AND pg.revoked_at IS NULL
      LEFT JOIN platform_capabilities pc ON pc.id=pg.capability_id AND pc.is_active=true
      WHERE pp.status='ACTIVE' AND ${clause}=$1 GROUP BY pp.id`,
      [value],
    );
    const row = result.rows[0];
    return row
      ? this.issue(
          row.id,
          row.principal_type as PlatformPrincipalType,
          row.principal_code,
          row.capabilities,
        )
      : null;
  }
  private async terminatedBootstrapAllowsReplay(q: Queryable): Promise<boolean> {
    if (process.env.NODE_ENV !== "test" || process.env.ALLOW_TERMINATED_SYSTEM_OWNER_REBOOTSTRAP !== "YES") return false;
    const result = await q.query(`SELECT t.id FROM platform_global_audit_log t
      WHERE t.outcome='SUCCESS'
        AND (
          (t.action='SYSTEM_OWNER_BOOTSTRAP_TERMINATED' AND t.source_provenance->>'kind'='R4_TEST_TERMINAL_BOOTSTRAP_CLEANUP')
          OR (t.action='R4_RECOVERY_AUTHORITY_RETIRED' AND t.source_provenance->>'kind'='R4_TEST_LATER_BOOTSTRAP_RETIREMENT')
        )
        AND NOT EXISTS(SELECT 1 FROM platform_principals WHERE status='ACTIVE')
        AND NOT EXISTS(SELECT 1 FROM platform_capability_grants WHERE revoked_at IS NULL)
        AND NOT EXISTS(SELECT 1 FROM platform_global_audit_log later WHERE (later.created_at,later.id)>(t.created_at,t.id))
      ORDER BY t.created_at DESC,t.id DESC LIMIT 1`);
    return result.rowCount === 1;
  }

  async terminalCleanupDisposableBootstrap(authority: PlatformAuthority, input: TerminalBootstrapCleanupInput, suppliedClient?: PoolClient) {
    if (process.env.NODE_ENV !== "test" || process.env.ALLOW_R4_TERMINAL_BOOTSTRAP_CLEANUP !== "YES") throw new Error("TERMINAL_BOOTSTRAP_CLEANUP_NOT_ALLOWED");
    const work=async (q:PoolClient) => {
      assertRepositoryIssuedPlatformAuthority(authority);
      if (authority.principalType !== "HUMAN" || authority.principalId !== input.bootstrapPrincipalId) throw new Error("TERMINAL_BOOTSTRAP_OWNER_MISMATCH");
      await q.query(`SELECT pg_advisory_xact_lock(hashtext('JUPITER_PLATFORM_AUTHORITY_BOOTSTRAP'))`);
      await q.query(`SELECT pg_advisory_xact_lock(hashtext('JUPITER_PLATFORM_AUTHORITY_MANAGE'))`);
      const db=await q.query('SELECT current_database() name');
      if(input.expectedDatabase!=="jupiter_test"||db.rows[0]?.name!=="jupiter_test") throw new Error("TERMINAL_BOOTSTRAP_DATABASE_MISMATCH");
      const expected=`TERMINATE:jupiter_test:${input.fixtureRootId}:${input.bootstrapPrincipalId}:${input.bootstrapAuditId}`;
      if(input.confirmationToken!==expected) throw new Error("TERMINAL_BOOTSTRAP_CONFIRMATION_MISMATCH");
      const ledger=await q.query(`SELECT name FROM "SequelizeMeta" ORDER BY name`);
      try { verifyRepositoryMigrationLedger(ledger.rows.map((r:any)=>String(r.name))); }
      catch { throw new Error("TERMINAL_BOOTSTRAP_LEDGER_MISMATCH"); }
      const guard=await q.query(`SELECT
        EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='tr_platform_global_audit_immutable' AND tgenabled<>'D') audit_trigger,
        (SELECT array_agg(id::text ORDER BY id::text) FROM platform_principals)=$1::text[] principals_match,
        (SELECT array_agg(id::text ORDER BY id::text) FROM platform_capability_grants)=$2::text[] grants_match,
        EXISTS(SELECT 1 FROM platform_global_audit_log WHERE id=$3 AND action='SYSTEM_OWNER_BOOTSTRAPPED' AND principal_id=$4) bootstrap_match`,
        [[...input.principalIds].sort(),[...input.grantIds].sort(),input.bootstrapAuditId,input.bootstrapPrincipalId]);
      const state=guard.rows[0]; if(!state?.audit_trigger||!state.principals_match||!state.grants_match||!state.bootstrap_match) throw new Error("TERMINAL_BOOTSTRAP_MANIFEST_MISMATCH");
      await this.revalidate(q,authority,PLATFORM_AUTHORITY_MANAGE);
      const terminalId=randomUUID();
      await q.query(`INSERT INTO platform_global_audit_log(id,principal_id,principal_type,principal_code,capability_code,action,resource_type,resource_id,correlation_id,source_provenance,old_values,new_values,outcome,reason)
        VALUES($1,$2,'HUMAN',$3,$4,'SYSTEM_OWNER_BOOTSTRAP_TERMINATED','platform_authority',$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,'SUCCESS',$10)`,
        [terminalId,authority.principalId,authority.principalCode,PLATFORM_AUTHORITY_MANAGE,input.fixtureRootId,randomUUID(),JSON.stringify({kind:'R4_TEST_TERMINAL_BOOTSTRAP_CLEANUP'}),JSON.stringify({principalIds:input.principalIds,grantIds:input.grantIds}),JSON.stringify({activePrincipals:0,activeGrants:0}),`Terminal cleanup ${input.fixtureRootId}`]);
      await q.query(`UPDATE platform_capability_grants SET revoked_by_principal_id=$1,revoked_at=CURRENT_TIMESTAMP,revocation_reason=$2 WHERE id=ANY($3::uuid[]) AND revoked_at IS NULL`,[authority.principalId,`Terminal cleanup ${input.fixtureRootId}`,input.grantIds]);
      await q.query(`UPDATE platform_principals SET status='DISABLED',disabled_at=CURRENT_TIMESTAMP,disabled_by_principal_id=$1 WHERE id=ANY($2::uuid[]) AND status='ACTIVE'`,[authority.principalId,input.principalIds]);
      await q.query(`UPDATE users SET is_active=false WHERE id IN(SELECT user_id FROM platform_principals WHERE id=ANY($1::uuid[]) AND user_id IS NOT NULL)`,[input.principalIds]);
      return Object.freeze({terminalAuditId:terminalId,activePrincipals:0,activeGrants:0});
    };
    return suppliedClient ? work(suppliedClient) : this.transaction(work);
  }
  resolveHuman(userId: string) {
    return this.resolve(
      this.pool,
      "pp.principal_type='HUMAN' AND pp.user_id",
      userId,
    );
  }
  resolveService(serviceCode: string) {
    return this.resolve(
      this.pool,
      "pp.principal_type='SERVICE' AND pp.service_code",
      serviceCode.trim().toUpperCase(),
    );
  }
  async resolveSystemOwnerNotificationEmail(): Promise<string | undefined> {
    const result = await this.pool.query(
      `SELECT u.email
         FROM platform_principals pp
         JOIN platform_capability_grants pg ON pg.principal_id=pp.id AND pg.revoked_at IS NULL
         JOIN platform_capabilities pc ON pc.id=pg.capability_id AND pc.code=$1 AND pc.is_active=true
         JOIN users u ON u.id=pp.user_id AND u.is_active=true
        WHERE pp.principal_type='HUMAN' AND pp.status='ACTIVE'
        ORDER BY pp.created_at ASC
        LIMIT 1`,
      [PLATFORM_AUTHORITY_MANAGE],
    );
    return result.rows[0]?.email as string | undefined;
  }
  async revalidate(
    q: Queryable,
    authority: PlatformAuthority,
    capability: string,
  ) {
    assertRepositoryIssuedPlatformAuthority(authority);
    const result = await q.query(
      `SELECT 1 FROM platform_principals pp JOIN platform_capability_grants pg ON pg.principal_id=pp.id AND pg.revoked_at IS NULL JOIN platform_capabilities pc ON pc.id=pg.capability_id AND pc.is_active=true WHERE pp.id=$1 AND pp.principal_type=$2 AND pp.status='ACTIVE' AND pc.code=$3`,
      [authority.principalId, authority.principalType, capability],
    );
    if (!result.rowCount) throw new Error("PLATFORM_CAPABILITY_REQUIRED");
  }
  async authorizeCapability(
    authority: PlatformAuthority,
    capability: string,
    allowedPrincipalTypes: readonly PlatformPrincipalType[],
  ) {
    return this.transaction(async (q) => {
      assertRepositoryIssuedPlatformAuthority(authority);
      if (!allowedPrincipalTypes.includes(authority.principalType))
        throw new Error("PLATFORM_PRINCIPAL_TYPE_REQUIRED");
      await this.revalidate(q, authority, capability);
    });
  }
  private async audit(
    q: Queryable,
    a: PlatformAuthority,
    action: string,
    type: string,
    id: string,
    reason: string,
    oldValues: unknown,
    newValues: unknown,
  ) {
    await q.query(
      `INSERT INTO platform_global_audit_log(id,principal_id,principal_type,principal_code,capability_code,action,resource_type,resource_id,correlation_id,source_provenance,old_values,new_values,outcome,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'SUCCESS',$13)`,
      [
        randomUUID(),
        a.principalId,
        a.principalType,
        a.principalCode,
        PLATFORM_AUTHORITY_MANAGE,
        action,
        type,
        id,
        randomUUID(),
        JSON.stringify({ source: "PLATFORM_AUTHORITY_SERVICE" }),
        JSON.stringify(oldValues),
        JSON.stringify(newValues),
        reason,
      ],
    );
  }
  async createPrincipal(
    authority: PlatformAuthority,
    input: {
      principalType: PlatformPrincipalType;
      userId?: string;
      serviceCode?: string;
      displayName: string;
      reason: string;
    },
  ) {
    return this.transaction(async (q) => {
      await q.query(
        `SELECT pg_advisory_xact_lock(hashtext('JUPITER_PLATFORM_AUTHORITY_MANAGE'))`,
      );
      await this.revalidate(q, authority, PLATFORM_AUTHORITY_MANAGE);
      if (authority.principalType !== "HUMAN")
        throw new Error("HUMAN_SYSTEM_OWNER_REQUIRED");
      if (input.principalType === "HUMAN") {
        if (!input.userId || input.serviceCode)
          throw new Error("HUMAN_PRINCIPAL_IDENTITY_REQUIRED");
        const user = await q.query(
          `SELECT 1 FROM users WHERE id=$1 AND is_active=true`,
          [input.userId],
        );
        if (!user.rowCount) throw new Error("ACTIVE_PLATFORM_USER_REQUIRED");
      } else if (!input.serviceCode || input.userId)
        throw new Error("SERVICE_PRINCIPAL_IDENTITY_REQUIRED");
      const id = randomUUID(),
        serviceCode = input.serviceCode?.trim().toUpperCase() ?? null;
      await q.query(
        `INSERT INTO platform_principals(id,principal_type,user_id,service_code,display_name,status) VALUES($1,$2,$3,$4,$5,'ACTIVE')`,
        [
          id,
          input.principalType,
          input.userId ?? null,
          serviceCode,
          input.displayName,
        ],
      );
      await this.audit(
        q,
        authority,
        "PLATFORM_PRINCIPAL_CREATED",
        "platform_principal",
        id,
        input.reason,
        null,
        {
          principalType: input.principalType,
          userId: input.userId ?? null,
          serviceCode,
        },
      );
      return id;
    });
  }
  async provisionSbSyncScheduler(authority: PlatformAuthority, reason: string) {
    return this.transaction(async (q) => {
      await q.query(
        `SELECT pg_advisory_xact_lock(hashtext('JUPITER_PLATFORM_AUTHORITY_MANAGE'))`,
      );
      await this.revalidate(q, authority, PLATFORM_AUTHORITY_MANAGE);
      if (authority.principalType !== "HUMAN")
        throw new Error("HUMAN_SYSTEM_OWNER_REQUIRED");
      const existing = await q.query(
        `SELECT id FROM platform_principals WHERE service_code='SB_SYNC_SCHEDULER' FOR UPDATE`,
      );
      if (existing.rowCount)
        throw new Error("SB_SYNC_SCHEDULER_ALREADY_PROVISIONED");
      const capability = await q.query(
        `SELECT id FROM platform_capabilities WHERE code='SERVICE_BULLETIN_SYNC_EXECUTE' AND is_active=true`,
      );
      if (capability.rowCount !== 1)
        throw new Error("SB_SYNC_CAPABILITY_REQUIRED");
      const principalId = randomUUID(),
        grantId = randomUUID();
      await q.query(
        `INSERT INTO platform_principals(id,principal_type,service_code,display_name,status) VALUES($1,'SERVICE','SB_SYNC_SCHEDULER','Service Bulletin Sync Scheduler','ACTIVE')`,
        [principalId],
      );
      await q.query(
        `INSERT INTO platform_capability_grants(id,principal_id,capability_id,granted_by_principal_id,grant_reason) VALUES($1,$2,$3,$4,$5)`,
        [
          grantId,
          principalId,
          capability.rows[0].id,
          authority.principalId,
          reason,
        ],
      );
      await this.audit(
        q,
        authority,
        "PLATFORM_PRINCIPAL_CREATED",
        "platform_principal",
        principalId,
        reason,
        null,
        { principalType: "SERVICE", serviceCode: "SB_SYNC_SCHEDULER" },
      );
      await this.audit(
        q,
        authority,
        "CAPABILITY_GRANTED",
        "platform_capability_grant",
        grantId,
        reason,
        null,
        {
          targetPrincipalId: principalId,
          capabilityCode: "SERVICE_BULLETIN_SYNC_EXECUTE",
        },
      );
      return principalId;
    });
  }
  async recoverSbSyncScheduler(authority: PlatformAuthority, reason: string) {
    return this.transaction(async (q) => {
      await q.query(
        `SELECT pg_advisory_xact_lock(hashtext('JUPITER_PLATFORM_AUTHORITY_MANAGE'))`,
      );
      await this.revalidate(q, authority, PLATFORM_AUTHORITY_MANAGE);
      if (authority.principalType !== "HUMAN")
        throw new Error("HUMAN_SYSTEM_OWNER_REQUIRED");
      const principal = await q.query(
        `SELECT id,status,principal_type,service_code FROM platform_principals WHERE service_code='SB_SYNC_SCHEDULER' FOR UPDATE`,
      );
      if (principal.rowCount === 0)
        throw new Error("SB_SYNC_SCHEDULER_REQUIRED");
      if (principal.rowCount !== 1)
        throw new Error("SB_SYNC_SCHEDULER_STATE_INVALID");
      const row = principal.rows[0];
      if (
        row.principal_type !== "SERVICE" ||
        row.service_code !== "SB_SYNC_SCHEDULER"
      )
        throw new Error("SB_SYNC_SCHEDULER_STATE_INVALID");
      const grants = await q.query(
        `SELECT pg.id,pc.id capability_id,pc.code,pc.is_active FROM platform_capability_grants pg JOIN platform_capabilities pc ON pc.id=pg.capability_id WHERE pg.principal_id=$1 AND pg.revoked_at IS NULL FOR UPDATE`,
        [row.id],
      );
      const exactGrant =
        grants.rows.length === 1 &&
        grants.rows[0].code === "SERVICE_BULLETIN_SYNC_EXECUTE" &&
        grants.rows[0].is_active === true;
      if (row.status === "ACTIVE") {
        if (exactGrant) throw new Error("SB_SYNC_SCHEDULER_ALREADY_ACTIVE");
        throw new Error("SB_SYNC_SCHEDULER_STATE_INVALID");
      }
      if (row.status !== "DISABLED" || (grants.rows.length > 0 && !exactGrant))
        throw new Error("SB_SYNC_SCHEDULER_STATE_INVALID");

      let grantId: string | null = null;
      if (!exactGrant) {
        const capability = await q.query(
          `SELECT id FROM platform_capabilities WHERE code='SERVICE_BULLETIN_SYNC_EXECUTE' AND is_active=true`,
        );
        if (capability.rowCount !== 1)
          throw new Error("SB_SYNC_CAPABILITY_REQUIRED");
        grantId = randomUUID();
        await q.query(
          `INSERT INTO platform_capability_grants(id,principal_id,capability_id,granted_by_principal_id,grant_reason) VALUES($1,$2,$3,$4,$5)`,
          [
            grantId,
            row.id,
            capability.rows[0].id,
            authority.principalId,
            reason,
          ],
        );
      }
      await q.query(
        `UPDATE platform_principals SET status='ACTIVE',disabled_at=NULL,disabled_by_principal_id=NULL WHERE id=$1 AND status='DISABLED'`,
        [row.id],
      );
      await this.audit(
        q,
        authority,
        "SB_SYNC_SCHEDULER_RECOVERED",
        "platform_principal",
        row.id,
        reason,
        { status: "DISABLED" },
        {
          status: "ACTIVE",
          serviceCode: "SB_SYNC_SCHEDULER",
          capabilityCode: "SERVICE_BULLETIN_SYNC_EXECUTE",
        },
      );
      if (grantId)
        await this.audit(
          q,
          authority,
          "CAPABILITY_GRANTED",
          "platform_capability_grant",
          grantId,
          reason,
          null,
          {
            targetPrincipalId: row.id,
            capabilityCode: "SERVICE_BULLETIN_SYNC_EXECUTE",
          },
        );
      return row.id as string;
    });
  }
  async grant(
    authority: PlatformAuthority,
    targetPrincipalId: string,
    capabilityCode: string,
    reason: string,
  ) {
    return this.transaction(async (q) => {
      await q.query(
        `SELECT pg_advisory_xact_lock(hashtext('JUPITER_PLATFORM_AUTHORITY_MANAGE'))`,
      );
      await this.revalidate(q, authority, PLATFORM_AUTHORITY_MANAGE);
      if (authority.principalType !== "HUMAN")
        throw new Error("HUMAN_SYSTEM_OWNER_REQUIRED");
      if (targetPrincipalId === authority.principalId)
        throw new Error("PLATFORM_SELF_GRANT_FORBIDDEN");
      const target = await q.query(
        `SELECT id,status,principal_type,service_code FROM platform_principals WHERE id=$1 FOR UPDATE`,
        [targetPrincipalId],
      );
      if (target.rows[0]?.status !== "ACTIVE")
        throw new Error("ACTIVE_PLATFORM_PRINCIPAL_REQUIRED");
      if (
        capabilityCode === PLATFORM_AUTHORITY_MANAGE &&
        target.rows[0].principal_type !== "HUMAN"
      )
        throw new Error("SYSTEM_OWNER_MUST_BE_HUMAN");
      if (
        target.rows[0].principal_type === "SERVICE" &&
        (target.rows[0].service_code !== "SB_SYNC_SCHEDULER" ||
          capabilityCode !== "SERVICE_BULLETIN_SYNC_EXECUTE")
      )
        throw new Error("SERVICE_CAPABILITY_BOUNDARY_REQUIRED");
      const cap = await q.query(
        `SELECT id FROM platform_capabilities WHERE code=$1 AND is_active=true`,
        [capabilityCode],
      );
      if (!cap.rowCount) throw new Error("ACTIVE_PLATFORM_CAPABILITY_REQUIRED");
      const id = randomUUID();
      await q.query(
        `INSERT INTO platform_capability_grants(id,principal_id,capability_id,granted_by_principal_id,grant_reason) VALUES($1,$2,$3,$4,$5)`,
        [id, targetPrincipalId, cap.rows[0].id, authority.principalId, reason],
      );
      await this.audit(
        q,
        authority,
        "CAPABILITY_GRANTED",
        "platform_capability_grant",
        id,
        reason,
        null,
        { targetPrincipalId, capabilityCode },
      );
      return id;
    });
  }
  async revoke(
    authority: PlatformAuthority,
    targetPrincipalId: string,
    capabilityCode: string,
    reason: string,
  ) {
    return this.transaction(async (q) => {
      await q.query(
        `SELECT pg_advisory_xact_lock(hashtext('JUPITER_PLATFORM_AUTHORITY_MANAGE'))`,
      );
      await this.revalidate(q, authority, PLATFORM_AUTHORITY_MANAGE);
      if (authority.principalType !== "HUMAN")
        throw new Error("HUMAN_SYSTEM_OWNER_REQUIRED");
      const grant = await q.query(
        `SELECT pg.id FROM platform_capability_grants pg JOIN platform_capabilities pc ON pc.id=pg.capability_id WHERE pg.principal_id=$1 AND pc.code=$2 AND pg.revoked_at IS NULL FOR UPDATE`,
        [targetPrincipalId, capabilityCode],
      );
      if (!grant.rowCount) throw new Error("ACTIVE_PLATFORM_GRANT_REQUIRED");
      if (capabilityCode === PLATFORM_AUTHORITY_MANAGE) {
        const count = await q.query(
          `SELECT count(*)::int count FROM platform_capability_grants pg JOIN platform_principals pp ON pp.id=pg.principal_id AND pp.status='ACTIVE' AND pp.principal_type='HUMAN' JOIN platform_capabilities pc ON pc.id=pg.capability_id AND pc.is_active=true WHERE pc.code=$1 AND pg.revoked_at IS NULL`,
          [PLATFORM_AUTHORITY_MANAGE],
        );
        if (count.rows[0].count <= 1)
          throw new Error("LAST_SYSTEM_OWNER_REQUIRED");
      }
      await q.query(
        `UPDATE platform_capability_grants SET revoked_by_principal_id=$1,revoked_at=CURRENT_TIMESTAMP,revocation_reason=$2 WHERE id=$3`,
        [authority.principalId, reason, grant.rows[0].id],
      );
      await this.audit(
        q,
        authority,
        "CAPABILITY_REVOKED",
        "platform_capability_grant",
        grant.rows[0].id,
        reason,
        { targetPrincipalId, capabilityCode },
        null,
      );
    });
  }
  async disablePrincipal(
    authority: PlatformAuthority,
    targetPrincipalId: string,
    reason: string,
  ) {
    return this.transaction(async (q) => {
      await q.query(
        `SELECT pg_advisory_xact_lock(hashtext('JUPITER_PLATFORM_AUTHORITY_MANAGE'))`,
      );
      await this.revalidate(q, authority, PLATFORM_AUTHORITY_MANAGE);
      if (authority.principalType !== "HUMAN")
        throw new Error("HUMAN_SYSTEM_OWNER_REQUIRED");
      const target = await q.query(
        `SELECT id,status FROM platform_principals WHERE id=$1 FOR UPDATE`,
        [targetPrincipalId],
      );
      if (target.rows[0]?.status !== "ACTIVE")
        throw new Error("ACTIVE_PLATFORM_PRINCIPAL_REQUIRED");
      const owns = await q.query(
        `SELECT 1 FROM platform_capability_grants pg JOIN platform_capabilities pc ON pc.id=pg.capability_id WHERE pg.principal_id=$1 AND pc.code=$2 AND pg.revoked_at IS NULL`,
        [targetPrincipalId, PLATFORM_AUTHORITY_MANAGE],
      );
      if (owns.rowCount) {
        const count = await q.query(
          `SELECT count(*)::int count FROM platform_capability_grants pg JOIN platform_principals pp ON pp.id=pg.principal_id AND pp.status='ACTIVE' AND pp.principal_type='HUMAN' JOIN platform_capabilities pc ON pc.id=pg.capability_id AND pc.is_active=true WHERE pc.code=$1 AND pg.revoked_at IS NULL`,
          [PLATFORM_AUTHORITY_MANAGE],
        );
        if (count.rows[0].count <= 1)
          throw new Error("LAST_SYSTEM_OWNER_REQUIRED");
      }
      await q.query(
        `UPDATE platform_principals SET status='DISABLED',disabled_at=CURRENT_TIMESTAMP,disabled_by_principal_id=$1 WHERE id=$2`,
        [authority.principalId, targetPrincipalId],
      );
      await this.audit(
        q,
        authority,
        "PLATFORM_PRINCIPAL_DISABLED",
        "platform_principal",
        targetPrincipalId,
        reason,
        { status: "ACTIVE" },
        { status: "DISABLED" },
      );
    });
  }
  async inspect(authority: PlatformAuthority) {
    return this.transaction(async (q) => {
      assertRepositoryIssuedPlatformAuthority(authority);
      if (authority.principalType !== "HUMAN")
        throw new Error("HUMAN_SYSTEM_OWNER_REQUIRED");
      await this.revalidate(q, authority, PLATFORM_AUDIT_VIEW);
      const [principals, capabilities, grants, audit] = await Promise.all([
        q.query(
          `SELECT pp.id,pp.principal_type,COALESCE(pp.user_id::text,pp.service_code) principal_code,pp.display_name,pp.status,pp.created_at,pp.disabled_at,u.email AS user_email,u.full_name AS user_full_name FROM platform_principals pp LEFT JOIN users u ON u.id=pp.user_id ORDER BY pp.created_at,pp.id`,
        ),
        q.query(
          `SELECT code,label,description,domain,is_active,system_locked FROM platform_capabilities ORDER BY code`,
        ),
        q.query(
          `SELECT pg.id,pg.principal_id,pp.display_name AS principal_display_name,pp.principal_type AS principal_type,pc.code capability_code,pc.label capability_label,pg.granted_at,pg.revoked_at FROM platform_capability_grants pg JOIN platform_principals pp ON pp.id=pg.principal_id JOIN platform_capabilities pc ON pc.id=pg.capability_id ORDER BY pg.granted_at,pg.id`,
        ),
        q.query(
          `SELECT id,principal_type,capability_code,action,resource_type,resource_id,outcome,created_at FROM platform_global_audit_log ORDER BY created_at DESC,id DESC LIMIT 200`,
        ),
      ]);
      return Object.freeze({
        principals: principals.rows,
        capabilities: capabilities.rows,
        grants: grants.rows,
        audit: audit.rows,
      });
    });
  }
  async preflightBootstrap(input: {
    userId: string;
    expectedEmail: string;
    expectedDatabase: string;
    confirmationToken: string;
  }) {
    return this.transaction(async (q) => {
      const db = await q.query("SELECT current_database() name");
      if (db.rows[0]?.name !== input.expectedDatabase)
        throw new Error("BOOTSTRAP_DATABASE_MISMATCH");
      const ledger = await q.query(
        `SELECT name FROM "SequelizeMeta" ORDER BY name`,
      );
      let files: readonly string[];
      try {
        files = verifyRepositoryMigrationLedger(
          ledger.rows.map((row: any) => String(row.name)),
        ).files;
      } catch {
        throw new Error("BOOTSTRAP_MIGRATION_LEDGER_MISMATCH");
      }
      const head = files[files.length - 1];
      if (!head) throw new Error("BOOTSTRAP_MIGRATION_LEDGER_MISMATCH");
      const schema = await q.query(
        `SELECT
    to_regclass('public.platform_principals') IS NOT NULL principals,
    to_regclass('public.platform_capabilities') IS NOT NULL capabilities,
    to_regclass('public.platform_capability_grants') IS NOT NULL grants,
    to_regclass('public.platform_global_audit_log') IS NOT NULL audit,
    (SELECT count(*)=$1::int AND count(*) FILTER(WHERE is_active AND system_locked)=$1::int
       AND array_agg(code ORDER BY code)=$2::varchar[] FROM platform_capabilities) capability_set,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='tr_platform_global_audit_immutable' AND tgenabled<>'D') audit_trigger`,
        [BOOTSTRAP_CAPABILITIES.length, [...BOOTSTRAP_CAPABILITIES]],
      );
      const state = schema.rows[0];
      if (
        !state ||
        !state.principals ||
        !state.capabilities ||
        !state.grants ||
        !state.audit ||
        !state.capability_set ||
        !state.audit_trigger
      )
        throw new Error("BOOTSTRAP_SCHEMA_STATE_MISMATCH");
      const expected = `BOOTSTRAP:${input.expectedDatabase}:${input.userId}:${input.expectedEmail.trim().toLowerCase()}`;
      if (input.confirmationToken !== expected)
        throw new Error("BOOTSTRAP_CONFIRMATION_MISMATCH");
      if (
        (
          await q.query(
            `SELECT 1 FROM platform_global_audit_log WHERE action='SYSTEM_OWNER_BOOTSTRAPPED' LIMIT 1`,
          )
        ).rowCount && !(await this.terminatedBootstrapAllowsReplay(q))
      )
        throw new Error("SYSTEM_OWNER_BOOTSTRAP_ALREADY_COMPLETED");
      if (
        (
          await q.query(
            `SELECT 1 FROM platform_capability_grants pg JOIN platform_capabilities pc ON pc.id=pg.capability_id WHERE pc.code=$1 AND pg.revoked_at IS NULL`,
            [PLATFORM_AUTHORITY_MANAGE],
          )
        ).rowCount
      )
        throw new Error("SYSTEM_OWNER_ALREADY_EXISTS");
      const user = await q.query(
        `SELECT id,email,is_active FROM users WHERE id=$1 FOR SHARE`,
        [input.userId],
      );
      if (
        !user.rowCount ||
        !user.rows[0].is_active ||
        user.rows[0].email.toLowerCase() !==
          input.expectedEmail.trim().toLowerCase()
      )
        throw new Error("BOOTSTRAP_USER_MISMATCH");
      return Object.freeze({
        database: input.expectedDatabase,
        userId: input.userId,
        ledgerHead: head,
        capabilityCount: BOOTSTRAP_CAPABILITIES.length,
      });
    });
  }
  async bootstrap(input: {
    userId: string;
    expectedEmail: string;
    expectedDatabase: string;
    confirmationToken: string;
    displayName: string;
  }) {
    return this.transaction(async (q) => {
      await q.query(
        `SELECT pg_advisory_xact_lock(hashtext('JUPITER_PLATFORM_AUTHORITY_BOOTSTRAP'))`,
      );
      const db = await q.query("SELECT current_database() name");
      if (db.rows[0]?.name !== input.expectedDatabase)
        throw new Error("BOOTSTRAP_DATABASE_MISMATCH");
      const ledger = await q.query(
        `SELECT name FROM "SequelizeMeta" ORDER BY name`,
      );
      try {
        verifyRepositoryMigrationLedger(
          ledger.rows.map((row: any) => String(row.name)),
        );
      } catch {
        throw new Error("BOOTSTRAP_MIGRATION_LEDGER_MISMATCH");
      }
      const schema = await q.query(
        `SELECT
    to_regclass('public.platform_principals') IS NOT NULL principals,
    to_regclass('public.platform_capabilities') IS NOT NULL capabilities,
    to_regclass('public.platform_capability_grants') IS NOT NULL grants,
    to_regclass('public.platform_global_audit_log') IS NOT NULL audit,
    (SELECT count(*)=$1::int AND count(*) FILTER(WHERE is_active AND system_locked)=$1::int
       AND array_agg(code ORDER BY code)=$2::varchar[] FROM platform_capabilities) capability_set,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='tr_platform_global_audit_immutable' AND tgenabled<>'D') audit_trigger`,
        [BOOTSTRAP_CAPABILITIES.length, [...BOOTSTRAP_CAPABILITIES]],
      );
      const state = schema.rows[0];
      if (
        !state ||
        !state.principals ||
        !state.capabilities ||
        !state.grants ||
        !state.audit ||
        !state.capability_set ||
        !state.audit_trigger
      )
        throw new Error("BOOTSTRAP_SCHEMA_STATE_MISMATCH");
      const expected = `BOOTSTRAP:${input.expectedDatabase}:${input.userId}:${input.expectedEmail.trim().toLowerCase()}`;
      if (input.confirmationToken !== expected)
        throw new Error("BOOTSTRAP_CONFIRMATION_MISMATCH");
      const prior = await q.query(
        `SELECT 1 FROM platform_global_audit_log WHERE action='SYSTEM_OWNER_BOOTSTRAPPED' LIMIT 1`,
      );
      if (prior.rowCount && !(await this.terminatedBootstrapAllowsReplay(q)))
        throw new Error("SYSTEM_OWNER_BOOTSTRAP_ALREADY_COMPLETED");
      const owners = await q.query(
        `SELECT 1 FROM platform_capability_grants pg JOIN platform_capabilities pc ON pc.id=pg.capability_id WHERE pc.code=$1 AND pg.revoked_at IS NULL`,
        [PLATFORM_AUTHORITY_MANAGE],
      );
      if (owners.rowCount) throw new Error("SYSTEM_OWNER_ALREADY_EXISTS");
      const user = await q.query(
        `SELECT id,email,full_name,is_active FROM users WHERE id=$1 FOR SHARE`,
        [input.userId],
      );
      if (
        !user.rowCount ||
        !user.rows[0].is_active ||
        user.rows[0].email.toLowerCase() !==
          input.expectedEmail.trim().toLowerCase()
      )
        throw new Error("BOOTSTRAP_USER_MISMATCH");
      const principalId = randomUUID();
      await q.query(
        `INSERT INTO platform_principals(id,principal_type,user_id,display_name,status) VALUES($1,'HUMAN',$2,$3,'ACTIVE')`,
        [
          principalId,
          input.userId,
          input.displayName || user.rows[0].full_name,
        ],
      );
      const caps = await q.query(
        `SELECT id,code FROM platform_capabilities WHERE code=ANY($1::text[]) AND is_active=true`,
        [[...SYSTEM_OWNER_CAPABILITIES]],
      );
      if (caps.rowCount !== SYSTEM_OWNER_CAPABILITIES.length) throw new Error("SYSTEM_OWNER_CAPABILITY_MISSING");
      for (const cap of caps.rows)
        await q.query(
          `INSERT INTO platform_capability_grants(id,principal_id,capability_id,granted_by_principal_id,grant_reason) VALUES($1,$2,$3,$2,'Initial guarded System Owner bootstrap')`,
          [randomUUID(), principalId, cap.id],
        );
      const authority = this.issue(principalId, "HUMAN", input.userId, [
        ...SYSTEM_OWNER_CAPABILITIES,
      ]);
      await this.audit(
        q,
        authority,
        "SYSTEM_OWNER_BOOTSTRAPPED",
        "platform_principal",
        principalId,
        "Initial guarded System Owner bootstrap",
        null,
        { userId: input.userId },
      );
      return principalId;
    });
  }
}
