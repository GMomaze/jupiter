import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../platform-authority/authoritative-platform-mutation.js', () => ({
  requirePlatformMutationOperations: (evidence: unknown) => evidence,
  executeAuthoritativePlatformMutation: async (_evidence: unknown, work: (tx: any, audit: any) => Promise<unknown>) => work({ LOCK: { UPDATE: 'UPDATE' } }, { setBefore: vi.fn() }),
}));
import { AirworthinessDirective } from '../../models/AirworthinessDirective.js';
import { ServiceBulletin } from '../../models/ServiceBulletin.js';
import { SupplementalInspectionDocument } from '../../models/SupplementalInspectionDocument.js';
import { LibraryService } from './library.service.js';
const evidence = {} as any;

describe('Compliance single-record creation service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses REQUIRED as the ServiceBulletin model compliance default', () => {
    expect(ServiceBulletin.getAttributes().compliance_type.defaultValue).toBe('REQUIRED');
  });

  it('validates and creates an Airworthiness Directive', async () => {
    vi.spyOn(AirworthinessDirective, 'findAll').mockResolvedValue([]);
    const createSpy = vi.spyOn(AirworthinessDirective, 'create').mockResolvedValue({
      id: 'ad-1',
    } as any);

    await LibraryService.createAirworthinessDirective(evidence, {
      ad_number: ' 2026-01-01 ',
      revision: ' A ',
      subject_heading: ' Wing spar inspection ',
      effective_date: '2026-06-01',
      authority: 'FAA',
      make: 'Piper',
      model: 'PA-28',
      status: 'ACTIVE',
      interval_hours: '100',
      interval_months: '12',
      summary: 'Inspect before next annual.',
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        ad_number: '2026-01-01',
        revision: 'A',
        subject_heading: 'Wing spar inspection',
        effective_date: '2026-06-01',
        authority: 'FAA',
        make: 'Piper',
        model: 'PA-28',
        status: 'ACTIVE',
        interval_hours: 100,
        interval_months: 12,
        summary: 'Inspect before next annual.',
      }),
      expect.objectContaining({ transaction: expect.anything() })
    );
  });

  it('blocks duplicate Airworthiness Directive ad number and revision', async () => {
    vi.spyOn(AirworthinessDirective, 'findAll').mockResolvedValue([
      { id: 'existing-ad', revision: 'A' },
    ] as any);

    await expect(
      LibraryService.createAirworthinessDirective(evidence, {
        ad_number: '2026-01-01',
        revision: 'a',
        subject_heading: 'Duplicate AD',
      }),
      expect.objectContaining({ transaction: expect.anything() })
    ).rejects.toThrow(/already exists/);
  });

  it('creates an SB / SL / SI record while preserving prefixed references', async () => {
    vi.spyOn(ServiceBulletin, 'findAll').mockResolvedValue([]);
    const createSpy = vi.spyOn(ServiceBulletin, 'create').mockResolvedValue({
      id: 'sb-1',
    } as any);

    await LibraryService.createLibraryServiceBulletin(evidence, {
      category: 'SL',
      reference: ' SL 1141A ',
      title: 'Landing gear inspection',
      manufacturer: 'Piper',
      revision: 'B',
      issued_on: '2026-05-01',
      compliance_type: 'MANDATORY',
      document_url: 'piper-sl-1141a.pdf',
      description: 'Inspect the landing gear attach points.',
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'SL',
        manufacturer: 'Piper',
        sb_number: 'SL 1141A',
        reference: 'SL 1141A',
        title: 'Landing gear inspection',
        revision: 'B',
        issued_on: '2026-05-01',
        compliance_type: 'MANDATORY',
        document_url: 'piper-sl-1141a.pdf',
        description: 'Inspect the landing gear attach points.',
        source_primary: 'MANUAL',
      }),
      expect.objectContaining({ transaction: expect.anything() })
    );
  });

  it('defaults SB / SL / SI compliance requirement to REQUIRED', async () => {
    vi.spyOn(ServiceBulletin, 'findAll').mockResolvedValue([]);
    const createSpy = vi.spyOn(ServiceBulletin, 'create').mockResolvedValue({
      id: 'sb-required',
    } as any);

    await LibraryService.createLibraryServiceBulletin(evidence, {
      category: 'SB',
      reference: 'SB 500',
      title: 'Default compliance',
      manufacturer: 'Piper',
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        compliance_type: 'REQUIRED',
      }),
      expect.objectContaining({ transaction: expect.anything() })
    );
  });

  it('blocks duplicate SB manufacturer, reference, and revision', async () => {
    vi.spyOn(ServiceBulletin, 'findAll').mockResolvedValue([
      { id: 'existing-sb', revision: null },
    ] as any);

    await expect(
      LibraryService.createLibraryServiceBulletin(evidence, {
        reference: 'SB 223',
        title: 'Duplicate SB',
        manufacturer: 'Piper',
      })
    ).rejects.toThrow(/already exists/);
  });

  it('validates and creates a Supplemental Inspection Document', async () => {
    vi.spyOn(SupplementalInspectionDocument, 'findAll').mockResolvedValue([]);
    const createSpy = vi.spyOn(SupplementalInspectionDocument, 'create').mockResolvedValue({
      id: 'sid-1',
    } as any);

    await LibraryService.createSupplementalInspectionDocument(evidence, {
      manufacturer: 'Cessna',
      reference: 'SID 55-10-01',
      title: 'Empennage inspection',
      description: 'Applicability: 172 series',
      category: 'STRUCTURAL',
      section_reference: '55-10',
      ata_chapter: '55',
      initial_interval_hours: '1000',
      initial_interval_months: '120',
      repeat_interval_hours: '500',
      repeat_interval_months: '60',
      inspection_operation: 'Detailed visual inspection',
      notes: 'Use current OEM procedure.',
      source_document: 'SID manual',
      is_active: 'true',
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        manufacturer: 'Cessna',
        reference: 'SID 55-10-01',
        title: 'Empennage inspection',
        initial_interval_hours: 1000,
        initial_interval_months: 120,
        repeat_interval_hours: 500,
        repeat_interval_months: 60,
        is_active: true,
      }),
      expect.objectContaining({ transaction: expect.anything() })
    );
  });

  it('validates SID required fields and duplicate handling', async () => {
    vi.spyOn(SupplementalInspectionDocument, 'findAll').mockResolvedValue([]);

    await expect(
      LibraryService.createSupplementalInspectionDocument(evidence, {
        manufacturer: 'Cessna',
        reference: '',
        title: 'Missing reference',
      })
    ).rejects.toThrow(/Reference is required/);

    vi.mocked(SupplementalInspectionDocument.findAll).mockResolvedValue([
      { id: 'existing-sid' },
    ] as any);

    await expect(
      LibraryService.createSupplementalInspectionDocument(evidence, {
        manufacturer: 'Cessna',
        reference: 'SID 55-10-01',
        title: 'Duplicate SID',
      })
    ).rejects.toThrow(/already exists/);
  });

  it('rejects negative interval values', async () => {
    vi.spyOn(SupplementalInspectionDocument, 'findAll').mockResolvedValue([]);

    await expect(
      LibraryService.createSupplementalInspectionDocument(evidence, {
        manufacturer: 'Cessna',
        reference: 'SID NEG',
        title: 'Negative interval',
        initial_interval_hours: '-1',
      })
    ).rejects.toThrow(/Initial interval hours must be a non-negative whole number/);
  });
});
