# Phase - Compliance Maintenance Data Navigation

## Mode

DEFINE only.

No implementation, migrations, production code changes, refactors, AD/SB/SID due-engine changes, workpack changes, or import-logic changes are part of this phase.

## Current Status

Status: DEFINED FOR FUTURE IMPLEMENT.

Current findings:

- The global header exposes `Library` and standalone `Service Bulletins`, but it does not expose a clear `Compliance / Maintenance Data` area.
- Airworthiness Directives exist under Library through list, import, and model-assignment workflows, but manual create is missing and navigation is not prominent.
- Service Bulletins are split between the Library workflow and the standalone `/service-bulletins` workflow.
- Supplemental Inspection Documents are partially implemented. The global Library page has SID list access, but global SID import/manage actions are disabled. SID import currently happens from model detail.
- Standard Tasks exist through import/list and model assignment, but template management is partly hidden or disabled.
- Applicability and allocation workflows exist mostly in model detail and SB import issue handling.
- Model detail is contextual assignment and visibility. It should not be treated as the main management area for compliance maintenance data.

## Goal

Define a clear navigation structure for compliance and maintenance source data so AMO users can find, load, review, and allocate ADs, SBs/SLs/SIs, SIDs, Standard Tasks, and applicability links without knowing the internal route layout first.

The design must preserve existing route ownership where practical and avoid inventing new screens unless a workflow is currently missing.

## Proposed Menu

Recommended top-level header entry:

```text
Compliance / Maintenance Data
  Airworthiness Directives
  Service Bulletins / Letters / Instructions
  Supplemental Inspection Documents
  Standard Tasks / Maintenance Requirements
  Applicability / Allocations
```

This should be a first-class header menu rather than only a Library card section.

Reason:

- AMO users think of ADs, SBs, SIDs, and standard tasks as operational compliance and maintenance data, not only as static library reference records.
- A top-level menu reduces the current split between `Library`, standalone `Service Bulletins`, and model-specific assignment pages.
- The existing `Library` area can remain the underlying owner for most routes, but the user-facing navigation should group compliance maintenance data by job to be done.

Library relationship:

- Keep Library as the system-of-record area for manufacturers, models, asset types, serialized components, and reference-style maintenance data.
- Add `Compliance / Maintenance Data` as a navigational grouping that links into existing Library and Service Bulletin routes.
- Do not duplicate persistence or create separate controllers only for navigation.
- Model detail pages remain contextual pages for a selected model.

## Existing Route Mapping

### Airworthiness Directives

Primary menu item:

```text
Compliance / Maintenance Data -> Airworthiness Directives
```

Initial route target:

```text
GET /library/ads
```

Existing routes:

- `GET /library/ads` - AD list/read view.
- `GET /library/ads/import` - AD import form.
- `POST /library/ads/import/preview` - AD import preview.
- `POST /library/ads/import/commit` - AD import commit.
- `POST /library/model/:id/airworthiness-directives/assign` - contextual model assignment.

Existing views:

- `src/views/library/ads/index.ejs`
- `src/views/library/ads/import.ejs`
- `src/views/library/ads/preview.ejs`
- `src/views/library/ads/result.ejs`
- `src/views/library/model-detail.ejs` for model assignment.

Design ownership:

- AD list/import remains Library-owned.
- AD assignment remains model-contextual.
- The new menu should expose both `AD list` and `Import ADs` from the AD area.

Missing:

- Manual AD create workflow.
- AD relationship management beyond import-created relationships.
- Clear AD applicability dashboard independent of model detail.
- Clear display/edit handling for ATA or relationship metadata if required operationally.

### Service Bulletins / Letters / Instructions

Primary menu item:

```text
Compliance / Maintenance Data -> Service Bulletins / Letters / Instructions
```

Initial route target:

```text
GET /library/sbs
```

Existing Library routes:

- `GET /library/sbs` - Library SB list/read view.
- `GET /library/sbs/import` - SB import form.
- `POST /library/sbs/import/preview` - SB import preview.
- `POST /library/sbs/import/commit` - SB import commit.
- `GET /library/sbs/import-issues/unallocated-models` - SB import allocation issue review.
- `POST /library/sbs/import-issues/recheck-exact-model-codes` - allocation recheck action.
- `POST /library/sbs/import-issues/expand-safe-shorthand` - allocation shorthand expansion action.
- `POST /library/sbs/import-issues/allocations/:id/link-models` - link imported allocation to models.
- `POST /library/sbs/import-issues/allocations/:id/ignore` - ignore allocation issue.
- `POST /library/sbs/import-issues/allocations/:id/create-incomplete-model` - create incomplete model from allocation issue.
- `POST /library/service-bulletin` - model-detail manual/bulk SB create.
- `POST /library/model/:id/service-bulletins/attach` - attach existing SBs to model.

Existing standalone routes:

- `GET /service-bulletins` - standalone SB management page.
- `POST /service-bulletins` - standalone manual SB create.
- `GET /service-bulletins/sync-status` - standalone sync status.
- `/sb` routes - sync/import execution mounted separately.

Existing views:

- `src/views/library/sbs/index.ejs`
- `src/views/library/sbs/import.ejs`
- `src/views/library/sbs/preview.ejs`
- `src/views/library/sbs/result.ejs`
- `src/views/library/sbs/allocation-issues.ejs`
- `src/views/service-bulletins/index.ejs`
- `src/views/library/model-detail.ejs` for model create/attach.

Design ownership:

- Use `GET /library/sbs` as the first menu target because it is the Library source-data list and sits with AD/SID/task data.
- From the SB page, provide clear actions to:
  - import SBs;
  - review SB import issues;
  - open standalone manual/sync workflow if it remains separate;
  - attach/apply SBs through model context.
- Do not remove `/service-bulletins` in this phase. Treat it as an existing manual/sync surface until a later consolidation phase decides whether to fold it into Library.

Missing:

- Unified SB/SL/SI terminology and document-type handling in navigation.
- One clear primary manual create location.
- Clear user guidance about the difference between Library SB list and standalone `/service-bulletins`.
- Unified SB applicability dashboard independent of model detail and import issue queues.
- Relationship and ATA metadata management if required operationally.

### Supplemental Inspection Documents

Primary menu item:

```text
Compliance / Maintenance Data -> Supplemental Inspection Documents
```

Initial route target:

```text
GET /library/sids
```

Existing routes:

- `GET /library/sids` - global SID list/read view.
- `GET /library/sids/:id` - global SID detail/read view.
- `POST /library/model/:id/sids/import` - model-scoped SID CSV import.
- `POST /library/model/:id/sids/assign` - contextual model SID assignment.

Existing views:

- `src/views/library/sids/index.ejs`
- `src/views/library/sids/detail.ejs`
- `src/views/library/model-detail.ejs` for model import/assignment.

Design ownership:

- SID list/detail remains Library-owned.
- Model-specific SID import remains contextual until a global import workflow is implemented.
- The menu item should lead to `GET /library/sids`, with clear messaging that global import/manage is not yet implemented.

Missing:

- Global SID import workflow.
- Global SID create/manage workflow.
- Enabled Library dashboard import/manage actions.
- Unified SID applicability dashboard.
- Relationship and ATA metadata management if required operationally.

### Standard Tasks / Maintenance Requirements

Primary menu item:

```text
Compliance / Maintenance Data -> Standard Tasks / Maintenance Requirements
```

Initial route target:

```text
GET /library/tasks
```

Existing routes:

- `GET /library/tasks` - Standard Task list/read view.
- `GET /library/tasks/import` - Standard Task import form.
- `POST /library/tasks/import/map` - import mapping step.
- `POST /library/tasks/import/preview` - import preview.
- `POST /library/tasks/import/commit` - import commit.
- `POST /library/model/:id/standard-tasks/assign` - contextual model task assignment.
- `POST /library/requirement` - model-specific maintenance requirement create.
- `POST /library/requirement/:id/update` - model-specific maintenance requirement update.
- `POST /library/requirement/:id/delete` - model-specific maintenance requirement delete.

Existing views:

- `src/views/library/tasks/index.ejs`
- `src/views/library/tasks/import.ejs`
- `src/views/library/tasks/map-columns.ejs`
- `src/views/library/tasks/preview.ejs`
- `src/views/library/tasks/result.ejs`
- `src/views/library/model-detail.ejs` for model assignment and requirement edit.

Design ownership:

- Standard Task source templates remain Library-owned.
- Model-specific maintenance requirements remain model-contextual.
- The menu item should lead to `GET /library/tasks` and expose import as the primary action.
- The page should distinguish reusable Standard Task templates from model-specific Maintenance Requirements.

Missing:

- Standard Task template manual create/edit/manage workflow.
- Clear global management for model-specific maintenance requirements.
- Unified relationship between imported templates and model-specific requirements.
- Clear ATA and relationship metadata management if required operationally.

### Applicability / Allocations

Primary menu item:

```text
Compliance / Maintenance Data -> Applicability / Allocations
```

Initial route target:

```text
GET /library/sbs/import-issues/unallocated-models
```

This is not a complete applicability dashboard, but it is the strongest existing allocation-review screen.

Existing routes:

- `GET /library/sbs/import-issues/unallocated-models` - SB import allocation issue review.
- `POST /library/sbs/import-issues/allocations/:id/link-models` - link SB allocation issue to models.
- `POST /library/model/:id/airworthiness-directives/assign` - model AD assignment.
- `POST /library/model/:id/sids/assign` - model SID assignment.
- `POST /library/model/:id/standard-tasks/assign` - model task assignment.
- `POST /library/model/:id/service-bulletins/attach` - model SB assignment.

Existing views:

- `src/views/library/sbs/allocation-issues.ejs`
- `src/views/library/model-detail.ejs`
- `src/views/library/sids/detail.ejs` for read-only SID model applicability.

Design ownership:

- Keep model-specific assignment on model detail.
- Use the allocation menu to point users to existing unresolved allocation work first.
- Add clear links from the allocation area back to model detail pages where contextual assignment is currently performed.

Missing:

- Unified applicability dashboard across ADs, SBs, SIDs, and Standard Tasks.
- Cross-source model applicability review.
- Allocation status counts across all compliance maintenance data types.
- Bulk assign/unassign workflow outside model detail.
- Read/write governance for applicability relationships.

## Proposed User Navigation

### Header

Add a top-level header item:

```text
Compliance / Maintenance Data
```

Recommended dropdown or landing links:

- `Airworthiness Directives` -> `GET /library/ads`
- `Service Bulletins / Letters / Instructions` -> `GET /library/sbs`
- `Supplemental Inspection Documents` -> `GET /library/sids`
- `Standard Tasks / Maintenance Requirements` -> `GET /library/tasks`
- `Applicability / Allocations` -> `GET /library/sbs/import-issues/unallocated-models`

### Library Dashboard

Keep the existing Library cards, but treat them as secondary entry points.

Recommended dashboard behavior:

- AD card links to list/import and shows that manual create is not yet implemented.
- SB card links to Library SB list/import/import issues and optionally to standalone `/service-bulletins`.
- SID card links to SID list and clearly states global import/manage is not yet implemented.
- Task card links to Standard Task list/import and clearly states template management is not yet implemented.
- Compliance Items remains read-only projection visibility.

### Model Detail

Keep model detail as contextual:

- assign ADs to this model;
- import or assign SIDs for this model;
- attach or create SBs for this model;
- assign Standard Tasks to this model;
- maintain model planning data and model-specific requirements.

Do not position model detail as the main management area.

## Missing Workflow Gaps

Required future phases should address:

- AD manual create is missing.
- SID global import is missing.
- SID global manage/edit is missing.
- Standard Task template management is disabled or missing.
- SB manual create exists in more than one place and needs ownership clarification.
- SB/SID/AD relationship fields are incomplete from a workflow perspective.
- ATA fields and operational classification metadata need a consistent source-data design.
- Unified applicability dashboard is missing.
- Allocation counts and unresolved-action indicators are not surfaced in header navigation.
- The naming of SBs should account for Service Bulletins, Service Letters, Service Instructions, Customer Information Letters, and similar document references without stripping prefixes.

## Implementation Scope For A Future Phase

Allowed in a navigation implementation phase:

- Add a header menu or Library sub-navigation for Compliance / Maintenance Data.
- Link menu items to existing routes listed in this document.
- Add landing/help text that clarifies which workflows are available and which are not yet implemented.
- Add secondary links between Library SB list and standalone `/service-bulletins`.
- Add clear "contextual assignment only" language on model detail where needed.
- Keep disabled actions disabled if the workflow is not implemented.

Not allowed in the navigation implementation phase:

- No schema changes.
- No migrations.
- No AD/SB/SID due-engine changes.
- No workpack changes.
- No import parser or import commit logic changes.
- No compliance projection logic changes.
- No model lifecycle or component lifecycle changes.
- No new authority model for applicability assignment.

## Risks

- The existing SB split between `/library/sbs` and `/service-bulletins` may continue to confuse users if the navigation only links both without explaining ownership.
- Pointing `Applicability / Allocations` to SB import issues is useful but incomplete; users may expect cross-source applicability management.
- SID global import/manage buttons are currently disabled, so exposing SIDs in a top-level menu must avoid implying full management is complete.
- Model detail already contains many assignment workflows. Adding global navigation without clear "contextual assignment" language could make ownership less clear.
- Future workflow phases must avoid coupling navigation cleanup to due-engine, compliance, workpack, or schema changes.

## Acceptance Criteria For This Define Phase

- The proposed menu is documented.
- Existing route ownership is mapped.
- Missing workflows are documented without implementing them.
- Boundaries are explicit.
- The next implementation phase can add navigation links without changing source-data authority or persistence behavior.
