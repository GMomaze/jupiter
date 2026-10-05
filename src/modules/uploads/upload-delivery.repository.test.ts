import { describe, expect, it, vi } from 'vitest';
import { createTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { UploadDeliveryRepository } from './upload-delivery.repository.js';

const authority = createTenantQueryAuthority({
  state: 'VALID_ACTIVE_TENANT',
  tenant: { id: 'tenant-a', publicId: 'public-a', code: 'A', displayName: 'A', status: 'ACTIVE' },
  membership: { id: 'membership-a', tenantId: 'tenant-a', userId: 'user-a', status: 'ACTIVE' },
  validatedAt: 1,
});

describe('MT-4C7B upload delivery repository', () => {
  it('requires authentic authority and exactly one owned Aircraft reference', async () => {
    for (const counts of [{ total: 0, owned: 0 }, { total: 1, owned: 0 }, { total: 2, owned: 1 }, { total: 2, owned: 2 }]) {
      const repository = new UploadDeliveryRepository({
        aircraftPhotoReferenceCounts: vi.fn().mockResolvedValue(counts),
        manufacturerLogoReferenceCount: vi.fn(),
      });
      await expect(repository.authorizeAircraftPhoto(authority, '/uploads/aircraft/a.png')).resolves.toBe(false);
    }
    const port = {
      aircraftPhotoReferenceCounts: vi.fn().mockResolvedValue({ total: 1, owned: 1 }),
      manufacturerLogoReferenceCount: vi.fn(),
    };
    const repository = new UploadDeliveryRepository(port);
    await expect(repository.authorizeAircraftPhoto(authority, '/uploads/aircraft/a.png')).resolves.toBe(true);
    expect(port.aircraftPhotoReferenceCounts).toHaveBeenCalledWith('tenant-a', '/uploads/aircraft/a.png');
    await expect(repository.authorizeAircraftPhoto({ tenantId: 'tenant-a' } as never, '/uploads/aircraft/a.png'))
      .rejects.toThrow('TENANT_AUTHORITY_REQUIRED');
  });

  it('requires a persisted shared Manufacturer reference', async () => {
    const repository = new UploadDeliveryRepository({
      aircraftPhotoReferenceCounts: vi.fn(),
      manufacturerLogoReferenceCount: vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(2),
    });
    await expect(repository.manufacturerLogoReferenceExists('/uploads/manufacturers/a.png')).resolves.toBe(false);
    await expect(repository.manufacturerLogoReferenceExists('/uploads/manufacturers/a.png')).resolves.toBe(true);
  });
});
