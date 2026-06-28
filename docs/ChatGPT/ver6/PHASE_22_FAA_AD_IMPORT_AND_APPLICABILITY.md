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
