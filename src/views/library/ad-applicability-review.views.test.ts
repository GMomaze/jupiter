import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const view = readFile('src/views/library/ads/applicability-review.ejs');
const routes = readFile('src/modules/library/library.routes.ts');
const controller = readFile('src/modules/library/library.controller.ts');
const service = readFile('src/modules/library/library.service.ts');
const adListView = readFile('src/views/library/ads/index.ejs');

describe('AD applicability review read-only page', () => {
  it('registers the review and manual refresh routes with the documented LIBRARY_EDIT fallback', () => {
    expect(routes).toContain("'/ads/applicability-review'");
    expect(routes).toContain("'/ads/applicability-review/refresh'");
    expect(routes).toContain("'/ads/applicability-review/allocations/:id/accept'");
    expect(routes).toContain("'/ads/applicability-review/allocations/:id/ignore'");
    expect(routes).toContain("requirePermission('LIBRARY_EDIT')");
    expect(routes).toContain('csrfProtection');
    expect(routes).toContain('LibraryController.renderAdApplicabilityReview');
    expect(routes).toContain('LibraryController.refreshAdApplicabilityReview');
    expect(routes).toContain('LibraryController.acceptAdApplicabilityAllocation');
    expect(routes).toContain('LibraryController.ignoreAdApplicabilityAllocation');
    expect(routes).not.toContain("'/ads/applicability-review/allocations/:id/restore'");
    expect(routes).not.toContain("'/ads/applicability-review/allocations/:id/link-model'");
    expect(routes).not.toContain("'/ads/applicability-review/allocations/:id/link-manufacturer'");
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

  it('adds manual refresh and accept-ignore forms without restore or link actions', () => {
    expect(view).toContain('method="POST"');
    expect(view).toContain('action="/library/ads/applicability-review/refresh?_csrf=<%= encodeURIComponent(csrfToken) %>"');
    expect(view).toContain('action="/library/ads/applicability-review/allocations/<%= allocation.id %>/accept?_csrf=<%= encodeURIComponent(csrfToken) %>"');
    expect(view).toContain('action="/library/ads/applicability-review/allocations/<%= allocation.id %>/ignore?_csrf=<%= encodeURIComponent(csrfToken) %>"');
    expect(view).toContain('name="_csrf" value="<%= csrfToken %>"');
    expect(view).toContain('Refresh Suggestions');
    expect(view).toContain('Accept Applicability');
    expect(view).toContain('Ignore Suggestion');
    expect(view).toContain("['SUGGESTED', 'NEEDS_REVIEW'].includes(allocation.status)");
    expect(view).toContain('name="review_reason"');
    expect(view).not.toContain('Restore');
    expect(view).not.toContain('Link Model');
    expect(view).not.toContain('Link Manufacturer');
  });

  it('keeps allocation mutations scoped to manual refresh and explicit review actions', () => {
    expect(routes).not.toContain('persistSuggestedAllocations');
    expect(controller).toContain('LibraryService.getAdApplicabilityReviewAllocations');
    expect(controller).toContain('LibraryService.refreshAdApplicabilityReviewAllocations');
    expect(controller).toContain("LibraryService.reviewAdApplicabilityAllocation(");
    expect(controller).toContain("'ACCEPTED'");
    expect(controller).toContain("'IGNORED'");
  });

  it('renders visible refresh feedback messages with the required summary counts', () => {
    expect(view).toContain('messages && messages.success && messages.success.length');
    expect(view).toContain('messages.success[0]');
    expect(view).toContain('messages && messages.error && messages.error.length');
    expect(view).toContain('messages.error[0]');
    [
      'modelsScanned',
      'adsScanned',
      'created',
      'updated',
      'skippedAccepted',
      'skippedIgnored',
      'unchanged',
    ].forEach((expectedCount) => {
      expect(controller).toContain(expectedCount);
    });
    [
      'model(s) scanned',
      'active AD(s) scanned',
      'created',
      'updated',
      'accepted skipped',
      'ignored skipped',
      'unchanged',
    ].forEach((expectedMessageText) => {
      expect(controller).toContain(expectedMessageText);
    });
  });

  it('uses existing user fields for reviewer display', () => {
    expect(service).toContain("attributes: ['id', 'full_name', 'email']");
    expect(view).toContain('allocation.Reviewer?.full_name');
    expect(view).not.toContain('allocation.Reviewer?.name');
  });

  it('keeps refresh orchestration scoped to relevance and allocation persistence', () => {
    const refreshStart = service.indexOf('static async refreshAdApplicabilityReviewAllocations');
    const refreshEnd = service.indexOf('static async createAirworthinessDirective');
    const refreshMethod = service.slice(refreshStart, refreshEnd);

    expect(refreshMethod).toContain('ComponentModel.findAll');
    expect(refreshMethod).toContain('AirworthinessDirective.count');
    expect(refreshMethod).toContain('AdRelevanceService.getReadOnlyRelevanceForModel');
    expect(refreshMethod).toContain('AdApplicabilityAllocationService.persistSuggestedAllocations');
    expect(refreshMethod).toContain('getAssignedAirworthinessDirectives');
    expect(refreshMethod).not.toContain('ComplianceItem');
    expect(refreshMethod).not.toContain('ComplianceAssignment');
    expect(refreshMethod).not.toContain('ServiceBulletin');
    expect(refreshMethod).not.toContain('SupplementalInspectionDocument');
    expect(refreshMethod).not.toContain('TaskTemplate');
    expect(refreshMethod).not.toContain('Workpack');
    expect(refreshMethod).not.toContain('DueStatus');
  });

  it('keeps accept-ignore controllers scoped to allocation review updates', () => {
    const acceptStart = controller.indexOf('static async acceptAdApplicabilityAllocation');
    const ignoreEnd = controller.indexOf('static renderAdCreateForm');
    const actionMethods = controller.slice(acceptStart, ignoreEnd);

    expect(actionMethods).toContain("LibraryService.reviewAdApplicabilityAllocation(");
    expect(actionMethods).toContain("'ACCEPTED'");
    expect(actionMethods).toContain("'IGNORED'");
    expect(actionMethods).not.toContain('ComplianceItem');
    expect(actionMethods).not.toContain('ComplianceAssignment');
    expect(actionMethods).not.toContain('Aircraft');
    expect(actionMethods).not.toContain('ServiceBulletin');
    expect(actionMethods).not.toContain('SupplementalInspectionDocument');
    expect(actionMethods).not.toContain('TaskTemplate');
    expect(actionMethods).not.toContain('Workpack');
    expect(actionMethods).not.toContain('DueStatus');
  });

  it('links the review screen from the AD list', () => {
    expect(adListView).toContain('href="/library/ads/applicability-review"');
    expect(adListView).toContain('Applicability Review');
  });
});
