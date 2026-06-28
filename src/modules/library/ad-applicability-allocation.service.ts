import { createHash } from 'node:crypto';
import { AdApplicabilityAllocation } from '../../models/index.js';
import type {
  AdApplicabilityAllocationClassification,
  AdApplicabilityAllocationStatus,
  AdApplicabilityAllocationTargetType,
} from '../../models/AdApplicabilityAllocation.js';
import type {
  AdRelevanceBucket,
  AdRelevanceBuckets,
  AdRelevanceMatch,
} from './ad-relevance.service.js';

export type AdApplicabilitySourceKeyInput = {
  bucket: AdRelevanceBucket;
  airworthinessDirectiveId: string;
  targetType: AdApplicabilityAllocationTargetType;
  targetIdentity: string | null;
  classification: AdApplicabilityAllocationClassification;
  sourceHashInput: AdApplicabilitySourceHashInput;
};

export type AdApplicabilitySourceHashInput = {
  adNumber: string | null;
  revision: string | null;
  sourceMake: string | null;
  sourceModel: string | null;
  sourceProductType: string | null;
  sourceProductSubtype: string | null;
  matchedMake: string | null;
  matchedModel: string | null;
  matchedModelField: string | null;
};

export type AdApplicabilityAllocationCandidate = {
  airworthiness_directive_id: string;
  ad_number_snapshot: string;
  ad_revision_snapshot: string | null;
  source_make: string | null;
  source_model: string | null;
  source_product_type: string | null;
  source_product_subtype: string | null;
  source_key: string;
  target_type: AdApplicabilityAllocationTargetType;
  target_id: string | null;
  matched_manufacturer_id: string | null;
  matched_component_model_id: string | null;
  status: AdApplicabilityAllocationStatus;
  classification: AdApplicabilityAllocationClassification;
  match_confidence: number | null;
  match_reason: string | null;
  reviewed_by: null;
  reviewed_at: null;
  review_reason: null;
  created_by: string | null;
  metadata: Record<string, unknown>;
};

export type BuildAdApplicabilityAllocationCandidatesInput = {
  relevance: AdRelevanceBuckets;
  modelId: string;
  manufacturerId?: string | null;
  actorUserId?: string | null;
};

export type PersistSuggestedAdApplicabilityAllocationsInput =
  BuildAdApplicabilityAllocationCandidatesInput;

export type AdApplicabilityAllocationPersistResult = {
  created: number;
  updated: number;
  skippedAccepted: number;
  skippedIgnored: number;
  unchanged: number;
  candidates: AdApplicabilityAllocationCandidate[];
};

function normalizeSourcePart(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function hashPart(value: string, length = 12) {
  return createHash('sha256').update(value).digest('hex').slice(0, length);
}

function sourceHashInputToString(input: AdApplicabilitySourceHashInput) {
  return [
    input.adNumber,
    input.revision,
    input.sourceMake,
    input.sourceModel,
    input.sourceProductType,
    input.sourceProductSubtype,
    input.matchedMake,
    input.matchedModel,
    input.matchedModelField,
  ]
    .map(normalizeSourcePart)
    .join('|');
}

function sourceHashInputForMatch(match: AdRelevanceMatch): AdApplicabilitySourceHashInput {
  return {
    adNumber: match.ad_number,
    revision: match.revision,
    sourceMake: match.make,
    sourceModel: match.model,
    sourceProductType: match.product_type,
    sourceProductSubtype: match.product_subtype ?? null,
    matchedMake: match.matched_make,
    matchedModel: match.matched_model,
    matchedModelField: match.matched_model_field,
  };
}

function broadClassification(match: AdRelevanceMatch): AdApplicabilityAllocationClassification {
  const modelText = normalizeSourcePart(match.model);

  if (/\bSERIES\b/.test(modelText)) {
    return 'BROAD_SERIES';
  }

  if (/\(ALL\)/.test(modelText) || /\bALL\b/.test(modelText)) {
    return 'BROAD_ALL';
  }

  return 'MULTI_MODEL_REVIEW';
}

function candidateFromMatch(
  match: AdRelevanceMatch,
  options: {
    bucket: AdRelevanceBucket;
    modelId: string;
    manufacturerId: string | null;
    actorUserId: string | null;
    targetType: AdApplicabilityAllocationTargetType;
    status: AdApplicabilityAllocationStatus;
    classification: AdApplicabilityAllocationClassification;
  }
): AdApplicabilityAllocationCandidate {
  const targetIdentity =
    options.targetType === 'MODEL'
      ? options.modelId
      : options.targetType === 'MANUFACTURER'
        ? options.manufacturerId
        : [
            options.manufacturerId,
            match.make,
            match.model,
            match.product_type,
            options.classification,
          ]
            .filter(Boolean)
            .join('|') || null;

  const sourceKey = AdApplicabilityAllocationService.generateSourceKey({
    bucket: options.bucket,
    airworthinessDirectiveId: String(match.id),
    targetType: options.targetType,
    targetIdentity,
    classification: options.classification,
    sourceHashInput: sourceHashInputForMatch(match),
  });

  return {
    airworthiness_directive_id: String(match.id),
    ad_number_snapshot: match.ad_number || '',
    ad_revision_snapshot: match.revision || null,
    source_make: match.make || null,
    source_model: match.model || null,
    source_product_type: match.product_type || null,
    source_product_subtype: match.product_subtype || null,
    source_key: sourceKey,
    target_type: options.targetType,
    target_id:
      options.targetType === 'MODEL'
        ? options.modelId
        : options.targetType === 'MANUFACTURER'
          ? options.manufacturerId
          : null,
    matched_manufacturer_id:
      options.targetType === 'MANUFACTURER' || options.targetType === 'BROAD_RULE'
        ? options.manufacturerId
        : null,
    matched_component_model_id: options.targetType === 'MODEL' ? options.modelId : null,
    status: options.status,
    classification: options.classification,
    match_confidence: null,
    match_reason: match.relevance_reason || null,
    reviewed_by: null,
    reviewed_at: null,
    review_reason: null,
    created_by: options.actorUserId,
    metadata: {
      relevance_bucket: options.bucket,
      matched_make: match.matched_make,
      matched_model: match.matched_model,
      matched_model_field: match.matched_model_field,
      product_type_match: match.product_type_match,
    },
  };
}

export class AdApplicabilityAllocationService {
  static generateSourceKey(input: AdApplicabilitySourceKeyInput) {
    const sourceHash = hashPart(sourceHashInputToString(input.sourceHashInput), 12);
    const targetIdentity = hashPart(normalizeSourcePart(input.targetIdentity || 'NONE'), 12);

    return [
      'v1',
      input.bucket,
      input.airworthinessDirectiveId,
      input.targetType,
      targetIdentity,
      input.classification,
      sourceHash,
    ].join(':');
  }

  static buildAllocationCandidatesFromRelevance(
    input: BuildAdApplicabilityAllocationCandidatesInput
  ): AdApplicabilityAllocationCandidate[] {
    const manufacturerId = input.manufacturerId || null;
    const actorUserId = input.actorUserId || null;
    const candidates: AdApplicabilityAllocationCandidate[] = [];

    for (const match of input.relevance.EXACT_MODEL_SUGGESTED || []) {
      candidates.push(
        candidateFromMatch(match, {
          bucket: 'EXACT_MODEL_SUGGESTED',
          modelId: input.modelId,
          manufacturerId,
          actorUserId,
          targetType: 'MODEL',
          status: 'SUGGESTED',
          classification:
            match.matched_model_field === 'model_name'
              ? 'EXACT_MODEL_NAME'
              : 'EXACT_MODEL_CODE',
        })
      );
    }

    if (manufacturerId) {
      for (const match of input.relevance.MANUFACTURER_SUGGESTED || []) {
        candidates.push(
          candidateFromMatch(match, {
            bucket: 'MANUFACTURER_SUGGESTED',
            modelId: input.modelId,
            manufacturerId,
            actorUserId,
            targetType: 'MANUFACTURER',
            status: 'SUGGESTED',
            classification: 'MANUFACTURER_MATCH',
          })
        );
      }
    }

    for (const match of input.relevance.BROAD_REVIEW || []) {
      candidates.push(
        candidateFromMatch(match, {
          bucket: 'BROAD_REVIEW',
          modelId: input.modelId,
          manufacturerId,
          actorUserId,
          targetType: 'BROAD_RULE',
          status: 'NEEDS_REVIEW',
          classification: broadClassification(match),
        })
      );
    }

    return candidates;
  }

  static async getExistingAllocationBySourceKey(
    airworthinessDirectiveId: string,
    sourceKey: string
  ): Promise<AdApplicabilityAllocation | null> {
    return AdApplicabilityAllocation.findOne({
      where: {
        airworthiness_directive_id: airworthinessDirectiveId,
        source_key: sourceKey,
      },
    });
  }

  static async persistSuggestedAllocations(
    input: PersistSuggestedAdApplicabilityAllocationsInput
  ): Promise<AdApplicabilityAllocationPersistResult> {
    const candidates = this.buildAllocationCandidatesFromRelevance(input);
    const result: AdApplicabilityAllocationPersistResult = {
      created: 0,
      updated: 0,
      skippedAccepted: 0,
      skippedIgnored: 0,
      unchanged: 0,
      candidates,
    };

    for (const candidate of candidates) {
      const existing = await this.getExistingAllocationBySourceKey(
        candidate.airworthiness_directive_id,
        candidate.source_key
      );

      if (!existing) {
        await AdApplicabilityAllocation.create(candidate);
        result.created += 1;
        continue;
      }

      if (existing.status === 'ACCEPTED') {
        result.skippedAccepted += 1;
        continue;
      }

      if (existing.status === 'IGNORED') {
        result.skippedIgnored += 1;
        continue;
      }

      if (existing.status !== 'SUGGESTED' && existing.status !== 'NEEDS_REVIEW') {
        result.unchanged += 1;
        continue;
      }

      await existing.update({
        ad_number_snapshot: candidate.ad_number_snapshot,
        ad_revision_snapshot: candidate.ad_revision_snapshot,
        source_make: candidate.source_make,
        source_model: candidate.source_model,
        source_product_type: candidate.source_product_type,
        source_product_subtype: candidate.source_product_subtype,
        target_type: candidate.target_type,
        target_id: candidate.target_id,
        matched_manufacturer_id: candidate.matched_manufacturer_id,
        matched_component_model_id: candidate.matched_component_model_id,
        match_confidence: candidate.match_confidence,
        match_reason: candidate.match_reason,
        metadata: candidate.metadata,
      });
      result.updated += 1;
    }

    return result;
  }
}
