# Phase: Component Model Detail Tabs

Mode: DEFINE

Goal: define a tabbed Component Model Detail screen so model identity, planning data, compliance data, maintenance requirements, and standard tasks are separated clearly.

This phase is definition only. Do not implement during this phase.

## Problem

The current component model detail screen is one long page. Model identity fields, planning fields, regulatory/manufacturer data, recurring maintenance requirements, and reusable standard tasks are mixed together. This makes critical fields such as the OEM Model Code hard to find and makes separate operating concerns feel like one undifferentiated form.

## Non-Goals / Guardrails

- Do not change backend authority.
- Do not change schema.
- Do not change import logic.
- Do not change AD/SB/SID assignment logic.
- Do not change maintenance requirement logic.
- Do not change standard task logic.
- Do not change routes unless a later implementation needs tab navigation state.
- Reorganize UI only in the later IMPLEMENT phase.
- Preserve current service methods and POST handlers unless a later implementation explicitly needs a presentation-only redirect/query-string adjustment.

## Current Page Inventory

Primary screen:

- `src/views/library/model-detail.ejs`
  - Renders the model detail screen as a single stacked page.
  - Shows flash messages and Back to Library link.
  - Shows model summary header.
  - Shows planning summary cards.
  - Shows maintenance requirements list.
  - Shows AD assignment and assigned AD list.
  - Shows SID CSV import, assignable SID list, and assigned SID list.
  - Shows attachable Service Bulletins / Letters / Instructions.
  - Shows standard task assignment and assigned standard task list.
  - Shows model planning/detail update form.
  - Shows Service Bulletin create grid and current Service Bulletin list.
  - Includes client-side row addition for Service Bulletin grid.

Primary route/controller surface:

- `src/modules/library/library.routes.ts`
  - `GET /library/model/:id`
    - Fetches the model, requirements, service bulletins, attachable service bulletins, SIDs, and applicability assignment data.
    - Renders `library/model-detail`.
  - `POST /library/model/:id/update`
    - Updates model name, model code, interval/TBO fields, life-limited flag, and maintenance notes.
  - `POST /library/requirement`
    - Creates a model maintenance requirement.
  - `POST /library/requirement/:id/update`
    - Updates a model maintenance requirement.
  - `POST /library/requirement/:id/delete`
    - Deletes a model maintenance requirement.
  - `POST /library/service-bulletin`
    - Creates one or more service bulletins and links them to the model when `model_id` is present.
  - `POST /library/model/:id/service-bulletins/attach`
    - Attaches existing service bulletins to the model.
  - `POST /library/model/:id/airworthiness-directives/assign`
    - Assigns selected ADs to the model through compliance assignments.
  - `POST /library/model/:id/sids/import`
    - Imports SID CSV rows for the model.
  - `POST /library/model/:id/sids/assign`
    - Assigns selected SIDs to the model.
  - `POST /library/model/:id/standard-tasks/assign`
    - Assigns selected standard tasks to the model.

Primary service surface:

- `src/modules/library/library.service.ts`
  - `getModelById`
  - `getModelRequirements`
  - `getModelServiceBulletins`
  - `getAttachableServiceBulletins`
  - `getModelSids`
  - `getModelApplicabilityAssignments`
  - `createModel`
  - `updateModel`
  - `createRequirement`
  - `updateRequirement`
  - `deleteRequirement`
  - `createServiceBulletin`
  - `createServiceBulletinsBulk`
  - `attachServiceBulletinsToModel`
  - `assignAirworthinessDirectiveToModel`
  - `assignSupplementalInspectionDocumentToModel`
  - `assignStandardTaskToModel`
  - `importModelSidsFromCsv`

Supporting model/partials:

- `src/models/ComponentModel.ts`
  - Supports `model_name`, `model_code`, `manufacturer_id`, `asset_type_id`, `default_tbo_hours`, `default_tbo_months`, `service_interval_hours`, `service_interval_months`, `overhaul_interval_hours`, `overhaul_interval_months`, `maintenance_notes`, `is_life_limited`, and `is_active`.
- `src/views/library/partials/model_form.ejs`
  - Existing older/new-model partial for manufacturer-driven model creation.
- `src/views/library/partials/model_edit_form.ejs`
  - Existing older/edit-model partial.
- `src/views/library/partials/requirement_form.ejs`
  - Existing maintenance requirement create form partial.
- `src/views/library/partials/requirement_edit_form.ejs`
  - Existing maintenance requirement edit form partial.
- `src/views/library/partials/requirement_list.ejs`
  - Existing maintenance requirement list/action partial.

## Proposed Tab Layout

The Component Model Detail page should keep one model-level header above the tabs:

- Display name using the existing model display formatting.
- Manufacturer.
- Asset Type.
- Model Code / OEM Model Code in a clearly labelled prominent field.
- Active/Inactive status if exposed in the detail UI.

Tabs:

1. Identity
2. Planning Data
3. Compliance Data
4. Maintenance Requirements
5. Standard Tasks

Tab navigation may be implemented as same-page client-side tabs, anchor/hash tabs, or query-string driven tabs in the later IMPLEMENT phase. The preferred first implementation should avoid new backend authority and should reuse the existing `GET /library/model/:id` data payload.

## Tab Definitions

### 1. Identity

Purpose: what this model is.

Fields:

- Manufacturer.
- Asset Type.
- Model Code.
- Model Name.
- OEM Model Code.
- Active/Inactive if supported.
- Description/notes if supported.

Current data source:

- `model.Manufacturer.name`
- `model.AssetType.code`
- `model.AssetType.label`
- `model.model_code`
- `model.model_name`
- `model.is_active`
- `model.maintenance_notes`

Definition notes:

- The current code has one `model_code` field. The UI should label this consistently as `Model Code / OEM Model Code` unless a later schema phase creates separate fields.
- `is_active` exists on `ComponentModel` and is selected by `getModelById`, but the current detail update form does not expose it. A later IMPLEMENT phase may display status read-only without changing update authority.
- There is no separate model description field in the current model. `maintenance_notes` can be displayed under Planning Data; it should not be reinterpreted as general identity notes unless product direction accepts that wording.

Existing forms/actions that belong here:

- Identity portion of `POST /library/model/:id/update`
  - `model_name`
  - `model_code`
- Read-only identity fields from `GET /library/model/:id`
  - Manufacturer.
  - Asset Type.
  - Active/Inactive status.

### 2. Planning Data

Purpose: how this model is maintained.

Fields:

- Service hours/months.
- Overhaul hours/months.
- Default TBO hours/months.
- Life limited.
- Maintenance notes.

Current data source:

- `model.service_interval_hours`
- `model.service_interval_months`
- `model.overhaul_interval_hours`
- `model.overhaul_interval_months`
- `model.default_tbo_hours`
- `model.default_tbo_months`
- `model.is_life_limited`
- `model.maintenance_notes`

Existing forms/actions that belong here:

- Planning portion of `POST /library/model/:id/update`
  - `service_interval_hours`
  - `service_interval_months`
  - `overhaul_interval_hours`
  - `overhaul_interval_months`
  - `default_tbo_hours`
  - `default_tbo_months`
  - `is_life_limited`
  - `maintenance_notes`

Definition notes:

- The current single "Save Model Details" form mixes identity and planning fields. A later IMPLEMENT phase may either keep one form visually split across Identity/Planning or create two forms that post to the same existing update endpoint with all required model fields preserved.
- Do not change the semantics of TBO, service intervals, overhaul intervals, or life-limited calculations.

### 3. Compliance Data

Purpose: regulatory and manufacturer source data tied to this model.

Sections:

- Airworthiness Directives.
- Service Bulletins / Letters / Instructions.
- Supplemental Inspection Documents.
- Applicability / Allocations.

Existing forms/actions that belong here:

- Airworthiness Directives
  - Assignable AD table.
  - Assigned AD table.
  - `POST /library/model/:id/airworthiness-directives/assign`.
- Service Bulletins / Letters / Instructions
  - Attachable service bulletin table.
  - Existing service bulletin list.
  - Bulk service bulletin create grid.
  - `POST /library/model/:id/service-bulletins/attach`.
  - `POST /library/service-bulletin` with hidden `model_id`.
- Supplemental Inspection Documents
  - SID CSV import form.
  - Assignable SID table.
  - Assigned/model SID table.
  - `POST /library/model/:id/sids/import`.
  - `POST /library/model/:id/sids/assign`.
- Applicability / Allocations
  - Current model detail page does not show SB allocation issue controls directly.
  - The tab should reserve a section for model-tied applicability/assignment visibility using the current `applicabilityAssignments` payload and existing SB/SID/AD model links.
  - Allocation remediation should remain under existing SB import issue routes unless a later phase explicitly defines a UI-only cross-link.

Definition notes:

- Do not alter AD assignment authority through `compliance_assignments`.
- Do not alter SID assignment authority through `sid_model_applicability`.
- Do not alter SB assignment authority through `service_bulletin_models`.
- Keep import/create behavior unchanged.

### 4. Maintenance Requirements

Purpose: recurring model-specific maintenance requirements.

Sections:

- Model maintenance requirements.
- Add/update/delete maintenance requirements.
- Existing requirements list.

Existing forms/actions that belong here:

- Requirements list currently rendered from `requirements`.
- `POST /library/requirement`.
- `POST /library/requirement/:id/update`.
- `POST /library/requirement/:id/delete`.
- Existing older requirement partials if later implementation chooses to reuse/refactor them:
  - `src/views/library/partials/requirement_form.ejs`
  - `src/views/library/partials/requirement_edit_form.ejs`
  - `src/views/library/partials/requirement_list.ejs`

Definition notes:

- The current detail page only displays requirements in a simple list. The routes/services support create, update, and delete.
- A later IMPLEMENT phase should make the add/edit/delete actions discoverable in this tab without changing requirement logic.

### 5. Standard Tasks

Purpose: reusable work instructions linked to the model.

Sections:

- Assigned standard tasks.
- Available standard tasks.
- Assign/remove standard tasks.

Existing forms/actions that belong here:

- Assignable standard task table.
- Assigned standard task table.
- `POST /library/model/:id/standard-tasks/assign`.

Definition notes:

- Current model detail supports assignment but does not expose a remove action.
- The requested tab includes "assign/remove standard tasks"; removal should be treated as UI definition only until existing backend authority is confirmed or a later phase explicitly defines the endpoint/service behavior.
- Do not change standard task assignment semantics. Current assignment updates `TaskTemplate.scope` to `MODEL`, sets `aircraft_model_id`, and clears `aircraft_id`.

## Existing Form / Action Placement Matrix

| Existing UI/action | Current file/route | Future tab |
| --- | --- | --- |
| Model display header | `src/views/library/model-detail.ejs` | Persistent header above tabs |
| Manufacturer display | `GET /library/model/:id` model include | Identity / persistent header |
| Asset Type display | `GET /library/model/:id` model include | Identity / persistent header |
| Model Name input | `POST /library/model/:id/update` | Identity |
| Model Code input | `POST /library/model/:id/update` | Identity |
| Active/Inactive display | `model.is_active` | Identity |
| Service interval inputs | `POST /library/model/:id/update` | Planning Data |
| Overhaul interval inputs | `POST /library/model/:id/update` | Planning Data |
| Default TBO inputs | `POST /library/model/:id/update` | Planning Data |
| Life-limited checkbox | `POST /library/model/:id/update` | Planning Data |
| Maintenance notes textarea | `POST /library/model/:id/update` | Planning Data |
| Assigned AD list | `applicabilityAssignments.assignedAirworthinessDirectives` | Compliance Data |
| Available AD assignment form | `POST /library/model/:id/airworthiness-directives/assign` | Compliance Data |
| SID CSV import | `POST /library/model/:id/sids/import` | Compliance Data |
| Assigned SID list | `sids` / `applicabilityAssignments.assignedSupplementalInspectionDocuments` | Compliance Data |
| Available SID assignment form | `POST /library/model/:id/sids/assign` | Compliance Data |
| Attachable SB table | `POST /library/model/:id/service-bulletins/attach` | Compliance Data |
| Service Bulletin create grid | `POST /library/service-bulletin` | Compliance Data |
| Current Service Bulletin list | `serviceBulletins` | Compliance Data |
| Maintenance requirement list | `requirements` | Maintenance Requirements |
| Maintenance requirement create | `POST /library/requirement` | Maintenance Requirements |
| Maintenance requirement update | `POST /library/requirement/:id/update` | Maintenance Requirements |
| Maintenance requirement delete | `POST /library/requirement/:id/delete` | Maintenance Requirements |
| Assigned standard task list | `applicabilityAssignments.assignedStandardTasks` | Standard Tasks |
| Available standard task assignment form | `POST /library/model/:id/standard-tasks/assign` | Standard Tasks |

## Route Strategy for Later IMPLEMENT Phase

Preferred:

- Keep `GET /library/model/:id` as the single model detail route.
- Use client-side tab state or URL hash for tab selection.
- Keep all existing POST destinations unchanged.
- Redirect back to `/library/model/:id` after actions as today.

Acceptable if needed:

- Add a non-authoritative `?tab=` query parameter to preserve selected tab after a POST redirect.
- Update POST redirects to include `?tab=identity`, `?tab=planning`, `?tab=compliance`, `?tab=requirements`, or `?tab=tasks`.

Not allowed in this phase:

- New persistence.
- New authority logic.
- New import behavior.
- New assignment semantics.

## Risks

- Splitting one update form into multiple tab forms could accidentally clear fields if the existing update endpoint receives missing values and writes them as null/false. The later implementation must preserve all existing model fields on each update or keep a single update form.
- The current page uses `model_code` as the closest equivalent of OEM Model Code. Labelling must be clear without implying a separate backend field exists.
- `is_active` is supported by the model but not currently editable through the detail update route. Displaying it as editable would exceed a UI-only reorganization unless the existing update authority is extended in a later dedicated phase.
- Requirement partials reference HTMX `hx-put`/`hx-delete` patterns that do not appear to be wired in the current library route file. Reusing those partials directly may require route verification in the later IMPLEMENT phase.
- Standard task removal is part of the desired tab purpose, but current model detail only exposes assignment. Removal should not be implemented until existing authority is confirmed or separately defined.
- Compliance data has multiple source authorities: AD compliance assignments, SB model links, SID applicability links, and SB allocation review records. The tab must present these clearly without merging their logic.
- Moving large tables into hidden tabs may hide flash feedback after form submissions unless tab state is preserved.
- Client-side tab implementation must remain accessible and usable without breaking current form submission and CSRF handling.

## Acceptance Criteria

Definition acceptance:

- This document exists at `docs/phase-component-model-detail-tabs.md`.
- The current page inventory identifies the existing model detail view, route/service surfaces, and related partials.
- The proposed tab layout includes Identity, Planning Data, Compliance Data, Maintenance Requirements, and Standard Tasks.
- Each requested field or section is assigned to a tab.
- Existing forms/actions are mapped to their future tabs.
- Risks and implementation guardrails are documented.
- No backend authority, schema, route behavior, import logic, assignment logic, maintenance requirement logic, or standard task logic is changed in this DEFINE phase.

Later implementation acceptance:

- `/library/model/:id` presents a tabbed detail screen.
- The first visible screen makes manufacturer, asset type, model name, model code/OEM model code, and status easy to find.
- Planning fields are visually separated from compliance data.
- ADs, SBs/SLs/SIs, SIDs, and applicability/allocation visibility live under Compliance Data.
- Maintenance requirements live under Maintenance Requirements with existing create/update/delete behavior preserved.
- Standard task assignment visibility lives under Standard Tasks with existing assignment behavior preserved.
- All existing form submissions continue to call the same backend authority unless a later phase explicitly defines otherwise.
- Every existing form moved into a tab keeps its existing CSRF token and POST target.
- Every existing input, select, and textarea currently on `src/views/library/model-detail.ejs` remains present after tab reorganization unless explicitly documented as intentionally removed. No fields are approved for removal in this phase.
- The model planning data save workflow still works.
- Maintenance requirement create, update, and delete workflows still work.
- AD assignment still works.
- SID CSV import still works.
- SID assignment still works.
- Existing SB attachment still works.
- SB bulk create still works.
- Standard task assignment still works.
- No currently available button, form, upload, assignment, or save action is disabled, hidden without an equivalent tab path, or replaced by a non-functional placeholder.
- All existing forms continue submitting to the same backend routes unless a route change is explicitly defined and verified. No route changes are approved in this phase.
- Implementation does not change controller/service payload shape except for active-tab UI state if absolutely needed.
- Implementation verification includes either focused view tests or static assertions proving:
  - Tab labels exist.
  - Each existing form/action still exists.
  - CSRF tokens remain.
  - POST/action URLs remain unchanged.
  - No required section disappeared.
- Existing tests continue to pass or are updated only for UI structure/visibility expectations.
