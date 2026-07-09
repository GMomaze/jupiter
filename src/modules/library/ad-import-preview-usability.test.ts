import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { previewAdImportFile } from './ad-import.controller.js';

const previewView = readFileSync(
  resolve(process.cwd(), 'src/views/library/ads/preview.ejs'),
  'utf8'
);
const resultView = readFileSync(
  resolve(process.cwd(), 'src/views/library/ads/result.ejs'),
  'utf8'
);

function countOccurrences(source: string, value: string) {
  return source.split(value).length - 1;
}

describe('AD import preview usability', () => {
  it('keeps CSV Subject values in the parsed preview rows', async () => {
    const csv = [
      'AD Number,Status,Effective Date,Subject',
      '2000-NM-42-AD,Active,06/06/2000,Aileron Ribs',
    ].join('\n');

    const preview = await previewAdImportFile(
      Buffer.from(csv, 'utf8'),
      'ad-import.csv',
      'text/csv'
    );

    expect(preview.rows[0]?.values.subject).toBe('Aileron Ribs');
  });

  it('displays FAA docket and subject values while keeping rows invalid without a true AD Number', async () => {
    const csv = [
      'Docket Number,Amendment Number,Publish Date,Issue Date,Effective Date,Subject',
      '2000-NM-42-AD,39-11728,05/22/2000,05/08/2000,06/06/2000,Aileron Ribs',
    ].join('\n');

    const preview = await previewAdImportFile(
      Buffer.from(csv, 'utf8'),
      'faa-ad.csv',
      'text/csv'
    );

    expect(preview.rows[0]?.status).toBe('INVALID');
    expect(preview.rows[0]?.values.ad_number).toBe('');
    expect(preview.rows[0]?.values.docket_number).toBe('2000-NM-42-AD');
    expect(preview.rows[0]?.values.amendment_number).toBe('39-11728');
    expect(preview.rows[0]?.values.citation_publish_date).toBe('2000-05-22');
    expect(preview.rows[0]?.values.issue_date).toBe('2000-05-08');
    expect(preview.rows[0]?.values.effective_date).toBe('2000-06-06');
    expect(preview.rows[0]?.values.subject).toBe('Aileron Ribs');
    expect(preview.rows[0]?.errors).toContain(
      'AD Number is required. Docket Number is displayed for review but is not used as AD Number.'
    );
  });

  it('finds the real header row when FAA exports contain preamble rows', async () => {
    const csv = [
      'FAA Airworthiness Directive Export',
      '',
      'Docket Number,Amendment Number,Publish Date,Issue Date,Effective Date,Subject',
      '2000-NM-42-AD,39-11728,05/22/2000,05/08/2000,06/06/2000,Aileron Ribs',
    ].join('\n');

    const preview = await previewAdImportFile(
      Buffer.from(csv, 'utf8'),
      'faa-ad.csv',
      'text/csv'
    );

    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0]?.rowNumber).toBe(4);
    expect(preview.rows[0]?.values.docket_number).toBe('2000-NM-42-AD');
    expect(preview.rows[0]?.values.subject).toBe('Aileron Ribs');
  });

  it('maps a true AD Number header to the required AD Number preview value', async () => {
    const csv = [
      'Airworthiness Directive Number,Status,Effective Date,Subject,Docket Number',
      '2000-10-01,Active,06/06/2000,Aileron Ribs,2000-NM-42-AD',
    ].join('\n');

    const preview = await previewAdImportFile(
      Buffer.from(csv, 'utf8'),
      'faa-ad.csv',
      'text/csv'
    );

    expect(preview.rows[0]?.values.ad_number).toBe('2000-10-01');
    expect(preview.rows[0]?.values.docket_number).toBe('2000-NM-42-AD');
    expect(preview.rows[0]?.values.subject).toBe('Aileron Ribs');
    expect(preview.rows[0]?.errors).not.toContain('AD Number is required.');
  });

  it('preserves first non-empty values when later duplicate mapped headers are blank', async () => {
    const csv = [
      [
        'AD Number',
        'Status',
        'Effective Date',
        'Subject',
        'Docket Number',
        'AD Number',
        'Status',
        'Effective Date',
      ].join(','),
      [
        '96-01-01',
        'Historical',
        '01/19/1996',
        'Blade Taper Bore',
        '95-ANE-73',
        '',
        '',
        '',
      ].join(','),
    ].join('\n');

    const preview = await previewAdImportFile(
      Buffer.from(csv, 'utf8'),
      'faa-ad.csv',
      'text/csv'
    );

    expect(preview.rows[0]?.status).toBe('VALID');
    expect(preview.rows[0]?.values.ad_number).toBe('96-01-01');
    expect(preview.rows[0]?.values.status).toBe('Historical');
    expect(preview.rows[0]?.values.effective_date).toBe('1996-01-19');
    expect(preview.rows[0]?.values.subject).toBe('Blade Taper Bore');
    expect(preview.rows[0]?.values.docket_number).toBe('95-ANE-73');
    expect(preview.rows[0]?.warnings).toContain(
      'Duplicate AD Number columns found; first non-empty value was preserved.'
    );
    expect(preview.rows[0]?.warnings).toContain(
      'Duplicate Status columns found; first non-empty value was preserved.'
    );
    expect(preview.rows[0]?.warnings).toContain(
      'Duplicate Effective Date columns found; first non-empty value was preserved.'
    );
  });

  it('preserves first non-empty values and warns when later duplicate mapped headers contain values', async () => {
    const csv = [
      [
        'AD Number',
        'Status',
        'Effective Date',
        'Subject',
        'Docket Number',
        'AD Number',
        'Status',
        'Effective Date',
      ].join(','),
      [
        '96-01-01',
        'Historical',
        '01/19/1996',
        'Blade Taper Bore',
        '95-ANE-73',
        '99-99-99',
        'Active',
        '02/20/1997',
      ].join(','),
    ].join('\n');

    const preview = await previewAdImportFile(
      Buffer.from(csv, 'utf8'),
      'faa-ad.csv',
      'text/csv'
    );

    expect(preview.rows[0]?.status).toBe('VALID');
    expect(preview.rows[0]?.values.ad_number).toBe('96-01-01');
    expect(preview.rows[0]?.values.status).toBe('Historical');
    expect(preview.rows[0]?.values.effective_date).toBe('1996-01-19');
    expect(preview.rows[0]?.values.subject).toBe('Blade Taper Bore');
    expect(preview.rows[0]?.values.docket_number).toBe('95-ANE-73');
    expect(preview.rows[0]?.warnings).toContain(
      'Duplicate AD Number column ignored; first non-empty value was preserved.'
    );
    expect(preview.rows[0]?.warnings).toContain(
      'Duplicate Status column ignored; first non-empty value was preserved.'
    );
    expect(preview.rows[0]?.warnings).toContain(
      'Duplicate Effective Date column ignored; first non-empty value was preserved.'
    );
  });

  it('renders commit actions at both the top and bottom without changing the commit form payload', () => {
    const action = 'action="/library/ads/import/commit?_csrf=<%= encodeURIComponent(csrfToken) %>"';

    expect(countOccurrences(previewView, 'Commit Valid AD Rows')).toBe(2);
    expect(countOccurrences(previewView, action)).toBe(2);
    expect(countOccurrences(previewView, 'method="POST"')).toBe(2);
    expect(countOccurrences(previewView, 'name="import_token" value="<%= importToken %>"')).toBe(2);
    expect(countOccurrences(previewView, 'name="_csrf" value="<%= csrfToken %>"')).toBe(2);
  });

  it('adds AD-number find controls and stable row data attributes to the preview list', () => {
    expect(previewView).toContain('placeholder="Find AD number..."');
    expect(previewView).toContain('id="ad-import-find-button"');
    expect(previewView).toContain('No matching AD found.');
    expect(previewView).toContain('data-ad-number="<%= row.values.ad_number || \'\' %>"');
    expect(previewView).toContain('String(row.dataset.adNumber || \'\').toLowerCase().includes(query)');
    expect(previewView).toContain("highlightedRow.classList.add('bg-blue-50', 'ring-2', 'ring-blue-300')");
  });

  it('renders Subject as a first-class preview column from parsed row values', () => {
    expect(previewView).toContain('>Subject</th>');
    expect(previewView).toContain('row.values.subject_heading && row.values.subject');
    expect(previewView).toContain('<%= row.values.subject %>');
    expect(previewView).toContain('<%= row.values.subject || row.values.subject_heading || \'-\' %>');
    expect(previewView).toContain('docket_number');
    expect(previewView).toContain('amendment_number');
    expect(previewView).toContain('issue_date');
  });

  it('renders Subject and AD-number find controls in the post-commit result list', () => {
    expect(resultView).toContain('placeholder="Find AD number..."');
    expect(resultView).toContain('id="ad-import-find-button"');
    expect(resultView).toContain('data-ad-number="<%= row.adNumber || \'\' %>"');
    expect(resultView).toContain('>Subject</th>');
    expect(resultView).toContain('<%= row.subject || \'-\' %>');
  });
});
