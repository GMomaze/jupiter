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
  });

  it('renders Subject and AD-number find controls in the post-commit result list', () => {
    expect(resultView).toContain('placeholder="Find AD number..."');
    expect(resultView).toContain('id="ad-import-find-button"');
    expect(resultView).toContain('data-ad-number="<%= row.adNumber || \'\' %>"');
    expect(resultView).toContain('>Subject</th>');
    expect(resultView).toContain('<%= row.subject || \'-\' %>');
  });
});
