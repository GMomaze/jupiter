import { describe, expect, it, vi } from 'vitest';
import sequelize from '../../config/database.js';
import { AirworthinessDirective } from '../../models/AirworthinessDirective.js';
import { ComplianceItem } from '../../models/ComplianceItem.js';
import { ServiceBulletin } from '../../models/ServiceBulletin.js';
import { ComplianceProjectionService } from '../compliance/compliance-projection.service.js';
import { MaintenanceTriggerService } from '../maintenance/maintenance-trigger.service.js';

describe('L2-2D4 dormant-writer closure', () => {
  it('fails the legacy maintenance shared-master entry before any work', async () => {
    await expect(MaintenanceTriggerService.evaluateComponentTBO('aircraft', 0, [], {}, {} as any)).rejects.toThrow('DORMANT_MAINTENANCE_SHARED_WRITER_DISABLED');
  });

  it.each(['projectAdSources', 'projectSbSources', 'projectAdAndSbSources'] as const)('%s fails before projection reads, transactions or writes', async method => {
    const transaction = vi.spyOn(sequelize, 'transaction');
    const adRead = vi.spyOn(AirworthinessDirective, 'findAll');
    const sbRead = vi.spyOn(ServiceBulletin, 'findAll');
    const write = vi.spyOn(ComplianceItem, 'create');
    await expect((ComplianceProjectionService[method] as () => Promise<unknown>)()).rejects.toThrow('DORMANT_COMPLIANCE_PROJECTION_WRITER_DISABLED');
    expect(transaction).not.toHaveBeenCalled(); expect(adRead).not.toHaveBeenCalled(); expect(sbRead).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
