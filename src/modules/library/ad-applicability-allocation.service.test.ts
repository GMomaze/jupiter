import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AdApplicabilityAllocation,
  ComplianceAssignment,
  ComplianceItem,
} from '../../models/index.js';
import type { AdRelevanceBuckets, AdRelevanceMatch } from './ad-relevance.service.js';
import { AdApplicabilityAllocationService } from './ad-applicability-allocation.service.js';

const modelId = '11111111-1111-4111-8111-111111111111';
const manufacturerId = '22222222-2222-4222-8222-222222222222';
const actorUserId = '33333333-3333-4333-8333-333333333333';

afterEach(() => {
  vi.restoreAllMocks();
});

function emptyBuckets(): AdRelevanceBuckets {
  return {
    ASSIGNED: [],
    EXACT_MODEL_SUGGESTED: [],
    MANUFACTURER_SUGGESTED: [],
    BROAD_REVIEW: [],
    UNMATCHED: [],
  };
}

function match(overrides: Partial<AdRelevanceMatch>): AdRelevanceMatch {
  return {
    id: overrides.id || 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ad_number: overrides.ad_number || '2024-01-01',
    revision: overrides.revision ?? 'R1',
    subject_heading: overrides.subject_heading || 'Test AD',
    status: overrides.status || 'Active',
    effective_date: overrides.effective_date || '2024-01-01',
    make: overrides.make ?? 'Piper Aircraft Inc.',
    model: overrides.model ?? 'PA-28-235',
    product_type: overrides.product_type ?? 'Aircraft',
    product_subtype: overrides.product_subtype ?? null,
    relevance_bucket: overrides.relevance_bucket || 'EXACT_MODEL_SUGGESTED',
    relevance_reason: overrides.relevance_reason || 'Matched for test.',
    matched_make: overrides.matched_make ?? 'Piper Aircraft Inc.',
    matched_model: overrides.matched_model ?? 'PA-28-235',
    matched_model_field: overrides.matched_model_field ?? 'model_code',
    product_type_match: overrides.product_type_match ?? true,
  };
}

function buildCandidates(relevance: AdRelevanceBuckets) {
  return AdApplicabilityAllocationService.buildAllocationCandidatesFromRelevance({
    relevance,
    modelId,
    manufacturerId,
    actorUserId,
  });
}

describe('AD applicability allocation service foundation', () => {
  it('generates deterministic versioned source keys', () => {
    const input = {
      bucket: 'EXACT_MODEL_SUGGESTED' as const,
      airworthinessDirectiveId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      targetType: 'MODEL' as const,
      targetIdentity: modelId,
      classification: 'EXACT_MODEL_CODE' as const,
      sourceHashInput: {
        adNumber: '2024-01-01',
        revision: 'R1',
        sourceMake: 'Piper Aircraft Inc.',
        sourceModel: 'PA-28-235',
        sourceProductType: 'Aircraft',
        sourceProductSubtype: null,
        matchedMake: 'Piper Aircraft Inc.',
        matchedModel: 'PA-28-235',
        matchedModelField: 'model_code',
      },
    };

    const first = AdApplicabilityAllocationService.generateSourceKey(input);
    const second = AdApplicabilityAllocationService.generateSourceKey(input);

    expect(first).toBe(second);
    expect(first).toMatch(
      /^v1:EXACT_MODEL_SUGGESTED:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:MODEL:[a-f0-9]{12}:EXACT_MODEL_CODE:[a-f0-9]{12}$/
    );
    expect(first.length).toBeLessThanOrEqual(128);
  });

  it('maps exact model-code suggestions to MODEL / SUGGESTED / EXACT_MODEL_CODE', () => {
    const relevance = emptyBuckets();
    relevance.EXACT_MODEL_SUGGESTED.push(match({ matched_model_field: 'model_code' }));

    const candidates = buildCandidates(relevance);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      target_type: 'MODEL',
      target_id: modelId,
      matched_component_model_id: modelId,
      status: 'SUGGESTED',
      classification: 'EXACT_MODEL_CODE',
      reviewed_by: null,
      reviewed_at: null,
      review_reason: null,
      created_by: actorUserId,
    });
  });

  it('maps exact model-name suggestions to MODEL / SUGGESTED / EXACT_MODEL_NAME', () => {
    const relevance = emptyBuckets();
    relevance.EXACT_MODEL_SUGGESTED.push(
      match({ matched_model: 'PA-28-235 Pathfinder', matched_model_field: 'model_name' })
    );

    const candidates = buildCandidates(relevance);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.classification).toBe('EXACT_MODEL_NAME');
  });

  it('maps manufacturer suggestions to MANUFACTURER / SUGGESTED / MANUFACTURER_MATCH', () => {
    const relevance = emptyBuckets();
    relevance.MANUFACTURER_SUGGESTED.push(
      match({ relevance_bucket: 'MANUFACTURER_SUGGESTED', model: '' })
    );

    const candidates = buildCandidates(relevance);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      target_type: 'MANUFACTURER',
      target_id: manufacturerId,
      matched_manufacturer_id: manufacturerId,
      status: 'SUGGESTED',
      classification: 'MANUFACTURER_MATCH',
    });
  });

  it('maps broad review suggestions to BROAD_RULE / NEEDS_REVIEW', () => {
    const relevance = emptyBuckets();
    relevance.BROAD_REVIEW.push(
      match({ relevance_bucket: 'BROAD_REVIEW', model: 'PA-28 Series' })
    );

    const candidates = buildCandidates(relevance);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      target_type: 'BROAD_RULE',
      target_id: null,
      matched_manufacturer_id: manufacturerId,
      status: 'NEEDS_REVIEW',
      classification: 'BROAD_SERIES',
    });
  });

  it('does not persist UNMATCHED rows by default', () => {
    const relevance = emptyBuckets();
    relevance.UNMATCHED.push(match({ relevance_bucket: 'UNMATCHED' }));

    expect(buildCandidates(relevance)).toEqual([]);
  });

  it('does not persist ASSIGNED rows as suggestions', () => {
    const relevance = emptyBuckets();
    relevance.ASSIGNED.push(match({ relevance_bucket: 'ASSIGNED' }));

    expect(buildCandidates(relevance)).toEqual([]);
  });

  it('does not overwrite an existing ACCEPTED user decision', async () => {
    const relevance = emptyBuckets();
    relevance.EXACT_MODEL_SUGGESTED.push(match({}));
    const update = vi.fn();
    vi.spyOn(AdApplicabilityAllocation, 'findOne').mockResolvedValue({
      status: 'ACCEPTED',
      update,
    } as any);
    const create = vi.spyOn(AdApplicabilityAllocation, 'create');

    const result = await AdApplicabilityAllocationService.persistSuggestedAllocations({
      relevance,
      modelId,
      manufacturerId,
    });

    expect(result.skippedAccepted).toBe(1);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('does not overwrite an existing IGNORED user decision', async () => {
    const relevance = emptyBuckets();
    relevance.EXACT_MODEL_SUGGESTED.push(match({}));
    const update = vi.fn();
    vi.spyOn(AdApplicabilityAllocation, 'findOne').mockResolvedValue({
      status: 'IGNORED',
      update,
    } as any);
    const create = vi.spyOn(AdApplicabilityAllocation, 'create');

    const result = await AdApplicabilityAllocationService.persistSuggestedAllocations({
      relevance,
      modelId,
      manufacturerId,
    });

    expect(result.skippedIgnored).toBe(1);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('reruns without duplicating allocations', async () => {
    const relevance = emptyBuckets();
    relevance.EXACT_MODEL_SUGGESTED.push(match({}));
    const update = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(AdApplicabilityAllocation, 'findOne')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ status: 'SUGGESTED', update } as any);
    const create = vi
      .spyOn(AdApplicabilityAllocation, 'create')
      .mockResolvedValue({ id: 'created-allocation' } as any);

    const first = await AdApplicabilityAllocationService.persistSuggestedAllocations({
      relevance,
      modelId,
      manufacturerId,
    });
    const second = await AdApplicabilityAllocationService.persistSuggestedAllocations({
      relevance,
      modelId,
      manufacturerId,
    });

    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('does not call compliance creation while persisting allocation suggestions', async () => {
    const relevance = emptyBuckets();
    relevance.EXACT_MODEL_SUGGESTED.push(match({}));
    vi.spyOn(AdApplicabilityAllocation, 'findOne').mockResolvedValue(null);
    vi.spyOn(AdApplicabilityAllocation, 'create').mockResolvedValue({ id: 'allocation' } as any);
    const itemCreate = vi.spyOn(ComplianceItem, 'create');
    const assignmentCreate = vi.spyOn(ComplianceAssignment, 'create');

    await AdApplicabilityAllocationService.persistSuggestedAllocations({
      relevance,
      modelId,
      manufacturerId,
    });

    expect(itemCreate).not.toHaveBeenCalled();
    expect(assignmentCreate).not.toHaveBeenCalled();
  });

  it('accepts a reviewable allocation by updating only review fields', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'allocation', status: 'ACCEPTED' });
    vi.spyOn(AdApplicabilityAllocation, 'findByPk').mockResolvedValue({
      status: 'SUGGESTED',
      update,
    } as any);

    await AdApplicabilityAllocationService.reviewAllocation({
      allocationId: 'allocation',
      status: 'ACCEPTED',
      actorUserId,
      reviewReason: 'Confirmed applicability.',
    });

    expect(update).toHaveBeenCalledTimes(1);
    const payload = update.mock.calls[0]?.[0];
    expect(Object.keys(payload).sort()).toEqual([
      'review_reason',
      'reviewed_at',
      'reviewed_by',
      'status',
    ]);
    expect(payload).toMatchObject({
      status: 'ACCEPTED',
      reviewed_by: actorUserId,
      review_reason: 'Confirmed applicability.',
    });
    expect(payload.reviewed_at).toBeInstanceOf(Date);
  });

  it('ignores a reviewable allocation by updating only review fields', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'allocation', status: 'IGNORED' });
    vi.spyOn(AdApplicabilityAllocation, 'findByPk').mockResolvedValue({
      status: 'NEEDS_REVIEW',
      update,
    } as any);

    await AdApplicabilityAllocationService.reviewAllocation({
      allocationId: 'allocation',
      status: 'IGNORED',
      actorUserId,
      reviewReason: 'False positive.',
    });

    expect(update).toHaveBeenCalledWith({
      status: 'IGNORED',
      reviewed_by: actorUserId,
      reviewed_at: expect.any(Date),
      review_reason: 'False positive.',
    });
  });

  it('does not review already accepted or ignored allocations', async () => {
    const update = vi.fn();
    vi.spyOn(AdApplicabilityAllocation, 'findByPk').mockResolvedValue({
      status: 'ACCEPTED',
      update,
    } as any);

    await expect(
      AdApplicabilityAllocationService.reviewAllocation({
        allocationId: 'allocation',
        status: 'IGNORED',
        actorUserId,
        reviewReason: null,
      })
    ).rejects.toThrow('Only suggested or needs-review allocations can be reviewed.');
    expect(update).not.toHaveBeenCalled();
  });

  it('restores broad ignored allocations to NEEDS_REVIEW using only review fields', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'allocation', status: 'NEEDS_REVIEW' });
    vi.spyOn(AdApplicabilityAllocation, 'findByPk').mockResolvedValue({
      status: 'IGNORED',
      classification: 'BROAD_SERIES',
      update,
    } as any);

    await AdApplicabilityAllocationService.restoreAllocation({
      allocationId: 'allocation',
      actorUserId,
      reviewReason: 'Review again.',
    });

    expect(update).toHaveBeenCalledTimes(1);
    const payload = update.mock.calls[0]?.[0];
    expect(Object.keys(payload).sort()).toEqual([
      'review_reason',
      'reviewed_at',
      'reviewed_by',
      'status',
    ]);
    expect(payload).toMatchObject({
      status: 'NEEDS_REVIEW',
      reviewed_by: actorUserId,
      review_reason: 'Review again.',
    });
    expect(payload.reviewed_at).toBeInstanceOf(Date);
  });

  it('restores non-broad ignored allocations to SUGGESTED', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'allocation', status: 'SUGGESTED' });
    vi.spyOn(AdApplicabilityAllocation, 'findByPk').mockResolvedValue({
      status: 'IGNORED',
      classification: 'EXACT_MODEL_CODE',
      update,
    } as any);

    await AdApplicabilityAllocationService.restoreAllocation({
      allocationId: 'allocation',
      actorUserId,
      reviewReason: null,
    });

    expect(update).toHaveBeenCalledWith({
      status: 'SUGGESTED',
      reviewed_by: actorUserId,
      reviewed_at: expect.any(Date),
      review_reason: null,
    });
  });

  it('does not restore allocations unless they are ignored', async () => {
    const update = vi.fn();
    vi.spyOn(AdApplicabilityAllocation, 'findByPk').mockResolvedValue({
      status: 'SUGGESTED',
      classification: 'EXACT_MODEL_CODE',
      update,
    } as any);

    await expect(
      AdApplicabilityAllocationService.restoreAllocation({
        allocationId: 'allocation',
        actorUserId,
        reviewReason: null,
      })
    ).rejects.toThrow('Only ignored allocations can be restored.');
    expect(update).not.toHaveBeenCalled();
  });

  it('manually links a reviewable allocation to an existing model using only approved fields', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'allocation', status: 'ACCEPTED' });
    vi.spyOn(AdApplicabilityAllocation, 'findByPk').mockResolvedValue({
      status: 'NEEDS_REVIEW',
      update,
    } as any);

    await AdApplicabilityAllocationService.linkAllocationToModel({
      allocationId: 'allocation',
      componentModelId: modelId,
      manufacturerId,
      actorUserId,
      reviewReason: 'Manual model confirmation.',
    });

    expect(update).toHaveBeenCalledTimes(1);
    const payload = update.mock.calls[0]?.[0];
    expect(Object.keys(payload).sort()).toEqual([
      'classification',
      'matched_component_model_id',
      'matched_manufacturer_id',
      'review_reason',
      'reviewed_at',
      'reviewed_by',
      'status',
      'target_id',
      'target_type',
    ]);
    expect(payload).toMatchObject({
      target_type: 'MANUAL_LINK',
      target_id: modelId,
      matched_component_model_id: modelId,
      matched_manufacturer_id: manufacturerId,
      status: 'ACCEPTED',
      classification: 'MANUAL_MODEL_LINK',
      reviewed_by: actorUserId,
      review_reason: 'Manual model confirmation.',
    });
    expect(payload.reviewed_at).toBeInstanceOf(Date);
  });

  it('does not manually link accepted or ignored allocations', async () => {
    const update = vi.fn();
    vi.spyOn(AdApplicabilityAllocation, 'findByPk').mockResolvedValue({
      status: 'ACCEPTED',
      update,
    } as any);

    await expect(
      AdApplicabilityAllocationService.linkAllocationToModel({
        allocationId: 'allocation',
        componentModelId: modelId,
        manufacturerId,
        actorUserId,
        reviewReason: null,
      })
    ).rejects.toThrow('Only suggested or needs-review allocations can be linked to a model.');
    expect(update).not.toHaveBeenCalled();
  });

  it('manually links a reviewable allocation to an existing manufacturer using only approved fields', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'allocation', status: 'ACCEPTED' });
    vi.spyOn(AdApplicabilityAllocation, 'findByPk').mockResolvedValue({
      status: 'SUGGESTED',
      update,
    } as any);

    await AdApplicabilityAllocationService.linkAllocationToManufacturer({
      allocationId: 'allocation',
      manufacturerId,
      actorUserId,
      reviewReason: 'Manual manufacturer confirmation.',
    });

    expect(update).toHaveBeenCalledTimes(1);
    const payload = update.mock.calls[0]?.[0];
    expect(Object.keys(payload).sort()).toEqual([
      'classification',
      'matched_component_model_id',
      'matched_manufacturer_id',
      'review_reason',
      'reviewed_at',
      'reviewed_by',
      'status',
      'target_id',
      'target_type',
    ]);
    expect(payload).toMatchObject({
      target_type: 'MANUAL_LINK',
      target_id: manufacturerId,
      matched_manufacturer_id: manufacturerId,
      matched_component_model_id: null,
      status: 'ACCEPTED',
      classification: 'MANUAL_MANUFACTURER_LINK',
      reviewed_by: actorUserId,
      review_reason: 'Manual manufacturer confirmation.',
    });
    expect(payload.reviewed_at).toBeInstanceOf(Date);
  });

  it('does not manually link manufacturers for accepted or ignored allocations', async () => {
    const update = vi.fn();
    vi.spyOn(AdApplicabilityAllocation, 'findByPk').mockResolvedValue({
      status: 'IGNORED',
      update,
    } as any);

    await expect(
      AdApplicabilityAllocationService.linkAllocationToManufacturer({
        allocationId: 'allocation',
        manufacturerId,
        actorUserId,
        reviewReason: null,
      })
    ).rejects.toThrow('Only suggested or needs-review allocations can be linked to a manufacturer.');
    expect(update).not.toHaveBeenCalled();
  });

  it('does not introduce aircraft, SB, SID, task, workpack, utilisation, due, or RBAC code', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/modules/library/ad-applicability-allocation.service.ts'),
      'utf8'
    );

    [
      'Aircraft',
      'ServiceBulletin',
      'SupplementalInspectionDocument',
      'TaskTemplate',
      'TaskCard',
      'Workpack',
      'Utilisation',
      'ComplianceItem',
      'ComplianceAssignment',
      'requirePermission',
      'rbac',
      'due',
    ].forEach((forbidden) => {
      expect(source).not.toContain(forbidden);
    });
  });
});
