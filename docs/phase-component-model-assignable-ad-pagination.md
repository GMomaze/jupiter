# Phase 22 - Component Model Assignable AD Pagination

## Active Phase

Phase 22 FAA AD Import and Applicability

## Mode

DEFINE

## Audit Result

PARTIAL_MATCH

The Component Model -> Compliance Data tab has an assignable AD list and AD-number search, but the assignable list still returns only the first 200 active unassigned AD rows. There is no offset, no next/previous paging, no total count, and no row-count selector.

## Current Data Flow

1. `GET /library/model/:id` renders the Component Model detail page.
2. The route reads `ad_number` from the query string and passes it to `LibraryService.getModelApplicabilityAssignments`.
3. `LibraryService.getModelApplicabilityAssignments` calls `getAssignableAirworthinessDirectives(modelId, adNumberSearch)`.
4. `getAssignableAirworthinessDirectives`:
   - reads active AD rows from `airworthiness_directives`
   - excludes ADs already assigned to the model through `compliance_assignments`
   - optionally filters by `ad.ad_number ILIKE :adNumberSearch`
   - orders by `ad.ad_number ASC, ad.revision ASC NULLS LAST`
   - applies hard-coded `LIMIT 200`
5. `src/views/library/model-detail.ejs` renders the returned rows and shows the current returned count.

## Problem

Users can search by AD number, but they cannot browse beyond the first 200 matching active unassigned ADs. They also cannot choose a larger bounded page size such as 400, 800, or 1000.

## Proposed Repair

Add bounded pagination and page-size controls to the existing assignable AD list only.

### Query Parameter Contract

Use these query parameters on the existing model detail route:

- `ad_number`
- `ad_page`
- `ad_page_size`

Example:

`/library/model/:id?ad_number=2022&ad_page=2&ad_page_size=400`

### Defaults

- `ad_page`: `1`
- `ad_page_size`: `200`

### Allowed Page Sizes

Only these page sizes are allowed:

- `200`
- `400`
- `800`
- `1000`

Invalid values must fall back to `200`.

### Page Handling

- Trim and parse `ad_page`.
- Invalid, blank, non-numeric, decimal, zero, or negative page values fall back to `1`.
- Page values above `totalPages` should be clamped to `totalPages` after the count query.
- If there are zero matching rows, return page `1`, total pages `1`, and an empty row list.

### Service Behavior

Extend `LibraryService.getModelApplicabilityAssignments` with an assignable AD paging option:

```ts
{
  adNumberSearch?: string | null;
  adPage?: number | string | null;
  adPageSize?: number | string | null;
}
```

`getAssignableAirworthinessDirectives` should return both rows and pagination metadata instead of only rows, or a sibling helper should provide the metadata while preserving existing public shape. The smallest safe outward shape is:

```ts
{
  rows: AirworthinessDirectiveRow[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasPrevious: boolean;
    hasNext: boolean;
  }
}
```

`getModelApplicabilityAssignments` should continue returning `assignableAirworthinessDirectives` as the row array for view compatibility, and add `assignableAirworthinessDirectivesPagination`.

### LIMIT/OFFSET Behavior

Use:

- `LIMIT :adPageSize`
- `OFFSET :adOffset`

Where:

- `adOffset = (page - 1) * pageSize`

The `ad_number` search filter and assigned-AD exclusion must be applied before limit/offset.

### COUNT Query

Add a `COUNT(*)` query using the same filters as the row query:

- `COALESCE(ad.is_active, TRUE) = TRUE`
- optional `ad.ad_number ILIKE :adNumberSearch`
- the same `NOT EXISTS` assignment exclusion for the selected model

The count query must not include `ORDER BY`, `LIMIT`, or `OFFSET`.

### Metadata Returned To View

Return:

- `total`
- `page`
- `pageSize`
- `totalPages`
- `hasPrevious`
- `hasNext`

Also preserve the trimmed search value already passed as `adNumberSearch`.

### View Controls

Add controls near the assignable AD search form:

- Page size selector with 200, 400, 800, 1000.
- Previous link/button.
- Next link/button.
- Current page summary, for example: `Page 2 of 8`.
- Total row summary, for example: `Showing 400 of 2,731 assignable ADs`.

All paging links/forms must preserve:

- `ad_number`
- `ad_page_size`

Changing page size should reset `ad_page` to `1`.

The existing Clear link should clear:

- `ad_number`
- `ad_page`
- `ad_page_size`

### Route Behavior

`GET /library/model/:id` should read:

- `ad_number`
- `ad_page`
- `ad_page_size`

It should pass the raw/trimmed values to the service. The service should own canonical page and page-size normalization so tests can cover the behavior outside the route.

## Preservation Rules

- Preserve assign-by-AD-number.
- Preserve checkbox assignment.
- Preserve search-before-limit behavior.
- Preserve existing ordering.
- Preserve `LIMIT 200` as the default behavior.
- Preserve read-only AD relevance suggestions.
- Do not auto-assign relevance suggestions.
- Do not consume accepted applicability allocations as compliance assignments.

## Out Of Scope

- No schema changes.
- No migrations.
- No AD import changes.
- No AD applicability review changes.
- No aircraft compliance changes.
- No workpack/task/due changes.
- No relevance suggestion changes.
- No unrelated route/controller/service refactoring.

## Expected Files To Change Later

- `src/modules/library/library.service.ts`
- `src/modules/library/library.routes.ts`
- `src/views/library/model-detail.ejs`
- `src/modules/library/component-model-ad-number-assignment.test.ts`
- Possibly `src/views/library/model-detail.tabs.test.ts`

## Tests Required

- Default page is `1`.
- Default page size is `200`.
- Invalid page falls back to `1`.
- Invalid page size falls back to `200`.
- Allowed page sizes are accepted: `200`, `400`, `800`, `1000`.
- Row query uses `LIMIT :adPageSize`.
- Row query uses `OFFSET :adOffset`.
- Count query uses the same active/search/unassigned filters as the row query.
- Search filter is applied before limit/offset.
- Page above `totalPages` is clamped.
- Empty result returns page `1`, total `0`, total pages `1`, no previous, no next.
- View renders page-size selector.
- View renders previous/next controls.
- View preserves `ad_number` in paging links/forms.
- View keeps assign-by-AD-number and checkbox assignment controls.
- Relevance suggestion section remains read-only.

## Risks

- Larger page sizes increase rendered HTML size and browser work on the model detail page.
- Count query and row query must stay in sync; otherwise totals and page navigation become misleading.
- Page-size selector must be allow-listed to avoid accidental large database/UI loads.
- `library.routes.ts` has unrelated dirty hunks in the current worktree, so later staging must be hunk-specific.

## Acceptance Criteria

- Users can choose 200, 400, 800, or 1000 assignable AD rows per page.
- Users can move to next and previous assignable AD pages.
- Search by AD number still filters before pagination.
- Search value is preserved across page changes.
- Changing page size resets to page 1.
- Existing AD-number assignment still works.
- Existing checkbox assignment still works.
- No relevance suggestions become assignable from the read-only section.
- No schema/import/applicability/compliance/workpack/task/due behavior changes.

## Verification Checklist

- Verify `GET /library/model/:id` still renders the existing page.
- Verify query parameters are `ad_number`, `ad_page`, and `ad_page_size`.
- Verify default page/page-size behavior.
- Verify invalid page/page-size behavior.
- Verify row query applies search and assignment exclusion before `LIMIT/OFFSET`.
- Verify count query uses the same filters as row query.
- Verify previous/next metadata is correct.
- Verify view controls preserve search and page-size state.
- Verify assign-by-AD-number and checkbox assignment forms remain intact.
- Verify relevance suggestions remain read-only.
- Run focused tests.
- Run `npm.cmd run build`.
- Run `git diff --check` on changed files.
