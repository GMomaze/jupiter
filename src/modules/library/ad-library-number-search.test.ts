import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Op } from 'sequelize';
import { AdServiceBulletinReference } from '../../models/index.js';
import { AirworthinessDirective } from '../../models/AirworthinessDirective.js';
import { LibraryController } from './library.controller.js';
import { LibraryService } from './library.service.js';

const adListView = readFileSync(
  resolve(process.cwd(), 'src/views/library/ads/index.ejs'),
  'utf8'
);

function row(id: string) {
  const values = new Map<string, unknown>();

  return {
    id,
    setDataValue: vi.fn((key: string, value: unknown) => {
      values.set(key, value);
    }),
    getDataValue: (key: string) => values.get(key),
  } as any;
}

function responseMock() {
  return {
    render: vi.fn(),
  } as any;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AD library number search', () => {
  it('renders the AD Number search form and active search controls', () => {
    expect(adListView).toContain('method="GET"');
    expect(adListView).toContain('action="/library/ads"');
    expect(adListView).toContain('AD Number');
    expect(adListView).toContain('name="ad_number"');
    expect(adListView).toContain('Search by AD number, e.g. 2022-05');
    expect(adListView).toContain('Search');
    expect(adListView).toContain('href="/library/ads"');
    expect(adListView).toContain('No Airworthiness Directives found.');
  });

  it('trims whitespace in the controller before calling the service', async () => {
    const service = vi
      .spyOn(LibraryService, 'getAirworthinessDirectives')
      .mockResolvedValue([] as any);
    const res = responseMock();

    await LibraryController.renderAdList(
      { query: { ad_number: ' 2022-05 ' } } as any,
      res
    );

    expect(service).toHaveBeenCalledWith({ adNumberSearch: '2022-05' });
    expect(res.render).toHaveBeenCalledWith(
      'library/ads/index',
      expect.objectContaining({
        filters: { ad_number: '2022-05' },
      })
    );
  });

  it('uses the first query value when AD Number is submitted more than once', async () => {
    const service = vi
      .spyOn(LibraryService, 'getAirworthinessDirectives')
      .mockResolvedValue([] as any);

    await LibraryController.renderAdList(
      { query: { ad_number: [' 2022-05 ', '2023-01'] } } as any,
      responseMock()
    );

    expect(service).toHaveBeenCalledWith({ adNumberSearch: '2022-05' });
  });

  it('passes an empty search through as full-list behavior', async () => {
    const service = vi
      .spyOn(LibraryService, 'getAirworthinessDirectives')
      .mockResolvedValue([] as any);

    await LibraryController.renderAdList(
      { query: { ad_number: '   ' } } as any,
      responseMock()
    );

    expect(service).toHaveBeenCalledWith({ adNumberSearch: '' });
  });

  it('filters by exact or partial AD Number using case-insensitive matching', async () => {
    vi.spyOn(AirworthinessDirective, 'findAll').mockResolvedValue([]);

    await LibraryService.getAirworthinessDirectives({ adNumberSearch: '2022-05' });

    expect(AirworthinessDirective.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ad_number: {
            [Op.iLike]: '%2022-05%',
          },
        },
        order: [['created_at', 'DESC'], ['ad_number', 'ASC']],
      })
    );
  });

  it('does not add a where clause for empty searches', async () => {
    vi.spyOn(AirworthinessDirective, 'findAll').mockResolvedValue([]);

    await LibraryService.getAirworthinessDirectives({ adNumberSearch: '   ' });

    expect(AirworthinessDirective.findAll).toHaveBeenCalledWith(
      expect.not.objectContaining({
        where: expect.anything(),
      })
    );
  });

  it('preserves AD-to-SB counts after filtering', async () => {
    const ad = row('ad-1');

    vi.spyOn(AirworthinessDirective, 'findAll').mockResolvedValue([ad]);
    vi.spyOn(AdServiceBulletinReference, 'findAll').mockResolvedValue([
      { airworthiness_directive_id: 'ad-1', match_status: 'MATCHED' },
      { airworthiness_directive_id: 'ad-1', match_status: 'UNRESOLVED' },
    ] as any);

    await LibraryService.getAirworthinessDirectives({ adNumberSearch: '2022' });

    expect(AdServiceBulletinReference.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          airworthiness_directive_id: {
            [Op.in]: ['ad-1'],
          },
        },
      })
    );
    expect(ad.setDataValue).toHaveBeenCalledWith('sb_reference_count', 2);
    expect(ad.setDataValue).toHaveBeenCalledWith('sb_reference_matched_count', 1);
    expect(ad.setDataValue).toHaveBeenCalledWith('sb_reference_unresolved_count', 1);
    expect(ad.setDataValue).toHaveBeenCalledWith('sb_reference_ignored_count', 0);
  });
});
