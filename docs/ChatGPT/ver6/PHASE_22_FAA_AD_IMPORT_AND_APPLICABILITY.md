# PHASE 22 - FAA AD Import And Applicability Programme

## Execution Mode

- [ ] Mode is DEFINE only.
- [ ] This document is the only deliverable for this step.
- [ ] Do not implement any code in this step.
- [ ] Do not create migrations in this step.
- [ ] Do not edit routes, services, models, views, tests, seeders, or package files in this step.
- [ ] Do not change existing AD, SB, SID, task, workpack, utilisation, or compliance behaviour in this step.

## Programme Goal

- [ ] Define the granular execution plan for FAA Airworthiness Directive import and applicability.
- [ ] Support FAA AD and AD1 file ingestion.
- [ ] Preserve imported FAA make, model, product type, AD relationships, and source text.
- [ ] Resolve AD relevance at make and model level.
- [ ] Handle unresolved and missing make/model values safely.
- [ ] Keep imports rerunnable and idempotent.
- [ ] Allow aircraft to inherit applicable ADs from make/model relationships.
- [ ] Define read-only AD-to-SB relationship rules.
- [ ] Protect existing SB, SID, task, workpack, utilisation, and compliance workflows.

## Locked Boundaries

- [ ] No SB logic may be weakened, rewritten, or made dependent on AD import success.
- [ ] No SID logic may be weakened, rewritten, or made dependent on AD import success.
- [ ] No standard task logic may be changed by this programme unless a later phase explicitly approves it.
- [ ] No workpack generation logic may consume new AD applicability until a later verified integration phase.
- [ ] No utilisation or due calculation logic may be changed during import/applicability foundation phases.
- [ ] Existing compliance items and compliance assignments must remain valid.
- [ ] Existing manual AD assignment must continue to work.
- [ ] Existing AD projection to `compliance_items` must not be damaged.
- [ ] No imported source data may be destructively overwritten without an explicit verified update rule.
- [ ] Broad or ambiguous AD applicability must never be treated as final compliance applicability without review or assignment authority.

## Phase 22.0 - Programme Inventory And Safety Baseline

- [ ] Inventory current FAA AD import routes.
- [ ] Inventory current FAA AD import controllers.
- [ ] Inventory current AD models and associations.
- [ ] Inventory current AD-related migrations.
- [ ] Inventory current AD views.
- [ ] Inventory current model-detail AD assignment UI.
- [ ] Inventory current compliance projection behavior for ADs.
- [ ] Inventory current aircraft applicability behavior for ADs.
- [ ] Inventory current RBAC permissions for library import, preview, commit, assign, and review actions.
- [ ] Inventory current session/preview storage behavior.
- [ ] Inventory current duplicate detection behavior.
- [ ] Inventory current AD relationship handling.
- [ ] Record current behavior before changing anything.
- [ ] Confirm existing AD assignment still works before implementation phases begin.
- [ ] Stop gate: no implementation until the inventory is reviewed and accepted.

## Phase 22.1 - FAA AD And AD1 File Source Definition

- [ ] Define accepted FAA AD file types.
- [ ] Define accepted FAA AD1 file types.
- [ ] Define whether each source may be CSV.
- [ ] Define whether each source may be XLSX.
- [ ] Define whether each source may be zipped XLSX.
- [ ] Define required columns for AD files.
- [ ] Define required columns for AD1 files.
- [ ] Define optional columns for AD files.
- [ ] Define optional columns for AD1 files.
- [ ] Define source file identity fields.
- [ ] Define source row identity fields.
- [ ] Define source row hash rules.
- [ ] Define source file hash rules.
- [ ] Define encoding expectations.
- [ ] Define date parsing expectations.
- [ ] Define whitespace trimming rules.
- [ ] Define blank value handling.
- [ ] Define malformed row handling.
- [ ] Define preview validation warnings.
- [ ] Define preview validation hard errors.
- [ ] Stop gate: no parser changes until AD and AD1 column contracts are documented.

## Phase 22.2 - FAA AD Import Preview

- [ ] Parse AD files into a preview model.
- [ ] Parse AD1 files into a preview model.
- [ ] Preserve raw source values in preview.
- [ ] Normalize display values for preview only.
- [ ] Validate AD number presence.
- [ ] Validate status presence if required by current import rules.
- [ ] Validate effective date presence if required by current import rules.
- [ ] Validate bounded string lengths.
- [ ] Validate date parseability.
- [ ] Detect duplicate AD numbers inside the uploaded file.
- [ ] Detect duplicate AD numbers against existing database rows.
- [ ] Detect duplicate AD and revision combinations where revision is available.
- [ ] Detect unknown columns.
- [ ] Display Make.
- [ ] Display Model.
- [ ] Display Product Type.
- [ ] Display Product Subtype.
- [ ] Display affected/superseded relationship source fields.
- [ ] Do not write database rows during preview.
- [ ] Do not create compliance items during preview.
- [ ] Do not create applicability rows during preview.
- [ ] Stop gate: preview must be read-only and rerunnable.

## Phase 22.3 - FAA AD Import Commit

- [ ] Commit only preview-valid AD rows.
- [ ] Store AD number.
- [ ] Store revision when available.
- [ ] Store subject heading.
- [ ] Store subject.
- [ ] Store summary.
- [ ] Store comments.
- [ ] Store status.
- [ ] Store CFR part reference.
- [ ] Store effective date.
- [ ] Store authority/service office fields where mapped.
- [ ] Store docket number.
- [ ] Store citation.
- [ ] Store citation publish date.
- [ ] Store Make exactly as normalized for storage.
- [ ] Store Model exactly as normalized for storage.
- [ ] Store Product Type exactly as normalized for storage.
- [ ] Store Product Subtype exactly as normalized for storage.
- [ ] Preserve blank optional Make as null or documented blank behavior.
- [ ] Preserve blank optional Model as null or documented blank behavior.
- [ ] Preserve broad source Model text without destructive parsing.
- [ ] Store AD relationship rows only after the parent AD row exists.
- [ ] Use a database transaction for each commit batch.
- [ ] Roll back the batch if a database error occurs.
- [ ] Do not create workpack tasks.
- [ ] Do not create aircraft compliance rows.
- [ ] Do not trigger due recalculation.
- [ ] Stop gate: commit must be transaction-safe and source-preserving.

## Phase 22.4 - Rerun And Idempotent Import Behaviour

- [ ] Define the natural key for an AD row.
- [ ] Prefer AD number plus revision when revision is reliable.
- [ ] Define fallback duplicate logic when revision is absent.
- [ ] Define whether existing rows are skipped, updated, or versioned.
- [ ] Default to skip duplicates unless an explicit update mode is approved.
- [ ] Ensure rerunning the same AD file creates zero duplicate AD rows.
- [ ] Ensure rerunning the same AD1 file creates zero duplicate relationship rows.
- [ ] Ensure relationship import is idempotent.
- [ ] Ensure source hash comparison is stable.
- [ ] Ensure import summary reports inserted rows.
- [ ] Ensure import summary reports skipped duplicate rows.
- [ ] Ensure import summary reports invalid rows.
- [ ] Ensure import summary reports relationship rows inserted.
- [ ] Ensure import summary reports relationship rows skipped.
- [ ] Ensure failed commit leaves no partial AD rows.
- [ ] Ensure failed commit leaves no partial relationship rows.
- [ ] Stop gate: rerun test must pass before applicability work begins.

## Phase 22.5 - Make-Level Applicability Foundation

- [ ] Define how FAA Make maps to Jupiter Manufacturer.
- [ ] Match manufacturer by normalized manufacturer name.
- [ ] Match manufacturer by normalized manufacturer code.
- [ ] Define approved manufacturer aliases.
- [ ] Treat unmatched Make as unresolved.
- [ ] Treat blank Make as unresolved unless a broad global rule is explicitly approved.
- [ ] Preserve raw FAA Make text for review.
- [ ] Create a make-level applicability candidate only when the make match is deterministic.
- [ ] Classify exact manufacturer matches separately from alias matches.
- [ ] Classify broad or blank Make as Needs Review.
- [ ] Do not automatically assign ADs to models from Make alone.
- [ ] Do not create compliance items from Make alone.
- [ ] Do not change existing manufacturers during AD import.
- [ ] Stop gate: Make matching must be explainable and non-authoritative.

## Phase 22.6 - Model-Level Applicability Foundation

- [ ] Define how FAA Model maps to `component_models.model_code`.
- [ ] Define how FAA Model maps to `component_models.model_name`.
- [ ] Define whether OEM model code participates in matching if supported.
- [ ] Define approved model aliases.
- [ ] Normalize hyphen variants.
- [ ] Normalize spacing variants.
- [ ] Normalize case variants.
- [ ] Preserve raw FAA Model text for review.
- [ ] Split multi-model FAA text into tokens only when tokenization is safe.
- [ ] Detect exact model-code matches.
- [ ] Detect exact model-name matches.
- [ ] Detect alias matches.
- [ ] Detect family/series matches.
- [ ] Detect broad model phrases such as ALL, ALL MODELS, SERIES, VARIOUS, SEE TEXT, and N/A.
- [ ] Classify exact matches as Suggested Relevant ADs.
- [ ] Classify family/series matches as Broad Make/Product ADs or Needs Review.
- [ ] Classify unparsed model text as Needs Review.
- [ ] Do not automatically confirm broad or ambiguous model matches.
- [ ] Do not create model records from AD text in this phase.
- [ ] Stop gate: exact, broad, and ambiguous examples must be verified separately.

## Phase 22.7 - Unresolved And Missing Make/Model Handling

- [ ] Define unresolved Make state.
- [ ] Define unresolved Model state.
- [ ] Define missing Make state.
- [ ] Define missing Model state.
- [ ] Define ambiguous Make state.
- [ ] Define ambiguous Model state.
- [ ] Display unresolved rows in a review bucket.
- [ ] Display raw source Make.
- [ ] Display raw source Model.
- [ ] Display raw Product Type.
- [ ] Display reason for unresolved state.
- [ ] Allow future manual link workflow to resolve unmatched Make.
- [ ] Allow future manual link workflow to resolve unmatched Model.
- [ ] Allow future ignore/exclude workflow for false positives.
- [ ] Do not hide unresolved ADs silently.
- [ ] Do not automatically apply unresolved ADs to aircraft.
- [ ] Do not delete unresolved source rows.
- [ ] Stop gate: unresolved rows must remain visible and non-destructive.

## Phase 22.8 - Applicability Review And User Confirmation

- [ ] Define Assigned ADs bucket.
- [ ] Define Suggested Relevant ADs bucket.
- [ ] Define Broad Make/Product ADs bucket.
- [ ] Define Needs Review/Ambiguous bucket.
- [ ] Define Ignored/Excluded bucket if durable exclusion is introduced.
- [ ] Assigned ADs must come from existing confirmed assignment authority.
- [ ] Suggested ADs must not be final compliance applicability.
- [ ] Broad ADs must not be final compliance applicability.
- [ ] Needs Review ADs must not be final compliance applicability.
- [ ] User assignment must remain explicit.
- [ ] Manual assignment must use existing AD assignment authority unless a later phase approves a new route.
- [ ] Ignoring a suggestion must not delete AD source data.
- [ ] Ignoring a suggestion must not delete confirmed assignments.
- [ ] Review decisions must record reviewer and timestamp if a durable review table is introduced.
- [ ] Stop gate: UI review behavior must be safe before aircraft inheritance is connected.

## Phase 22A.2 - AD Applicability Review Workflow

- [ ] Define this slice as the next safe step after read-only AD relevance suggestions.
- [ ] Confirm this slice introduces review authority only, not aircraft compliance authority.
- [ ] Confirm existing manual AD assignment remains valid and unchanged.
- [ ] Confirm existing read-only suggestion buckets remain visible until replaced by verified review UI.
- [ ] Confirm no SB, SID, task, workpack, utilisation, due-status, or existing compliance behavior may be changed.
- [ ] Confirm AD-to-SB linking remains future/read-only only.
- [ ] Confirm aircraft inheritance from make/model review decisions is future scope only.

### 22A.2 Review Buckets

- [ ] Keep `ASSIGNED` as the bucket for ADs already assigned through existing confirmed authority.
- [ ] Define `EXACT_MODEL_REVIEW` for suggestions where FAA Model exactly matches `component_models.model_code` or `component_models.model_name`.
- [ ] Define `MANUFACTURER_REVIEW` for suggestions where FAA Make matches the manufacturer and FAA Model is blank or manufacturer-wide.
- [ ] Define `BROAD_REVIEW` for series, all-model, all-product, family, ambiguous, or broad wording suggestions.
- [ ] Define `UNRESOLVED_MAKE_MODEL` for AD source rows with missing, unmatched, or ambiguous Make/Model values.
- [ ] Define `IGNORED_EXCLUDED` for suggestions intentionally suppressed by a user decision.
- [ ] Keep raw FAA Make, Model, Product Type, Product Subtype, AD Number, revision, and subject visible in every review bucket.
- [ ] Show the match reason for every reviewed suggestion.
- [ ] Show whether the suggestion came from exact model, manufacturer, broad model text, unresolved source data, or manual link.
- [ ] Do not hide unresolved or ignored source rows from administrators with review permission.

### 22A.2 User Actions

- [ ] Allow authorized users to accept model applicability for exact model suggestions.
- [ ] Allow authorized users to accept manufacturer applicability for make-level suggestions.
- [ ] Allow authorized users to manually link an AD to a selected component model.
- [ ] Allow authorized users to mark broad manufacturer applicability where the AD applies across a manufacturer/product context.
- [ ] Allow authorized users to ignore/exclude a false-positive suggestion.
- [ ] Allow authorized users to restore an ignored/excluded suggestion.
- [ ] Require every accept, manual link, ignore, exclude, and restore action to be explicit.
- [ ] Do not auto-accept exact suggestions without a user action.
- [ ] Do not auto-accept manufacturer-level suggestions without a user action.
- [ ] Do not auto-accept broad suggestions without a user action.
- [ ] Do not create aircraft compliance rows from any review action in this slice.
- [ ] Do not generate workpack tasks from any review action in this slice.

### 22A.2 Durable Audit Table Requirements

- [ ] Define a durable AD applicability review table before implementing this slice.
- [ ] Store `airworthiness_directive_id`.
- [ ] Store nullable `component_model_id` for model-specific decisions.
- [ ] Store nullable `manufacturer_id` for manufacturer-level decisions.
- [ ] Store nullable `asset_type_id` or product context when required for broad manufacturer applicability.
- [ ] Store decision type such as `ACCEPT_MODEL`, `ACCEPT_MANUFACTURER`, `MANUAL_MODEL_LINK`, `BROAD_MANUFACTURER`, `IGNORE`, `EXCLUDE`, or `RESTORE`.
- [ ] Store review state such as `ACTIVE`, `IGNORED`, `EXCLUDED`, or `RESTORED` if distinct from decision type.
- [ ] Store source bucket at time of decision.
- [ ] Store raw FAA Make and Model snapshot at time of decision.
- [ ] Store match reason snapshot at time of decision.
- [ ] Store reviewer user id where available.
- [ ] Store reviewed timestamp.
- [ ] Store optional reviewer notes.
- [ ] Store active/inactive state if superseded decisions must be retained.
- [ ] Define uniqueness constraints to prevent duplicate active decisions for the same AD/model/manufacturer/context.
- [ ] Define whether restored ignored rows reactivate the old row or create a new audit row.
- [ ] Preserve audit history; do not delete prior review decisions during normal workflow.

### 22A.2 Rerun And Idempotency Behaviour

- [ ] Rerunning FAA AD import must not duplicate review decisions.
- [ ] Rerunning suggestion generation must not duplicate review decisions.
- [ ] Accepted model applicability must remain accepted after import rerun.
- [ ] Accepted manufacturer applicability must remain accepted after import rerun.
- [ ] Ignored/excluded suggestions must remain ignored/excluded after import rerun.
- [ ] Restored suggestions must become visible again according to the restored state.
- [ ] If AD source Make/Model changes on rerun, keep prior audit decisions and flag changed source text for review.
- [ ] If an AD revision changes, define whether review carries forward or requires fresh review.
- [ ] If the AD natural key changes, do not silently transfer review decisions without an explicit rule.
- [ ] Stop duplicate active decisions at the database constraint layer.
- [ ] Report review decision counts in verification: accepted, ignored, excluded, restored, unchanged.

### 22A.2 UI Design

- [ ] Add review controls only for users with the required review permission.
- [ ] Keep read-only users on read-only bucket display.
- [ ] Display Assigned ADs separately from review candidates.
- [ ] Display Exact Model suggestions separately from Manufacturer-level suggestions.
- [ ] Display Broad/Series/All suggestions separately from exact and manufacturer-level suggestions.
- [ ] Display Unresolved Make/Model rows separately from actionable matches.
- [ ] Display Ignored/Excluded rows in a collapsible or separate review area.
- [ ] Provide an explicit Accept Model Applicability action.
- [ ] Provide an explicit Accept Manufacturer Applicability action.
- [ ] Provide an explicit Manual Link To Model action.
- [ ] Provide an explicit Mark Broad Manufacturer Applicability action.
- [ ] Provide an explicit Ignore/Exclude action with optional note.
- [ ] Provide an explicit Restore Ignored action.
- [ ] Show confirmation text before broad manufacturer applicability is accepted.
- [ ] Do not replace existing Assign Selected ADs workflow in this slice.
- [ ] Do not remove existing AD assignment form in this slice.

### 22A.2 RBAC Requirements

- [ ] Define permission required to view AD applicability review buckets.
- [ ] Define permission required to accept model applicability.
- [ ] Define permission required to accept manufacturer applicability.
- [ ] Define permission required to manually link an AD to a model.
- [ ] Define permission required to mark broad manufacturer applicability.
- [ ] Define permission required to ignore/exclude suggestions.
- [ ] Define permission required to restore ignored/excluded suggestions.
- [ ] Reuse existing library edit permission only if verified as appropriate.
- [ ] Read-only library/compliance users may view review state only where existing visibility allows it.
- [ ] Customer users must not manage AD applicability review decisions.
- [ ] Unauthorized users must not see action buttons.
- [ ] Unauthorized POST attempts must be blocked by route permission checks.

### 22A.2 Boundaries And Stop Gates

- [ ] Do not change AD import mapping.
- [ ] Do not change AD import commit behavior.
- [ ] Do not change AD manual assignment authority.
- [ ] Do not change existing ComplianceItem projection logic.
- [ ] Do not create compliance items from review suggestions.
- [ ] Do not create compliance assignments except where an explicitly approved accept action maps to existing assignment authority.
- [ ] Do not create aircraft associations.
- [ ] Do not connect aircraft inheritance in this slice.
- [ ] Do not change SB import, allocation, attachment, or applicability logic.
- [ ] Do not change SID import, assignment, or applicability logic.
- [ ] Do not change standard task assignment logic.
- [ ] Do not change workpack generation.
- [ ] Do not change utilisation or due calculations.
- [ ] Do not add AD-to-SB write actions.
- [ ] Stop gate: implementation may not begin until durable table fields and uniqueness rules are reviewed.
- [ ] Stop gate: implementation may not begin until RBAC permission names are approved.
- [ ] Stop gate: implementation may not begin until exact/broad/unresolved/ignored workflows have test expectations.
- [ ] Stop gate: implementation verification must prove existing SB, SID, task, workpack, utilisation, due, and compliance tests remain unaffected.

## Phase 22A.3 - AD Applicability Allocation Foundation

- [ ] Define this slice as the durable allocation foundation for reviewed AD applicability decisions.
- [ ] Confirm this allocation layer becomes the source of truth for reviewed AD applicability only after implementation is approved.
- [ ] Confirm this slice does not create aircraft applicability.
- [ ] Confirm this slice does not create or update compliance items.
- [ ] Confirm this slice does not create or update compliance assignments.
- [ ] Confirm this slice does not create tasks.
- [ ] Confirm this slice does not trigger due calculations.
- [ ] Confirm this slice does not generate workpacks.
- [ ] Confirm this slice does not create SB links.
- [ ] Confirm this slice does not affect SID logic.

### 22A.3 Allocation Table

- [ ] Define a dedicated AD applicability allocation table.
- [ ] Use the allocation table for reviewed/saved AD applicability decisions.
- [ ] Keep read-only 22A.1 suggestion generation separate from durable allocation writes until an explicit persist step is approved.
- [ ] Store the allocation row id.
- [ ] Store `airworthiness_directive_id`.
- [ ] Store AD number snapshot for audit and debugging.
- [ ] Store AD revision snapshot where present.
- [ ] Store target type.
- [ ] Store decision/status value.
- [ ] Store original FAA Make used for the suggestion.
- [ ] Store original FAA Model used for the suggestion.
- [ ] Store original FAA Product Type used for the suggestion.
- [ ] Store original FAA Product Subtype used for the suggestion.
- [ ] Store matched `manufacturer_id` where applicable.
- [ ] Store matched `component_model_id` where applicable.
- [ ] Store nullable `asset_type_id` or product context where broad rules require it.
- [ ] Store classification reason.
- [ ] Store source bucket from the 22A.1/22A.2 review flow.
- [ ] Store source hash or match hash if needed for idempotent rerun detection.
- [ ] Store active/inactive state if superseded allocations must remain in audit history.
- [ ] Store created timestamp.
- [ ] Store updated timestamp.

### 22A.3 Target Types

- [ ] Define `MANUFACTURER` for accepted manufacturer-level AD applicability.
- [ ] Define `MODEL` for accepted model-specific AD applicability.
- [ ] Define `BROAD_RULE` for reviewed broad/series/all manufacturer or product applicability.
- [ ] Define `MANUAL_LINK` for user-created AD-to-model links that did not originate from an exact imported suggestion.
- [ ] Define `IGNORED` for intentionally suppressed false-positive suggestions.
- [ ] Define `UNRESOLVED` for persisted unresolved Make/Model candidates that require later review.
- [ ] Ensure target type is required.
- [ ] Ensure `MANUFACTURER` rows require `manufacturer_id`.
- [ ] Ensure `MODEL` rows require `component_model_id`.
- [ ] Ensure `BROAD_RULE` rows require enough context to explain the broad rule.
- [ ] Ensure `MANUAL_LINK` rows require the manually selected model or explicitly documented target.
- [ ] Ensure `IGNORED` rows preserve the source suggestion context that was ignored.
- [ ] Ensure `UNRESOLVED` rows preserve raw FAA Make/Model/Product fields.

### 22A.3 Decision And Status Values

- [ ] Define `SUGGESTED` for persisted suggestions not yet accepted or ignored.
- [ ] Define `ACCEPTED` for reviewed allocations accepted by an authorized user.
- [ ] Define `IGNORED` for suggestions suppressed by an authorized user.
- [ ] Define `RESTORED` for suggestions brought back from ignored/excluded state.
- [ ] Define `NEEDS_REVIEW` for broad, ambiguous, unresolved, or changed-source allocations.
- [ ] Ensure status is required.
- [ ] Ensure accepted allocations remain distinguishable from suggestions.
- [ ] Ensure ignored allocations remain distinguishable from deleted rows.
- [ ] Ensure restored allocations are auditable.
- [ ] Ensure broad/unresolved allocations cannot be treated as accepted without an explicit accepted status.

### 22A.3 Audit Fields

- [ ] Store `created_by` when the allocation is created by a user action.
- [ ] Store nullable `created_by` or system actor when allocation is created from suggestion persistence.
- [ ] Store `reviewed_by` when a user accepts, ignores, restores, or otherwise reviews the allocation.
- [ ] Store `reviewed_at` when a review action occurs.
- [ ] Store `review_reason` for user-entered or system-provided review explanation.
- [ ] Store original source bucket at creation.
- [ ] Store latest classification reason.
- [ ] Store raw FAA source snapshots even if the AD source row later changes.
- [ ] Preserve old allocation rows or audit history when decisions are superseded.
- [ ] Do not hard-delete allocation decisions in normal workflow.

### 22A.3 Idempotency And Rerun Rules

- [ ] Define a stable allocation natural key before implementation.
- [ ] Include `airworthiness_directive_id` in the natural key.
- [ ] Include target type in the natural key.
- [ ] Include target id fields relevant to the target type.
- [ ] Include normalized FAA Make/Model/Product source hash if needed to distinguish changed-source suggestions.
- [ ] Rerunning 22A.1 suggestion generation must not duplicate allocation rows.
- [ ] Rerunning FAA AD import must not duplicate allocation rows.
- [ ] Rerunning FAA AD import must not erase accepted allocation decisions.
- [ ] Rerunning FAA AD import must not erase ignored allocation decisions.
- [ ] Rerunning FAA AD import must not erase unresolved allocation rows.
- [ ] If source FAA Make/Model/Product fields change, flag the existing allocation as `NEEDS_REVIEW` or create a new review candidate according to the approved rule.
- [ ] If AD number/revision changes, define whether the allocation remains linked by AD id or requires a new allocation.
- [ ] If an AD is deactivated, define whether allocations remain visible as inactive/history.
- [ ] Repeated accept of the same allocation must be idempotent.
- [ ] Repeated ignore of the same allocation must be idempotent.
- [ ] Repeated restore of the same allocation must be idempotent.

### 22A.3 Feeding From 22A.1 Suggestions

- [ ] Map `EXACT_MODEL_SUGGESTED` to a candidate `MODEL` allocation with `SUGGESTED` status.
- [ ] Map `MANUFACTURER_SUGGESTED` to a candidate `MANUFACTURER` allocation with `SUGGESTED` status.
- [ ] Map `BROAD_REVIEW` to a candidate `BROAD_RULE` allocation with `NEEDS_REVIEW` status.
- [ ] Map unmatched or ambiguous source rows to `UNRESOLVED` only when unresolved persistence is explicitly approved.
- [ ] Do not persist `UNMATCHED` rows unless a review workflow requires unresolved visibility.
- [ ] Preserve the 22A.1 classification reason in the allocation.
- [ ] Preserve the 22A.1 matched manufacturer/model ids where available.
- [ ] Do not create allocations during read-only suggestion display.
- [ ] Introduce a separate explicit persist/review action in a later implementation slice.
- [ ] Keep the existing manual AD assignment workflow separate unless a later slice explicitly maps it into allocations.

### 22A.3 Manual Actions In Later Implementation

- [ ] Accept model applicability by changing the relevant allocation to `ACCEPTED`.
- [ ] Accept manufacturer applicability by changing the relevant allocation to `ACCEPTED`.
- [ ] Manually link to model by creating or activating a `MANUAL_LINK` allocation.
- [ ] Mark broad manufacturer applicability by creating or accepting a `BROAD_RULE` allocation.
- [ ] Ignore/exclude by creating or updating an `IGNORED` allocation with `IGNORED` status.
- [ ] Restore ignored by recording a `RESTORED` status or creating a new active suggestion row according to the approved audit rule.
- [ ] Require review reason for ignore/exclude when the UI supports notes.
- [ ] Require explicit confirmation for broad manufacturer applicability.
- [ ] Do not convert accepted allocations into compliance items in this slice.
- [ ] Do not project accepted allocations to aircraft in this slice.

### 22A.3 Indexes And Uniqueness Constraints

- [ ] Add an index on `airworthiness_directive_id`.
- [ ] Add an index on AD number snapshot if query/reporting needs it.
- [ ] Add an index on target type.
- [ ] Add an index on decision/status.
- [ ] Add an index on `manufacturer_id`.
- [ ] Add an index on `component_model_id`.
- [ ] Add an index on active/inactive state if included.
- [ ] Add an index on reviewed timestamp if review queues sort by review activity.
- [ ] Define a uniqueness constraint for active AD/model allocations.
- [ ] Define a uniqueness constraint for active AD/manufacturer allocations.
- [ ] Define a uniqueness constraint for active AD/broad-rule context.
- [ ] Define a uniqueness constraint for active ignored source suggestion context.
- [ ] Ensure uniqueness constraints allow historical superseded decisions where audit history is retained.
- [ ] Ensure null target fields do not break uniqueness for target-specific allocation rows.

### 22A.3 RBAC Requirements

- [ ] Define permission required to view AD allocation rows.
- [ ] Define permission required to persist suggestions into allocation rows.
- [ ] Define permission required to accept allocations.
- [ ] Define permission required to create manual model links.
- [ ] Define permission required to mark broad manufacturer applicability.
- [ ] Define permission required to ignore/exclude allocations.
- [ ] Define permission required to restore ignored allocations.
- [ ] Define permission required to view audit fields.
- [ ] Customer users must not manage AD allocations.
- [ ] Unauthorized users must not see allocation write controls.
- [ ] Unauthorized POST attempts must be blocked by route permission checks.

### 22A.3 Strict Boundaries

- [ ] Do not create aircraft inheritance in this slice.
- [ ] Do not create aircraft applicability rows in this slice.
- [ ] Do not create or update compliance items in this slice.
- [ ] Do not create or update compliance assignments in this slice except existing manual assignment flows already approved outside this allocation foundation.
- [ ] Do not change existing AD manual assignment behavior.
- [ ] Do not change existing AD projection behavior.
- [ ] Do not change SB import behavior.
- [ ] Do not change SB allocation behavior.
- [ ] Do not create AD-to-SB links.
- [ ] Do not change SID import or assignment behavior.
- [ ] Do not change standard task behavior.
- [ ] Do not change workpack generation.
- [ ] Do not change utilisation tracking.
- [ ] Do not change due calculations.
- [ ] Do not change aircraft compliance display.
- [ ] Stop gate: implementation may not begin until table name, columns, indexes, and uniqueness rules are approved.
- [ ] Stop gate: implementation may not begin until target type and status enum values are approved.
- [ ] Stop gate: implementation may not begin until RBAC permission names are approved.
- [ ] Stop gate: implementation verification must prove no SB, SID, task, workpack, utilisation, due, or existing compliance behavior changed.

## Phase 22A.4 - AD Applicability Review UI And Actions

- [ ] Define this slice as the review UI and action workflow for durable AD applicability allocations.
- [ ] Confirm 22A.1 read-only relevance suggestions remain unchanged.
- [ ] Confirm 22A.3.2 allocation persistence remains explicit and is not called automatically from model detail.
- [ ] Confirm existing manual AD assignment remains separate and unchanged.
- [ ] Confirm no aircraft inheritance or compliance effect exists in this slice.
- [ ] Confirm this slice only reviews `ad_applicability_allocations` rows.

### 22A.4 Review Screen Location

- [ ] Add the primary review screen at `GET /library/ads/applicability-review`.
- [ ] Keep the review screen under the Library AD area.
- [ ] Display allocations from `ad_applicability_allocations`.
- [ ] Do not replace the existing model-detail AD assignment form in this slice.
- [ ] Do not remove the existing read-only model-detail AD relevance suggestions until a later verified replacement is approved.
- [ ] Keep model-scoped review entry points future-only unless explicitly approved.

### 22A.4 Routes

- [ ] Define `GET /library/ads/applicability-review` for the allocation review list.
- [ ] Define `POST /library/ads/applicability-review/refresh` for manual suggestion persistence refresh.
- [ ] Define `POST /library/ads/applicability-review/allocations/:id/accept` for accepting an allocation.
- [ ] Define `POST /library/ads/applicability-review/allocations/:id/ignore` for ignoring an allocation.
- [ ] Define `POST /library/ads/applicability-review/allocations/:id/restore` for restoring an ignored allocation.
- [ ] Define `POST /library/ads/applicability-review/allocations/:id/link-model` for manually linking an allocation to a model.
- [ ] Define `POST /library/ads/applicability-review/allocations/:id/link-manufacturer` for manually linking an allocation to a manufacturer.
- [ ] Require CSRF protection on every POST route.
- [ ] Redirect every POST route back to a safe review URL.
- [ ] Do not add route behavior that creates `ComplianceItem` rows.
- [ ] Do not add route behavior that creates `ComplianceAssignment` rows.
- [ ] Do not add route behavior that creates aircraft applicability.

### 22A.4 Review Buckets

- [ ] Show `SUGGESTED` allocations as reviewable suggestions.
- [ ] Show `NEEDS_REVIEW` allocations as broad, ambiguous, or manually reviewable suggestions.
- [ ] Show `ACCEPTED` allocations as reviewed accepted applicability decisions.
- [ ] Show `IGNORED` allocations as suppressed false-positive decisions.
- [ ] Keep `SUGGESTED` separate from `NEEDS_REVIEW`.
- [ ] Keep `ACCEPTED` separate from current suggestions.
- [ ] Keep `IGNORED` visible to authorized review users.
- [ ] Do not treat `SUGGESTED` or `NEEDS_REVIEW` as final operational applicability.
- [ ] Do not treat `ACCEPTED` as aircraft compliance applicability until a later aircraft inheritance phase explicitly approves it.

### 22A.4 UI Columns

- [ ] Display AD number.
- [ ] Display subject.
- [ ] Display source make.
- [ ] Display source model.
- [ ] Display source product type/subtype.
- [ ] Display target type.
- [ ] Display matched manufacturer/model.
- [ ] Display classification.
- [ ] Display status.
- [ ] Display match reason.
- [ ] Display reviewed by / reviewed at.
- [ ] Display review reason.
- [ ] Display review action.
- [ ] Preserve source snapshots exactly as stored on the allocation row.
- [ ] Show enough target context to distinguish model, manufacturer, broad, manual, ignored, and unresolved allocations.

### 22A.4 Refresh Rules

- [ ] Refresh is manual/admin-triggered only.
- [ ] Refresh must not run automatically on model detail.
- [ ] Refresh must not run automatically on ordinary review page load.
- [ ] Refresh may call the 22A.3.2 allocation service to persist current 22A.1 suggestions.
- [ ] Refresh may create only `SUGGESTED` and `NEEDS_REVIEW` allocation rows.
- [ ] Refresh must not persist `ASSIGNED` suggestions as allocation review rows.
- [ ] Refresh must not persist `UNMATCHED` rows by default.
- [ ] Refresh must not overwrite `ACCEPTED` decisions.
- [ ] Refresh must not overwrite `IGNORED` decisions.
- [ ] Refresh must be idempotent and must not duplicate allocation rows.
- [ ] All-model refresh remains future-only unless separately approved.
- [ ] Model-specific refresh remains future-only unless separately approved.

### 22A.4 User Actions

- [ ] Accept allocation by updating the selected allocation status to `ACCEPTED`.
- [ ] Accept allocation must set `reviewed_by`.
- [ ] Accept allocation must set `reviewed_at`.
- [ ] Accept allocation may set `review_reason`.
- [ ] Ignore allocation by updating the selected allocation status to `IGNORED`.
- [ ] Ignore allocation must set `reviewed_by`.
- [ ] Ignore allocation must set `reviewed_at`.
- [ ] Ignore allocation should require or strongly encourage `review_reason`.
- [ ] Restore ignored allocation by changing the selected allocation back to its active review status.
- [ ] Restore ignored allocation must set `reviewed_by`.
- [ ] Restore ignored allocation must set `reviewed_at`.
- [ ] Restore ignored allocation may set `review_reason`.
- [ ] Restore returns ignored rows to `SUGGESTED` unless their classification is `BROAD_SERIES`, `BROAD_ALL`, or `MULTI_MODEL_REVIEW`.
- [ ] Restore returns ignored rows with classification `BROAD_SERIES`, `BROAD_ALL`, or `MULTI_MODEL_REVIEW` to `NEEDS_REVIEW`.
- [ ] Manually link to model by setting or creating model-targeted allocation context.
- [ ] Manually link to model must populate `matched_component_model_id` or a model target id.
- [ ] Manually link to model must set status to `ACCEPTED` only after explicit user confirmation.
- [ ] Manually link to manufacturer by setting or creating manufacturer-targeted allocation context.
- [ ] Manually link to manufacturer must populate `matched_manufacturer_id` or a manufacturer target id.
- [ ] Manually link to manufacturer must set status to `ACCEPTED` only after explicit user confirmation.
- [ ] Every action must be explicit and attributable to the acting user.
- [ ] No action may create aircraft applicability in this slice.
- [ ] No action may create compliance records in this slice.

### 22A.4 RBAC Requirements

- [ ] Define `AD_APPLICABILITY_REVIEW_VIEW` for viewing the review screen.
- [ ] Define `AD_APPLICABILITY_REVIEW_REFRESH` for manually refreshing persisted suggestions.
- [ ] Define `AD_APPLICABILITY_REVIEW_ACCEPT` for accepting allocations.
- [ ] Define `AD_APPLICABILITY_REVIEW_IGNORE` for ignoring allocations.
- [ ] Define `AD_APPLICABILITY_REVIEW_RESTORE` for restoring ignored allocations.
- [ ] Define `AD_APPLICABILITY_REVIEW_LINK_MODEL` for manual model links.
- [ ] Define `AD_APPLICABILITY_REVIEW_LINK_MANUFACTURER` for manual manufacturer links.
- [ ] First implementation may temporarily reuse `LIBRARY_EDIT` only if explicit AD applicability review permissions are not seeded yet.
- [ ] If `LIBRARY_EDIT` is temporarily reused, document the temporary fallback in the implementation notes.
- [ ] If `LIBRARY_EDIT` is temporarily reused, keep route checks centralized so explicit permissions can replace it cleanly.
- [ ] Unauthorized users must not see review action controls.
- [ ] Unauthorized POST attempts must be blocked by route permission checks.
- [ ] Customer users must not manage AD applicability review decisions.

### 22A.4 Strict Boundaries

- [ ] Do not create `ComplianceItem` rows.
- [ ] Do not create `ComplianceAssignment` rows.
- [ ] Do not create aircraft applicability.
- [ ] Do not connect aircraft inheritance.
- [ ] Do not change AD import behavior.
- [ ] Do not change existing manual AD assignment behavior.
- [ ] Do not change existing AD projection behavior.
- [ ] Do not change SB logic.
- [ ] Do not change SID logic.
- [ ] Do not change standard task logic.
- [ ] Do not change workpack logic.
- [ ] Do not change utilisation logic.
- [ ] Do not change due calculation logic.
- [ ] Do not add AD-to-SB linking in this phase.
- [ ] Do not infer compliance equivalence from AD-to-SB references.
- [ ] Do not remove existing model-detail workflows.

### 22A.4 Test Expectations

- [ ] Verify the review route renders review buckets.
- [ ] Verify the review route shows the required UI columns.
- [ ] Verify refresh is manual and not triggered by model detail.
- [ ] Verify refresh is idempotent.
- [ ] Verify accept updates only allocation status and review fields.
- [ ] Verify ignore updates only allocation status and review fields.
- [ ] Verify restore returns ordinary ignored rows to `SUGGESTED`.
- [ ] Verify restore returns broad ignored rows to `NEEDS_REVIEW`.
- [ ] Verify manual model link updates only allocation target/review fields.
- [ ] Verify manual manufacturer link updates only allocation target/review fields.
- [ ] Verify no action creates `ComplianceItem`.
- [ ] Verify no action creates `ComplianceAssignment`.
- [ ] Verify no action creates aircraft applicability.
- [ ] Verify no SB, SID, task, workpack, utilisation, due, or AD-to-SB logic is called.
- [ ] Verify unauthorized users cannot access write routes.
- [ ] Verify CSRF protection remains on every POST route.

### 22A.4 Stop Gates

- [ ] Stop gate: implementation may not begin until route names are accepted.
- [ ] Stop gate: implementation may not begin until restore semantics are accepted.
- [ ] Stop gate: implementation may not begin until RBAC fallback behavior is accepted.
- [ ] Stop gate: implementation verification must prove no compliance rows are created.
- [ ] Stop gate: implementation verification must prove no aircraft applicability is created.
- [ ] Stop gate: implementation verification must prove SB, SID, task, workpack, utilisation, due, and AD-to-SB logic remain untouched.

## Phase 22A.6 - Aircraft AD Applicability Preview

- [x] Define read-only aircraft AD applicability preview.
- [x] Implement preview on aircraft applicability page.
- [x] Use ACCEPTED allocations only.
- [x] Exclude SUGGESTED, NEEDS_REVIEW, IGNORED, UNRESOLVED.
- [x] Exclude UNRESOLVED_MAKE and UNRESOLVED_MODEL.
- [x] Require MANUAL_LINK target_type for manual model/manufacturer links.
- [x] Display preview-only warning.
- [x] Do not create ComplianceItem.
- [x] Do not create ComplianceAssignment.
- [x] Do not create aircraft applicability rows.
- [x] Do not create tasks/workpacks.
- [x] Do not affect due calculations.
- [x] Do not affect SB logic.
- [x] Do not affect SID logic.
- [x] Build passed: `npm.cmd run build`.
- [x] Tests passed: `npx.cmd vitest run src/modules/aircraft/aircraft-ad-applicability-preview.service.test.ts src/views/aircraft/ad-applicability-preview.views.test.ts`.
- [x] Committed: 13f54e3 Add aircraft AD applicability preview.

## Phase 22A.7 - Aircraft AD Applicability Authority

### 22A.7 Purpose

- [ ] Define the single authoritative method for determining which ADs apply to an aircraft before compliance records are created.
- [ ] Treat this phase as an authority contract only.
- [ ] Keep the authority read-only until a later explicit compliance phase approves operational use.

### 22A.7 Authority Inputs

- [ ] Aircraft AD applicability shall be determined only from ACCEPTED `ad_applicability_allocations`.
- [ ] Aircraft AD applicability shall use the aircraft's current `model_id`.
- [ ] Aircraft AD applicability shall use the aircraft model's current `manufacturer_id`.
- [ ] Current aircraft model always governs applicability.
- [ ] Changing an aircraft model must immediately change derived applicability.
- [ ] No cached aircraft applicability table is approved in this phase.
- [ ] No aircraft applicability persistence is approved in this phase.
- [ ] No background sync is approved in this phase.
- [ ] No scheduled job is approved in this phase.

### 22A.7 Non-Authoritative Rows

- [ ] SUGGESTED allocations must never determine aircraft applicability.
- [ ] NEEDS_REVIEW allocations must never determine aircraft applicability.
- [ ] IGNORED allocations must never determine aircraft applicability.
- [ ] RESTORED is not an aircraft applicability authority status. Restored rows return to SUGGESTED or NEEDS_REVIEW and only become applicable after a later explicit ACCEPTED review decision.
- [ ] UNRESOLVED allocations must never determine aircraft applicability.
- [ ] Classifications `UNRESOLVED_MAKE` and `UNRESOLVED_MODEL` must be excluded even if a row is accidentally ACCEPTED.

### 22A.7 Matching Rules

- [ ] Model allocation applies when `matched_component_model_id == aircraft.model_id`.
- [ ] Manufacturer allocation applies when `matched_manufacturer_id == aircraft model manufacturer_id`.
- [ ] Manual model link applies only when `target_type = MANUAL_LINK`, `classification = MANUAL_MODEL_LINK`, and `matched_component_model_id == aircraft.model_id`.
- [ ] Manual manufacturer link applies only when `target_type = MANUAL_LINK`, `classification = MANUAL_MANUFACTURER_LINK`, and `matched_manufacturer_id == aircraft model manufacturer_id`.
- [ ] Broad rules apply only when status is ACCEPTED.
- [ ] Broad rules must preserve classification for explainability.
- [ ] Broad rules must preserve review reason for explainability.
- [ ] Broad rules must not imply final compliance status.

### 22A.7 Read-Only Boundaries

- [ ] The authority resolver must not create `ComplianceItem`.
- [ ] The authority resolver must not create `ComplianceAssignment`.
- [ ] The authority resolver must not create aircraft applicability rows.
- [ ] The authority resolver must not create tasks.
- [ ] The authority resolver must not create workpacks.
- [ ] The authority resolver must not affect due calculations.
- [ ] The authority resolver must not affect SB logic.
- [ ] The authority resolver must not affect SID logic.
- [ ] The authority resolver must not alter AD import.
- [ ] The authority resolver must not alter allocation review workflow.
- [ ] The authority resolver must not perform writes.

### 22A.7 Future Consumers

- [ ] Aircraft AD applicability preview may consume this authority.
- [ ] Future AD compliance engine may consume this authority only after a later explicit phase approves operational use.
- [ ] Future AD due engine may consume this authority only after a later explicit phase approves operational use.
- [ ] Future workpack planning may consume this authority only after a later explicit phase approves operational use.
- [ ] Future consumers must not duplicate matching rules outside the shared authority resolver.

### 22A.7 Query Strategy

- [ ] Load the aircraft with its current component model.
- [ ] Load the model's current manufacturer.
- [ ] Query `ad_applicability_allocations` where `status = ACCEPTED`.
- [ ] Exclude `UNRESOLVED_MAKE` and `UNRESOLVED_MODEL` classifications.
- [ ] Match rows where `matched_component_model_id` equals the aircraft model id.
- [ ] Match rows where `matched_manufacturer_id` equals the aircraft model manufacturer id.
- [ ] Include linked `AirworthinessDirective` data for AD number and subject display.
- [ ] Include matched model/manufacturer details for explainability.
- [ ] Include reviewer and review timestamp for audit display.
- [ ] Return a read-only result set without persisting derived applicability.

### 22A.7 Index Expectations

- [ ] Existing or future indexes should support `status`.
- [ ] Existing or future indexes should support `classification`.
- [ ] Existing or future indexes should support `matched_component_model_id`.
- [ ] Existing or future indexes should support `matched_manufacturer_id`.
- [ ] Existing or future indexes should support `airworthiness_directive_id`.
- [ ] Future caching may be considered only after correctness and operational authority are verified.
- [ ] Future caching must not become the source of truth unless a later phase explicitly approves it.

### 22A.7 Risks

- [ ] Broad manufacturer rules can affect many aircraft once accepted.
- [ ] Broad accepted rows must remain explainable with classification and review reason.
- [ ] Manual manufacturer links can intentionally apply to many models under a manufacturer.
- [ ] Aircraft model changes can change applicability immediately and must be visible to users.
- [ ] Future compliance creation must consume this authority rather than reimplementing matching rules.
- [ ] Any later persistence layer must avoid stale applicability after aircraft model changes.

### 22A.7 Tests Required

- [ ] Verify aircraft model changes change derived applicability.
- [ ] Verify manufacturer changes change derived applicability.
- [ ] Verify only ACCEPTED rows are considered.
- [ ] Verify SUGGESTED rows are ignored.
- [ ] Verify NEEDS_REVIEW rows are ignored.
- [ ] Verify IGNORED rows are ignored.
- [ ] Verify UNRESOLVED rows are ignored.
- [ ] Verify model allocations are honoured.
- [ ] Verify manufacturer allocations are honoured.
- [ ] Verify manual model links require `target_type = MANUAL_LINK` and `classification = MANUAL_MODEL_LINK`.
- [ ] Verify manual manufacturer links require `target_type = MANUAL_LINK` and `classification = MANUAL_MANUFACTURER_LINK`.
- [ ] Verify accepted broad rules are honoured and remain explainable.
- [ ] Verify no writes occur.
- [ ] Verify no compliance, task, workpack, due, SB, or SID side effects occur.

### 22A.7 Stop Gates

- [ ] Stop gate: aircraft applicability authority must remain read-only until a later compliance phase explicitly authorises operational use.
- [ ] Stop gate: no ComplianceItem creation may consume this authority until separately approved.
- [ ] Stop gate: no ComplianceAssignment creation may consume this authority until separately approved.
- [ ] Stop gate: no due calculation may consume this authority until separately approved.
- [ ] Stop gate: no workpack planning may consume this authority until separately approved.

## Phase 22A.8 - Explicit AD Applicability Review RBAC

### 22A.8 Purpose

- [ ] Replace temporary `LIBRARY_EDIT` fallback guards with dedicated AD applicability review permissions.
- [ ] Keep this slice RBAC-only.
- [ ] Preserve existing review workflow behavior while permissions are introduced.
- [ ] Do not change AD applicability matching, review decisions, aircraft preview, or compliance behavior.

### 22A.8 Permission Names And Purpose

- [ ] Define `AD_APPLICABILITY_REVIEW_VIEW` for viewing the AD applicability review screen.
- [ ] Define `AD_APPLICABILITY_REVIEW_REFRESH` for running manual refresh to persist suggestion allocations.
- [ ] Define `AD_APPLICABILITY_REVIEW_ACCEPT` for accepting suggested or needs-review allocations.
- [ ] Define `AD_APPLICABILITY_REVIEW_IGNORE` for ignoring suggested or needs-review allocations.
- [ ] Define `AD_APPLICABILITY_REVIEW_RESTORE` for restoring ignored allocations.
- [ ] Define `AD_APPLICABILITY_REVIEW_LINK_MODEL` for manually linking an allocation to an existing component model.
- [ ] Define `AD_APPLICABILITY_REVIEW_LINK_MANUFACTURER` for manually linking an allocation to an existing manufacturer.
- [ ] Permission names must remain stable once seeded.
- [ ] Permission names must be used directly by route guards after the transition.

### 22A.8 Recommended Role Mapping

- [ ] ADMIN receives `AD_APPLICABILITY_REVIEW_VIEW`.
- [ ] ADMIN receives `AD_APPLICABILITY_REVIEW_REFRESH`.
- [ ] ADMIN receives `AD_APPLICABILITY_REVIEW_ACCEPT`.
- [ ] ADMIN receives `AD_APPLICABILITY_REVIEW_IGNORE`.
- [ ] ADMIN receives `AD_APPLICABILITY_REVIEW_RESTORE`.
- [ ] ADMIN receives `AD_APPLICABILITY_REVIEW_LINK_MODEL`.
- [ ] ADMIN receives `AD_APPLICABILITY_REVIEW_LINK_MANUFACTURER`.
- [ ] QA receives `AD_APPLICABILITY_REVIEW_VIEW`.
- [ ] QA receives `AD_APPLICABILITY_REVIEW_REFRESH`.
- [ ] QA receives `AD_APPLICABILITY_REVIEW_ACCEPT`.
- [ ] QA receives `AD_APPLICABILITY_REVIEW_IGNORE`.
- [ ] QA receives `AD_APPLICABILITY_REVIEW_RESTORE`.
- [ ] QA receives `AD_APPLICABILITY_REVIEW_LINK_MODEL`.
- [ ] QA receives `AD_APPLICABILITY_REVIEW_LINK_MANUFACTURER`.
- [ ] ENGINEER receives `AD_APPLICABILITY_REVIEW_VIEW` only unless later explicitly approved.
- [ ] PLANNER receives `AD_APPLICABILITY_REVIEW_VIEW` only.
- [ ] VIEWER receives `AD_APPLICABILITY_REVIEW_VIEW` only.
- [ ] No non-review role receives write/action permissions by default.

### 22A.8 Seed And Migration Strategy

- [ ] Add permission definitions first.
- [ ] Add role-permission mapping second.
- [ ] Replace route guards third.
- [ ] Verify permission seeds before replacing `LIBRARY_EDIT` fallback guards.
- [ ] Verify role mappings before replacing `LIBRARY_EDIT` fallback guards.
- [ ] Keep seed changes narrowly scoped to AD applicability review permissions.
- [ ] Do not combine RBAC seed changes with workflow behavior changes.

### 22A.8 Transition Rule

- [ ] `LIBRARY_EDIT` fallback may remain only until explicit permissions are seeded.
- [ ] `LIBRARY_EDIT` fallback may remain only until route tests verify explicit permissions.
- [ ] Dedicated permissions must fully replace `LIBRARY_EDIT` guards after seeds and tests are verified.
- [ ] Transition must not lock out current authorized reviewers.
- [ ] Transition must not broaden access beyond the recommended role mapping.

### 22A.8 Route Guard Replacement Plan

- [ ] Replace review screen guard with `AD_APPLICABILITY_REVIEW_VIEW`.
- [ ] Replace refresh guard with `AD_APPLICABILITY_REVIEW_REFRESH`.
- [ ] Replace accept guard with `AD_APPLICABILITY_REVIEW_ACCEPT`.
- [ ] Replace ignore guard with `AD_APPLICABILITY_REVIEW_IGNORE`.
- [ ] Replace restore guard with `AD_APPLICABILITY_REVIEW_RESTORE`.
- [ ] Replace manual model link guard with `AD_APPLICABILITY_REVIEW_LINK_MODEL`.
- [ ] Replace manual manufacturer link guard with `AD_APPLICABILITY_REVIEW_LINK_MANUFACTURER`.
- [ ] Remove `LIBRARY_EDIT` fallback only after all dedicated route guards are verified.

### 22A.8 Boundaries

- [ ] RBAC changes must not change workflow behavior.
- [ ] RBAC changes must not change aircraft applicability behavior.
- [ ] RBAC changes must not create aircraft applicability rows.
- [ ] RBAC changes must not create `ComplianceItem`.
- [ ] RBAC changes must not create `ComplianceAssignment`.
- [ ] RBAC changes must not affect SB logic.
- [ ] RBAC changes must not affect SID logic.
- [ ] RBAC changes must not affect task logic.
- [ ] RBAC changes must not affect workpack logic.
- [ ] RBAC changes must not affect due calculations.
- [ ] RBAC changes must not affect AD import.
- [ ] RBAC changes must not alter allocation matching or review action payloads.

### 22A.8 Tests Required

- [ ] Verify users with `AD_APPLICABILITY_REVIEW_VIEW` can access the review screen.
- [ ] Verify users without `AD_APPLICABILITY_REVIEW_VIEW` cannot access the review screen.
- [ ] Verify refresh requires `AD_APPLICABILITY_REVIEW_REFRESH`.
- [ ] Verify accept requires `AD_APPLICABILITY_REVIEW_ACCEPT`.
- [ ] Verify ignore requires `AD_APPLICABILITY_REVIEW_IGNORE`.
- [ ] Verify restore requires `AD_APPLICABILITY_REVIEW_RESTORE`.
- [ ] Verify manual model link requires `AD_APPLICABILITY_REVIEW_LINK_MODEL`.
- [ ] Verify manual manufacturer link requires `AD_APPLICABILITY_REVIEW_LINK_MANUFACTURER`.
- [ ] Verify `LIBRARY_EDIT` alone no longer grants review access after fallback removal.
- [ ] Verify ADMIN and QA role mappings grant expected access.
- [ ] Verify ENGINEER, PLANNER, and VIEWER receive view-only access.

### 22A.8 Stop Gates

- [ ] Stop gate: no guard replacement until dedicated permissions are seeded.
- [ ] Stop gate: no guard replacement until role mappings are seeded.
- [ ] Stop gate: no guard replacement until route tests verify explicit permissions.
- [ ] Stop gate: no `LIBRARY_EDIT` fallback removal until current reviewer access is verified.
- [ ] Stop gate: implementation verification must prove no workflow behavior changed.
- [ ] Stop gate: implementation verification must prove no aircraft, compliance, SB, SID, task, workpack, due, or import behavior changed.

## Phase 22.9 - Aircraft Inheritance From Make And Model

- [ ] Define aircraft inheritance from assigned model ADs.
- [ ] Define aircraft inheritance from confirmed model-level AD assignments.
- [ ] Define aircraft inheritance from exact model applicability only after confirmation rules are approved.
- [ ] Define aircraft inheritance from make-level broad applicability only after review rules are approved.
- [ ] Define aircraft inheritance from product type only after review rules are approved.
- [ ] Aircraft must inherit via its selected component/aircraft model.
- [ ] Aircraft must inherit manufacturer context through its model.
- [ ] Aircraft must inherit asset type/product context through its model.
- [ ] Aircraft must not inherit unresolved ADs.
- [ ] Aircraft must not inherit ignored/excluded AD suggestions.
- [ ] Aircraft must not receive automatic aircraft compliance rows in this phase.
- [ ] Aircraft due status must not change in this phase.
- [ ] Workpack generation must not change in this phase.
- [ ] Stop gate: inheritance must be previewed before it affects operational compliance.

## Phase 22.10 - AD-To-SB Read-Only Relationship Rules

- [ ] Preserve FAA AD relationship fields from AD and AD1 sources.
- [ ] Store affected AD relationships as read-only source relationships.
- [ ] Store superseded AD relationships as read-only source relationships.
- [ ] Store affected-by relationships as read-only source relationships.
- [ ] Store superseded-by relationships as read-only source relationships.
- [ ] Define AD-to-SB references as read-only cross-reference data when present.
- [ ] Do not create SB records from AD relationship text.
- [ ] Do not attach SBs to models from AD relationship text.
- [ ] Do not alter SB applicability from AD relationship text.
- [ ] Do not alter SB compliance status from AD relationship text.
- [ ] Do not create workpack SB tasks from AD relationship text.
- [ ] Display AD-to-SB relationships as informational only unless a later phase approves action.
- [ ] If an AD references an SB, show the reference without claiming compliance equivalence.
- [ ] If an SB references an AD, show the reference without claiming compliance equivalence.
- [ ] Stop gate: AD-to-SB links must remain read-only and non-authoritative.

## Phase 22.11 - RBAC, Audit, And Operational Controls

- [ ] Define permission required to upload FAA AD files.
- [ ] Define permission required to preview FAA AD files.
- [ ] Define permission required to commit FAA AD imports.
- [ ] Define permission required to view AD applicability suggestions.
- [ ] Define permission required to assign ADs to models.
- [ ] Define permission required to mark suggestions ignored/excluded if implemented.
- [ ] Define permission required to restore ignored/excluded suggestions if implemented.
- [ ] Library edit users may manage AD source/import workflows only if currently authorized.
- [ ] Read-only users may view AD applicability only where existing RBAC allows library/compliance visibility.
- [ ] Customer users must not receive AD source management actions.
- [ ] Import commits must write audit events if the audit system supports this action.
- [ ] Applicability review decisions must write audit events if durable review is implemented.
- [ ] Assignment actions must remain attributable to the acting user where existing infrastructure supports it.
- [ ] Failed imports must not expose sensitive stack traces to normal users.
- [ ] Stop gate: RBAC matrix must be verified before routes are exposed.

## Phase 22.12 - Final Verification And Programme Stop Gate

- [ ] Verify no production behaviour changed during DEFINE-only steps.
- [ ] Verify AD file preview is read-only.
- [ ] Verify AD1 file preview is read-only.
- [ ] Verify AD import commit is transaction-safe.
- [ ] Verify AD import commit is idempotent.
- [ ] Verify duplicate AD rows are not created on rerun.
- [ ] Verify duplicate AD relationship rows are not created on rerun.
- [ ] Verify Make is preserved.
- [ ] Verify Model is preserved.
- [ ] Verify Product Type is preserved.
- [ ] Verify Product Subtype is preserved.
- [ ] Verify exact model matches are classified correctly.
- [ ] Verify make-level broad matches are classified correctly.
- [ ] Verify unresolved Make rows remain visible.
- [ ] Verify unresolved Model rows remain visible.
- [ ] Verify ambiguous rows are Needs Review.
- [ ] Verify manual AD assignment still works.
- [ ] Verify existing compliance items remain valid.
- [ ] Verify existing compliance assignments remain valid.
- [ ] Verify SB workflows still pass.
- [ ] Verify SID workflows still pass.
- [ ] Verify standard task workflows still pass.
- [ ] Verify workpack generation still passes.
- [ ] Verify utilisation workflows still pass.
- [ ] Verify due calculation workflows still pass.
- [ ] Verify RBAC blocks unauthorized import and assignment actions.
- [ ] Verify customer users cannot manage AD source data.
- [ ] Verify AD-to-SB relationships remain read-only.
- [ ] Verify no automatic aircraft compliance rows are created by import.
- [ ] Verify no due status is recalculated by import.
- [ ] Verify no workpack tasks are generated by import.
- [ ] Stop gate: do not proceed to operational integration until all checks pass.

## Programme Acceptance Criteria

- [ ] The programme is split into phases 22.0 through 22.12.
- [ ] FAA AD import from AD files is included.
- [ ] FAA AD import from AD1 files is included.
- [ ] Make-level applicability is included.
- [ ] Model-level applicability is included.
- [ ] Unresolved and missing make/model handling is included.
- [ ] Rerun and idempotent import behaviour is included.
- [ ] Aircraft inheritance from make/model is included.
- [ ] AD-to-SB read-only relationship rules are included.
- [ ] RBAC requirements are included.
- [ ] Verification and stop gates are included.
- [ ] Boundaries protecting SBs are explicit.
- [ ] Boundaries protecting SIDs are explicit.
- [ ] Boundaries protecting tasks are explicit.
- [ ] Boundaries protecting workpacks are explicit.
- [ ] Boundaries protecting utilisation are explicit.
- [ ] Boundaries protecting existing compliance are explicit.
- [ ] No implementation is approved by this document alone.
