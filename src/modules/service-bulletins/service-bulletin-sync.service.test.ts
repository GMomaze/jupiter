import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceBulletinSyncService } from './service-bulletin-sync.service.js';
import { ServiceBulletinService } from './service-bulletin.service.js';
import { VeryonAdapter } from './adapters/VeryonAdapter.js';
import { ATPAdapter } from './adapters/ATPAdapter.js';
import { PiperPdfAdapter } from './adapters/PiperPdfAdapter.js';
import {
  sequelize,
  ComponentModel,
  ServiceBulletin,
  ServiceBulletinModel,
  ServiceBulletinSyncRun,
} from '../../models/index.js';

describe('Phase 8: Service bulletin sync automation', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it('schedules automatic CRON sync on boot and interval', async () => {
    vi.useFakeTimers();

    process.env.NODE_ENV = 'development';
    process.env.SB_SYNC_CRON_ENABLED = 'true';
    process.env.SB_SYNC_RUN_ON_BOOT = 'true';
    process.env.SB_SYNC_INTERVAL_MINUTES = '1';

    const syncSpy = vi
      .spyOn(ServiceBulletinSyncService, 'syncAll')
      .mockResolvedValue({ synced: 3, created: 2, updated: 1 });

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    ServiceBulletinSyncService.startCronJob();

    expect(syncSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(syncSpy).toHaveBeenNthCalledWith(1, 'CRON');

    await vi.advanceTimersByTimeAsync(60_000);
    expect(syncSpy).toHaveBeenNthCalledWith(2, 'CRON');
  });

  it('runs only the selected import method with its required options', async () => {
    const syncRunUpdate = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(ServiceBulletinSyncRun, 'create').mockResolvedValue({
      update: syncRunUpdate,
    } as any);
    vi.spyOn(ServiceBulletinService, 'getCreateOptions').mockResolvedValue([
      { id: 'model-1', model_name: 'OE-900' },
    ] as any);
    vi.spyOn(VeryonAdapter, 'buildForModels').mockResolvedValue([
      {
        source: 'VERYON',
        source_primary: 'VERYON',
        source_refs: [{ provider: 'VERYON', reference: 'SB-001' }],
        sb_number: 'SB-001',
        title: 'Veryon Bulletin',
        model_id: 'model-1',
        compliance_type: 'MANDATORY',
      },
    ]);
    const atpSpy = vi.spyOn(ATPAdapter, 'buildForModels').mockReturnValue([]);
    vi.spyOn(sequelize, 'transaction').mockImplementation(async (callback: any) =>
      callback({ LOCK: { UPDATE: 'UPDATE' } })
    );
    vi.spyOn(ComponentModel, 'findByPk').mockResolvedValue({
      id: 'model-1',
      manufacturer_id: 'mfr-1',
    } as any);
    vi.spyOn(ServiceBulletin, 'findOne').mockResolvedValue(null);
    vi.spyOn(ServiceBulletin, 'create').mockResolvedValue({ id: 'sb-created' } as any);
    vi.spyOn(ServiceBulletinModel, 'create').mockResolvedValue({} as any);
    vi.spyOn(ServiceBulletinModel, 'findOrCreate').mockResolvedValue([{} as any, true]);

    const result = await ServiceBulletinSyncService.syncAll('MANUAL', {
      method: 'VERYON',
      veryonRootPath: 'C:\\Custom\\SB',
    });

    expect(result).toEqual({
      synced: 1,
      created: 1,
      updated: 0,
      unmatchedModels: [],
    });
    expect(VeryonAdapter.buildForModels).toHaveBeenCalledWith(
      [{ id: 'model-1', model_name: 'OE-900' }],
      { rootPath: 'C:\\Custom\\SB' }
    );
    expect(atpSpy).not.toHaveBeenCalled();
  });

  it('runs the Piper PDF import method with the selected PDF path', async () => {
    const syncRunUpdate = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(ServiceBulletinSyncRun, 'create').mockResolvedValue({
      update: syncRunUpdate,
    } as any);
    vi.spyOn(ServiceBulletinService, 'getCreateOptions').mockResolvedValue([
      { id: 'model-1', model_name: 'PA-28-181 Archer II' },
    ] as any);
    vi.spyOn(PiperPdfAdapter, 'buildForModels').mockResolvedValue([
      {
        source: 'PIPER_PDF',
        source_primary: 'PIPER_PDF',
        source_refs: [{ provider: 'PIPER_PDF', reference: '1005' }],
        sb_number: '1005',
        title: 'Addition of Drain Holes to the Engine Induction Air Inlet Scoops',
        model_id: 'model-1',
        compliance_type: 'MANUAL',
        document_url: 'C:\\GMO\\Projects\\Documents\\Piper SB-Index-12.pdf',
      },
    ]);
    vi.spyOn(VeryonAdapter, 'buildForModels').mockResolvedValue([]);
    vi.spyOn(ATPAdapter, 'buildForModels').mockReturnValue([]);
    vi.spyOn(sequelize, 'transaction').mockImplementation(async (callback: any) =>
      callback({ LOCK: { UPDATE: 'UPDATE' } })
    );
    vi.spyOn(ComponentModel, 'findByPk').mockResolvedValue({
      id: 'model-1',
      manufacturer_id: 'mfr-1',
    } as any);
    vi.spyOn(ServiceBulletin, 'findOne').mockResolvedValue(null);
    vi.spyOn(ServiceBulletin, 'create').mockResolvedValue({ id: 'sb-created' } as any);
    vi.spyOn(ServiceBulletinModel, 'create').mockResolvedValue({} as any);
    vi.spyOn(ServiceBulletinModel, 'findOrCreate').mockResolvedValue([{} as any, true]);

    const result = await ServiceBulletinSyncService.syncAll('MANUAL', {
      method: 'PIPER_PDF',
      piperPdfPath: 'C:\\GMO\\Projects\\Documents\\Piper SB-Index-12.pdf',
    });

    expect(result).toEqual({
      synced: 1,
      created: 1,
      updated: 0,
      unmatchedModels: [],
    });
    expect(PiperPdfAdapter.buildForModels).toHaveBeenCalledWith(
      [{ id: 'model-1', model_name: 'PA-28-181 Archer II' }],
      { pdfPath: 'C:\\GMO\\Projects\\Documents\\Piper SB-Index-12.pdf' }
    );
  });
});
