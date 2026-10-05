import {
  assertTenantQueryAuthority,
  type TenantQueryAuthority,
} from '../tenancy/tenant-query-authority.js';
import { withTenantTransaction } from '../tenancy/tenant-transaction.js';
import type { Transaction } from 'sequelize';

export interface UploadDeliveryAuthorityPort {
  aircraftPhotoReferenceCounts(
    tenantId: string,
    canonicalReference: string,
    transaction: Transaction,
  ): Promise<{ readonly total: number; readonly owned: number }>;
  manufacturerLogoReferenceCount(canonicalReference: string): Promise<number>;
}

export class UploadDeliveryRepository {
  constructor(private readonly port: UploadDeliveryAuthorityPort) {}

  async authorizeAircraftPhoto(
    authority: TenantQueryAuthority,
    canonicalReference: string,
  ): Promise<boolean> {
    assertTenantQueryAuthority(authority);
    const counts = await withTenantTransaction(authority, (transaction) =>
      this.port.aircraftPhotoReferenceCounts(authority.tenantId, canonicalReference, transaction),
    );
    return counts.total === 1 && counts.owned === 1;
  }

  async manufacturerLogoReferenceExists(canonicalReference: string): Promise<boolean> {
    return (await this.port.manufacturerLogoReferenceCount(canonicalReference)) > 0;
  }
}
