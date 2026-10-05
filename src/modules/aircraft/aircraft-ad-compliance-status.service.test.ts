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
    status: 'DUE',
    notes: null,
    compliance_method: null,
    item_type: 'AD',
    source_type: 'AD',
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('aircraft AD operational compliance status update', () => {
  it('updates a valid AD aircraft_compliance status and writes audit', async () => {
    mockTransaction();
    mockAircraft();
    vi.spyOn(sequelize, 'query')
      .mockResolvedValueOnce([aircraftComplianceRow()] as any)
      .mockResolvedValueOnce([] as any);
    vi.spyOn(AuditService, 'log').mockResolvedValue({} as any);

    const result = await AircraftService.updateAdOperationalComplianceStatus(authority, {
      aircraftId,
      complianceId,
      status: 'IN_PROGRESS',
      actorUserId: 'user-id',
      notes: '  reviewed  ',
      complianceMethod: '  visual inspection  ',
    });

    expect(result.previousStatus).toBe('DUE');
    expect(result.status).toBe('IN_PROGRESS');
    expect(result.notes).toBe('reviewed');
    expect(result.complianceMethod).toBe('visual inspection');
    expect(sequelize.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE aircraft_compliance'),
      expect.objectContaining({
        replacements: expect.objectContaining({
          complianceId,
          status: 'IN_PROGRESS',
          notes: 'reviewed',
          complianceMethod: 'visual inspection',
        }),
      })
    );
    expect(AuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        table_name: 'aircraft_compliance',
        row_id: complianceId,
        action: 'AD_COMPLIANCE_STATUS_UPDATE',
        actor_id: 'user-id',
        old_values: expect.objectContaining({ status: 'DUE' }),
        new_values: expect.objectContaining({ status: 'IN_PROGRESS' }),
      }),
      expect.any(Object)
    );
  });

  it('allows same-status updates as notes or method updates', async () => {
    mockTransaction();
    mockAircraft();
    vi.spyOn(sequelize, 'query')
      .mockResolvedValueOnce([aircraftComplianceRow({ status: 'DUE' })] as any)
      .mockResolvedValueOnce([] as any);
    vi.spyOn(AuditService, 'log').mockResolvedValue({} as any);

    const result = await AircraftService.updateAdOperationalComplianceStatus(authority, {
      aircraftId,
      complianceId,
      status: 'DUE',
      notes: 'same status note',
    });

    expect(result.previousStatus).toBe('DUE');
    expect(result.status).toBe('DUE');
    expect(result.notes).toBe('same status note');
  });

  it('blocks invalid statuses', async () => {
    mockAircraft();
    vi.spyOn(sequelize, 'transaction');

    await expect(
      AircraftService.updateAdOperationalComplianceStatus(authority, {
        aircraftId,
        complianceId,
        status: 'OVERDUE',
      })
    ).rejects.toThrow('INVALID_AD_COMPLIANCE_STATUS');

    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  it('blocks invalid transitions', async () => {
    mockTransaction();
    mockAircraft();
    vi.spyOn(sequelize, 'query').mockResolvedValueOnce([
      aircraftComplianceRow({ status: 'COMPLIANT' }),
    ] as any);

    await expect(
      AircraftService.updateAdOperationalComplianceStatus(authority, {
        aircraftId,
        complianceId,
        status: 'DUE',
      })
    ).rejects.toThrow('INVALID_AD_COMPLIANCE_STATUS_TRANSITION');
  });

  it('blocks missing aircraft', async () => {
    mockAircraft(false);
    vi.spyOn(sequelize, 'transaction');

    await expect(
      AircraftService.updateAdOperationalComplianceStatus(authority, {
        aircraftId,
        complianceId,
        status: 'DUE',
      })
    ).rejects.toThrow('AIRCRAFT_NOT_FOUND');

    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  it('blocks missing aircraft_compliance rows', async () => {
    mockTransaction();
    mockAircraft();
    vi.spyOn(sequelize, 'query').mockResolvedValueOnce([] as any);

    await expect(
      AircraftService.updateAdOperationalComplianceStatus(authority, {
        aircraftId,
        complianceId,
        status: 'DUE',
      })
    ).rejects.toThrow('AIRCRAFT_COMPLIANCE_NOT_FOUND');
  });

  it('makes wrong-aircraft aircraft_compliance rows observationally unavailable', async () => {
    mockTransaction();
    mockAircraft();
    vi.spyOn(sequelize, 'query').mockResolvedValueOnce([] as any);

    await expect(
      AircraftService.updateAdOperationalComplianceStatus(authority, {
        aircraftId,
        complianceId,
        status: 'DUE',
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
      AircraftService.updateAdOperationalComplianceStatus(authority, {
        aircraftId,
        complianceId,
        status: 'IN_PROGRESS',
      })
    ).rejects.toThrow('COMPLIANCE_ITEM_NOT_AD');
  });

  it('does not add due, workpack, task, SB, SID, or import logic', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/modules/aircraft/aircraft.service.ts'),
      'utf8'
    );
    const start = source.indexOf('static async updateAdOperationalComplianceStatus');
    const end = source.indexOf('static async updateAdOperationalComplianceDueData', start);
    const method = source.slice(start, end);

    [
      'next_due_at',
      'next_due_hours',
      'next_due_cycles',
      'last_complied_at',
      'last_complied_hours',
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
