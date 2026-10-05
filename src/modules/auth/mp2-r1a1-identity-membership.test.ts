import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it,vi } from 'vitest';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { StaffInvitationService } from './staff-membership-administration.js';

const id=(n:string)=>`${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`;
const authority=createTenantQueryAuthority({state:'VALID_ACTIVE_TENANT',validatedAt:1,tenant:{id:id('1'),publicId:'tenant-a',code:'A',displayName:'A',status:'ACTIVE'},membership:{id:id('2'),tenantId:id('1'),userId:id('3'),status:'ACTIVE'}});

describe('MP2-R1A-1 identity and membership boundary',()=>{
  it('creates an opaque invitation and delegates only the delivery credential',async()=>{
    const repository={invite:vi.fn().mockResolvedValue({invitationId:id('4')})};
    const delivery={deliver:vi.fn().mockResolvedValue(undefined)};
    const service=new StaffInvitationService(repository as any,delivery,()=>1_000);
    await expect(service.invite(authority,{email:' Person@Example.COM ',fullName:'Person',actorUserId:id('3'),reason:'Onboarding'})).resolves.toEqual({accepted:true});
    expect(repository.invite).toHaveBeenCalledOnce();
    const persisted=repository.invite.mock.calls[0][1];
    expect(persisted.email).toBe('person@example.com');
    expect(persisted.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(persisted)).not.toContain(delivery.deliver.mock.calls[0][0].token);
  });

  it('fails malformed invitation acceptance before persistence',async()=>{
    const repository={accept:vi.fn()};
    const service=new StaffInvitationService(repository as any,{deliver:vi.fn()});
    await expect(service.accept({token:'bad'})).rejects.toThrow('STAFF_MEMBERSHIP_UNAVAILABLE');
    expect(repository.accept).not.toHaveBeenCalled();
  });

  it('keeps tenant and platform authority boundaries explicit',()=>{
    const staff=readFileSync(resolve(process.cwd(),'src/modules/auth/staff-membership-administration.ts'),'utf8');
    const recovery=readFileSync(resolve(process.cwd(),'src/modules/tenancy/tenant-admin-recovery.ts'),'utf8');
    const migration=readFileSync(resolve(process.cwd(),'migrations/602_create_staff_membership_administration.ts'),'utf8');
    const repair=readFileSync(resolve(process.cwd(),'migrations/603_remove_deferred_last_admin_enforcement.ts'),'utf8');
    expect(staff).toContain('assertTenantQueryAuthority(authority)');
    expect(staff).toContain('tm.tenant_id=$1');
    expect(staff).not.toMatch(/listAllUsers|searchUsers|globalUser/i);
    expect(recovery).toContain("requirePlatformMutationOperations(evidence,['TENANT_ADMIN_RECOVER'])");
    expect(recovery).toContain('executeAuthoritativePgPlatformMutation');
    expect(migration).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(migration).toContain('TENANT_MEMBERSHIP_AUTHORITY_AUDIT_IMMUTABLE');
    expect(migration).toContain('REVOKE UPDATE,DELETE ON tenant_membership_authority_audit');
    expect(repair).toContain('DROP TRIGGER ${ROLE_TRIGGER}');
    expect(repair).toContain('DROP FUNCTION public.${FUNCTION}()');
    expect(repair).not.toMatch(/DROP TABLE|DELETE FROM tenant_|UPDATE tenant_/i);
  });
});
