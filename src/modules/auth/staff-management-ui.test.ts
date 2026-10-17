import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string): string =>
  readFileSync(resolve(process.cwd(), file), 'utf8');

const header = read('src/views/partials/header.ejs');
const staffList = read('src/views/auth/staff-list.ejs');
const dashboard = read('src/views/dashboard/index.ejs');
const routes = read('src/modules/auth/staff.routes.ts');

describe('tenant staff management interface', () => {

  it('adds an ADMIN-gated Staff Management navigation link', () => {
    expect(header).toContain('href="/auth/staff"');
    expect(header).toContain('Staff Management');
    expect(header).toContain('user.roles.some');
    expect(header).toContain("=== 'ADMIN'");
  });

  it('gates the navigation link behind the ADMIN role check', () => {
    const guard = header.indexOf("=== 'ADMIN'");
    const link = header.indexOf('href="/auth/staff"');
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(link).toBeGreaterThanOrEqual(0);
    expect(guard).toBeLessThan(link);
  });

  it('wraps the staff screen with the standard header and footer', () => {
    expect(staffList).toContain("include('../partials/header')");
    expect(staffList).toContain("include('../partials/footer')");
  });

  it('identifies the active company being managed', () => {
    expect(staffList).toContain('activeOrganisationUi.current.tenantDisplayName');
    expect(staffList).toContain('activeOrganisationUi.current.tenantCode');
  });

  it('provides an invite form posting to the existing route', () => {
    expect(staffList).toContain('action="/auth/staff/invite"');
    expect(staffList).toContain('name="email"');
    expect(staffList).toContain('name="fullName"');
    expect(staffList).toContain('name="reason"');
  });

  it('provides disable and reinstate controls using the existing routes', () => {
    expect(staffList).toContain('/auth/staff/<%= staff.id %>/disable');
    expect(staffList).toContain('/auth/staff/<%= staff.id %>/reinstate');
  });

  it('requires confirmation before disabling a user', () => {
    expect(staffList).toMatch(/onsubmit="return confirm\('Disable access/);
  });

  it('preserves the existing role-assignment checkboxes', () => {
    expect(staffList).toContain('class="staff-role-toggle"');
    expect(staffList).toContain('data-user-id="<%= staff.id %>"');
    expect(staffList).toContain('data-role-id="<%= role.id %>"');
  });

  it('includes a CSRF token on every mutating form', () => {
    const csrfCount = (staffList.match(/name="_csrf"/g) || []).length;
    expect(csrfCount).toBeGreaterThanOrEqual(3); // invite + disable + reinstate
  });

  it('routes invite/disable/reinstate through flash + redirect (no raw JSON success)', () => {
    expect(routes).toContain("req.flash('success'");
    expect(routes).toContain("res.redirect('/auth/staff')");
    expect(routes).toContain('LAST_ACTIVE_TENANT_ADMIN_REQUIRED');
  });

  it('replaces the hard-coded dashboard Read only label with a derived indicator', () => {
    expect(dashboard).toContain('accessLabel');
    expect(dashboard).not.toContain('>Read only</span>');
    expect(dashboard).not.toContain('>Read only</p>');
  });
});

describe('staff role checkbox state correction', () => {
  it('reverts the checkbox to its previous state on a failed toggle', () => {
    expect(staffList).toContain('checkbox.checked = previous');
  });

  it('shows a clear error for the last-administrator HTTP 409', () => {
    expect(staffList).toContain('response.status === 409');
    expect(staffList).toMatch(/last active company administrator/);
  });

  it('shows an error for other failed role changes', () => {
    expect(staffList).toContain('The role change was not applied.');
  });

  it('handles network failures by reverting the checkbox', () => {
    expect(staffList).toContain('network error');
  });

  it('disables the checkbox during the request to prevent rapid repeated toggles', () => {
    expect(staffList).toContain('checkbox.disabled = true');
    expect(staffList).toContain('checkbox.disabled = false');
  });

  it('clears the error and keeps the new state on success', () => {
    expect(staffList).toContain('clearError()');
  });

  it('preserves the toggle-role backend response contract (200 / 409)', () => {
    expect(routes).toContain('res.status(200).send()');
    expect(routes).toContain('res.status(409).send()');
  });
});
