import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AdApplicabilityAllocation,
  AirworthinessDirective,
  Aircraft,
  ComplianceAssignment,
  ComplianceItem,
  sequelize,
} from '../../models/index.js';
import { AircraftService } from './aircraft.service.js';

const aircraftId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const allocationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const directiveId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const complianceItemId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const assignmentId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const directive = {
  id: directiveId,
  ad_number: '2026-01-01',
  revision: 'R1',
  subject_heading: 'Inspect elevator control',
  subject: 'Elevator inspection',
  summary: 'Inspection summary',
  authority: 'FAA',
  effective_date: '2026-02-01',
};

function mockTransaction() {
  vi.spyOn(sequelize, 'transaction').mockImplementation(async (callback: any) =>
    callback({ transaction: true })
  );
}

function mockAircraft() {
  vi.spyOn(Aircraft, 'findByPk').mockResolvedValue({
    id: aircraftId,
    model_id: 'model-id',
    ComponentModel: {
      manufacturer_id: 'manufacturer-id',
    },
  } as any);
}

function mockAcceptedAllocation(overrides: Record<string, any> = {}) {
  vi.spyOn(AdApplicabilityAllocation, 'findByPk').mockResolvedValue({
    id: allocationId,
    status: 'ACCEPTED',
    airworthiness_directive_id: directiveId,
    AirworthinessDirective: directive,
    ...overrides,
  } as any);
}

function mockApplicablePreview(items: Array<Record<string, any>> = [{ id: allocationId }]) {
  vi.spyOn(AircraftService, 'getAdApplicabilityPreviewForAircraft').mockResolvedValue(
    items as any
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('aircraft AD compliance assignment creation', () => {
  it('creates a missing AD ComplianceItem and aircraft ComplianceAssignment', async () => {
    mockTransaction();
    mockAircraft();
    mockAcceptedAllocation();
    mockApplicablePreview();
    vi.spyOn(ComplianceItem, 'findOne').mockResolvedValue(null);
    vi.spyOn(ComplianceItem, 'create').mockResolvedValue({ id: complianceItemId } as any);
    vi.spyOn(ComplianceAssignment, 'findOne').mockResolvedValue(null);
    vi.spyOn(ComplianceAssignment, 'create').mockResolvedValue({ id: assignmentId } as any);

    const result =
      await AircraftService.createAdComplianceAssignmentFromAcceptedAllocation({
        aircraftId,
        allocationId,
        actorUserId: 'user-id',
      });

    expect(result.createdComplianceItem).toBe(true);
    expect(result.createdAssignment).toBe(true);
    expect(ComplianceItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        item_type: 'AD',
        source_type: 'AD',
        source_id: directiveId,
        code: '2026-01-01',
        title: 'Inspect elevator control',
        revision: 'R1',
        effective_on: '2026-02-01',
        source_table: 'airworthiness_directives',
        compliance_basis: 'MANDATORY',
        status: 'ACTIVE',
      }),
      expect.any(Object)
    );
    expect(ComplianceAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        compliance_item_id: complianceItemId,
        assignment_type: 'AIRCRAFT',
        aircraft_id: aircraftId,
        model_id: null,
        assignment_source: 'MANUAL',
        is_active: true,
      }),
      expect.any(Object)
    );
  });

  it('treats an existing active aircraft assignment as idempotent', async () => {
    mockTransaction();
    mockAircraft();
    mockAcceptedAllocation();
    mockApplicablePreview();
    vi.spyOn(ComplianceItem, 'findOne').mockResolvedValue({ id: complianceItemId } as any);
    vi.spyOn(ComplianceItem, 'create');
    vi.spyOn(ComplianceAssignment, 'findOne').mockResolvedValue({
      id: assignmentId,
      is_active: true,
      update: vi.fn(),
    } as any);
    vi.spyOn(ComplianceAssignment, 'create');

    const result =
      await AircraftService.createAdComplianceAssignmentFromAcceptedAllocation({
        aircraftId,
        allocationId,
      });

    expect(result.alreadyAssigned).toBe(true);
    expect(ComplianceItem.create).not.toHaveBeenCalled();
    expect(ComplianceAssignment.create).not.toHaveBeenCalled();
  });

  it('reactivates an inactive aircraft assignment', async () => {
    mockTransaction();
    mockAircraft();
    mockAcceptedAllocation();
    mockApplicablePreview();
    const update = vi.fn();
    vi.spyOn(ComplianceItem, 'findOne').mockResolvedValue({ id: complianceItemId } as any);
    vi.spyOn(ComplianceAssignment, 'findOne').mockResolvedValue({
      id: assignmentId,
      is_active: false,
      update,
    } as any);

    const result =
      await AircraftService.createAdComplianceAssignmentFromAcceptedAllocation({
        aircraftId,
        allocationId,
      });

    expect(result.reactivatedAssignment).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        assignment_type: 'AIRCRAFT',
        aircraft_id: aircraftId,
        model_id: null,
        assignment_source: 'MANUAL',
        is_active: true,
      }),
      expect.any(Object)
    );
  });

  it.each(['SUGGESTED', 'NEEDS_REVIEW', 'IGNORED'])(
    'blocks %s allocations',
    async (status) => {
      mockAircraft();
      mockAcceptedAllocation({ status });
      mockApplicablePreview();

      await expect(
        AircraftService.createAdComplianceAssignmentFromAcceptedAllocation({
          aircraftId,
          allocationId,
        })
      ).rejects.toThrow('AD_ALLOCATION_NOT_ACCEPTED');
    }
  );

  it('blocks accepted allocations that do not apply to this aircraft', async () => {
    mockAircraft();
    mockAcceptedAllocation();
    mockApplicablePreview([]);

    await expect(
      AircraftService.createAdComplianceAssignmentFromAcceptedAllocation({
        aircraftId,
        allocationId,
      })
    ).rejects.toThrow('AD_ALLOCATION_NOT_APPLICABLE_TO_AIRCRAFT');
  });

  it('blocks accepted allocations with a missing AD source', async () => {
    mockAircraft();
    mockAcceptedAllocation({ AirworthinessDirective: null });
    mockApplicablePreview();
    vi.spyOn(AirworthinessDirective, 'findByPk').mockResolvedValue(null);

    await expect(
      AircraftService.createAdComplianceAssignmentFromAcceptedAllocation({
        aircraftId,
        allocationId,
      })
    ).rejects.toThrow('AIRWORTHINESS_DIRECTIVE_NOT_FOUND');
  });

  it('does not create aircraft_compliance, due, workpack, task, SB, SID, or import side effects', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/modules/aircraft/aircraft.service.ts'),
      'utf8'
    );
    const start = source.indexOf(
      'static async createAdComplianceAssignmentFromAcceptedAllocation'
    );
    const end = source.indexOf('static async markServiceBulletinComplied', start);
    const method = source.slice(start, end);

    [
      'aircraft_compliance',
      'next_due',
      'DueStatus',
      'Workpack',
      'TaskTemplate',
      'AircraftSbCompliance.create',
      'ServiceBulletin',
      'SupplementalInspectionDocument',
      'import',
    ].forEach((forbidden) => {
      expect(method).not.toContain(forbidden);
    });
  });
});
