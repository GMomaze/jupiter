import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ComplianceAssignment,
  ComplianceItem,
  sequelize,
} from '../../models/index.js';
import { AircraftService } from './aircraft.service.js';
import { aircraftTenantRepository } from './aircraft-tenant.repository.live.js';
import { aircraftComplianceTestAuthority as authority } from './aircraft-compliance-tenant.test-support.js';

const aircraftId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherAircraftId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const assignmentId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const complianceItemId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const aircraftComplianceId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function mockTransaction() {
  vi.spyOn(sequelize, 'transaction').mockImplementation(async (callback: any) =>
    callback({ transaction: true })
  );
}

function mockAircraft(found = true) {
  vi.spyOn(aircraftTenantRepository, 'getById').mockResolvedValue(found ? ({ id: aircraftId } as any) : undefined);
}

function mockAssignment(overrides: Record<string, any> = {}) {
  vi.spyOn(ComplianceAssignment, 'findOne').mockResolvedValue({
    id: assignmentId,
    compliance_item_id: complianceItemId,
    assignment_type: 'AIRCRAFT',
    aircraft_id: aircraftId,
    is_active: true,
    ComplianceItem: {
      id: complianceItemId,
      item_type: 'AD',
      source_type: 'AD',
    },
    ...overrides,
  } as any);
}

function mockNoExistingAircraftCompliance() {
  vi.spyOn(sequelize, 'query')
    .mockResolvedValueOnce([] as any)
    .mockResolvedValueOnce([{ id: aircraftComplianceId }] as any);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('aircraft AD operational compliance record creation', () => {
  it('creates aircraft_compliance from an active aircraft AD assignment', async () => {
    mockTransaction();
    mockAircraft();
    mockAssignment();
    mockNoExistingAircraftCompliance();

    const result =
      await AircraftService.createAdOperationalComplianceRecordFromAssignment(authority, {
        aircraftId,
        assignmentId,
        actorUserId: 'user-id',
        notes: '  reviewed  ',
      });

    expect(result.created).toBe(true);
    expect(result.aircraftComplianceId).toBe(aircraftComplianceId);
    expect(sequelize.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO aircraft_compliance'),
      expect.objectContaining({
        replacements: expect.objectContaining({
          aircraftId,
          complianceItemId,
          notes: 'reviewed',
        }),
      })
    );
    expect((sequelize.query as any).mock.calls[1][0]).toContain("status,\n          notes");
    expect((sequelize.query as any).mock.calls[1][0]).toContain("'DUE'");
  });

  it('blocks missing aircraft', async () => {
    mockAircraft(false);
    vi.spyOn(ComplianceAssignment, 'findByPk');

    await expect(
      AircraftService.createAdOperationalComplianceRecordFromAssignment(authority, {
        aircraftId,
        assignmentId,
      })
    ).rejects.toThrow('AIRCRAFT_NOT_FOUND');

    expect(ComplianceAssignment.findByPk).not.toHaveBeenCalled();
  });

  it('blocks missing assignment', async () => {
    mockAircraft();
    vi.spyOn(ComplianceAssignment, 'findByPk').mockResolvedValue(null);

    await expect(
      AircraftService.createAdOperationalComplianceRecordFromAssignment(authority, {
        aircraftId,
        assignmentId,
      })
    ).rejects.toThrow('AD_COMPLIANCE_ASSIGNMENT_NOT_FOUND');
  });

  it('blocks inactive assignments', async () => {
    mockAircraft();
    mockAssignment({ is_active: false });

    await expect(
      AircraftService.createAdOperationalComplianceRecordFromAssignment(authority, {
        aircraftId,
        assignmentId,
      })
    ).rejects.toThrow('AD_COMPLIANCE_ASSIGNMENT_INACTIVE');
  });

  it('makes wrong-aircraft assignments observationally unavailable', async () => {
    mockAircraft();
    vi.spyOn(ComplianceAssignment, 'findOne').mockResolvedValue(null);

    await expect(
      AircraftService.createAdOperationalComplianceRecordFromAssignment(authority, {
        aircraftId,
        assignmentId,
      })
    ).rejects.toThrow('AD_COMPLIANCE_ASSIGNMENT_NOT_FOUND');
  });

  it('blocks non-AD compliance items', async () => {
    mockAircraft();
    mockAssignment({
      ComplianceItem: {
        id: complianceItemId,
        item_type: 'SB',
        source_type: 'SB',
      },
    });

    await expect(
      AircraftService.createAdOperationalComplianceRecordFromAssignment(authority, {
        aircraftId,
        assignmentId,
      })
    ).rejects.toThrow('COMPLIANCE_ITEM_NOT_AD');
  });

  it('blocks duplicate aircraft_compliance rows', async () => {
    mockTransaction();
    mockAircraft();
    mockAssignment();
    vi.spyOn(sequelize, 'query').mockResolvedValueOnce([{ id: aircraftComplianceId }] as any);

    await expect(
      AircraftService.createAdOperationalComplianceRecordFromAssignment(authority, {
        aircraftId,
        assignmentId,
      })
    ).rejects.toThrow('AIRCRAFT_COMPLIANCE_ALREADY_EXISTS');
  });

  it('leaves due, completion, and workpack fields unset', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/modules/aircraft/aircraft.service.ts'),
      'utf8'
    );
    const start = source.indexOf(
      'static async createAdOperationalComplianceRecordFromAssignment'
    );
    const end = source.indexOf('static async updateAdOperationalComplianceStatus', start);
    const method = source.slice(start, end);

    expect(method).toContain('INSERT INTO aircraft_compliance');
    expect(method).toContain("'DUE'");
    [
      'last_complied_at',
      'next_due_at',
      'last_complied_hours',
      'next_due_hours',
      'compliance_method',
      'complied_workpack_id',
      'DueStatus',
      'Workpack',
      'TaskTemplate',
      'AircraftSbCompliance',
      'ServiceBulletin',
      'SupplementalInspectionDocument',
      'import',
    ].forEach((forbidden) => {
      expect(method).not.toContain(forbidden);
    });
  });
});
