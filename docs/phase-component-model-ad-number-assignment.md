# Phase 22 - Component Model AD Number Assignment Repair

## Active Phase

Phase 22 FAA AD Import and Applicability

## Mode

DEFINE

## Audit Result

PARTIAL_MATCH

The Component Model -> Compliance Data tab already supports manual AD assignment through the existing model compliance assignment workflow, but the selectable list is limited to the first 200 active unassigned ADs ordered by AD number. The tab also shows read-only AD relevance suggestions, but those suggestions are not assignable from the suggestion panel.

## Current Data Flow

1. `GET /library/model/:id` renders the component model detail page.
2. The route loads model compliance data with `LibraryService.getModelApplicabilityAssignments(modelId)`.
3. `getAssignedAirworthinessDirectives(modelId)` reads existing model-level AD assignments from `compliance_assignments` joined to `compliance_items` and `airworthiness_directives`.
4. `getAssignableAirworthinessDirectives(modelId)` reads active, unassigned ADs from `airworthiness_directives`, orders by `ad_number`, and limits the result to 200.
5. `AdRelevanceService.getReadOnlyRelevanceForModel(modelId, assignedAds)` calculates read-only relevance buckets from active AD Make/Model/Product fields.
6. `src/views/library/model-detail.ejs` renders:
   - checkbox assignment for the limited assignable AD list
   - assigned ADs
   - read-only relevance suggestions
7. `POST /library/model/:id/airworthiness-directives/assign` accepts `airworthiness_directive_ids` from visible checkboxes and calls `LibraryService.assignAirworthinessDirectiveToModel(modelId, directiveId)`.

## Problem

The current UI cannot assign an AD that is not present in the first 200 active unassigned AD rows. The current list is a generic picker, not a relevance list, and the read-only relevance suggestions are intentionally not assignment controls.

## Repair Plan

### 1. Add Assign AD By AD Number

Add a small form on the Component Model -> Compliance Data tab above or beside the existing checkbox assignment list.

Form contract:

- Method: `POST`
- Action: reuse `/library/model/:id/airworthiness-directives/assign`
- Field name: `ad_number`
- Label: `Assign AD by AD Number`
- Placeholder: `Enter exact AD number`
- CSRF: preserve existing CSRF behavior

Controller/route behavior:

- Continue accepting existing `airworthiness_directive_ids` checkbox payloads.
- Also accept optional `ad_number`.
- Trim leading/trailing whitespace.
- Reject blank AD number with a clear user-facing message.
- Resolve only active ADs.
- Match AD number exactly after trimming.
- Do not use docket number or any other FAA field as AD number.
- If no active AD is found, reject with a clear user-facing message.
- If multiple active AD rows match the same AD number, reject as ambiguous and ask the user to assign from a disambiguated list or future revision-aware workflow.
- If the matching AD is already assigned to the model, reject with a clear user-facing message.
- If exactly one active, unassigned AD matches, call the existing `LibraryService.assignAirworthinessDirectiveToModel(modelId, directiveId)` path.

Service behavior:

- Add a focused helper such as `assignAirworthinessDirectiveToModelByNumber(modelId, adNumber)`, or add a lower-level lookup helper consumed by the route.
- Reuse `assignAirworthinessDirectiveToModel` for the actual assignment creation.
- Do not create a second assignment implementation.
- Preserve `compliance_items` and `compliance_assignments` as the assignment authority.

### 2. Preserve Existing Checkbox Assignment

The existing checkbox list and `airworthiness_directive_ids` payload must continue to work unchanged.

The POST route may handle both payload styles, but it must not require both:

- selected checkbox IDs assign selected ADs
- `ad_number` assigns the resolved AD
- if both are supplied, process both safely or reject mixed input with a clear message; prefer the smallest implementation that is easiest to verify

### 3. Add Assignable AD Search/Filter

Add a GET filter to the same model detail page for the existing assignable AD list.

Query contract:

- Parameter: `ad_number`
- Example: `/library/model/:id?ad_number=2022-05`
- Trim whitespace.
- Empty search returns the existing first 200 active unassigned ADs.
- Non-empty search filters active unassigned ADs by case-insensitive partial match on `airworthiness_directives.ad_number`.
- Preserve existing ordering.
- Preserve existing `LIMIT 200`.
- Preserve the active tab behavior for Compliance Data, using the existing tab mechanism or a narrow query/hash convention if already present.

View behavior:

- Add a search form near the assignable AD checkbox list.
- Label: `Search assignable ADs`
- Placeholder: `Search by AD number`
- Button: `Search`
- Show a clear link only when a search is active.
- Preserve the entered search value.
- Show filtered count.
- Show a no-results message when an active search returns no assignable ADs.

### 4. Do Not Auto-Assign Relevance Suggestions Or Accepted Allocations

This repair must not change applicability authority.

- Read-only relevance suggestions stay read-only.
- Accepted `ad_applicability_allocations` are not automatically converted into model compliance assignments.
- Manual model assignment remains an explicit user action through the existing assignment authority.

## Expected Files To Change Later

- `src/modules/library/library.routes.ts`
- `src/modules/library/library.service.ts`
- `src/views/library/model-detail.ejs`
- `src/views/library/model-detail.tabs.test.ts`
- Optional focused service/route test file if existing tests are not the right fit

## Out Of Scope

- No schema changes.
- No migrations.
- No pagination changes.
- No new route unless existing route reuse proves unsafe during implementation.
- No AD import changes.
- No AD applicability review changes.
- No aircraft applicability preview changes.
- No compliance due/status/workpack/task changes.
- No auto-assignment from relevance suggestions.
- No auto-assignment from accepted allocations.
- No fuzzy AD number matching.
- No docket-number-as-AD-number fallback.

## Risks

- AD number duplicates or revisions may exist. The first implementation must reject ambiguous matches rather than choose one silently.
- Users may expect accepted applicability allocations to become assignments automatically. This repair must keep those concepts separate.
- The existing route file has unrelated dirty hunks in the worktree, so implementation and staging must be hunk-specific if needed.
- Searching the first 200 unassigned rows is insufficient; filtering must happen in the service query before the `LIMIT 200`.

## Acceptance Criteria

- User can assign an active, unassigned AD by exact AD number from the Component Model -> Compliance Data tab.
- Blank AD number is rejected.
- Unknown AD number is rejected.
- Already assigned AD number is rejected.
- Duplicate active AD number is rejected as ambiguous.
- Existing checkbox assignment still works.
- Existing assignable AD list still appears when no search is active.
- Assignable AD search supports partial AD number matching and can find rows beyond the unfiltered first 200.
- Search preserves current ordering and 200-row limit.
- Read-only relevance suggestions remain read-only.
- No accepted applicability allocation is auto-assigned.

## Verification Checklist

- Confirm `GET /library/model/:id` still renders the existing model detail page.
- Confirm `POST /library/model/:id/airworthiness-directives/assign` still uses `requirePermission('LIBRARY_EDIT')` and CSRF.
- Confirm checkbox assignment calls the existing `assignAirworthinessDirectiveToModel` path.
- Confirm AD-number assignment calls the existing `assignAirworthinessDirectiveToModel` path after lookup.
- Confirm service lookup trims input and uses exact active `ad_number` matching.
- Confirm duplicate/revision ambiguity is blocked.
- Confirm assignable search filters before `LIMIT 200`.
- Confirm empty search preserves current list behavior.
- Confirm no relevance suggestion form/buttons are added.
- Confirm no AD import, applicability review, aircraft, compliance, task, workpack, due, schema, or migration files are changed.
- Run focused tests for route/service/view behavior.
- Run `npm.cmd run build`.
- Run `git diff --check` on changed files.
