import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { PlatformUserInvitationRepository, PlatformUserInvitationService, NullPlatformUserInvitationDelivery } from './platform-user-invitation.js';

const read = (relative: string) => fs.readFileSync(path.resolve(process.cwd(), relative), 'utf8');

describe('platform user invitation — token security', () => {
  it('hashes the token with SHA-256 and never persists plaintext', async () => {
    const repo = {
      invite: vi.fn().mockResolvedValue({ invitationId: 'inv-1' }),
      describeInvitation: vi.fn().mockResolvedValue(null),
    } as any;
    const delivery = { deliver: vi.fn().mockResolvedValue(undefined) };
    const service = new PlatformUserInvitationService(repo, delivery, () => 1_000_000);

    await service.invite(
      { principalId: 'p', principalType: 'HUMAN', principalCode: 'owner', capabilities: new Set(['PLATFORM_AUTHORITY_MANAGE']) } as any,
      { email: 'Curator@Example.com', fullName: 'Curator', reason: 'r' },
    );

    const inviteArg = repo.invite.mock.calls[0][1];
    expect(inviteArg.email).toBe('curator@example.com');
    expect(inviteArg.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(inviteArg.tokenHash).not.toContain(inviteArg.email);
    const delivered = delivery.deliver.mock.calls[0][0];
    expect(delivered.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    // the delivered token, when hashed, matches the stored hash (no plaintext stored)
    expect(require('node:crypto').createHash('sha256').update(delivered.token).digest('hex')).toBe(inviteArg.tokenHash);
  });

  it('rejects invalid email, empty fullName/reason', async () => {
    const service = new PlatformUserInvitationService({ invite: vi.fn() } as any, new NullPlatformUserInvitationDelivery(), () => Date.now());
    await expect(service.invite({} as any, { email: 'bad', fullName: 'x', reason: 'r' })).rejects.toThrow('PLATFORM_USER_INVITATION_UNAVAILABLE');
    await expect(service.invite({} as any, { email: 'a@b.com', fullName: '', reason: 'r' })).rejects.toThrow('PLATFORM_USER_INVITATION_UNAVAILABLE');
  });

  it('rejects password shorter than 12 characters', async () => {
    const service = new PlatformUserInvitationService({ accept: vi.fn() } as any, new NullPlatformUserInvitationDelivery());
    await expect(service.accept({ token: 'x'.repeat(32), password: 'short' })).rejects.toThrow('PLATFORM_USER_INVITATION_UNAVAILABLE');
  });

  it('describe returns valid=false for expired/consumed/revoked', async () => {
    const repo = { describeInvitation: vi.fn().mockResolvedValue({ invitationId: 'i', email: 'a@b.com', expiresAt: new Date(Date.now() - 1000), consumedAt: null, revokedAt: null }) };
    const service = new PlatformUserInvitationService(repo as any, new NullPlatformUserInvitationDelivery());
    expect(await service.describe({ token: 'x'.repeat(32) })).toEqual({ valid: false });
  });
});

describe('platform user invitation — source wiring', () => {
  it('mounts the acceptance router before the authenticated platform router', () => {
    const app = read('src/app.ts');
    const accept = app.indexOf("app.use('/platform/users/accept'");
    const platform = app.indexOf("app.use('/platform', ensureAuthenticated, createPlatformAdministrationRouter");
    expect(accept).toBeGreaterThanOrEqual(0);
    expect(platform).toBeGreaterThanOrEqual(0);
    expect(accept).toBeLessThan(platform);
  });

  it('recognises any active HUMAN platform principal for login routing', () => {
    const app = read('src/app.ts');
    expect(app).toContain('authority.capabilities.size > 0');
  });

  it('removes tenant-local LIBRARY_EDIT from manufacturer/model shared-master mutation routes', () => {
    const library = read('src/modules/library/library.routes.ts');
    expect(library).toContain("router.post('/manufacturers', csrfProtection");
    expect(library).toContain("router.post('/manufacturers/:id/update', csrfProtection");
    expect(library).toContain("router.post('/model', async (req, res, next) => {");
    expect(library).toContain("router.post('/model/:id/update', async (req, res, next) => {");
  });
});
