import { QueryTypes } from 'sequelize';
import type { Transaction } from 'sequelize';
import { sequelize } from '../../models/index.js';
import { UploadDeliveryRepository } from './upload-delivery.repository.js';

export const uploadDeliveryRepository = new UploadDeliveryRepository({
  async aircraftPhotoReferenceCounts(tenantId, canonicalReference, transaction: Transaction) {
    const [row] = await sequelize.query<{ total: number; owned: number }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE tenant_id = :tenantId)::int AS owned
       FROM aircraft
       WHERE photo_url = :canonicalReference`,
      {
        replacements: { tenantId, canonicalReference },
        type: QueryTypes.SELECT,
        transaction,
      },
    );
    return { total: Number(row?.total ?? 0), owned: Number(row?.owned ?? 0) };
  },

  async manufacturerLogoReferenceCount(canonicalReference) {
    const [row] = await sequelize.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM manufacturers
       WHERE logo_url = :canonicalReference`,
      {
        replacements: { canonicalReference },
        type: QueryTypes.SELECT,
      },
    );
    return Number(row?.count ?? 0);
  },
});
