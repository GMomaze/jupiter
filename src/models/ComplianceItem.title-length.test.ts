import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import sequelize from '../config/database.js';
import { ComplianceItem } from './ComplianceItem.js';

describe('ComplianceItem title length', () => {
  it('saves titles longer than 255 characters without truncation', async () => {
    const longTitle = `FAA AD long title ${'Piper PA-28 applicability '.repeat(12)}`;
    expect(longTitle.length).toBeGreaterThan(255);

    const transaction = await sequelize.transaction();

    try {
      const item = await ComplianceItem.create(
        {
          item_type: 'AD',
          code: `LONG-${randomUUID().slice(0, 8).toUpperCase()}`,
          title: longTitle,
          source_type: 'AD',
          source_id: randomUUID(),
          source_table: 'airworthiness_directives',
          compliance_basis: 'MANDATORY',
          status: 'ACTIVE',
        },
        { transaction }
      );

      const reloaded = await ComplianceItem.findByPk(item.id, { transaction });

      expect(reloaded?.title).toBe(longTitle);
      expect(reloaded?.title.length).toBe(longTitle.length);
    } finally {
      await transaction.rollback();
    }
  });
});
