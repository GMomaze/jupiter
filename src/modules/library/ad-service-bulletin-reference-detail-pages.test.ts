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

const readFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const routes = readFile('src/modules/library/library.routes.ts');
const controller = readFile('src/modules/library/library.controller.ts');
const adDetailView = readFile('src/views/library/ads/detail.ejs');
const sbDetailView = readFile('src/views/library/sbs/detail.ejs');

function modelRow(id: string, values: Record<string, unknown> = {}) {
  return {
    id,
    ...values,
    setDataValue: vi.fn(),
  } as any;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AD-to-SB read-only detail pages', () => {
  it('registers read-only AD and SB detail GET routes without POST routes or RBAC changes', () => {
    const adRouteStart = routes.indexOf("'/ads/:id'");
    const adRouteEnd = routes.indexOf(');', adRouteStart);
    const adRouteBlock = routes.slice(adRouteStart, adRouteEnd);
    const sbRouteStart = routes.indexOf("'/sbs/:id'");
    const sbRouteEnd = routes.indexOf(');', sbRouteStart);
    const sbRouteBlock = routes.slice(sbRouteStart, sbRouteEnd);

    expect(adRouteBlock).toContain("requirePermission('LIBRARY_EDIT')");
    expect(adRouteBlock).toContain('LibraryController.renderAdDetail');
    expect(sbRouteBlock).toContain("requirePermission('LIBRARY_EDIT')");
    expect(sbRouteBlock).toContain('LibraryController.renderSbDetail');
    expect(routes).not.toContain("router.post(\n  '/ads/:id'");
    expect(routes).not.toContain("router.post(\n  '/sbs/:id'");
  });

  it('keeps detail controllers thin and delegated to library service methods', () => {
    expect(controller).toContain('static async renderAdDetail');
    expect(controller).toContain('LibraryService.getAirworthinessDirectiveByIdWithServiceBulletinReferences');
    expect(controller).toContain("res.render('library/ads/detail'");
    expect(controller).toContain('static async renderSbDetail');
    expect(controller).toContain('LibraryService.getServiceBulletinByIdWithAirworthinessDirectiveReferences');
    expect(controller).toContain("res.render('library/sbs/detail'");
  });

  it('loads an AD with referenced SB rows and matched service bulletin context', async () => {
    const directive = modelRow('ad-1', { ad_number: '2026-01-01' });
    const references = [
      {
        raw_reference_text: 'SB 123',
        normalized_reference_text: 'SB 123',
        match_status: 'MATCHED',
        MatchedServiceBulletin: { id: 'sb-1', sb_number: 'SB 123' },
      },
      {
        raw_reference_text: 'SB 777',
        normalized_reference_text: 'SB 777',
        match_status: 'UNRESOLVED',
        MatchedServiceBulletin: null,
      },
    ];

    vi.spyOn(AirworthinessDirective, 'findByPk').mockResolvedValue(directive);
    vi.spyOn(AdServiceBulletinReference, 'findAll').mockResolvedValue(references as any);

    const result = await LibraryService.getAirworthinessDirectiveByIdWithServiceBulletinReferences('ad-1');

    expect(result).toBe(directive);
    expect(AirworthinessDirective.findByPk).toHaveBeenCalledWith(
      'ad-1',
      expect.objectContaining({ attributes: expect.arrayContaining(['id', 'ad_number']) })
    );
    expect(AdServiceBulletinReference.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { airworthiness_directive_id: 'ad-1' },
        include: [
          expect.objectContaining({
            model: ServiceBulletin,
            as: 'MatchedServiceBulletin',
            required: false,
          }),
        ],
      })
    );
    expect(directive.setDataValue).toHaveBeenCalledWith('ServiceBulletinReferences', references);
  });

  it('loads an SB with referencing AD rows', async () => {
    const bulletin = modelRow('sb-1', { sb_number: 'SB 123' });
    const references = [
      {
        raw_reference_text: 'SB 123',
        match_status: 'MATCHED',
        AirworthinessDirective: { id: 'ad-1', ad_number: '2026-01-01' },
      },
    ];

    vi.spyOn(ServiceBulletin, 'findByPk').mockResolvedValue(bulletin);
    vi.spyOn(AdServiceBulletinReference, 'findAll').mockResolvedValue(references as any);

    const result = await LibraryService.getServiceBulletinByIdWithAirworthinessDirectiveReferences('sb-1');

    expect(result).toBe(bulletin);
    expect(ServiceBulletin.findByPk).toHaveBeenCalledWith(
      'sb-1',
      expect.objectContaining({ attributes: expect.arrayContaining(['id', 'sb_number']) })
    );
    expect(AdServiceBulletinReference.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { matched_service_bulletin_id: 'sb-1' },
        include: [
          expect.objectContaining({
            model: AirworthinessDirective,
            as: 'AirworthinessDirective',
            required: false,
          }),
        ],
      })
    );
    expect(bulletin.setDataValue).toHaveBeenCalledWith('AirworthinessDirectiveReferences', references);
  });

  it('renders AD detail referenced SB fields, unresolved rows, and empty state', () => {
    [
      'Referenced Service Bulletins',
      'Subject Heading',
      'directive.subject',
      'raw_reference_text',
      'normalized_reference_text',
      'match_status',
      'match_reason',
      'source_context',
      'MatchedServiceBulletin',
      'No service bulletin references have been extracted for this AD.',
      'do not establish compliance equivalence',
    ].forEach((expected) => {
      expect(adDetailView).toContain(expected);
    });
  });

  it('renders SB detail referenced-by-AD fields and empty state', () => {
    [
      'Referenced By Airworthiness Directives',
      'AirworthinessDirective',
      'ad_number',
      'revision',
      'subject_heading',
      'directive.subject',
      'Subject:',
      'raw_reference_text',
      'match_reason',
      'match_status',
      'No airworthiness directives currently reference this service bulletin.',
      'do not establish compliance equivalence',
    ].forEach((expected) => {
      expect(sbDetailView).toContain(expected);
    });
  });

  it('does not add forms, buttons, POST actions, or operational side effects', async () => {
    expect(adDetailView).not.toContain('<form');
    expect(adDetailView).not.toContain('<button');
    expect(adDetailView).not.toContain('method="POST"');
    expect(adDetailView).not.toContain('?_csrf');
    expect(sbDetailView).not.toContain('<form');
    expect(sbDetailView).not.toContain('<button');
    expect(sbDetailView).not.toContain('method="POST"');
    expect(sbDetailView).not.toContain('?_csrf');

    vi.spyOn(AirworthinessDirective, 'findByPk').mockResolvedValue(null);
    const sbCreate = vi.spyOn(ServiceBulletin, 'create');
    const sbApplicability = vi.spyOn(ServiceBulletinModel, 'findOrCreate');
    const complianceItemCreate = vi.spyOn(ComplianceItem, 'create');
    const complianceAssignmentCreate = vi.spyOn(ComplianceAssignment, 'create');

    await LibraryService.getAirworthinessDirectiveByIdWithServiceBulletinReferences('missing-ad');

    expect(sbCreate).not.toHaveBeenCalled();
    expect(sbApplicability).not.toHaveBeenCalled();
    expect(complianceItemCreate).not.toHaveBeenCalled();
    expect(complianceAssignmentCreate).not.toHaveBeenCalled();
  });
});
