import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { hashPassword } from './password.util.js';
import { assertTenantQueryAuthority, type TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { TENANT_LIFECYCLE_LOCK_NAMESPACE } from '../tenancy/tenant-lifecycle-coordination.js';
import { emitOperationalEvent } from '../observability/operational-event.js';

export const STAFF_MEMBERSHIP_UNAVAILABLE = 'STAFF_MEMBERSHIP_UNAVAILABLE';
export type InvitationDeliveryMessage = Readonly<{ email: string; token: string; expiresAt: Date; tenantId: string; tenantName: string; initialAdmin: boolean }>;
export interface StaffInvitationDelivery { deliver(message: InvitationDeliveryMessage): Promise<void>; }
export class NullStaffInvitationDelivery implements StaffInvitationDelivery { async deliver(): Promise<void> {} }

/** Result of a completed initial-administrator onboarding acceptance. */
export type StaffAcceptanceResult = Readonly<{
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  tenantStatus: string;
}>;

export type SystemOwnerNotificationMessage = Readonly<{
  email: string;
  companyDisplayName: string;
  companyCode: string;
  tenantId: string;
}>;

export interface SystemOwnerNotificationDelivery {
  deliver(message: SystemOwnerNotificationMessage): Promise<void>;
}

export interface SystemOwnerNotificationRecipientResolver {
  resolve(): Promise<string | undefined>;
}

export interface SystemOwnerNotificationCoordinator {
  readonly delivery: SystemOwnerNotificationDelivery;
  readonly recipient: SystemOwnerNotificationRecipientResolver;
}

type InviteInput = Readonly<{ email: string; fullName: string; actorUserId: string; expiresAt: Date; tokenHash: string; placeholderHash: string; correlationId: string; reason: string }>;

export type InvitationDescription = Readonly<{
  invitationId: string;
  tenantId: string;
  email: string;
  identityCreated: boolean;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
}>;

const TENANT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unavailable(): Error { return new Error(STAFF_MEMBERSHIP_UNAVAILABLE); }
function normalizedEmail(value: string): string { return value.trim().toLowerCase(); }

export class StaffMembershipAdministrationRepository {
  constructor(private readonly database: Pool) {}

  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.database.connect();
    try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  private async lock(client: PoolClient, tenantId: string) {
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1::text, ${TENANT_LIFECYCLE_LOCK_NAMESPACE}::bigint))`, [tenantId]);
  }
  private async tenantContext(client: PoolClient, tenantId: string) {
    await client.query(`SELECT set_config('jupiter.tenant_id', $1, true)`, [tenantId]);
  }
  private async actor(client: PoolClient, authority: TenantQueryAuthority, actorUserId: string) {
    assertTenantQueryAuthority(authority);
    const row = await client.query(`SELECT tm.id FROM tenant_memberships tm JOIN tenant_membership_roles tmr ON tmr.membership_id=tm.id AND tmr.revoked_at IS NULL JOIN rf_role r ON r.id=tmr.role_id AND r.code='ADMIN' AND r.is_active=true WHERE tm.tenant_id=$1 AND tm.user_id=$2 AND tm.status='ACTIVE' FOR SHARE`, [authority.tenantId, actorUserId]);
    if (row.rowCount !== 1) throw unavailable();
  }
  private async audit(client: PoolClient, data: { tenantId: string; membershipId: string; actorUserId: string; actorKind: 'TENANT_ADMIN'|'PLATFORM_HUMAN'|'INVITEE'; action: string; reason: string; correlationId: string; before: unknown; after: unknown }) {
    await client.query(`INSERT INTO tenant_membership_authority_audit(id,tenant_id,membership_id,actor_user_id,actor_kind,action,reason,correlation_id,old_values,new_values) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)`, [randomUUID(),data.tenantId,data.membershipId,data.actorUserId,data.actorKind,data.action,data.reason,data.correlationId,JSON.stringify(data.before),JSON.stringify(data.after)]);
  }

  async invite(authority: TenantQueryAuthority, input: InviteInput): Promise<{ invitationId: string; tenantName: string }> {
    assertTenantQueryAuthority(authority);
    return this.transaction(async client => {
      await this.tenantContext(client, authority.tenantId);
      const tenantName = (await client.query(`SELECT display_name FROM tenants WHERE id=$1`, [authority.tenantId])).rows[0]?.display_name || '';
      await this.lock(client, authority.tenantId); await this.actor(client, authority, input.actorUserId);
      const email = normalizedEmail(input.email);
      let user = await client.query(`SELECT id,is_active FROM users WHERE lower(email)=$1 AND retired_at IS NULL FOR UPDATE`, [email]);
      let userId: string; let identityCreated = false;
      if (!user.rowCount) {
        userId=randomUUID(); identityCreated=true;
        await client.query(`INSERT INTO users(id,email,password_hash,full_name,is_active,created_at,updated_at) VALUES($1,$2,$3,$4,false,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, [userId,email,input.placeholderHash,input.fullName]);
      } else userId=user.rows[0].id;
      let membership = await client.query(`SELECT id,status FROM tenant_memberships WHERE tenant_id=$1 AND user_id=$2 FOR UPDATE`, [authority.tenantId,userId]);
      let membershipId: string;
      if (!membership.rowCount) {
        membershipId=randomUUID();
        await client.query(`INSERT INTO tenant_memberships(id,tenant_id,user_id,status,created_by_user_id,updated_by_user_id) VALUES($1,$2,$3,'INVITED',$4,$4)`, [membershipId,authority.tenantId,userId,input.actorUserId]);
      } else {
        membershipId=membership.rows[0].id;
        if (membership.rows[0].status !== 'INVITED') throw unavailable();
        await client.query(`UPDATE staff_invitations SET revoked_at=CURRENT_TIMESTAMP,revoked_by_user_id=$2 WHERE membership_id=$1 AND consumed_at IS NULL AND revoked_at IS NULL`, [membershipId,input.actorUserId]);
      }
      const invitationId=randomUUID();
      await client.query(`INSERT INTO staff_invitations(id,tenant_id,membership_id,user_id,normalized_email,token_hash,expires_at,identity_created,invited_by_user_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [invitationId,authority.tenantId,membershipId,userId,email,input.tokenHash,input.expiresAt,identityCreated,input.actorUserId]);
      await this.audit(client,{tenantId:authority.tenantId,membershipId,actorUserId:input.actorUserId,actorKind:'TENANT_ADMIN',action:'STAFF_INVITED',reason:input.reason,correlationId:input.correlationId,before:null,after:{status:'INVITED'}});
      return { invitationId, tenantName };
    });
  }

  async accept(tokenHash: string, tenantId: string, currentUserId: string | undefined, passwordHash: string | undefined, correlationId: string): Promise<StaffAcceptanceResult> {
    if (!TENANT_UUID.test(tenantId)) throw unavailable();
    const normalizedTenantId = tenantId.toLowerCase();
    return this.transaction(async client => {
      await this.tenantContext(client, normalizedTenantId);
      await this.lock(client, normalizedTenantId);
      const invitation = await client.query(`SELECT si.*,tm.status membership_status,u.is_active,t.display_name,t.code,t.status tenant_status FROM staff_invitations si JOIN tenant_memberships tm ON tm.id=si.membership_id JOIN users u ON u.id=si.user_id JOIN tenants t ON t.id=si.tenant_id WHERE si.token_hash=$1 FOR UPDATE OF si,tm,u`, [tokenHash]);
      const row=invitation.rows[0];
      if (!row || row.tenant_id !== normalizedTenantId || row.consumed_at || row.revoked_at || new Date(row.expires_at).getTime()<=Date.now() || row.membership_status!=='INVITED') throw unavailable();
      if (row.identity_created) {
        if (!passwordHash || row.is_active) throw unavailable();
        await client.query(`UPDATE users SET password_hash=$1,is_active=true,updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND is_active=false`,[passwordHash,row.user_id]);
      } else if (!currentUserId || currentUserId!==row.user_id || !row.is_active) throw unavailable();
      await client.query(`UPDATE tenant_memberships SET status='ACTIVE',joined_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP,updated_by_user_id=$2 WHERE id=$1 AND status='INVITED'`,[row.membership_id,row.user_id]);
      await client.query(`UPDATE staff_invitations SET consumed_at=CURRENT_TIMESTAMP WHERE id=$1 AND consumed_at IS NULL AND revoked_at IS NULL`,[row.id]);
      await this.audit(client,{tenantId:row.tenant_id,membershipId:row.membership_id,actorUserId:row.user_id,actorKind:'INVITEE',action:'MEMBERSHIP_ACTIVATED',reason:'Accepted staff invitation',correlationId,before:{status:'INVITED'},after:{status:'ACTIVE'}});
      return { tenantId: row.tenant_id, tenantName: row.display_name, tenantCode: row.code, tenantStatus: row.tenant_status };
    });
  }

  async describeInvitation(tokenHash: string, tenantId: string): Promise<InvitationDescription | undefined> {
    if (!TENANT_UUID.test(tenantId)) throw unavailable();
    const normalizedTenantId = tenantId.toLowerCase();
    return this.transaction(async client => {
      await this.tenantContext(client, normalizedTenantId);
      const rows = await client.query(
        `SELECT id, tenant_id, normalized_email, identity_created, expires_at, consumed_at, revoked_at
         FROM staff_invitations WHERE token_hash=$1`,
        [tokenHash],
      );
      const row = rows.rows[0];
      if (!row) return undefined;
      return {
        invitationId: row.id,
        tenantId: row.tenant_id,
        email: row.normalized_email,
        identityCreated: row.identity_created,
        expiresAt: row.expires_at,
        consumedAt: row.consumed_at,
        revokedAt: row.revoked_at,
      };
    });
  }

  async setMembershipStatus(authority: TenantQueryAuthority, targetUserId: string, status: 'DISABLED'|'ACTIVE', actorUserId: string, reason: string, correlationId: string): Promise<void> {
    assertTenantQueryAuthority(authority);
    await this.transaction(async client => {
      await this.tenantContext(client, authority.tenantId);
      await this.lock(client,authority.tenantId); await this.actor(client,authority,actorUserId);
      const target=await client.query(`SELECT id,status,joined_at FROM tenant_memberships WHERE tenant_id=$1 AND user_id=$2 FOR UPDATE`,[authority.tenantId,targetUserId]);
      const row=target.rows[0]; if (!row || (status==='DISABLED' ? row.status!=='ACTIVE' : row.status!=='DISABLED')) throw unavailable();
      if(status==='DISABLED'){
        const targetAdmin = await client.query(
          `SELECT 1 FROM tenant_membership_roles tmr
             JOIN rf_role r ON r.id = tmr.role_id AND r.code = 'ADMIN' AND r.is_active = true
           WHERE tmr.membership_id = $1 AND tmr.revoked_at IS NULL LIMIT 1`,
          [row.id]);
        if (targetAdmin.rowCount === 1) {
          const otherAdmin = await client.query(
            `SELECT 1 FROM tenant_memberships tm
               JOIN tenant_membership_roles tmr ON tmr.membership_id = tm.id AND tmr.revoked_at IS NULL
               JOIN rf_role r ON r.id = tmr.role_id AND r.code = 'ADMIN' AND r.is_active = true
             WHERE tm.tenant_id = $1 AND tm.status = 'ACTIVE' AND tm.id <> $2 LIMIT 1`,
            [authority.tenantId, row.id]);
          if (otherAdmin.rowCount === 0) throw new Error('LAST_ACTIVE_TENANT_ADMIN_REQUIRED');
        }
        await client.query(`UPDATE tenant_memberships SET status='DISABLED',disabled_at=CURRENT_TIMESTAMP,disabled_by_user_id=$2,status_reason=$3,updated_at=CURRENT_TIMESTAMP,updated_by_user_id=$2 WHERE id=$1`,[row.id,actorUserId,reason]);
      }
      else await client.query(`UPDATE tenant_memberships SET status='ACTIVE',joined_at=COALESCE(joined_at,CURRENT_TIMESTAMP),disabled_at=NULL,disabled_by_user_id=NULL,status_reason=NULL,updated_at=CURRENT_TIMESTAMP,updated_by_user_id=$2 WHERE id=$1`,[row.id,actorUserId]);
      await this.audit(client,{tenantId:authority.tenantId,membershipId:row.id,actorUserId,actorKind:'TENANT_ADMIN',action:status==='DISABLED'?'MEMBERSHIP_DISABLED':'MEMBERSHIP_REINSTATED',reason,correlationId,before:{status:row.status},after:{status}});
    });
  }
}

export class StaffInvitationService {
  constructor(
    private readonly repository: StaffMembershipAdministrationRepository,
    private readonly delivery: StaffInvitationDelivery,
    private readonly clock = Date.now,
    private readonly systemOwnerNotification?: SystemOwnerNotificationCoordinator,
  ) {}
  async invite(authority: TenantQueryAuthority,input:{email:unknown;fullName:unknown;actorUserId:unknown;reason:unknown;correlationId?:unknown}) {
    if(typeof input.email!=='string'||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim())||typeof input.fullName!=='string'||!input.fullName.trim()||typeof input.actorUserId!=='string'||typeof input.reason!=='string'||!input.reason.trim()) throw unavailable();
    const token=randomBytes(32).toString('base64url'), expiresAt=new Date(this.clock()+24*60*60*1000);
    const created=await this.repository.invite(authority,{email:normalizedEmail(input.email),fullName:input.fullName.trim(),actorUserId:input.actorUserId,reason:input.reason.trim(),correlationId:typeof input.correlationId==='string'?input.correlationId:randomUUID(),expiresAt,tokenHash:createHash('sha256').update(token).digest('hex'),placeholderHash:await hashPassword(randomUUID())});
    await this.delivery.deliver({email:normalizedEmail(input.email),token,expiresAt,tenantId:authority.tenantId,tenantName:created.tenantName,initialAdmin:false});
    return { accepted:true } as const;
  }
  async accept(input:{token:unknown;tenantId:unknown;password?:unknown;currentUserId?:unknown;correlationId?:unknown}) {
    if(typeof input.token!=='string'||input.token.length<32) throw unavailable();
    if(typeof input.tenantId!=='string'||!TENANT_UUID.test(input.tenantId)) throw unavailable();
    const passwordHash=typeof input.password==='string'&&input.password.length>=12?await hashPassword(input.password):undefined;
    const correlationId=typeof input.correlationId==='string'?input.correlationId:randomUUID();
    const result=await this.repository.accept(createHash('sha256').update(input.token).digest('hex'),input.tenantId.toLowerCase(),typeof input.currentUserId==='string'?input.currentUserId:undefined,passwordHash,correlationId);
    if (this.systemOwnerNotification && result.tenantStatus === 'PROVISIONING') {
      await this.notifySystemOwner(result, correlationId);
    }
    return { accepted:true, tenantName:result.tenantName, tenantCode:result.tenantCode, tenantStatus:result.tenantStatus } as const;
  }

  private async notifySystemOwner(result: StaffAcceptanceResult, correlationId: string): Promise<void> {
    const coordinator = this.systemOwnerNotification;
    if (!coordinator) return;
    try {
      const email = await coordinator.recipient.resolve();
      if (!email) {
        emitOperationalEvent({ code: 'SYSTEM_OWNER_NOTIFICATION_RECIPIENT_MISSING', severity: 'WARN', outcome: 'SKIPPED', operation: 'SYSTEM_OWNER_ONBOARDING_NOTIFICATION', correlationId, tenantId: result.tenantId });
        return;
      }
      await coordinator.delivery.deliver({ email, companyDisplayName: result.tenantName, companyCode: result.tenantCode, tenantId: result.tenantId });
      emitOperationalEvent({ code: 'SYSTEM_OWNER_NOTIFICATION_DELIVERED', severity: 'INFO', outcome: 'SUCCESS', operation: 'SYSTEM_OWNER_ONBOARDING_NOTIFICATION', correlationId, tenantId: result.tenantId });
    } catch (error) {
      emitOperationalEvent({ code: 'SYSTEM_OWNER_NOTIFICATION_FAILED', severity: 'ERROR', outcome: 'FAILED', operation: 'SYSTEM_OWNER_ONBOARDING_NOTIFICATION', correlationId, tenantId: result.tenantId, error });
    }
  }

  async describe(input:{token:unknown;tenantId:unknown}) {
    try {
      if(typeof input.token!=='string'||input.token.length<32) return { valid:false } as const;
      if(typeof input.tenantId!=='string') return { valid:false } as const;
      const row=await this.repository.describeInvitation(createHash('sha256').update(input.token).digest('hex'),input.tenantId);
      if(!row||row.consumedAt||row.revokedAt||new Date(row.expiresAt).getTime()<=Date.now()) return { valid:false } as const;
      return { valid:true, email:row.email, needsPassword:row.identityCreated, tenantId:row.tenantId } as const;
    } catch { return { valid:false } as const; }
  }
}
