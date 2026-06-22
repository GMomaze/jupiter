import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const complianceTemplate = readFileSync(
  resolve(process.cwd(), 'src/views/compliance-maintenance-data/index.ejs'),
  'utf8'
);

describe('compliance maintenance data landing page', () => {
  it('contains only existing compliance maintenance data links', () => {
    expect(complianceTemplate).toContain('Compliance / Maintenance Data');
    expect(complianceTemplate).toContain('href="/library/ads/new"');
    expect(complianceTemplate).toContain('href="/library/ads"');
    expect(complianceTemplate).toContain('href="/library/ads/import"');
    expect(complianceTemplate).toContain('href="/library/sbs/new"');
    expect(complianceTemplate).toContain('href="/library/sbs"');
    expect(complianceTemplate).toContain('href="/library/sbs/import"');
    expect(complianceTemplate).toContain('href="/library/sbs/import-issues/unallocated-models"');
    expect(complianceTemplate).toContain('href="/library/sids/new"');
    expect(complianceTemplate).toContain('href="/library/sids"');
    expect(complianceTemplate).toContain('href="/library/tasks"');
    expect(complianceTemplate).toContain('href="/library/tasks/import"');
    expect(complianceTemplate).not.toContain('href="#"');
  });

  it('does not duplicate component management links from the Library dashboard', () => {
    expect(complianceTemplate).not.toContain('Component Manufacturers / Models');
    expect(complianceTemplate).not.toContain('Create Asset Type');
    expect(complianceTemplate).not.toContain('Generic Model Import');
    expect(complianceTemplate).not.toContain('Serialized Components');
    expect(complianceTemplate).not.toContain('Serialized Reconciliation');
    expect(complianceTemplate).not.toContain('Migration Dry Run');
    expect(complianceTemplate).not.toContain('Create Serialized Component');
  });
});
