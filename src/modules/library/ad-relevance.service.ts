import {
  AirworthinessDirective,
  AssetType,
  ComponentModel,
  Manufacturer,
} from '../../models/index.js';

export type AdRelevanceBucket =
  | 'ASSIGNED'
  | 'EXACT_MODEL_SUGGESTED'
  | 'MANUFACTURER_SUGGESTED'
  | 'BROAD_REVIEW'
  | 'UNMATCHED';

export type AdRelevanceDirective = {
  id: string;
  ad_number: string | null;
  revision: string | null;
  subject_heading: string | null;
  status: string | null;
  effective_date: string | null;
  make: string | null;
  model: string | null;
  product_type: string | null;
  product_subtype?: string | null;
};

export type AdRelevanceMatch = AdRelevanceDirective & {
  relevance_bucket: AdRelevanceBucket;
  relevance_reason: string;
  matched_make: string | null;
  matched_model: string | null;
  matched_model_field: 'model_code' | 'model_name' | null;
  product_type_match: boolean | null;
};

export type AdRelevanceContext = {
  modelId: string;
  modelCode: string | null;
  modelName: string | null;
  manufacturerName: string | null;
  manufacturerCode: string | null;
  manufacturerAliases?: string[];
  assetTypeCode: string | null;
  assetTypeLabel: string | null;
};

export type AdRelevanceBuckets = {
  ASSIGNED: AdRelevanceMatch[];
  EXACT_MODEL_SUGGESTED: AdRelevanceMatch[];
  MANUFACTURER_SUGGESTED: AdRelevanceMatch[];
  BROAD_REVIEW: AdRelevanceMatch[];
  UNMATCHED: AdRelevanceMatch[];
};

const EMPTY_BUCKETS = (): AdRelevanceBuckets => ({
  ASSIGNED: [],
  EXACT_MODEL_SUGGESTED: [],
  MANUFACTURER_SUGGESTED: [],
  BROAD_REVIEW: [],
  UNMATCHED: [],
});

function normalizeForMatch(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function normalizeCompact(value: unknown) {
  return normalizeForMatch(value).replace(/[^A-Z0-9]+/g, '');
}

function splitPipeTokens(value: unknown) {
  return String(value ?? '')
    .split('|')
    .map((token) => token.trim())
    .filter(Boolean);
}

function isBroadModelToken(token: string) {
  const normalized = normalizeForMatch(token);
  return (
    /\bSERIES\b/.test(normalized) ||
    /\(ALL\)/.test(normalized) ||
    /\bALL\b/.test(normalized) ||
    /\bALL MODELS\b/.test(normalized) ||
    /\bALL PRODUCTS\b/.test(normalized)
  );
}

function isManufacturerWideToken(token: string) {
  const normalized = normalizeForMatch(token);
  return !normalized || normalized === 'N/A';
}

function modelTokenMatches(token: string, target: string | null) {
  if (!target) {
    return false;
  }

  return normalizeCompact(token) === normalizeCompact(target);
}

function manufacturerTokenMatches(token: string, context: AdRelevanceContext) {
  const candidate = normalizeCompact(token);
  if (!candidate) {
    return false;
  }

  const manufacturerValues = [
    context.manufacturerName,
    context.manufacturerCode,
    ...(context.manufacturerAliases || []),
  ]
    .map(normalizeCompact)
    .filter(Boolean);

  return manufacturerValues.includes(candidate);
}

function productTypeMatchesContext(value: unknown, context: AdRelevanceContext) {
  const productTokens = splitPipeTokens(value).map(normalizeCompact).filter(Boolean);
  if (!productTokens.length) {
    return null;
  }

  const assetText = normalizeCompact(
    [context.assetTypeCode, context.assetTypeLabel].filter(Boolean).join(' ')
  );
  if (!assetText) {
    return null;
  }

  const assetProductHints = [
    ['AIRCRAFT', ['AIRCRAFT', 'AIRFRAME', 'AIRPLANE', 'AEROPLANE']],
    ['ENGINE', ['ENGINE', 'POWERPLANT']],
    ['PROPELLER', ['PROPELLER', 'PROP']],
    ['APPLIANCE', ['APPLIANCE', 'EQUIPMENT', 'AVIONICS', 'COMPONENT']],
  ] as const;

  const safeProductTypes = new Set<string>();
  for (const [productType, hints] of assetProductHints) {
    if (hints.some((hint) => assetText.includes(hint))) {
      safeProductTypes.add(productType);
    }
  }

  if (!safeProductTypes.size) {
    return null;
  }

  return productTokens.some((token) => safeProductTypes.has(token));
}

function toMatch(
  directive: AdRelevanceDirective,
  bucket: AdRelevanceBucket,
  reason: string,
  details: {
    matchedMake?: string | null;
    matchedModel?: string | null;
    matchedModelField?: 'model_code' | 'model_name' | null;
    productTypeMatch?: boolean | null;
  } = {}
): AdRelevanceMatch {
  return {
    ...directive,
    relevance_bucket: bucket,
    relevance_reason: reason,
    matched_make: details.matchedMake ?? null,
    matched_model: details.matchedModel ?? null,
    matched_model_field: details.matchedModelField ?? null,
    product_type_match: details.productTypeMatch ?? null,
  };
}

export function classifyAirworthinessDirectiveForModel(
  directive: AdRelevanceDirective,
  context: AdRelevanceContext,
  assignedIds: Set<string> = new Set()
): AdRelevanceMatch {
  const productTypeMatch = productTypeMatchesContext(directive.product_type, context);
  const makeTokens = splitPipeTokens(directive.make);
  const matchedMake = makeTokens.find((token) => manufacturerTokenMatches(token, context)) || null;

  if (assignedIds.has(String(directive.id))) {
    return toMatch(
      directive,
      'ASSIGNED',
      'AD is already assigned to this model through existing compliance assignment authority.',
      { matchedMake, productTypeMatch }
    );
  }

  const modelTokens = splitPipeTokens(directive.model);
  const makeAllowsExactMatch = !makeTokens.length || Boolean(matchedMake);
  for (const token of modelTokens) {
    if (makeAllowsExactMatch && modelTokenMatches(token, context.modelCode)) {
      return toMatch(
        directive,
        'EXACT_MODEL_SUGGESTED',
        'FAA Model token exactly matches the component model code.',
        {
          matchedMake,
          matchedModel: token,
          matchedModelField: 'model_code',
          productTypeMatch,
        }
      );
    }

    if (makeAllowsExactMatch && modelTokenMatches(token, context.modelName)) {
      return toMatch(
        directive,
        'EXACT_MODEL_SUGGESTED',
        'FAA Model token exactly matches the component model name.',
        {
          matchedMake,
          matchedModel: token,
          matchedModelField: 'model_name',
          productTypeMatch,
        }
      );
    }
  }

  if (!matchedMake) {
    return toMatch(
      directive,
      'UNMATCHED',
      'FAA Make does not match the component model manufacturer.',
      { productTypeMatch }
    );
  }

  if (!modelTokens.length || modelTokens.every(isManufacturerWideToken)) {
    return toMatch(
      directive,
      'MANUFACTURER_SUGGESTED',
      'FAA Make matches the manufacturer and the FAA Model field is manufacturer-wide.',
      {
        matchedMake,
        productTypeMatch,
      }
    );
  }

  if (modelTokens.some(isBroadModelToken)) {
    return toMatch(
      directive,
      'BROAD_REVIEW',
      'FAA Make matches, but FAA Model text is broad and requires review.',
      {
        matchedMake,
        matchedModel: modelTokens.find(isBroadModelToken) || null,
        productTypeMatch,
      }
    );
  }

  if (modelTokens.length > 1) {
    return toMatch(
      directive,
      'BROAD_REVIEW',
      'FAA Make matches, but multiple FAA Model tokens do not exactly match this model.',
      {
        matchedMake,
        productTypeMatch,
      }
    );
  }

  return toMatch(
    directive,
    'UNMATCHED',
    'FAA Make matches, but FAA Model does not exactly match and is not broad.',
    {
      matchedMake,
      productTypeMatch,
    }
  );
}

export function buildAdRelevanceBuckets(
  directives: AdRelevanceDirective[],
  context: AdRelevanceContext,
  assignedDirectives: AdRelevanceDirective[] = []
) {
  const assignedIds = new Set(assignedDirectives.map((directive) => String(directive.id)));
  const buckets = EMPTY_BUCKETS();

  for (const directive of directives) {
    const match = classifyAirworthinessDirectiveForModel(directive, context, assignedIds);
    buckets[match.relevance_bucket].push(match);
  }

  for (const assignedDirective of assignedDirectives) {
    if (!buckets.ASSIGNED.some((directive) => String(directive.id) === String(assignedDirective.id))) {
      buckets.ASSIGNED.push(
        classifyAirworthinessDirectiveForModel(assignedDirective, context, assignedIds)
      );
    }
  }

  return buckets;
}

function modelToContext(model: ComponentModel): AdRelevanceContext {
  return {
    modelId: String(model.id || ''),
    modelCode: model.model_code || null,
    modelName: model.model_name || null,
    manufacturerName: model.Manufacturer?.name || null,
    manufacturerCode: model.Manufacturer?.code || null,
    manufacturerAliases: [],
    assetTypeCode: model.AssetType?.code || null,
    assetTypeLabel: model.AssetType?.label || null,
  };
}

export class AdRelevanceService {
  static async getReadOnlyRelevanceForModel(
    modelId: string,
    assignedDirectives: AdRelevanceDirective[] = []
  ) {
    const model = await ComponentModel.findByPk(modelId, {
      attributes: ['id', 'model_name', 'model_code'],
      include: [
        {
          model: Manufacturer,
          attributes: ['id', 'name', 'code'],
          required: false,
        },
        {
          model: AssetType,
          attributes: ['id', 'code', 'label'],
          required: false,
        },
      ],
    });

    if (!model) {
      return EMPTY_BUCKETS();
    }

    const directives = (await AirworthinessDirective.findAll({
      attributes: [
        'id',
        'ad_number',
        'revision',
        'subject_heading',
        'status',
        'effective_date',
        'make',
        'model',
        'product_type',
        'product_subtype',
      ],
      where: {
        is_active: true,
      },
      order: [['ad_number', 'ASC'], ['revision', 'ASC']],
      raw: true,
    })) as unknown as AdRelevanceDirective[];

    return buildAdRelevanceBuckets(directives, modelToContext(model), assignedDirectives);
  }
}
