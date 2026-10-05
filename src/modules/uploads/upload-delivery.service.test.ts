import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { UploadDeliveryRepository } from './upload-delivery.repository.js';
import { canonicalUploadReference, UploadDeliveryService } from './upload-delivery.service.js';

const authority = createTenantQueryAuthority({
  state: 'VALID_ACTIVE_TENANT',
  tenant: { id: 'tenant-a', publicId: 'public-a', code: 'A', displayName: 'A', status: 'ACTIVE' },
  membership: { id: 'membership-a', tenantId: 'tenant-a', userId: 'user-a', status: 'ACTIVE' },
  validatedAt: 1,
});

function harness(options: { authorized?: boolean; referenced?: boolean; symlink?: boolean; regular?: boolean; escaped?: boolean } = {}) {
  const repository = new UploadDeliveryRepository({
    aircraftPhotoReferenceCounts: vi.fn().mockResolvedValue(options.authorized === false ? { total: 1, owned: 0 } : { total: 1, owned: 1 }),
    manufacturerLogoReferenceCount: vi.fn().mockResolvedValue(options.referenced === false ? 0 : 1),
  });
  const roots = { aircraft: path.resolve('safe', 'aircraft'), manufacturers: path.resolve('safe', 'manufacturers') };
  const fileSystem = {
    lstat: vi.fn().mockResolvedValue({ isFile: () => options.regular !== false, isSymbolicLink: () => options.symlink === true }),
    realpath: vi.fn(async (value: string) => options.escaped && value.endsWith('photo.png') ? path.resolve('outside', 'photo.png') : value),
  };
  return { service: new UploadDeliveryService(repository, fileSystem, roots), fileSystem };
}

describe('MT-4C7B upload path authorization', () => {
  it('creates only exact canonical references from safe basenames', () => {
    expect(canonicalUploadReference('aircraft', '123-photo.name.png')).toBe('/uploads/aircraft/123-photo.name.png');
    for (const value of ['', '../x.png', 'a/b.png', 'a\\b.png', '%2e%2e.png', '%252e.png', 'C:x.png', '/x.png', 'x\0.png', 'x\n.png', '.hidden', 'x..png', 'x y.png', 'a'.repeat(256)]) {
      expect(canonicalUploadReference('aircraft', value)).toBeUndefined();
    }
  });

  it('authorizes before returning a regular contained Aircraft file', async () => {
    const { service } = harness();
    await expect(service.aircraftPhoto(authority, 'photo.png')).resolves.toEqual({ absolutePath: path.resolve('safe', 'aircraft', 'photo.png') });
    await expect(harness({ authorized: false }).service.aircraftPhoto(authority, 'photo.png')).resolves.toBeUndefined();
  });

  it('fails closed for symlinks, non-files, escaped realpaths, and missing paths', async () => {
    await expect(harness({ symlink: true }).service.aircraftPhoto(authority, 'photo.png')).resolves.toBeUndefined();
    await expect(harness({ regular: false }).service.aircraftPhoto(authority, 'photo.png')).resolves.toBeUndefined();
    await expect(harness({ escaped: true }).service.aircraftPhoto(authority, 'photo.png')).resolves.toBeUndefined();
    const h = harness();
    h.fileSystem.lstat.mockRejectedValueOnce(new Error('missing'));
    await expect(h.service.aircraftPhoto(authority, 'photo.png')).resolves.toBeUndefined();
  });

  it('uses the same safe-file policy for persisted shared Manufacturer logos', async () => {
    await expect(harness().service.manufacturerLogo('logo.png')).resolves.toEqual({ absolutePath: path.resolve('safe', 'manufacturers', 'logo.png') });
    await expect(harness({ referenced: false }).service.manufacturerLogo('logo.png')).resolves.toBeUndefined();
  });
});
