import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readView = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('compliance single-record creation views', () => {
  it('exposes manual create from the compliance maintenance data landing page', () => {
    const template = readView('src/views/compliance-maintenance-data/index.ejs');

    expect(template).toContain('href="/library/ads/new"');
    expect(template).toContain('Add New AD');
    expect(template).toContain('href="/library/sbs/new"');
    expect(template).toContain('Add New SB / SL / SI');
    expect(template).toContain('href="/library/sids/new"');
    expect(template).toContain('Add New SID');
  });

  it('exposes manual create from the Library dashboard', () => {
    const template = readView('src/views/library/index.ejs');

    expect(template).toContain('href="/library/ads/new"');
    expect(template).toContain('Add New AD');
    expect(template).toContain('href="/library/sbs/new"');
    expect(template).toContain('Add New SB / SL / SI');
    expect(template).toContain('href="/library/sids/new"');
    expect(template).toContain('Add New SID');
  });

  it('renders the AD create form fields', () => {
    const template = readView('src/views/library/ads/new.ejs');

    expect(template).toContain('Add New AD');
    expect(template).toContain('action="/library/ads"');
    expect(template).toContain('name="ad_number"');
    expect(template).toContain('name="subject_heading"');
    expect(template).toContain('name="interval_hours"');
    expect(template).toContain('name="interval_months"');
  });

  it('makes SB create reachable from the SB list and documents deferred links', () => {
    const listTemplate = readView('src/views/library/sbs/index.ejs');
    const formTemplate = readView('src/views/library/sbs/new.ejs');

    expect(listTemplate).toContain('href="/library/sbs/new"');
    expect(listTemplate).toContain('Add New SB / SL / SI');
    expect(formTemplate).toContain('action="/library/sbs"');
    expect(formTemplate).toContain('name="category"');
    expect(formTemplate).toContain('name="reference"');
    expect(formTemplate).toContain('Related AD and ATA linkage will be added in a later phase.');
  });

  it('renders the SID create form fields', () => {
    const template = readView('src/views/library/sids/new.ejs');

    expect(template).toContain('Add New SID');
    expect(template).toContain('action="/library/sids"');
    expect(template).toContain('name="manufacturer"');
    expect(template).toContain('name="reference"');
    expect(template).toContain('name="initial_interval_hours"');
    expect(template).toContain('name="repeat_interval_months"');
    expect(template).toContain('name="is_active"');
  });

  it('adds manual create buttons to the AD and SID list pages', () => {
    expect(readView('src/views/library/ads/index.ejs')).toContain('href="/library/ads/new"');
    expect(readView('src/views/library/ads/index.ejs')).toContain('Add New AD');
    expect(readView('src/views/library/sbs/index.ejs')).toContain('href="/library/sbs/new"');
    expect(readView('src/views/library/sbs/index.ejs')).toContain('Add New SB / SL / SI');
    expect(readView('src/views/library/sids/index.ejs')).toContain('href="/library/sids/new"');
    expect(readView('src/views/library/sids/index.ejs')).toContain('Add New SID');
  });
});
