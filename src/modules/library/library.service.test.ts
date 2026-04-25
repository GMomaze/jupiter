import { afterEach, describe, expect, it, vi } from 'vitest';
import { LibraryService } from './library.service.js';
import {
  ComponentModel,
  CessnaSid,
  ModelSid,
} from '../../models/index.js';

describe('LibraryService SID import', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips duplicate summaries while attaching unique SIDs from CSV', async () => {
    vi.spyOn(ComponentModel, 'findByPk').mockResolvedValue({ id: 'model-1' } as any);
    vi.spyOn(LibraryService, 'getModelSids').mockResolvedValue([
      { id: 'sid-existing', title: 'Inspect Carry Through Spar' },
    ] as any);
    vi.spyOn(CessnaSid, 'findAll').mockResolvedValue([] as any);

    const createSpy = vi
      .spyOn(CessnaSid, 'create')
      .mockResolvedValueOnce({
        id: 'sid-1',
        sid_number: 'SID-001',
        title: 'Inspect Firewall Structure',
      } as any)
      .mockResolvedValueOnce({
        id: 'sid-2',
        sid_number: 'SID-003',
        title: 'Inspect Empennage Attach Points',
      } as any);

    vi.spyOn(ModelSid, 'findOrCreate').mockResolvedValue([{} as any, true]);

    const csv = Buffer.from(
      [
        'sid_number,summary',
        'SID-001,Inspect Firewall Structure',
        'SID-002,Inspect Firewall Structure',
        'SID-003,Inspect Empennage Attach Points',
        'SID-004,Inspect Carry Through Spar',
      ].join('\n')
    );

    const result = await LibraryService.importModelSidsFromCsv('model-1', csv);

    expect(result).toEqual({
      created: 2,
      attached: 2,
      skippedDuplicates: 2,
      skippedInvalid: 0,
      processed: 4,
    });
    expect(createSpy).toHaveBeenCalledTimes(2);
    expect(createSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sid_number: 'SID-001',
        title: 'Inspect Firewall Structure',
      })
    );
    expect(createSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sid_number: 'SID-003',
        title: 'Inspect Empennage Attach Points',
      })
    );
  });
});
