import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const controller = readFile('src/modules/aircraft/aircraft.controller.ts');
const routes = readFile('src/modules/aircraft/aircraft.routes.ts');
const view = readFile('src/views/aircraft/applicability.ejs');

describe('aircraft AD applicability preview view', () => {
  it('loads the read-only accepted AD allocation preview on the aircraft applicability page', () => {
    expect(controller).toContain('AircraftService.getAdApplicabilityPreviewForAircraft');
    expect(controller).toContain('adApplicabilityPreview');
    expect(view).toContain('AD Applicability Preview');
    expect(view).toContain('Preview only — does not create compliance status.');
  });

  it('renders the required preview columns', () => {
    [
      'AD Number',
      'Subject',
      'Allocation Type',
      'Matched Model/Manufacturer',
      'Classification',
      'Accepted By / Accepted At',
      'Review Reason',
      'Action',
    ].forEach((column) => {
      expect(view).toContain(column);
    });
  });

  it('adds only the approved manual AD compliance assignment action to accepted preview rows', () => {
    const start = view.indexOf('AD Applicability Preview');
    const end = view.indexOf("<% const sections = [");
    const previewSection = view.slice(start, end);

    expect(previewSection).toContain('Create AD Compliance Assignment');
    expect(previewSection).toContain(
      'This creates an aircraft compliance assignment only. It does not record compliance status or due dates.'
    );
    expect(previewSection).toContain(
      'action="/aircraft/<%= aircraft.id %>/ad-applicability/<%= item.id %>/create-compliance-assignment?_csrf=<%= encodeURIComponent(csrfToken) %>"'
    );
    expect(previewSection).toContain('name="_csrf" value="<%= csrfToken %>"');
    expect(previewSection).not.toContain('aircraft_compliance');
    expect(previewSection).not.toContain('next_due');
    expect(previewSection).not.toContain('compliance_status');
    expect(previewSection).not.toContain('Workpack');
    expect(previewSection).not.toContain('DueStatus');
  });

  it('protects the create assignment route with the dedicated permission and CSRF', () => {
    const routeStart = routes.indexOf(
      "'/:id/ad-applicability/:allocationId/create-compliance-assignment'"
    );
    const routeEnd = routes.indexOf("router.post('/:id/utilisation/preview'", routeStart);
    const routeBlock = routes.slice(routeStart, routeEnd);

    expect(routeBlock).toContain('requireAuth');
    expect(routeBlock).toContain("requirePermission('AD_COMPLIANCE_ASSIGN_CREATE')");
    expect(routeBlock).toContain('csrfProtection');
    expect(routeBlock).toContain('AircraftController.createAdComplianceAssignment');
  });
});
