import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const headerTemplate = readFileSync(
  resolve(process.cwd(), 'src/views/partials/header.ejs'),
  'utf8'
);

describe('header compliance maintenance data navigation', () => {
  it('makes the top-level compliance maintenance data item a real link', () => {
    expect(headerTemplate).toContain('href="/library"');
    expect(headerTemplate).toContain('href="/compliance-maintenance-data"');
    expect(headerTemplate).toMatch(
      /<a\s+href="\/compliance-maintenance-data"[\s\S]*?>\s*Compliance \/ Maintenance Data\s*<\/a>/
    );
    expect(headerTemplate).not.toContain('href="#"');
  });

  it('keeps Library and Compliance Maintenance Data on distinct routes', () => {
    expect(headerTemplate).toMatch(
      /<a\s+href="\/library"\s+class="hover:text-slate-300">\s*Library\s*<\/a>/
    );
    expect(headerTemplate).toMatch(
      /<a\s+href="\/compliance-maintenance-data"[\s\S]*?>\s*Compliance \/ Maintenance Data\s*<\/a>/
    );
  });

  it('exposes the approved compliance maintenance data menu links', () => {
    expect(headerTemplate).toContain('Compliance / Maintenance Data');
    expect(headerTemplate).toContain('href="/library/ads"');
    expect(headerTemplate).toContain('Airworthiness Directives');
    expect(headerTemplate).toContain('href="/library/sbs"');
    expect(headerTemplate).toContain('Service Bulletins / Letters / Instructions');
    expect(headerTemplate).toContain('href="/library/sids"');
    expect(headerTemplate).toContain('Supplemental Inspection Documents');
    expect(headerTemplate).toContain('href="/library/tasks"');
    expect(headerTemplate).toContain('Standard Tasks / Maintenance Requirements');
    expect(headerTemplate).toContain('href="/library/sbs/import-issues/unallocated-models"');
    expect(headerTemplate).toContain('Applicability / Allocations');
  });

  it('does not keep the old standalone service bulletin header link', () => {
    expect(headerTemplate).not.toContain(
      '<a href="/service-bulletins" class="hover:text-slate-300">Service Bulletins</a>'
    );
  });

  it('shows only the approved active Organisation projection and switch fields', () => {
    expect(headerTemplate).toContain('activeOrganisationUi.current.tenantDisplayName');
    expect(headerTemplate).toContain('activeOrganisationUi.current.tenantCode');
    expect(headerTemplate).toContain('activeOrganisationUi.alternatives.length > 0');
    expect(headerTemplate).toContain('action="/organisation/switch"');
    expect(headerTemplate).toContain('hx-post="/organisation/switch"');
    expect(headerTemplate).toContain('name="tenant_public_id"');
    expect(headerTemplate).toContain('name="expected_context_token"');
    expect(headerTemplate).toContain('name="_csrf"');
    expect(headerTemplate).not.toMatch(/membershipId|membership_id|tenantId|tenant_id/);
    expect(headerTemplate).not.toMatch(/TENANT_SWITCH_TOKEN_SECRET/);
  });
});
