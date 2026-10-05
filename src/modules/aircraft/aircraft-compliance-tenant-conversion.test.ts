import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const service = readFileSync(resolve('src/modules/aircraft/aircraft.service.ts'), 'utf8');
const controller = readFileSync(resolve('src/modules/aircraft/aircraft.controller.ts'), 'utf8');

const operations = [
  'getServiceBulletinsForAircraft',
  'getApplicableStandardTasksForAircraft',
  'getAdApplicabilityPreviewForAircraft',
  'createAdComplianceAssignmentFromAcceptedAllocation',
  'createAdOperationalComplianceRecordFromAssignment',
  'updateAdOperationalComplianceStatus',
  'updateAdOperationalComplianceDueData',
] as const;

function operationBlock(name: string, next?: string) {
  const start = service.indexOf(`static async ${name}`);
  const end = next ? service.indexOf(`static async ${next}`, start) : service.length;
  expect(start).toBeGreaterThan(-1);
  return service.slice(start, end);
}

describe('MT-4C3B6.3 aircraft compliance tenant conversion', () => {
  operations.forEach((name, index) => {
    it(`${name} requires authentic authority and an owned Aircraft root`, () => {
      const block = operationBlock(name, operations[index + 1]);
      expect(block).toContain('authority: TenantQueryAuthority');
      expect(block).toContain('assertTenantQueryAuthority(authority)');
      expect(block).toContain('this.tenantRepository.getById(authority,');
      expect(block).not.toContain('Aircraft.findByPk');
    });
  });

  it('scopes compliance children and propagates controller authority', () => {
    expect(service).toContain('where: { id: params.assignmentId, aircraft_id: params.aircraftId }');
    expect(service.match(/AND ac\.aircraft_id = :aircraftId/g)?.length).toBeGreaterThanOrEqual(2);
    expect(service.match(/AND aircraft_id = :aircraftId/g)).toHaveLength(2);
    for (const name of operations) {
      expect(controller).toMatch(new RegExp(`AircraftService\\.${name}\\([\\s\\S]{0,80}authority`));
    }
  });
});
