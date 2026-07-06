# AD Library Number Search

## Status

- Active Phase: AD Library Number Search
- Mode: DEFINE
- Audit Result: PARTIAL_MATCH
- Deliverable: Definition only

## Current Implementation Inventory

- Entry screen: Library -> Airworthiness Directives -> View ADs.
- Route: `GET /library/ads`.
- Guard: `requirePermission('LIBRARY_EDIT')`.
- Controller: `LibraryController.renderAdList`.
- Service: `LibraryService.getAirworthinessDirectives()`.
- View: `src/views/library/ads/index.ejs`.
- Model/table: `AirworthinessDirective` / `airworthiness_directives`.
- Search field target: `airworthiness_directives.ad_number`.
- Existing index: `AirworthinessDirective` defines an index on `ad_number`.
- Current behavior: the AD list renders all directives and does not consume query parameters for search/filtering.
- Current pagination: none. Pagination is out of scope for this slice.
- Current AD-to-SB counts: `getAirworthinessDirectives()` enriches rows with SB reference counts. This behavior must be preserved.

## Scope

Add a small, server-side AD Number search to the existing View ADs page.

This is an extension of the existing AD Library list. It must not introduce a new AD search page, route, model, table, or separate search architecture.

## Query Parameter Contract

- Parameter: `ad_number`
- Example: `/library/ads?ad_number=2022-05`
- Matching: case-insensitive partial match against `airworthiness_directives.ad_number`.
- Empty, missing, or whitespace-only values must return the full existing list.
- The parameter name must remain specific to AD Number and must not be reused for docket number.

## Controller Contract

`LibraryController.renderAdList(req, res)` shall:

- Read `req.query.ad_number`.
- Normalize array query values by using the first value if necessary.
- Trim whitespace.
- Pass the clean value to `LibraryService.getAirworthinessDirectives({ adNumberSearch })`.
- Render `library/ads/index` with:
  - `directives`
  - `filters.ad_number`
- Preserve the existing title and route behavior.

No other AD controller actions shall change.

## Service Contract

`LibraryService.getAirworthinessDirectives()` shall be extended to accept an optional filter object:

```ts
{
  adNumberSearch?: string;
}
```

Service behavior:

- If `adNumberSearch` is blank, use the current unfiltered query.
- If populated, add a case-insensitive partial match on `ad_number`.
- Preserve the existing selected fields.
- Preserve the existing ordering: `created_at DESC`, then `ad_number ASC`.
- Preserve existing AD-to-SB reference count enrichment.
- Preserve current behavior for empty result sets.

No schema changes, migrations, duplicate detection changes, import behavior changes, or applicability review behavior changes are permitted.

## View Contract

`src/views/library/ads/index.ejs` shall add a GET search form above the AD table.

Required UI:

- Label: `AD Number`
- Input name: `ad_number`
- Placeholder: `Search by AD number, e.g. 2022-05`
- Button: `Search`
- Clear link: shown only when a search is active, linking to `/library/ads`
- Filtered count: show the count of currently rendered AD records.
- No-results message: when search is active and no rows match, show a message indicating no ADs match the entered AD Number.

The existing AD table columns and action links must remain unchanged.

## Expected Files To Change Later

- `src/modules/library/library.controller.ts`
- `src/modules/library/library.service.ts`
- `src/views/library/ads/index.ejs`
- Focused test file for AD library search, likely under `src/modules/library/`.

No route, model, migration, seeder, package, AD import, AD applicability review, compliance, SB, SID, task, workpack, or due files are expected to change.

## Tests Required

- Exact AD number search filters the list.
- Partial AD number search filters the list.
- Whitespace is trimmed before filtering.
- Empty or whitespace-only search returns the full list.
- Existing selected AD fields remain available.
- Existing AD-to-SB counts remain present after filtering.
- View renders the AD Number search form.
- View renders the active search value.
- View renders the clear link only when search is active.
- View renders no-results messaging for an active search with zero matches.
- Existing AD list links and columns remain present.

## Acceptance Criteria

- `GET /library/ads?ad_number=2022-05` returns only directives whose `ad_number` contains `2022-05`, case-insensitively.
- `GET /library/ads` retains existing full-list behavior.
- Whitespace-only `ad_number` behaves like no search.
- AD-to-SB reference count columns continue to render correctly.
- The implementation uses the existing route, controller, service, model, and view.
- No new route or page is introduced.
- No schema change or migration is created.
- No AD import, AD applicability review, compliance, SB, SID, task, workpack, or due behavior changes.

## Verification Checklist

- Confirm route remains `GET /library/ads`.
- Confirm guard remains `requirePermission('LIBRARY_EDIT')`.
- Confirm controller reads only `req.query.ad_number` for this slice.
- Confirm service uses `ad_number` partial matching only.
- Confirm empty search returns all rows.
- Confirm ordering is unchanged.
- Confirm AD-to-SB reference count enrichment still runs on filtered rows.
- Confirm the view form uses method `GET`.
- Confirm the view does not add POST actions.
- Confirm no schema, migration, package, seeder, AD import, AD applicability review, compliance, SB, SID, task, workpack, or due files changed.
- Run `npm.cmd run build`.
- Run focused AD library search tests.
- Run `git diff --check` on changed files.

## Risks

- The AD list currently has no pagination. Search should not introduce pagination or pagination assumptions.
- The worktree contains unrelated dirty files. Future staging must be path-specific.
- The query must search `ad_number` only. Docket number must not be mislabeled or treated as AD Number.
- Existing AD-to-SB count enrichment must continue to work after filtering.

## Next Recommended Mode

IMPLEMENT, limited to the existing AD Library list route/controller/service/view and focused tests.
