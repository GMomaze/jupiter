import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Op } from 'sequelize';
import sequelize from '../../config/database.js';
import { ComponentModel } from '../../models/index.js';
import { AirworthinessDirective } from '../../models/AirworthinessDirective.js';
import { LibraryService } from './library.service.js';

const modelDetailView = readFileSync(
  resolve(process.cwd(), 'src/views/library/model-detail.ejs'),
  'utf8'
);
const libraryRoutes = readFileSync(
  resolve(process.cwd(), 'src/modules/library/library.routes.ts'),
  'utf8'
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('component model AD number assignment repair', () => {
  it('renders exact AD number assignment without removing checkbox assignment', () => {
    expect(modelDetailView).toContain('Assign AD by AD Number');
    expect(modelDetailView).toContain('name="ad_number"');
    expect(modelDetailView).toContain('placeholder="Enter exact AD number"');
    expect(modelDetailView).toContain('Assign AD');
    expect(modelDetailView).toContain('name="airworthiness_directive_ids"');
    expect(modelDetailView).toContain('Assign Selected ADs');
  });

  it('renders assignable AD search and no-results messaging', () => {
    expect(modelDetailView).toContain('Search assignable ADs');
    expect(modelDetailView).toContain('method="GET"');
    expect(modelDetailView).toContain('name="tab" value="compliance"');
    expect(modelDetailView).toContain('placeholder="Search by AD number"');
    expect(modelDetailView).toContain('activeAdNumberSearch');
    expect(modelDetailView).toContain('Clear');
    expect(modelDetailView).toContain('action="/library/model/<%= model.id %>#compliance-data"');
    expect(modelDetailView).toContain('/library/model/<%= model.id %>?tab=compliance#compliance-data');
    expect(modelDetailView).toContain('No assignable Airworthiness Directives found');
    expect(modelDetailView).toContain('Showing <%= assignableAdStart %>-<%= assignableAdEnd %> of <%= assignableAdPagination.total %> assignable AD');
  });

  it('renders assignable AD page-size and previous-next controls', () => {
    expect(modelDetailView).toContain('name="ad_page"');
    expect(modelDetailView).toContain('name="ad_page_size"');
    expect(modelDetailView).toContain('Page <%= assignableAdPagination.page %> of <%= assignableAdPagination.totalPages %>');
    expect(modelDetailView).toContain('Previous');
    expect(modelDetailView).toContain('Next');
    expect(modelDetailView).toContain("params.push('tab=compliance');");
    expect(modelDetailView).toContain("return `/library/model/${model.id}?${params.join('&')}#compliance-data`;");
    expect(modelDetailView).toContain('[200, 400, 800, 1000].forEach');
    expect(modelDetailView).toContain('assignableAdPageUrl(assignableAdPagination.page + 1)');
  });

  it('keeps AD relevance suggestions read-only', () => {
    const suggestionStart = modelDetailView.indexOf('Read-only AD Relevance Suggestions');
    const sidStart = modelDetailView.indexOf('Structural Inspection Directives');
    const suggestionPanel = modelDetailView.slice(suggestionStart, sidStart);

    expect(suggestionPanel).toContain('readOnlyAdSuggestionGroups.forEach');
    expect(suggestionPanel).toContain('directive.relevance_reason');
    expect(suggestionPanel).not.toContain('<form');
    expect(suggestionPanel).not.toContain('type="checkbox"');
  });

  it('passes trimmed assignable AD search to model applicability assignments', () => {
    expect(libraryRoutes).toContain(
      "const adNumberSearch = getParam(req.query.ad_number as string | string[] | undefined).trim();"
    );
    expect(libraryRoutes).toContain('LibraryService.getModelApplicabilityAssignments(id, {');
    expect(libraryRoutes).toContain('adNumberSearch,');
    expect(libraryRoutes).toContain('adPage: normalizedAdPage,');
    expect(libraryRoutes).toContain('adPageSize: normalizedAdPageSize,');
    expect(libraryRoutes).toContain('adNumberSearch,');
  });

  it('preserves checkbox assignment and adds AD-number route handling on the existing route', () => {
    const routeStart = libraryRoutes.indexOf(
      "router.post('/model/:id/airworthiness-directives/assign'"
    );
    const nextRouteStart = libraryRoutes.indexOf("router.post('/model/:id/sids/assign'", routeStart);
    const route = libraryRoutes.slice(routeStart, nextRouteStart);

    expect(route).toContain("requirePermission('LIBRARY_EDIT')");
    expect(route).toContain('csrfProtection');
    expect(route).toContain('airworthiness_directive_ids');
    expect(route).toContain('assignAirworthinessDirectiveToModel(id, String(directiveId))');
    expect(route).toContain('assignAirworthinessDirectiveToModelByNumber(id, adNumber)');
    expect(route).toContain('Use either AD number assignment or selected AD rows, not both.');
  });

  it('uses default page one and page size 200 for assignable ADs', async () => {
    const query = vi
      .spyOn(sequelize, 'query')
      .mockResolvedValueOnce([{ total: '450' }] as any)
      .mockResolvedValueOnce([{ id: 'ad-1' }] as any);

    const result = await (LibraryService as any).getAssignableAirworthinessDirectives('model-1');

    expect(result.pagination).toEqual({
      total: 450,
      page: 1,
      pageSize: 200,
      totalPages: 3,
      hasPrevious: false,
      hasNext: true,
    });
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('LIMIT :adPageSize'),
      expect.objectContaining({
        replacements: {
          modelId: 'model-1',
          adPageSize: 200,
          adOffset: 0,
        },
      })
    );
  });

  it('uses requested next page and allowed page size for assignable ADs', async () => {
    const query = vi
      .spyOn(sequelize, 'query')
      .mockResolvedValueOnce([{ total: '1200' }] as any)
      .mockResolvedValueOnce([{ id: 'ad-401' }] as any);

    const result = await (LibraryService as any).getAssignableAirworthinessDirectives(
      'model-1',
      null,
      { page: '2', pageSize: '400' }
    );

    expect(result.pagination).toEqual({
      total: 1200,
      page: 2,
      pageSize: 400,
      totalPages: 3,
      hasPrevious: true,
      hasNext: true,
    });
    expect(query).toHaveBeenLastCalledWith(
      expect.stringMatching(/LIMIT :adPageSize[\s\S]*OFFSET :adOffset/),
      expect.objectContaining({
        replacements: {
          modelId: 'model-1',
          adPageSize: 400,
          adOffset: 400,
        },
      })
    );
  });

  it('falls back for invalid assignable AD page and page size', async () => {
    const query = vi
      .spyOn(sequelize, 'query')
      .mockResolvedValueOnce([{ total: '10' }] as any)
      .mockResolvedValueOnce([] as any);

    const result = await (LibraryService as any).getAssignableAirworthinessDirectives(
      'model-1',
      null,
      { page: '-2', pageSize: '1200' }
    );

    expect(result.pagination.page).toBe(1);
    expect(result.pagination.pageSize).toBe(200);
    expect(query.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        replacements: {
          modelId: 'model-1',
          adPageSize: 200,
          adOffset: 0,
        },
      })
    );
  });

  it('clamps assignable AD page above total pages', async () => {
    const query = vi
      .spyOn(sequelize, 'query')
      .mockResolvedValueOnce([{ total: '450' }] as any)
      .mockResolvedValueOnce([] as any);

    const result = await (LibraryService as any).getAssignableAirworthinessDirectives(
      'model-1',
      null,
      { page: '99', pageSize: '200' }
    );

    expect(result.pagination.page).toBe(3);
    expect(result.pagination.hasNext).toBe(false);
    expect(query.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        replacements: {
          modelId: 'model-1',
          adPageSize: 200,
          adOffset: 400,
        },
      })
    );
  });

  it('returns empty assignable AD pagination safely', async () => {
    vi.spyOn(sequelize, 'query')
      .mockResolvedValueOnce([{ total: '0' }] as any)
      .mockResolvedValueOnce([] as any);

    const result = await (LibraryService as any).getAssignableAirworthinessDirectives(
      'model-1',
      null,
      { page: '3', pageSize: '800' }
    );

    expect(result.rows).toEqual([]);
    expect(result.pagination).toEqual({
      total: 0,
      page: 1,
      pageSize: 800,
      totalPages: 1,
      hasPrevious: false,
      hasNext: false,
    });
  });

  it('filters active unassigned ADs by AD number before pagination', async () => {
    const query = vi
      .spyOn(sequelize, 'query')
      .mockResolvedValueOnce([{ total: '1' }] as any)
      .mockResolvedValueOnce([{ id: 'ad-1' }] as any);

    await (LibraryService as any).getAssignableAirworthinessDirectives(
      'model-1',
      ' 2022-05 ',
      { page: '1', pageSize: '1000' }
    );

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('AND ad.ad_number ILIKE :adNumberSearch'),
      expect.objectContaining({
        replacements: {
          modelId: 'model-1',
          adNumberSearch: '%2022-05%',
        },
      })
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/ad\.ad_number ILIKE :adNumberSearch[\s\S]*LIMIT :adPageSize[\s\S]*OFFSET :adOffset/),
      expect.objectContaining({
        replacements: {
          modelId: 'model-1',
          adNumberSearch: '%2022-05%',
          adPageSize: 1000,
          adOffset: 0,
        },
      })
    );
  });

  it('keeps empty assignable AD search as the existing full-list query', async () => {
    const query = vi
      .spyOn(sequelize, 'query')
      .mockResolvedValueOnce([{ total: '0' }] as any)
      .mockResolvedValueOnce([] as any);

    await (LibraryService as any).getAssignableAirworthinessDirectives('model-1', '   ');

    expect(String(query.mock.calls[0]?.[0] || '')).not.toContain('ad.ad_number ILIKE');
    expect(String(query.mock.calls[1]?.[0] || '')).not.toContain('ad.ad_number ILIKE');
  });

  it('rejects blank AD number assignment', async () => {
    await expect(
      LibraryService.assignAirworthinessDirectiveToModelByNumber('model-1', '   ')
    ).rejects.toThrow('Enter an AD number to assign.');
  });

  it('rejects missing active AD number assignment', async () => {
    vi.spyOn(ComponentModel, 'findByPk').mockResolvedValue({ id: 'model-1' } as any);
    vi.spyOn(AirworthinessDirective, 'findAll').mockResolvedValue([]);

    await expect(
      LibraryService.assignAirworthinessDirectiveToModelByNumber('model-1', '2022-05-01')
    ).rejects.toThrow('No active AD found for AD number 2022-05-01.');
  });

  it('rejects duplicate active AD number assignment as ambiguous', async () => {
    vi.spyOn(ComponentModel, 'findByPk').mockResolvedValue({ id: 'model-1' } as any);
    vi.spyOn(AirworthinessDirective, 'findAll').mockResolvedValue([
      { id: 'ad-1', ad_number: '2022-05-01' },
      { id: 'ad-2', ad_number: '2022-05-01' },
    ] as any);

    await expect(
      LibraryService.assignAirworthinessDirectiveToModelByNumber('model-1', '2022-05-01')
    ).rejects.toThrow('Multiple active AD records match 2022-05-01.');
  });

  it('rejects already assigned AD number assignment', async () => {
    vi.spyOn(ComponentModel, 'findByPk').mockResolvedValue({ id: 'model-1' } as any);
    vi.spyOn(AirworthinessDirective, 'findAll').mockResolvedValue([
      { id: 'ad-1', ad_number: '2022-05-01' },
    ] as any);
    vi.spyOn(sequelize, 'query').mockResolvedValue([{ id: 'ad-1' }] as any);

    await expect(
      LibraryService.assignAirworthinessDirectiveToModelByNumber('model-1', '2022-05-01')
    ).rejects.toThrow('AD 2022-05-01 is already assigned to this model.');
  });

  it('assigns a unique active AD number through the existing assignment path', async () => {
    vi.spyOn(ComponentModel, 'findByPk').mockResolvedValue({ id: 'model-1' } as any);
    vi.spyOn(AirworthinessDirective, 'findAll').mockResolvedValue([
      { id: 'ad-1', ad_number: '2022-05-01' },
    ] as any);
    vi.spyOn(sequelize, 'query').mockResolvedValue([] as any);
    const assign = vi
      .spyOn(LibraryService, 'assignAirworthinessDirectiveToModel')
      .mockResolvedValue({ id: 'assignment-1' } as any);

    await LibraryService.assignAirworthinessDirectiveToModelByNumber(
      'model-1',
      ' 2022-05-01 '
    );

    expect(assign).toHaveBeenCalledWith('model-1', 'ad-1');
    expect(AirworthinessDirective.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ad_number: { [Op.iLike]: '2022-05-01' },
          is_active: true,
        },
      })
    );
  });
});
