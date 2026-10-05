import { afterEach, describe, expect, it, vi } from 'vitest';
import sequelize from '../../config/database.js';
import { LibraryService } from './library.service.js';

afterEach(() => vi.restoreAllMocks());

function allocation(overrides: Record<string, unknown>) {
  return {
    id: String(overrides.id || 'ad-1'),
    ad_number: String(overrides.ad_number || '2024-01-01'),
    target_type: 'MODEL',
    target_id: 'model-180',
    matched_component_model_id: 'model-180',
    matched_manufacturer_id: null,
    allocation_status: 'SUGGESTED',
    classification: 'EXACT_MODEL_CODE',
    ...overrides,
  };
}

describe('model Compliance Data applicability scope', () => {
  it('keeps assigned, model-accepted, exact, manufacturer, and broad scopes separate', async () => {
    vi.spyOn(sequelize, 'query').mockResolvedValue([
      allocation({ id: 'ad-assigned', allocation_status: 'ACCEPTED' }),
      allocation({ id: 'ad-accepted', allocation_status: 'ACCEPTED' }),
      allocation({ id: 'ad-exact' }),
      allocation({
        id: 'ad-manufacturer',
        target_type: 'MANUFACTURER',
        target_id: 'manufacturer-cessna',
        matched_component_model_id: null,
        matched_manufacturer_id: 'manufacturer-cessna',
        allocation_status: 'ACCEPTED',
        classification: 'MANUFACTURER_MATCH',
      }),
      allocation({
        id: 'ad-broad',
        target_type: 'BROAD_RULE',
        target_id: null,
        matched_component_model_id: null,
        matched_manufacturer_id: 'manufacturer-cessna',
        allocation_status: 'ACCEPTED',
        classification: 'BROAD_SERIES',
      }),
      allocation({ id: 'ad-ignored', allocation_status: 'IGNORED' }),
    ] as any);

    const result = await LibraryService.getModelAdApplicabilityScope(
      'model-180',
      'manufacturer-cessna',
      [{ id: 'ad-assigned', ad_number: '2020-01-01' }]
    );

    expect(result.assignedOrAccepted.map((row) => row.id)).toEqual([
      'ad-assigned',
      'ad-accepted',
    ]);
    expect(result.strongModelSuggestions.map((row) => row.id)).toEqual(['ad-exact']);
    expect(result.manufacturerReview.map((row) => row.id)).toEqual(['ad-manufacturer']);
    expect(result.broadReview.map((row) => row.id)).toEqual(['ad-broad']);
    expect(result.assignedOrAccepted.map((row) => row.id)).not.toContain('ad-manufacturer');
    expect(result.assignedOrAccepted.map((row) => row.id)).not.toContain('ad-broad');
    expect(JSON.stringify(result)).not.toContain('ad-ignored');
  });

  it('uses current model and manufacturer IDs and excludes ignored allocations in SQL', async () => {
    const query = vi.spyOn(sequelize, 'query').mockResolvedValue([] as any);

    await LibraryService.getModelAdApplicabilityScope(
      'model-180',
      'manufacturer-cessna',
      []
    );

    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/aaa\.status <> 'IGNORED'[\s\S]*matched_component_model_id = :modelId[\s\S]*matched_manufacturer_id = :manufacturerId/),
      expect.objectContaining({
        replacements: {
          modelId: 'model-180',
          manufacturerId: 'manufacturer-cessna',
        },
      })
    );
  });
});
