import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { PlatformAuthorityRepository } from '../platform-authority/platform-authority.repository.js';
import { TenantLifecycleCommandService } from './tenant-lifecycle-command.service.js';
import { OrganisationProvisioningRepository } from './organisation-provisioning.repository.js';

const userId = '60200000-0000-4000-8000-000000000001';

async function authority() {
  const query = vi.fn(async (sql: string) => sql.includes('FROM platform_principals pp LEFT JOIN')
    ? { rows: [{ id: 'principal', principal_type: 'HUMAN', principal_code: userId,
      capabilities: ['TENANT_PROVISION', 'TENANT_ACTIVATE', 'TENANT_SUSPEND', 'TENANT_REINSTATE'] }], rowCount: 1 }
    : { rows: [], rowCount: 0 });
  return (await new PlatformAuthorityRepository({ query } as any).resolveHuman(userId))!;
}

describe('L3-2 consolidated authoritative lifecycle commands', () => {
  it('maps each service command to exactly one capability operation', async () => {
    const repository = {
      provision: vi.fn(async (evidence) => evidence.operations),
      activate: vi.fn(async (evidence) => evidence.operations),
      suspend: vi.fn(async (evidence) => evidence.operations),
      reinstate: vi.fn(async (evidence) => evidence.operations),
    };
    const service = new TenantLifecycleCommandService(repository as any);
    const context = { authority: await authority(), reason: 'Authorized test', correlationId: userId };
    await expect(service.provision(context, { code: 'TEST', displayName: 'Test', initialUserId: userId })).resolves.toEqual(['TENANT_PROVISION']);
    await expect(service.activate(context, userId)).resolves.toEqual(['TENANT_ACTIVATE']);
    await expect(service.suspend(context, userId)).resolves.toEqual(['TENANT_SUSPEND']);
    await expect(service.reinstate(context, userId)).resolves.toEqual(['TENANT_REINSTATE']);
  });

  it('rejects fabricated and tenant/legacy-role-shaped authority before repository work', async () => {
    const repository = { provision: vi.fn() };
    const service = new TenantLifecycleCommandService(repository as any);
    for (const fake of [{}, { tenantId: userId }, { roles: ['ADMIN'] }]) {
      expect(() => service.provision({ authority: fake as any, reason: 'No' }, {
        code: 'DENIED', displayName: 'Denied', initialUserId: userId,
      })).toThrow('PLATFORM_AUTHORITY_REQUIRED');
    }
    expect(repository.provision).not.toHaveBeenCalled();
  });

  it('keeps the superseded provisioning path fail closed with no tenant writer', async () => {
    const legacySource = fs.readFileSync('src/modules/tenancy/organisation-provisioning.repository.ts', 'utf8');
    expect(legacySource).not.toMatch(/INSERT INTO\s+(?:public\.)?tenants/i);
    const repository = new OrganisationProvisioningRepository({} as any);
    await expect(repository.provision({ actorUserId: userId, initialUserId: userId, code: 'OLD', displayName: 'Old' }))
      .rejects.toThrow('LEVEL3_PLATFORM_AUTHORITY_REQUIRED');
  });

  it('mounts the four lifecycle commands plus exact ADMIN recovery without unrelated lifecycle behavior', () => {
    const routes = fs.readFileSync('src/modules/tenancy/tenant-lifecycle-command.routes.ts', 'utf8');
    const repository = fs.readFileSync('src/modules/tenancy/tenant-lifecycle-command.repository.ts', 'utf8');
    const app = fs.readFileSync('src/app.ts', 'utf8');
    expect(routes.match(/router\.post\(/g)).toHaveLength(7);
    expect(routes).toContain("if (typeof value !== 'string') throw new Error('TENANT_LIFECYCLE_COMMAND_UNAVAILABLE')");
    expect(routes.match(/publicId\(req\)/g)).toHaveLength(6);
    expect(routes).toContain("router.post('/:publicId/activate'");
    expect(routes).toContain("router.post('/:publicId/suspend'");
    expect(routes).toContain("router.post('/:publicId/reinstate'");
    expect(routes).toContain("router.post('/:publicId/admin-recovery'");
    expect(routes).toContain("['TENANT_ADMIN_RECOVER']");
    expect(routes).not.toMatch(/router\.(?:delete|patch|put)\(/);
    expect(`${routes}\n${repository}`).not.toMatch(/TENANT_(?:TRANSFER|ARCHIVE)|quota|ROW LEVEL SECURITY|CREATE POLICY/i);
    expect(app).toContain("app.use('/platform/tenants', ensureAuthenticated, tenantLifecycleCommandRoutes)");
  });

  it('locks before every state re-read and delegates mutation/audit atomically', () => {
    const source = fs.readFileSync('src/modules/tenancy/tenant-lifecycle-command.repository.ts', 'utf8');
    expect(source).toContain('executeAuthoritativePlatformMutation');
    expect(source).toContain('requirePlatformMutationOperations');
    expect(source).toMatch(/await lockTenant\(located\.id, transaction\);\s+const current = await tenantByPublicId\(publicId, transaction, true\)/);
    expect(source).toContain('audit.setBefore(auditState(current))');
    expect(source).not.toMatch(/\.destroy\(|DELETE FROM tenants/i);
  });
});

describe('L3 initial-admin onboarding (provision + controlled invitation)', () => {
  it('provisions a company and issues a tenant-bound initial-admin invitation without a pre-existing global user', async () => {
    const repository = {
      provisionWithInitialAdminInvitation: vi.fn(async (_evidence: unknown, command: Record<string, unknown>) => ({
        tenant: { tenantId: userId, publicId: 'public-1', code: command.code, displayName: command.displayName, status: 'PROVISIONING' },
        invitationId: command.invitationId,
      })),
    };
    const delivery = { deliver: vi.fn(async () => undefined) };
    const service = new TenantLifecycleCommandService(repository as any, delivery as any);
    const context = { authority: await authority(), reason: 'Authorized test', correlationId: userId };
    const result = await service.provisionWithInitialAdminInvitation(context, {
      code: 'ACME', displayName: 'Acme Airways', initialAdminEmail: 'admin@example.com', initialAdminName: 'Ada Admin',
    });

    expect(repository.provisionWithInitialAdminInvitation).toHaveBeenCalledOnce();
    const [evidence, command] = repository.provisionWithInitialAdminInvitation.mock.calls[0] as [Record<string, unknown>, Record<string, unknown>];
    expect((evidence as { operations?: readonly string[] }).operations).toEqual(['TENANT_PROVISION']);
    expect(command).toMatchObject({ code: 'ACME', displayName: 'Acme Airways', initialAdminEmail: 'admin@example.com', initialAdminName: 'Ada Admin' });
    expect(command).not.toHaveProperty('initialUserId');
    expect(command.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(String(command.invitationId)).toMatch(/^[0-9a-f-]{36}$/);
    expect((command.expiresAt as Date).getTime()).toBeGreaterThan(Date.now());

    expect(result.tenantId).toBe(userId);
    expect(result.publicId).toBe('public-1');
    expect(result.invitationId).toBe(command.invitationId);
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

    expect(delivery.deliver).toHaveBeenCalledOnce();
    const [delivered] = delivery.deliver.mock.calls[0] as [Record<string, unknown>];
    expect(delivered.email).toBe('admin@example.com');
    expect(delivered.initialAdmin).toBe(true);
    expect(delivered.tenantName).toBe('Acme Airways');
    expect(delivered.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('requires the repository-issued HUMAN authority for the initial-admin path', async () => {
    const repository = { provisionWithInitialAdminInvitation: vi.fn() };
    const service = new TenantLifecycleCommandService(repository as any);
    for (const fake of [{}, { tenantId: userId }, { roles: ['ADMIN'] }]) {
      await expect(service.provisionWithInitialAdminInvitation({ authority: fake as any, reason: 'No' }, {
        code: 'DENIED', displayName: 'Denied', initialAdminEmail: 'a@b.co', initialAdminName: 'X',
      })).rejects.toThrow('PLATFORM_AUTHORITY_REQUIRED');
    }
    expect(repository.provisionWithInitialAdminInvitation).not.toHaveBeenCalled();
  });

  it('replaces the global-user selector in the normal first-company workflow', () => {
    const routes = fs.readFileSync('src/modules/tenancy/tenant-lifecycle-command.routes.ts', 'utf8');
    const view = fs.readFileSync('src/views/platform/index.ejs', 'utf8');
    expect(routes).toContain('provisionWithInitialAdminInvitation');
    expect(routes).toContain('initialAdminEmail');
    expect(routes).toContain('initialAdminName');
    expect(routes).not.toMatch(/initialUserId/);
    expect(view).toContain('name="initialAdminEmail"');
    expect(view).toContain('name="initialAdminName"');
    expect(view).not.toContain('name="initialUserId"');
    expect(view).not.toMatch(/<select name="initialUserId"/);
  });

  it('delivers the invitation by email and never logs or flashes the raw token', () => {
    const routes = fs.readFileSync('src/modules/tenancy/tenant-lifecycle-command.routes.ts', 'utf8');
    const service = fs.readFileSync('src/modules/tenancy/tenant-lifecycle-command.service.ts', 'utf8');
    const repository = fs.readFileSync('src/modules/tenancy/tenant-lifecycle-command.repository.ts', 'utf8');
    // No development console-token path remains.
    expect(routes).not.toContain('[DEVELOPMENT INVITATION]');
    expect(`${routes}\n${service}`).not.toMatch(/console\.log\([^)]*token/i);
    // Success reports email delivery, never a token.
    expect(routes).toContain("'Company provisioned. Administrator invitation email sent.'");
    // Delivery failure is reported without exposing a token.
    expect(routes).toContain('INVITATION_DELIVERY_FAILED');
    // The raw token flows only through the delivery abstraction in the service.
    expect(service).toContain('this.delivery.deliver');
    // The repository persists only the SHA-256 token hash, never the raw token.
    expect(repository).toContain('token_hash');
    expect(repository).not.toMatch(/INSERT INTO staff_invitations[\s\S]*:token\b/);
  });

  it('rejects non-HUMAN (SERVICE) authority before issuing an initial-admin invitation', async () => {
    const repository = { provisionWithInitialAdminInvitation: vi.fn() };
    const service = new TenantLifecycleCommandService(repository as any);
    const serviceAuthority = { ...(await authority()), principalType: 'SERVICE' as const };
    await expect(service.provisionWithInitialAdminInvitation({ authority: serviceAuthority as any, reason: 'No' }, {
      code: 'DENIED', displayName: 'Denied', initialAdminEmail: 'a@b.co', initialAdminName: 'X',
    })).rejects.toThrow(/PLATFORM_PRINCIPAL_TYPE_REQUIRED|PLATFORM_AUTHORITY_REQUIRED/);
    expect(repository.provisionWithInitialAdminInvitation).not.toHaveBeenCalled();
  });

  it('corrects the initial administrator email by issuing a fresh invitation', async () => {
    const repository = {
      correctInitialAdminInvitation: vi.fn(async (_evidence: unknown, _publicId: string, command: Record<string, unknown>) => ({
        tenantId: userId,
        publicId: 'public-1',
        tenantName: 'Acme Airways',
        email: command.email,
        identityCreated: true,
        invitationId: command.invitationId,
      })),
    };
    const delivery = { deliver: vi.fn(async () => undefined) };
    const service = new TenantLifecycleCommandService(repository as any, delivery as any);
    const context = { authority: await authority(), reason: 'Corrected address', correlationId: userId };
    const result = await service.correctInitialAdminInvitation(context, 'public-1', 'new-admin@example.com', 'New Admin');

    expect(repository.correctInitialAdminInvitation).toHaveBeenCalledOnce();
    const [evidence, publicId, command] = repository.correctInitialAdminInvitation.mock.calls[0] as [Record<string, unknown>, string, Record<string, unknown>];
    expect((evidence as { operations?: readonly string[] }).operations).toEqual(['TENANT_ADMIN_INVITATION_CORRECT']);
    expect(publicId).toBe('public-1');
    expect(command.email).toBe('new-admin@example.com');
    expect(command.fullName).toBe('New Admin');
    expect(command.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(delivery.deliver).toHaveBeenCalledOnce();
    const [delivered] = delivery.deliver.mock.calls[0] as [Record<string, unknown>];
    expect(delivered.initialAdmin).toBe(true);
    expect(delivered.email).toBe('new-admin@example.com');
    expect(result.publicId).toBe('public-1');
  });

  it('sends exactly one activation notification to the onboarded administrator after commit', async () => {
    const repository = {
      activate: vi.fn(async () => ({ tenantId: userId, publicId: 'public-1', code: 'ACME', displayName: 'Acme Airways', status: 'ACTIVE' })),
      resolveInitialAdminEmail: vi.fn(async () => 'admin@example.com'),
    };
    const delivery = { deliver: vi.fn(async () => undefined) };
    const activationDelivery = { deliver: vi.fn(async () => undefined) };
    const service = new TenantLifecycleCommandService(repository as any, delivery as any, activationDelivery as any);
    const context = { authority: await authority(), reason: 'Activate', correlationId: userId };
    const result = await service.activate(context, 'public-1');
    expect(result.status).toBe('ACTIVE');
    expect(repository.resolveInitialAdminEmail).toHaveBeenCalledOnce();
    expect(activationDelivery.deliver).toHaveBeenCalledOnce();
    const [message] = activationDelivery.deliver.mock.calls[0] as [Record<string, unknown>];
    expect(message.email).toBe('admin@example.com');
    expect(message.companyDisplayName).toBe('Acme Airways');
    // No secret material may flow into the activation notification.
    expect(JSON.stringify(message)).not.toMatch(/token|password|hash|secret/i);
  });

  it('still returns the ACTIVE identity when activation notification delivery fails', async () => {
    const repository = {
      activate: vi.fn(async () => ({ tenantId: userId, publicId: 'public-1', code: 'ACME', displayName: 'Acme Airways', status: 'ACTIVE' })),
      resolveInitialAdminEmail: vi.fn(async () => 'admin@example.com'),
    };
    const delivery = { deliver: vi.fn(async () => undefined) };
    const activationDelivery = { deliver: vi.fn(async () => { throw new Error('SMTP_UNAVAILABLE'); }) };
    const service = new TenantLifecycleCommandService(repository as any, delivery as any, activationDelivery as any);
    const context = { authority: await authority(), reason: 'Activate' };
    const result = await service.activate(context, 'public-1');
    expect(result.status).toBe('ACTIVE');
    expect(activationDelivery.deliver).toHaveBeenCalledOnce();
  });

  it('sends no activation notification when activation fails', async () => {
    const repository = {
      activate: vi.fn(async () => { throw new Error('TENANT_LIFECYCLE_COMMAND_UNAVAILABLE'); }),
      resolveInitialAdminEmail: vi.fn(async () => 'admin@example.com'),
    };
    const delivery = { deliver: vi.fn(async () => undefined) };
    const activationDelivery = { deliver: vi.fn(async () => undefined) };
    const service = new TenantLifecycleCommandService(repository as any, delivery as any, activationDelivery as any);
    const context = { authority: await authority(), reason: 'Activate' };
    await expect(service.activate(context, 'public-1')).rejects.toThrow('TENANT_LIFECYCLE_COMMAND_UNAVAILABLE');
    expect(repository.resolveInitialAdminEmail).not.toHaveBeenCalled();
    expect(activationDelivery.deliver).not.toHaveBeenCalled();
  });
});
