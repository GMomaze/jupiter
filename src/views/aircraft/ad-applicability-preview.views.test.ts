import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const controller = readFile('src/modules/aircraft/aircraft.controller.ts');
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
    ].forEach((column) => {
      expect(view).toContain(column);
    });
  });

  it('keeps the AD applicability preview section read-only', () => {
    const start = view.indexOf('AD Applicability Preview');
    const end = view.indexOf("<% const sections = [");
    const previewSection = view.slice(start, end);

    expect(previewSection).not.toContain('<form');
    expect(previewSection).not.toContain('method="POST"');
    expect(previewSection).not.toContain('action=');
    expect(previewSection).not.toContain('<button');
    expect(previewSection).not.toContain('ComplianceItem');
    expect(previewSection).not.toContain('ComplianceAssignment');
    expect(previewSection).not.toContain('Workpack');
    expect(previewSection).not.toContain('DueStatus');
  });
});
