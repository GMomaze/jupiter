import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Op } from 'sequelize';
import { ComponentModel, AdApplicabilityAllocation } from '../../models/index.js';
import { AircraftService } from './aircraft.service.js';
import { aircraftTenantRepository } from './aircraft-tenant.repository.live.js';
import { aircraftComplianceTestAuthority as authority } from './aircraft-compliance-tenant.test-support.js';

const aircraftId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const modelId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const manufacturerId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

afterEach(() => {
  vi.restoreAllMocks();
});

function allocation(overrides: Record<string, any>) {
  const matchedComponentModelId = Object.prototype.hasOwnProperty.call(
    overrides,
    'matched_component_model_id'
  )
    ? overrides.matched_component_model_id
    : modelId;
  const matchedManufacturerId = Object.prototype.hasOwnProperty.call(
    overrides,
    'matched_manufacturer_id'
  )
    ? overrides.matched_manufacturer_id
    : null;

  return {
    id: overrides.id || 'allocation-id',
    ad_number_snapshot: overrides.ad_number_snapshot || '2025-01-01',
    ad_revision_snapshot: overrides.ad_revision_snapshot ?? 'R1',
    target_type: overrides.target_type || 'MODEL',
    matched_component_model_id: matchedComponentModelId,
    matched_manufacturer_id: matchedManufacturerId,
    classification: overrides.classification || 'EXACT_MODEL_CODE',
    reviewed_at: overrides.reviewed_at || new Date('2026-01-02T03:04:05Z'),
    review_reason: overrides.review_reason || 'Accepted for preview.',
    AirworthinessDirective: overrides.AirworthinessDirective || {
      ad_number: overrides.ad_number_snapshot || '2025-01-01',
      revision: overrides.ad_revision_snapshot ?? 'R1',
      subject_heading: overrides.subject || 'Inspection of test article',
      subject: null,
    },
    MatchedManufacturer: overrides.MatchedManufacturer || null,
    MatchedComponentModel: overrides.MatchedComponentModel || {
      id: modelId,
      model_code: 'PA-28-235',
      model_name: 'Pathfinder',
      Manufacturer: {
        id: manufacturerId,
        name: 'Piper',
        code: 'PIPER',
      },
    },
    Reviewer: overrides.Reviewer || {
      full_name: 'Inspector One',
      email: 'inspector@example.test',
    },
  };
}

describe('aircraft AD applicability preview', () => {
  it('queries only ACCEPTED allocation rows for the aircraft model or manufacturer', async () => {
    vi.spyOn(aircraftTenantRepository, 'getById').mockResolvedValue({
      id: aircraftId,
      model_id: modelId,
    } as any);
    vi.spyOn(ComponentModel, 'findByPk').mockResolvedValue({ manufacturer_id: manufacturerId } as any);
    vi.spyOn(AdApplicabilityAllocation, 'findAll').mockResolvedValue([]);

    await AircraftService.getAdApplicabilityPreviewForAircraft(authority, aircraftId);

    expect(AdApplicabilityAllocation.findAll).toHaveBeenCalledTimes(1);
    const query = vi.mocked(AdApplicabilityAllocation.findAll).mock.calls[0]?.[0] as any;
    expect(query.where.status).toBe('ACCEPTED');
    expect(query.where.classification).toEqual({
      [Op.notIn]: ['UNRESOLVED_MAKE', 'UNRESOLVED_MODEL'],
    });
    expect(query.where[Op.or]).toEqual([
      { matched_component_model_id: modelId },
      { matched_manufacturer_id: manufacturerId },
    ]);
  });

  it('maps model, manufacturer, manual model, manual manufacturer, and broad accepted rows', async () => {
    vi.spyOn(aircraftTenantRepository, 'getById').mockResolvedValue({ id: aircraftId, model_id: modelId } as any);
    vi.spyOn(ComponentModel, 'findByPk').mockResolvedValue({ manufacturer_id: manufacturerId } as any);
    vi.spyOn(AdApplicabilityAllocation, 'findAll').mockResolvedValue([
      allocation({ id: 'model', classification: 'EXACT_MODEL_CODE' }),
      allocation({
        id: 'manufacturer',
        target_type: 'MANUFACTURER',
        matched_component_model_id: null,
        matched_manufacturer_id: manufacturerId,
        classification: 'MANUFACTURER_MATCH',
        MatchedComponentModel: null,
        MatchedManufacturer: { id: manufacturerId, name: 'Piper', code: 'PIPER' },
      }),
      allocation({
        id: 'manual-model',
        target_type: 'MANUAL_LINK',
        classification: 'MANUAL_MODEL_LINK',
      }),
      allocation({
        id: 'manual-manufacturer',
        target_type: 'MANUAL_LINK',
        matched_component_model_id: null,
        matched_manufacturer_id: manufacturerId,
        classification: 'MANUAL_MANUFACTURER_LINK',
        MatchedComponentModel: null,
        MatchedManufacturer: { id: manufacturerId, name: 'Piper', code: 'PIPER' },
      }),
      allocation({
        id: 'broad',
        target_type: 'BROAD_RULE',
        matched_component_model_id: null,
        matched_manufacturer_id: manufacturerId,
        classification: 'BROAD_SERIES',
        review_reason: 'Accepted broad series applicability.',
        MatchedComponentModel: null,
        MatchedManufacturer: { id: manufacturerId, name: 'Piper', code: 'PIPER' },
      }),
    ] as any);

    const preview = await AircraftService.getAdApplicabilityPreviewForAircraft(authority, aircraftId);

    expect(preview.map((item) => item.allocation_type)).toEqual([
      'Model allocation',
      'Manufacturer allocation',
      'Manual model link',
      'Manual manufacturer link',
      'Broad rule',
    ]);
    expect(preview[0]?.subject_heading).toBe('Inspection of test article');
    expect(preview[0]?.subject).toBe('Inspection of test article');
    expect(preview[4]?.classification).toBe('BROAD_SERIES');
    expect(preview[4]?.review_reason).toBe('Accepted broad series applicability.');
  });

  it('requires MANUAL_LINK target type before labeling manual link allocations', async () => {
    vi.spyOn(aircraftTenantRepository, 'getById').mockResolvedValue({ id: aircraftId, model_id: modelId } as any);
    vi.spyOn(ComponentModel, 'findByPk').mockResolvedValue({ manufacturer_id: manufacturerId } as any);
    vi.spyOn(AdApplicabilityAllocation, 'findAll').mockResolvedValue([
      allocation({
        id: 'manual-model-classification-with-model-target',
        target_type: 'MODEL',
        classification: 'MANUAL_MODEL_LINK',
      }),
      allocation({
        id: 'manual-manufacturer-classification-with-manufacturer-target',
        target_type: 'MANUFACTURER',
        matched_component_model_id: null,
        matched_manufacturer_id: manufacturerId,
        classification: 'MANUAL_MANUFACTURER_LINK',
        MatchedComponentModel: null,
        MatchedManufacturer: { id: manufacturerId, name: 'Piper', code: 'PIPER' },
      }),
      allocation({
        id: 'manual-model-link',
        target_type: 'MANUAL_LINK',
        classification: 'MANUAL_MODEL_LINK',
      }),
      allocation({
        id: 'manual-manufacturer-link',
        target_type: 'MANUAL_LINK',
        matched_component_model_id: null,
        matched_manufacturer_id: manufacturerId,
        classification: 'MANUAL_MANUFACTURER_LINK',
        MatchedComponentModel: null,
        MatchedManufacturer: { id: manufacturerId, name: 'Piper', code: 'PIPER' },
      }),
    ] as any);

    const preview = await AircraftService.getAdApplicabilityPreviewForAircraft(authority, aircraftId);

    expect(preview.map((item) => item.allocation_type)).toEqual([
      'Model allocation',
      'Manufacturer allocation',
      'Manual model link',
      'Manual manufacturer link',
    ]);
  });

  it('does not return accepted unresolved allocations', async () => {
    vi.spyOn(aircraftTenantRepository, 'getById').mockResolvedValue({ id: aircraftId, model_id: modelId } as any);
    vi.spyOn(ComponentModel, 'findByPk').mockResolvedValue({ manufacturer_id: manufacturerId } as any);
    vi.spyOn(AdApplicabilityAllocation, 'findAll').mockResolvedValue([
      allocation({ id: 'unresolved-make', classification: 'UNRESOLVED_MAKE' }),
      allocation({ id: 'unresolved-model', classification: 'UNRESOLVED_MODEL' }),
      allocation({ id: 'exact-model', classification: 'EXACT_MODEL_CODE' }),
    ] as any);

    const preview = await AircraftService.getAdApplicabilityPreviewForAircraft(authority, aircraftId);

    expect(preview.map((item) => item.classification)).toEqual(['EXACT_MODEL_CODE']);
  });

  it('does not create compliance, aircraft applicability, tasks, workpacks, SB, SID, or due logic', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/modules/aircraft/aircraft.service.ts'),
      'utf8'
    );
    const start = source.indexOf('static async getAdApplicabilityPreviewForAircraft');
    const end = source.indexOf('static async updateServiceBulletinCompliance');
    const method = source.slice(start, end);

    [
      'ComplianceItem',
      'ComplianceAssignment',
      '.create(',
      '.update(',
      '.destroy(',
      'TaskTemplate',
      'Workpack',
      'ServiceBulletin',
      'SupplementalInspectionDocument',
      'DueStatus',
      'AD-to-SB',
    ].forEach((forbidden) => {
      expect(method).not.toContain(forbidden);
    });
  });
});
