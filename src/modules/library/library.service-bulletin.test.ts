import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ComponentModel,
  ServiceBulletin,
  ServiceBulletinModel,
} from '../../models/index.js';
import { LibraryService } from './library.service.js';

describe('LibraryService service bulletin creation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockModel(manufacturer: { code?: string | null; name?: string | null } = {}) {
    vi.spyOn(ComponentModel, 'findByPk').mockResolvedValue({
      id: 'model-1',
      manufacturer_id: 'manufacturer-1',
      Manufacturer: manufacturer,
    } as any);
  }

  it('writes the selected component model manufacturer on create', async () => {
    mockModel({ code: 'BENDIX', name: 'Bendix' });
    vi.spyOn(ServiceBulletin, 'findOne').mockResolvedValue(null);
    const createSpy = vi.spyOn(ServiceBulletin, 'create').mockResolvedValue({
      id: 'sb-1',
    } as any);
    vi.spyOn(ServiceBulletinModel, 'findOrCreate').mockResolvedValue([{} as any, true]);

    await LibraryService.createServiceBulletin({
      model_id: 'model-1',
      sb_number: ' sb-001 ',
      title: 'Magneto Inspection',
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        manufacturer: 'BENDIX',
        sb_number: 'SB-001',
        title: 'Magneto Inspection',
      })
    );
  });

  it('writes reference through the current sb_number model mapping without source_refs', async () => {
    mockModel({ name: 'Bendix' });
    vi.spyOn(ServiceBulletin, 'findOne').mockResolvedValue(null);
    const createSpy = vi.spyOn(ServiceBulletin, 'create').mockResolvedValue({
      id: 'sb-2',
    } as any);
    vi.spyOn(ServiceBulletinModel, 'findOrCreate').mockResolvedValue([{} as any, true]);

    await LibraryService.createServiceBulletin({
      model_id: 'model-1',
      sb_number: ' sb-002 ',
      title: 'Operational Check',
      compliance_type: '',
    });

    expect(ServiceBulletin.getAttributes()).not.toHaveProperty('source_refs');
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        manufacturer: 'Bendix',
        sb_number: 'SB-002',
        compliance_type: 'MANUAL',
        status: 'ACTIVE',
      })
    );
    expect(createSpy.mock.calls[0]?.[0]).not.toHaveProperty('source_refs');
  });

  it('bulk create succeeds with minimal service bulletin data', async () => {
    mockModel({ code: 'PIPER', name: 'Piper' });
    vi.spyOn(ServiceBulletin, 'findOne').mockResolvedValue(null);
    const createSpy = vi.spyOn(ServiceBulletin, 'create').mockResolvedValue({
      id: 'sb-3',
    } as any);
    vi.spyOn(ServiceBulletinModel, 'findOrCreate').mockResolvedValue([{} as any, true]);

    const createdCount = await LibraryService.createServiceBulletinsBulk('model-1', [
      {
        sb_number: ' piper-1005 ',
        title: 'Drain Hole Inspection',
      },
    ]);

    expect(createdCount).toBe(1);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        manufacturer: 'PIPER',
        sb_number: 'PIPER-1005',
        title: 'Drain Hole Inspection',
        compliance_type: 'MANUAL',
        status: 'ACTIVE',
      })
    );
  });

  it('keeps duplicate handling by linking the existing bulletin instead of creating', async () => {
    mockModel({ code: 'BENDIX', name: 'Bendix' });
    const update = vi.fn().mockResolvedValue(undefined);
    const existing = {
      id: 'existing-sb',
      title: 'Existing Title',
      description: null,
      issued_on: null,
      compliance_type: 'MANDATORY',
      revision: null,
      document_url: null,
      update,
    };
    vi.spyOn(ServiceBulletin, 'findOne').mockResolvedValue(existing as any);
    const createSpy = vi.spyOn(ServiceBulletin, 'create').mockResolvedValue({
      id: 'new-sb',
    } as any);
    const linkSpy = vi
      .spyOn(ServiceBulletinModel, 'findOrCreate')
      .mockResolvedValue([{} as any, false]);

    const result = await LibraryService.createServiceBulletin({
      model_id: 'model-1',
      sb_number: 'SB-001',
      title: 'Imported Duplicate',
      revision: 'A',
    });

    expect(result).toBe(existing);
    expect(createSpy).not.toHaveBeenCalled();
    expect(linkSpy).toHaveBeenCalledWith({
      where: {
        service_bulletin_id: 'existing-sb',
        model_id: 'model-1',
      },
      defaults: {
        service_bulletin_id: 'existing-sb',
        model_id: 'model-1',
      },
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        revision: 'A',
      })
    );
  });
});
