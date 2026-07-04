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

const adListView = readFileSync(
  resolve(process.cwd(), 'src/views/library/ads/index.ejs'),
  'utf8'
);
const sbListView = readFileSync(
  resolve(process.cwd(), 'src/views/library/sbs/index.ejs'),
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AD-to-SB read-only list counts', () => {
  it('adds AD list count columns without action controls', () => {
    expect(adListView).toContain('SB References');
    expect(adListView).toContain('Matched');
    expect(adListView).toContain('Unresolved');
    expect(adListView).toContain('Ignored');
    expect(adListView).toContain('directive.sb_reference_count || 0');
    expect(adListView).toContain('directive.sb_reference_matched_count || 0');
    expect(adListView).toContain('directive.sb_reference_unresolved_count || 0');
    expect(adListView).toContain('directive.sb_reference_ignored_count || 0');
    expect(adListView).not.toContain('service-bulletin-references/refresh?_csrf');
  });

  it('adds SB list referenced-by-AD count without action controls', () => {
    expect(sbListView).toContain('Referenced by ADs');
    expect(sbListView).toContain('bulletin.referenced_by_ad_count || 0');
    expect(sbListView).not.toContain('service-bulletin-references/refresh?_csrf');
  });

  it('attaches matched, unresolved, ignored, and total SB reference counts to AD list rows', async () => {
    const adOne = row('ad-1');
    const adTwo = row('ad-2');

    vi.spyOn(AirworthinessDirective, 'findAll').mockResolvedValue([adOne, adTwo]);
    vi.spyOn(AdServiceBulletinReference, 'findAll').mockResolvedValue([
      { airworthiness_directive_id: 'ad-1', match_status: 'MATCHED' },
      { airworthiness_directive_id: 'ad-1', match_status: 'UNRESOLVED' },
      { airworthiness_directive_id: 'ad-1', match_status: 'IGNORED' },
      { airworthiness_directive_id: 'ad-2', match_status: 'MATCHED' },
    ] as any);

    await LibraryService.getAirworthinessDirectives();

    expect(adOne.setDataValue).toHaveBeenCalledWith('sb_reference_count', 3);
    expect(adOne.setDataValue).toHaveBeenCalledWith('sb_reference_matched_count', 1);
    expect(adOne.setDataValue).toHaveBeenCalledWith('sb_reference_unresolved_count', 1);
    expect(adOne.setDataValue).toHaveBeenCalledWith('sb_reference_ignored_count', 1);
    expect(adTwo.setDataValue).toHaveBeenCalledWith('sb_reference_count', 1);
    expect(adTwo.setDataValue).toHaveBeenCalledWith('sb_reference_matched_count', 1);
    expect(adTwo.setDataValue).toHaveBeenCalledWith('sb_reference_unresolved_count', 0);
    expect(adTwo.setDataValue).toHaveBeenCalledWith('sb_reference_ignored_count', 0);
  });

  it('renders empty AD reference counts as zero through list row defaults', async () => {
    const ad = row('ad-empty');

    vi.spyOn(AirworthinessDirective, 'findAll').mockResolvedValue([ad]);
    vi.spyOn(AdServiceBulletinReference, 'findAll').mockResolvedValue([]);

    await LibraryService.getAirworthinessDirectives();

    expect(ad.setDataValue).toHaveBeenCalledWith('sb_reference_count', 0);
    expect(ad.setDataValue).toHaveBeenCalledWith('sb_reference_matched_count', 0);
    expect(ad.setDataValue).toHaveBeenCalledWith('sb_reference_unresolved_count', 0);
    expect(ad.setDataValue).toHaveBeenCalledWith('sb_reference_ignored_count', 0);
  });

  it('attaches distinct referenced-by-AD counts to SB list rows', async () => {
    const sbOne = row('sb-1');
    const sbTwo = row('sb-2');

    vi.spyOn(ServiceBulletin, 'findAll').mockResolvedValue([sbOne, sbTwo]);
    vi.spyOn(AdServiceBulletinReference, 'findAll').mockResolvedValue([
      { airworthiness_directive_id: 'ad-1', matched_service_bulletin_id: 'sb-1' },
      { airworthiness_directive_id: 'ad-1', matched_service_bulletin_id: 'sb-1' },
      { airworthiness_directive_id: 'ad-2', matched_service_bulletin_id: 'sb-1' },
      { airworthiness_directive_id: 'ad-3', matched_service_bulletin_id: 'sb-2' },
    ] as any);

    await LibraryService.getServiceBulletins();

    expect(sbOne.setDataValue).toHaveBeenCalledWith('referenced_by_ad_count', 2);
    expect(sbTwo.setDataValue).toHaveBeenCalledWith('referenced_by_ad_count', 1);
  });

  it('does not call SB applicability, compliance, task, workpack, or import side effects', async () => {
    vi.spyOn(AirworthinessDirective, 'findAll').mockResolvedValue([]);
    const referenceFind = vi.spyOn(AdServiceBulletinReference, 'findAll');
    const sbCreate = vi.spyOn(ServiceBulletin, 'create');
    const sbApplicability = vi.spyOn(ServiceBulletinModel, 'findOrCreate');
    const complianceItemCreate = vi.spyOn(ComplianceItem, 'create');
    const complianceAssignmentCreate = vi.spyOn(ComplianceAssignment, 'create');

    await LibraryService.getAirworthinessDirectives();

    expect(referenceFind).not.toHaveBeenCalled();
    expect(sbCreate).not.toHaveBeenCalled();
    expect(sbApplicability).not.toHaveBeenCalled();
    expect(complianceItemCreate).not.toHaveBeenCalled();
    expect(complianceAssignmentCreate).not.toHaveBeenCalled();
  });
});
