import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const view = readFile('src/views/library/ads/applicability-review.ejs');
const routes = readFile('src/modules/library/library.routes.ts');
const controller = readFile('src/modules/library/library.controller.ts');
const adListView = readFile('src/views/library/ads/index.ejs');

describe('AD applicability review read-only page', () => {
  it('registers the read-only review route with the documented LIBRARY_EDIT fallback', () => {
    expect(routes).toContain("'/ads/applicability-review'");
    expect(routes).toContain("requirePermission('LIBRARY_EDIT')");
    expect(routes).toContain('LibraryController.renderAdApplicabilityReview');
    expect(routes).not.toContain("'/ads/applicability-review/refresh'");
    expect(routes).not.toContain("'/ads/applicability-review/allocations/:id/accept'");
    expect(routes).not.toContain("'/ads/applicability-review/allocations/:id/ignore'");
    expect(routes).not.toContain("'/ads/applicability-review/allocations/:id/restore'");
  });

  it('renders the required review buckets and UI columns', () => {
    [
      'SUGGESTED',
      'NEEDS_REVIEW',
      'ACCEPTED',
      'IGNORED',
      'AD Number',
      'Subject',
      'Source Make',
      'Source Model',
      'Source Product Type/Subtype',
      'Target Type',
      'Matched Manufacturer/Model',
      'Classification',
      'Status',
      'Match Reason',
      'Reviewed By / Reviewed At',
      'Review Reason',
    ].forEach((expectedContent) => {
      expect(view).toContain(expectedContent);
    });
  });

  it('keeps the review view read-only with no POST forms or action buttons', () => {
    expect(view).not.toContain('<form');
    expect(view).not.toContain('method="POST"');
    expect(view).not.toContain('<button');
    expect(view).not.toContain('Accept');
    expect(view).not.toContain('Ignore');
    expect(view).not.toContain('Restore');
    expect(view).not.toContain('Refresh');
  });

  it('does not call allocation persistence from route or controller code', () => {
    expect(routes).not.toContain('persistSuggestedAllocations');
    expect(controller).not.toContain('persistSuggestedAllocations');
    expect(controller).toContain('LibraryService.getAdApplicabilityReviewAllocations');
  });

  it('uses existing user fields for reviewer display', () => {
    const service = readFile('src/modules/library/library.service.ts');

    expect(service).toContain("attributes: ['id', 'full_name', 'email']");
    expect(view).toContain('allocation.Reviewer?.full_name');
    expect(view).not.toContain('allocation.Reviewer?.name');
  });

  it('links the review screen from the AD list without adding mutation controls', () => {
    expect(adListView).toContain('href="/library/ads/applicability-review"');
    expect(adListView).toContain('Applicability Review');
  });
});
