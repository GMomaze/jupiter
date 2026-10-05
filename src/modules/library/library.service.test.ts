import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../platform-authority/authoritative-platform-mutation.js', () => ({
  requirePlatformMutationOperations: (evidence: unknown) => evidence,
  executeAuthoritativePlatformMutation: async (_evidence: unknown, work: (tx: any, audit: any) => Promise<unknown>) => work({ LOCK: { UPDATE: 'UPDATE' } }, { setBefore: vi.fn() }),
}));
import { LibraryService } from './library.service.js';
import {
  ComponentModel,
  SidModelApplicability,
  SupplementalInspectionDocument,
} from '../../models/index.js';

const modelId = '11111111-1111-4111-8111-111111111111';
const evidence = {} as any;

describe('LibraryService SID import', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips duplicate summaries while attaching unique SIDs from CSV', async () => {
    vi.spyOn(ComponentModel, 'findByPk').mockResolvedValue({ id: modelId } as any);
    vi.spyOn(LibraryService, 'getModelSids').mockResolvedValue([
      { id: 'sid-existing', title: 'Inspect Carry Through Spar' },
    ] as any);
    vi.spyOn(SupplementalInspectionDocument, 'findAll').mockResolvedValue([] as any);
    vi.spyOn(SidModelApplicability, 'findOne').mockResolvedValue(null);

    const createSpy = vi
      .spyOn(SupplementalInspectionDocument, 'create')
      .mockResolvedValueOnce({
        id: '22222222-2222-4222-8222-222222222222',
        reference: 'SID-001',
        title: 'Inspect Firewall Structure',
      } as any)
      .mockResolvedValueOnce({
        id: '33333333-3333-4333-8333-333333333333',
        reference: 'SID-003',
        title: 'Inspect Empennage Attach Points',
      } as any);

    vi.spyOn(SidModelApplicability, 'findOrCreate').mockResolvedValue([{} as any, true]);

    const csv = Buffer.from(
      [
        'sid_number,summary',
        'SID-001,Inspect Firewall Structure',
        'SID-002,Inspect Firewall Structure',
        'SID-003,Inspect Empennage Attach Points',
        'SID-004,Inspect Carry Through Spar',
      ].join('\n')
    );

    const result = await LibraryService.importModelSidsFromCsv(evidence, modelId, csv);

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
        reference: 'SID-001',
        title: 'Inspect Firewall Structure',
      }),
      expect.objectContaining({ transaction: expect.anything() })
    );
    expect(createSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        reference: 'SID-003',
        title: 'Inspect Empennage Attach Points',
      }),
      expect.objectContaining({ transaction: expect.anything() })
    );
  });
});
