import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ComplianceItem } from '../../models/index.js';
import {
  type AdRelevanceContext,
  type AdRelevanceDirective,
  buildAdRelevanceBuckets,
} from './ad-relevance.service.js';

const piperPathfinderContext: AdRelevanceContext = {
  modelId: 'model-pa-28-235',
  modelCode: 'PA-28-235',
  modelName: 'PA-28-235 Pathfinder',
  manufacturerName: 'Piper Aircraft Inc.',
  manufacturerCode: 'PIPER',
  manufacturerAliases: [],
  assetTypeCode: 'AIRCRAFT',
  assetTypeLabel: 'Aircraft',
};

function directive(overrides: Partial<AdRelevanceDirective>): AdRelevanceDirective {
  return {
    id: overrides.id || `ad-${overrides.ad_number || 'test'}`,
    ad_number: overrides.ad_number || '2024-01-01',
    revision: overrides.revision ?? null,
    subject_heading: overrides.subject_heading || 'Test AD',
    status: overrides.status || 'Active',
    effective_date: overrides.effective_date || '2024-01-01',
    make: overrides.make ?? 'Piper Aircraft Inc.',
    model: overrides.model ?? null,
    product_type: overrides.product_type ?? 'Aircraft',
    product_subtype: overrides.product_subtype ?? null,
  };
}

describe('AD read-only relevance matching', () => {
  it('suggests an AD when an FAA model token exactly matches model_code', () => {
    const buckets = buildAdRelevanceBuckets(
      [directive({ ad_number: '2024-01-01R1', model: 'PA-28-235' })],
      piperPathfinderContext
    );

    expect(buckets.EXACT_MODEL_SUGGESTED).toHaveLength(1);
    expect(buckets.EXACT_MODEL_SUGGESTED[0]?.matched_model_field).toBe('model_code');
    expect(buckets.EXACT_MODEL_SUGGESTED[0]?.ad_number).toBe('2024-01-01R1');
  });

  it('suggests an AD when an FAA model token exactly matches model_name', () => {
    const buckets = buildAdRelevanceBuckets(
      [directive({ model: 'PA-28-235 Pathfinder' })],
      piperPathfinderContext
    );

    expect(buckets.EXACT_MODEL_SUGGESTED).toHaveLength(1);
    expect(buckets.EXACT_MODEL_SUGGESTED[0]?.matched_model_field).toBe('model_name');
  });

  it('splits FAA Model only on pipes and finds an exact model token', () => {
    const buckets = buildAdRelevanceBuckets(
      [directive({ model: 'PA-28-140 | PA-28-235 | PA-28R-200' })],
      piperPathfinderContext
    );

    expect(buckets.EXACT_MODEL_SUGGESTED).toHaveLength(1);
    expect(buckets.EXACT_MODEL_SUGGESTED[0]?.matched_model).toBe('PA-28-235');
  });

  it('splits FAA Make on pipes before matching manufacturer', () => {
    const buckets = buildAdRelevanceBuckets(
      [directive({ make: 'Cessna | Piper Aircraft Inc.', model: 'PA-28-235' })],
      piperPathfinderContext
    );

    expect(buckets.EXACT_MODEL_SUGGESTED).toHaveLength(1);
    expect(buckets.EXACT_MODEL_SUGGESTED[0]?.matched_make).toBe('Piper Aircraft Inc.');
  });

  it('classifies matching manufacturer with blank model as manufacturer suggested', () => {
    const buckets = buildAdRelevanceBuckets(
      [directive({ make: 'PIPER', model: '' })],
      piperPathfinderContext
    );

    expect(buckets.MANUFACTURER_SUGGESTED).toHaveLength(1);
    expect(buckets.MANUFACTURER_SUGGESTED[0]?.matched_make).toBe('PIPER');
  });

  it('sends Series, all, and (all) model text to broad review unless exact model matches', () => {
    const buckets = buildAdRelevanceBuckets(
      [
        directive({ id: 'series', model: 'PA-28 Series' }),
        directive({ id: 'all', model: 'all' }),
        directive({ id: 'paren-all', model: '(all)' }),
        directive({ id: 'exact-plus-broad', model: 'PA-28-235 | PA-28 Series (all)' }),
      ],
      piperPathfinderContext
    );

    expect(buckets.BROAD_REVIEW.map((item) => item.id).sort()).toEqual([
      'all',
      'paren-all',
      'series',
    ]);
    expect(buckets.EXACT_MODEL_SUGGESTED.map((item) => item.id)).toEqual(['exact-plus-broad']);
  });

  it('does not split comma-separated FAA Model text into exact suggestions', () => {
    const buckets = buildAdRelevanceBuckets(
      [directive({ model: 'PA-28-140, PA-28-235' })],
      piperPathfinderContext
    );

    expect(buckets.EXACT_MODEL_SUGGESTED).toHaveLength(0);
    expect(buckets.UNMATCHED).toHaveLength(1);
  });

  it('does not suggest a non-matching model as exact', () => {
    const buckets = buildAdRelevanceBuckets(
      [directive({ model: 'PA-28-140' })],
      piperPathfinderContext
    );

    expect(buckets.EXACT_MODEL_SUGGESTED).toHaveLength(0);
    expect(buckets.UNMATCHED).toHaveLength(1);
  });

  it('does not create compliance items while building suggestions', () => {
    const createSpy = vi.spyOn(ComplianceItem, 'create');

    buildAdRelevanceBuckets(
      [directive({ model: 'PA-28-235' })],
      piperPathfinderContext
    );

    expect(createSpy).not.toHaveBeenCalled();
    createSpy.mockRestore();
  });

  it('does not introduce service bulletin relationship logic in the relevance service', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/modules/library/ad-relevance.service.ts'),
      'utf8'
    );

    expect(source).not.toContain('ServiceBulletin');
    expect(source).not.toContain('service_bulletin');
  });
});
