import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sequelize } from '../../models/index.js';
import { AuditService } from '../audit/audit.service.js';
import { AircraftService } from './aircraft.service.js';
import { aircraftTenantRepository } from './aircraft-tenant.repository.live.js';
import { aircraftComplianceTestAuthority as authority } from './aircraft-compliance-tenant.test-support.js';

const aircraftId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherAircraftId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const complianceId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const complianceItemId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function mockTransaction() {
  vi.spyOn(sequelize, 'transaction').mockImplementation(async (callback: any) =>
    callback({ transaction: true })
  );
}

function mockAircraft(found = true) {
  vi.spyOn(aircraftTenantRepository, 'getById').mockResolvedValue(found ? ({ id: aircraftId } as any) : undefined);
}

function aircraftComplianceRow(overrides: Record<string, any> = {}) {
  return {
    id: complianceId,
    aircraft_id: aircraftId,
    compliance_item_id: complianceItemId,
    next_due_at: null,
    next_due_hours: null,
    last_complied_at: null,
    last_complied_hours: null,
    compliance_method: null,
    notes: null,
    item_type: 'AD',
    source_type: 'AD',
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('aircraft AD manual due data update', () => {
  it('updates valid manual due data for an AD aircraft_compliance row', async () => {
    mockTransaction();
    mockAircraft();
    vi.spyOn(sequelize, 'query')
      .mockResolvedValueOnce([aircraftComplianceRow()] as any)
      .mockResolvedValueOnce([] as any);
    vi.spyOn(AuditService, 'log').mockResolvedValue({} as any);

    const result = await AircraftService.updateAdOperationalComplianceDueData(authority, {
      aircraftId,
      complianceId,
      actorUserId: 'user-id',
      nextDueAt: '2026-08-01',
      nextDueHours: '125.5',
      lastCompliedAt: '2026-07-01',
      lastCompliedHours: '100',
      complianceMethod: '  manual review  ',
      notes: '  entered from AD text  ',
    });

    expect(result).toMatchObject({
      aircraftComplianceId: complianceId,
      complianceItemId,
      nextDueAt: '2026-08-01',
      nextDueHours: 125.5,
      lastCompliedAt: '2026-07-01',
      lastCompliedHours: 100,
      complianceMethod: 'manual review',
      notes: 'entered from AD text',
    });
    expect(sequelize.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE aircraft_compliance'),
      expect.objectContaining({
        replacements: expect.objectContaining({
          complianceId,
          nextDueAt: '2026-08-01',
          nextDueHours: 125.5,
          lastCompliedAt: '2026-07-01',
          lastCompliedHours: 100,
          complianceMethod: 'manual review',
          notes: 'entered from AD text',
        }),
      })
    );
    expect(AuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        table_name: 'aircraft_compliance',
        row_id: complianceId,
        action: 'AD_COMPLIANCE_DUE_UPDATE',
        actor_id: 'user-id',
        old_values: expect.objectContaining({
          aircraft_id: aircraftId,
          compliance_item_id: complianceItemId,
        }),
        new_values: expect.objectContaining({
          next_due_at: '2026-08-01',
          next_due_hours: 125.5,
        }),
      }),
      expect.any(Object)
    );
  });

  it('clears nullable manual due data when blank values are submitted', async () => {
    mockTransaction();
    mockAircraft();
    vi.spyOn(sequelize, 'query')
      .mockResolvedValueOnce([
        aircraftComplianceRow({
          next_due_at: '2026-08-01',
          next_due_hours: '125.5',
          last_complied_at: '2026-07-01',
          last_complied_hours: '100',
          compliance_method: 'manual review',
          notes: 'entered',
        }),
      ] as any)
      .mockResolvedValueOnce([] as any);
    vi.spyOn(AuditService, 'log').mockResolvedValue({} as any);

    const result = await AircraftService.updateAdOperationalComplianceDueData(authority, {
      aircraftId,
      complianceId,
      nextDueAt: '',
      nextDueHours: '',
      lastCompliedAt: '',
      lastCompliedHours: '',
      complianceMethod: '',
      notes: '',
    });

    expect(result.nextDueAt).toBeNull();
    expect(result.nextDueHours).toBeNull();
    expect(result.lastCompliedAt).toBeNull();
    expect(result.lastCompliedHours).toBeNull();
    expect(result.complianceMethod).toBeNull();
    expect(result.notes).toBeNull();
  });

  it('blocks invalid dates', async () => {
    mockAircraft();
    vi.spyOn(sequelize, 'transaction');

    await expect(
      AircraftService.updateAdOperationalComplianceDueData(authority, {
        aircraftId,
        complianceId,
        nextDueAt: '2026-02-31',
      })
    ).rejects.toThrow('INVALID_NEXT_DUE_AT');

    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  it('blocks negative hour values', async () => {
    mockAircraft();
    vi.spyOn(sequelize, 'transaction');

    await expect(
      AircraftService.updateAdOperationalComplianceDueData(authority, {
        aircraftId,
        complianceId,
        nextDueHours: '-1',
      })
    ).rejects.toThrow('INVALID_NEXT_DUE_HOURS');

    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  it('blocks missing aircraft', async () => {
    mockAircraft(false);
    vi.spyOn(sequelize, 'transaction');

    await expect(
      AircraftService.updateAdOperationalComplianceDueData(authority, {
        aircraftId,
        complianceId,
      })
    ).rejects.toThrow('AIRCRAFT_NOT_FOUND');

    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  it('blocks missing aircraft_compliance rows', async () => {
    mockTransaction();
    mockAircraft();
    vi.spyOn(sequelize, 'query').mockResolvedValueOnce([] as any);

    await expect(
      AircraftService.updateAdOperationalComplianceDueData(authority, {
        aircraftId,
        complianceId,
      })
    ).rejects.toThrow('AIRCRAFT_COMPLIANCE_NOT_FOUND');
  });

  it('makes wrong-aircraft aircraft_compliance rows observationally unavailable', async () => {
    mockTransaction();
    mockAircraft();
    vi.spyOn(sequelize, 'query').mockResolvedValueOnce([] as any);

    await expect(
      AircraftService.updateAdOperationalComplianceDueData(authority, {
        aircraftId,
        complianceId,
      })
    ).rejects.toThrow('AIRCRAFT_COMPLIANCE_NOT_FOUND');
  });

  it('blocks non-AD compliance items', async () => {
    mockTransaction();
    mockAircraft();
    vi.spyOn(sequelize, 'query').mockResolvedValueOnce([
      aircraftComplianceRow({ item_type: 'SB', source_type: 'SB' }),
    ] as any);

    await expect(
      AircraftService.updateAdOperationalComplianceDueData(authority, {
        aircraftId,
        complianceId,
      })
    ).rejects.toThrow('COMPLIANCE_ITEM_NOT_AD');
  });

  it('updates only approved due fields and no due/workpack/task/SB/SID/import logic', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/modules/aircraft/aircraft.service.ts'),
      'utf8'
    );
    const start = source.indexOf('static async updateAdOperationalComplianceDueData');
    const end = source.indexOf('static async markServiceBulletinComplied', start);
    const method = source.slice(start, end);
    const updateStart = method.indexOf('UPDATE aircraft_compliance');
    const updateEnd = method.indexOf('WHERE id = :complianceId', updateStart);
    const updateSql = method.slice(updateStart, updateEnd);

    [
      'next_due_at',
      'next_due_hours',
      'last_complied_at',
      'last_complied_hours',
      'compliance_method',
      'notes',
      'updated_at',
    ].forEach((allowed) => {
      expect(updateSql).toContain(allowed);
    });

    [
      'status',
      'complied_workpack_id',
      'next_due_cycles',
      'last_complied_cycles',
      'recurrence',
      'AMOC',
      'terminating',
      'DueStatus',
      'Workpack',
      'TaskTemplate',
      'AircraftSbCompliance',
      'ServiceBulletin',
      'SupplementalInspectionDocument',
      'import',
    ].forEach((forbidden) => {
      expect(updateSql).not.toContain(forbidden);
      expect(method).not.toContain(forbidden);
    });
  });
});
