import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AdServiceBulletinReference,
  ComplianceAssignment,
  ComplianceItem,
  ServiceBulletin,
  ServiceBulletinModel,
} from '../../models/index.js';
import { AirworthinessDirective } from '../../models/AirworthinessDirective.js';
import { LibraryService } from './library.service.js';

const routes = readFileSync(
  resolve(process.cwd(), 'src/modules/library/library.routes.ts'),
  'utf8'
);
const controller = readFileSync(
  resolve(process.cwd(), 'src/modules/library/library.controller.ts'),
  'utf8'
);

function directive(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id || 'ad-1',
    ad_number: overrides.ad_number || '2026-01-01',
    subject_heading: overrides.subject_heading ?? null,
    subject: overrides.subject ?? null,
    summary: overrides.summary ?? null,
    comments: overrides.comments ?? null,
    citation: overrides.citation ?? null,
    created_at: new Date('2026-01-01T00:00:00Z'),
  } as any;
}

function bulletin(id: string, sbNumber: string, reference = sbNumber) {
  return {
    id,
    sb_number: sbNumber,
    reference,
  } as any;
}

function existingReference(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id || 'ref-1',
    airworthiness_directive_id: overrides.airworthiness_directive_id || 'ad-1',
    raw_reference_text: overrides.raw_reference_text || 'SB 123',
    normalized_reference_text: overrides.normalized_reference_text || 'SB 123',
    matched_service_bulletin_id: overrides.matched_service_bulletin_id ?? null,
    match_status: overrides.match_status || 'UNRESOLVED',
    match_reason: overrides.match_reason ?? null,
    source_context: overrides.source_context || 'summary',
    update: vi.fn().mockResolvedValue({}),
  } as any;
}

function mockSources(options: {
  directives?: any[];
  bulletins?: any[];
  existingRows?: any[];
}) {
  vi.spyOn(AirworthinessDirective, 'findAll').mockResolvedValue(options.directives || []);
  vi.spyOn(ServiceBulletin, 'findAll').mockResolvedValue(options.bulletins || []);
  vi.spyOn(AdServiceBulletinReference, 'findAll').mockResolvedValue(options.existingRows || []);
  vi.spyOn(AdServiceBulletinReference, 'create').mockResolvedValue({ id: 'created-ref' } as any);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AD-to-SB reference extraction', () => {
  it('registers the manual refresh route with library edit permission and CSRF', () => {
    const routeStart = routes.indexOf("'/ads/service-bulletin-references/refresh'");
    const routeEnd = routes.indexOf(');', routeStart);
    const routeBlock = routes.slice(routeStart, routeEnd);

    expect(routeStart).toBeGreaterThan(-1);
    expect(routeBlock).toContain("requirePermission('LIBRARY_EDIT')");
    expect(routeBlock).toContain('csrfProtection');
    expect(routeBlock).toContain('LibraryController.refreshAdServiceBulletinReferences');
    expect(controller).toContain('LibraryService.refreshAdServiceBulletinReferences');
  });

  it('extracts explicit SB references from approved AD fields and creates a matched row', async () => {
    mockSources({
      directives: [
        directive({
          subject_heading: 'Wing inspection',
          summary: 'Comply with Service Bulletin No. 123A before next flight.',
        }),
      ],
      bulletins: [bulletin('sb-1', 'SB 123A')],
    });

    const result = await LibraryService.refreshAdServiceBulletinReferences();

    expect(AdServiceBulletinReference.create).toHaveBeenCalledWith(
      expect.objectContaining({
        airworthiness_directive_id: 'ad-1',
        raw_reference_text: 'Service Bulletin No. 123A',
        normalized_reference_text: 'SB 123A',
        matched_service_bulletin_id: 'sb-1',
        match_status: 'MATCHED',
        source_context: 'summary',
      })
    );
    expect(result).toMatchObject({ referencesFound: 1, created: 1 });
  });

  it('does not extract vague service bulletin prose', async () => {
    mockSources({
      directives: [
        directive({
          comments: 'Comply with the service bulletin before further flight.',
        }),
      ],
      bulletins: [bulletin('sb-1', 'SB 100')],
    });

    const result = await LibraryService.refreshAdServiceBulletinReferences();

    expect(AdServiceBulletinReference.create).not.toHaveBeenCalled();
    expect(AdServiceBulletinReference.findAll).not.toHaveBeenCalled();
    expect(result).toMatchObject({ referencesFound: 0, created: 0 });
  });

  it('normalizes separator, case, and spacing variants', async () => {
    mockSources({
      directives: [
        directive({
          subject: 'Inspection required by sb-123.',
        }),
      ],
      bulletins: [bulletin('sb-1', 'SB 123')],
    });

    await LibraryService.refreshAdServiceBulletinReferences();

    expect(AdServiceBulletinReference.create).toHaveBeenCalledWith(
      expect.objectContaining({
        raw_reference_text: 'sb-123',
        normalized_reference_text: 'SB 123',
        match_status: 'MATCHED',
      })
    );
  });

  it('creates unresolved rows when no exact SB number or reference exists', async () => {
    mockSources({
      directives: [directive({ citation: 'See SB No. 777 for details.' })],
      bulletins: [bulletin('sb-1', 'SB 123')],
    });

    await LibraryService.refreshAdServiceBulletinReferences();

    expect(AdServiceBulletinReference.create).toHaveBeenCalledWith(
      expect.objectContaining({
        normalized_reference_text: 'SB 777',
        matched_service_bulletin_id: null,
        match_status: 'UNRESOLVED',
        match_reason: 'No exact SB number/reference match.',
      })
    );
  });

  it('creates ambiguous unresolved rows when multiple exact matches exist', async () => {
    mockSources({
      directives: [directive({ summary: 'Inspect per SB 123.' })],
      bulletins: [bulletin('sb-1', 'SB 123'), bulletin('sb-2', 'SB 123')],
    });

    await LibraryService.refreshAdServiceBulletinReferences();

    expect(AdServiceBulletinReference.create).toHaveBeenCalledWith(
      expect.objectContaining({
        normalized_reference_text: 'SB 123',
        matched_service_bulletin_id: null,
        match_status: 'UNRESOLVED',
        match_reason: 'Multiple exact SB matches; manual review required.',
      })
    );
  });

  it('preserves ignored rows without update or duplicate creation', async () => {
    const ignored = existingReference({ match_status: 'IGNORED' });
    mockSources({
      directives: [directive({ summary: 'Inspect per SB 123.' })],
      bulletins: [bulletin('sb-1', 'SB 123')],
      existingRows: [ignored],
    });

    const result = await LibraryService.refreshAdServiceBulletinReferences();

    expect(ignored.update).not.toHaveBeenCalled();
    expect(AdServiceBulletinReference.create).not.toHaveBeenCalled();
    expect(result.skippedIgnored).toBe(1);
  });

  it('does not duplicate unchanged unresolved rows on rerun', async () => {
    const unresolved = existingReference({
      match_status: 'UNRESOLVED',
      match_reason: 'No exact SB number/reference match.',
    });
    mockSources({
      directives: [directive({ summary: 'Inspect per SB 123.' })],
      bulletins: [],
      existingRows: [unresolved],
    });

    const result = await LibraryService.refreshAdServiceBulletinReferences();

    expect(unresolved.update).not.toHaveBeenCalled();
    expect(AdServiceBulletinReference.create).not.toHaveBeenCalled();
    expect(result.unchanged).toBe(1);
  });

  it('upgrades unresolved rows to matched when one exact SB match appears', async () => {
    const unresolved = existingReference({
      match_status: 'UNRESOLVED',
      match_reason: 'No exact SB number/reference match.',
    });
    mockSources({
      directives: [directive({ summary: 'Inspect per SB 123.' })],
      bulletins: [bulletin('sb-1', 'SB 123')],
      existingRows: [unresolved],
    });

    const result = await LibraryService.refreshAdServiceBulletinReferences();

    expect(unresolved.update).toHaveBeenCalledWith(
      expect.objectContaining({
        match_status: 'MATCHED',
        matched_service_bulletin_id: 'sb-1',
      })
    );
    expect(result.upgradedMatched).toBe(1);
  });

  it('does not downgrade already matched rows', async () => {
    const matched = existingReference({
      match_status: 'MATCHED',
      matched_service_bulletin_id: 'sb-1',
    });
    mockSources({
      directives: [directive({ summary: 'Inspect per SB 123.' })],
      bulletins: [],
      existingRows: [matched],
    });

    const result = await LibraryService.refreshAdServiceBulletinReferences();

    expect(matched.update).not.toHaveBeenCalled();
    expect(AdServiceBulletinReference.create).not.toHaveBeenCalled();
    expect(result.skippedMatched).toBe(1);
  });

  it('does not create SBs, applicability, compliance, tasks, workpacks, or import side effects', async () => {
    mockSources({
      directives: [directive({ summary: 'Inspect per SB 123.' })],
      bulletins: [],
    });
    const sbCreate = vi.spyOn(ServiceBulletin, 'create');
    const sbApplicability = vi.spyOn(ServiceBulletinModel, 'findOrCreate');
    const complianceItemCreate = vi.spyOn(ComplianceItem, 'create');
    const complianceAssignmentCreate = vi.spyOn(ComplianceAssignment, 'create');

    await LibraryService.refreshAdServiceBulletinReferences();

    expect(sbCreate).not.toHaveBeenCalled();
    expect(sbApplicability).not.toHaveBeenCalled();
    expect(complianceItemCreate).not.toHaveBeenCalled();
    expect(complianceAssignmentCreate).not.toHaveBeenCalled();
  });
});
