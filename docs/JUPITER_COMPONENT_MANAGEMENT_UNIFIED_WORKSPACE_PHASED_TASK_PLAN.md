
JUPITER COMPONENT MANAGEMENT UNIFIED WORKSPACE
Complete Phased Task Plan
Project: Jupiter AMMS
Feature: Unified Component Management Workspace
Governance status: Feature authority approved through Phase 3; implementation paused pending Governance Modernisation verification
Governance registration: docs/governance/ACTIVE_WORK.md
Approval state: Phase 1 approved; Phase 2 approved; Phase 3 approved; no implementation slice currently authorised
Status: Approved through technical design; implementation paused and not authorised
Execution order: INVESTIGATE → DEFINE → APPROVE → IMPLEMENT → VERIFY → RELEASE

1. Purpose
Jupiter currently presents the following closely related capabilities through separate screens and navigation paths:
    • Component life-limit governance
    • Component manufacturers
    • Component models
    • Serialized components
    • Create serialized component
Although these are separate technical and data domains, they form one operational workflow for the user. The objective is to provide one Component Management workspace from which an authorised user can find, create, and manage serialized components and, when permitted, create or maintain the related manufacturer, model, and life-governance information without repeatedly moving between unrelated screens.
The objective is interface and workflow consolidation, not uncontrolled replacement of proven data structures or business logic.

2. Non-Negotiable Safety Rules
    • Load and comply with JUPITER_AI_DEVELOPMENT_CONSTITUTION.md.
    • Load and comply with JUPITER AI SESSION BOOT.
    • Load and reconcile MASTER_EXECUTION_PLAN.md.
    • Load and reconcile CURRENT_SYSTEM_ROADMAP.md.
    • Identify the active approved phase document.
    • Record the current branch, commit, and working-tree status.
    • Preserve all unrelated user changes in the working tree.
    • Do not infer missing functionality merely because it is not visible on one screen.
    • Investigate before designing or changing code.
    • Classify existing capability as EXACT_MATCH, PARTIAL_MATCH, or NO_MATCH.
    • Reuse working routes, services, validation, permissions, and audit controls wherever safe.
    • Do not remove existing screens or routes during the first implementation slices.
    • Do not change database schema until the investigation proves it is necessary and the migration is approved.
    • Do not silently alter component life calculations, utilisation baselines, installation history, or compliance behaviour.
    • Run database tests only through Jupiter's guarded test-database path.
    • Never run destructive tests or reset commands against the development or production database.
    • Stop on an unexplained roadmap inconsistency, dirty-file overlap, failing baseline, migration uncertainty, permission regression, or data-integrity risk.

2.1 Locked current scoping and future multi-tenancy boundary
    • CURRENT FEATURE REQUIREMENT — Preserve Jupiter's current proven data/scoping architecture and existing server-side permissions/data visibility.
    • CURRENT FEATURE REQUIREMENT — Manufacturers and component models remain global master data for this feature.
    • CURRENT FEATURE REQUIREMENT — Serialized-component lookup remains under the current proven scoping model, with no expansion of visibility beyond existing authority.
    • CURRENT FEATURE REQUIREMENT — Do not add tenant_id, company_id, RLS, tenant predicates, transfer semantics, provider hierarchy, or a parallel ownership architecture.
    • CURRENT FEATURE REQUIREMENT — Do not claim that the resulting workspace is tenant-isolated.
    • FUTURE / DEFERRED — JUPITER MULTI-TENANCY: Jupiter is intended to support strong tenant/company isolation, and this design must not unnecessarily obstruct that future architecture.
    • FUTURE / DEFERRED — Tenant ownership, company scoping, RLS, transfer semantics, provider hierarchy, and cross-tenant isolation require a separately approved INVESTIGATE → DEFINE → IMPLEMENT → VERIFY lifecycle.
    • FUTURE / DEFERRED — Multi-tenant productisation is outside the authorised Component Management implementation scope.

3. Target User Outcome
An authorised user should be able to open one Component Management workspace and:
    • Search, filter, sort, and view serialized components.
    • Start creation of a serialized component without leaving the workspace.
    • Select an existing manufacturer and model.
    • Create a missing manufacturer or model in context if the user has permission.
    • See the life-limit and tracking governance inherited from the selected model.
    • Enter the component identity, dates, certification/reference information, status, location, and operational baselines required by existing Jupiter rules.
    • See clear validation before saving.
    • Save the serialized component once, without duplicate data entry.
    • Return to the component list with the created component visible.
    • Access manufacturer, model, and life-governance administration from the same workspace when authorised.
The workspace should use tabs, panels, drawers, or guided steps as appropriate. “One screen” means one coherent workspace and navigation context; it does not require every field to be visible simultaneously.

PHASE 0 — SESSION BOOT AND BASELINE CONTROL
0.1 Governance and repository baseline
    • Complete every mandatory boot document check.
    • Record active phase and current roadmap position.
    • Record git status --short without changing existing files.
    • Identify pre-existing modified and untracked files.
    • Confirm whether any existing work overlaps component management.
    • Record current build, typecheck, unit-test, integration-test, and E2E commands.
    • Confirm the safe test database configuration and guarded commands.
    • Run only the approved non-destructive baseline checks.
    • Record all pre-existing failures separately from feature-related failures.
Phase 0 exit gate
    • Governance documents agree on the allowed work.
    • Working-tree ownership is understood.
    • Safe test execution is confirmed.
    • Baseline results are recorded.
    • No implementation has started.
STOP if: the active phase is unclear, required documents conflict, the baseline cannot be safely established, or overlapping uncommitted work cannot be separated.

PHASE 1 — CODEX EXISTING-SYSTEM INVESTIGATION
1.1 Navigation and route inventory
    • Locate every menu entry and link for component manufacturers.
    • Locate every menu entry and link for component models.
    • Locate every menu entry and link for life-limit governance.
    • Locate every menu entry and link for serialized components.
    • Locate every menu entry and link for creating serialized components.
    • Inventory all relevant GET, POST, PUT/PATCH, and delete/deactivate routes.
    • Record route guards, authentication requirements, CSRF handling, and permission checks.
    • Identify redirects and return paths after create/edit operations.
1.2 Controller, service, validation, and view inventory
    • Identify all relevant controllers and controller methods.
    • Identify all domain/application services called by those controllers.
    • Identify request schemas, validators, normalisers, and duplicate checks.
    • Identify all EJS templates, partials, HTMX endpoints, and client-side scripts.
    • Identify shared form components that can safely be reused.
    • Identify pagination, search, filtering, and sorting implementations.
    • Identify flash messages, field errors, and failure recovery behaviour.
1.3 Data-model and database inventory
    • Identify the manufacturer model/table and all significant fields.
    • Identify the component-model model/table and all significant fields.
    • Identify serialized-component models/tables and all significant fields.
    • Identify life-limit, tracking-basis, utilisation, overhaul, installation, and history models/tables.
    • Map primary keys, foreign keys, uniqueness constraints, check constraints, and delete rules.
    • Identify database triggers, functions, views, and any existing scoping controls affecting the workflow; do not infer RLS or tenant predicates.
    • Identify audit/history tables and immutable records.
    • List migrations that established or changed these structures.
    • Confirm the proven current scope: manufacturers and component models are global master data.
    • Determine the existing serialized-component and history data-visibility boundaries without claiming tenant/company isolation.
    • Confirm the workspace does not expand data visibility beyond current server-side authority.
1.4 Current workflow investigation
    • Document the exact current path for creating a manufacturer.
    • Document the exact current path for creating a model.
    • Document the exact current path for defining life-limit governance.
    • Document the exact current path for creating a serialized component.
    • Document the exact current path for setting initial operational values.
    • Document how last overhaul date, TSN, TSO, CSN, CSO, hours, cycles, landings, and calendar values are represented.
    • Distinguish initial installation date, current/last installation date, manufacture date, and last overhaul date.
    • Document what is inherited from a model and what is entered per serialized component.
    • Identify duplicate fields or repeated entry across screens.
    • Identify fields that appear optional in the UI but are operationally required later.
    • Identify all side effects of serialized-component creation.
    • Identify whether creation automatically generates history, audit, tracking, inventory, or allocation records.
1.5 Permission and role investigation
    • Inventory permissions for viewing and editing manufacturers.
    • Inventory permissions for viewing and editing models.
    • Inventory permissions for viewing and editing life governance.
    • Inventory permissions for viewing and creating serialized components.
    • Map permissions to ADMIN, QA, ENGINEER, PLANNER, MECHANIC, CONTROLLER, and VIEWER where present.
    • Determine whether different tabs/actions must be hidden, read-only, or disabled per permission.
    • Confirm that server-side permission enforcement remains authoritative even if controls are hidden.
1.6 Test inventory and behavioural evidence
    • Locate unit tests for manufacturers and models.
    • Locate tests for serialized-component creation and duplicate prevention.
    • Locate tests for life-limit governance and tracking-basis rules.
    • Locate tests for component utilisation and remaining-life calculations.
    • Locate tests for installation/removal and overhaul histories.
    • Locate permission and current data-visibility tests; record future tenant-isolation coverage as deferred.
    • Locate relevant Playwright/E2E tests.
    • Record untested critical behaviour as a gap; do not assume it is absent.
1.7 Capability classification
For every requested outcome, classify the current implementation:
    • Unified component landing workspace — EXACT_MATCH / PARTIAL_MATCH / NO_MATCH
    • Serialized-component search/list — EXACT_MATCH / PARTIAL_MATCH / NO_MATCH
    • In-workspace component creation — EXACT_MATCH / PARTIAL_MATCH / NO_MATCH
    • In-context manufacturer creation — EXACT_MATCH / PARTIAL_MATCH / NO_MATCH
    • In-context model creation — EXACT_MATCH / PARTIAL_MATCH / NO_MATCH
    • Automatic model-governance display — EXACT_MATCH / PARTIAL_MATCH / NO_MATCH
    • Automatic inheritance of applicable rules — EXACT_MATCH / PARTIAL_MATCH / NO_MATCH
    • Baseline and overhaul capture — EXACT_MATCH / PARTIAL_MATCH / NO_MATCH
    • Permission-sensitive workspace controls — EXACT_MATCH / PARTIAL_MATCH / NO_MATCH
    • Current permission and data-visibility enforcement — EXACT_MATCH / PARTIAL_MATCH / NO_MATCH
Required Phase 1 deliverable
    • Produce an evidence-backed investigation report containing exact file paths, relevant symbols, routes, tables, migrations, permissions, tests, current behaviour, gaps, risks, and recommended reuse points.
    • State whether the change is primarily UI orchestration, requires service refactoring, requires schema work, or requires a combination.
    • State explicitly what must not be changed.
    • Do not implement any code.
Phase 1 exit gate
    • Existing behaviour is understood end-to-end.
    • Current data ownership and visibility boundaries are understood without inventing tenant architecture.
    • Missing capability is proven rather than assumed.
    • Investigation report is reviewed and approved by the user.

PHASE 2 — FUNCTIONAL AND UX DEFINITION
2.1 Workspace information architecture
    • Define the workspace name and route, recommended as /components or the closest consistent existing route.
    • Define the default tab as Serialized Components.
    • Define the Create Component workflow.
    • Define the Manufacturers & Models administration area.
    • Define the Life Governance administration/review area.
    • Decide whether areas use tabs, drawers, modal dialogs, inline panels, or full-width steps.
    • Ensure browser back/forward, refresh, deep linking, validation errors, and return-to-list behaviour are defined.
    • Define responsive behaviour and accessibility expectations.
2.2 Serialized-components list definition
    • Define visible columns and default order.
    • Define search fields: serial number, part number, model, manufacturer, status, aircraft, and location as supported by current data.
    • Define filters and result counts that preserve the current proven data visibility.
    • Define pagination and page-size behaviour.
    • Define row actions and permission requirements.
    • Define empty, loading, error, and no-result states.
2.3 Guided create-component definition
    • Define logical steps: classification/model → identity → dates/status → operational baselines → governance review → confirmation.
    • Reuse existing field definitions and validations.
    • Mark mandatory, conditional, inherited, calculated, and read-only fields clearly.
    • Define serial-number and part-number duplicate handling.
    • Define manufacture date, received date, last overhaul date, and installation-date semantics.
    • Define TSN/TSO/CSN/CSO and other baseline semantics.
    • Define how unknown values are represented without converting them to zero.
    • Define how validation errors preserve entered values.
    • Define save behaviour and duplicate-submit protection.
    • Define cancellation and unsaved-change warnings.
2.4 In-context master-data creation
    • Permit “Add manufacturer” only for users with the existing required permission.
    • Permit “Add model” only for users with the existing required permission.
    • Reuse existing validation, duplicate detection, auditing, permissions, and proven data visibility.
    • Return the newly created record to the component form and select it safely.
    • Do not permit inline creation to bypass required manufacturer/model fields.
    • Define behaviour when a concurrent user creates the same record.
    • Define behaviour when the user lacks permission.
2.5 Life-governance presentation
    • Define the exact rules shown after model selection.
    • Distinguish inherited governance from serialized-component baseline values.
    • Show hours, cycles, landings, calendar, overhaul, replacement, inspection, or combination rules as supported.
    • Define warnings for a model lacking required governance.
    • Define whether component creation may proceed when governance is incomplete, using existing business rules.
    • Require an explicit approved rule before changing inherited governance during component creation.
2.6 Permission matrix
    • Produce an action-by-role/permission matrix covering view, create, edit, deactivate, and governance administration.
    • Define hidden versus read-only controls.
    • Confirm all mutations remain protected server-side.
2.7 Acceptance criteria and mock-up
    • Produce a wireframe or annotated layout.
    • Produce acceptance criteria for each tab and workflow.
    • Produce negative acceptance criteria for forbidden behaviour.
    • Obtain explicit user approval of the screen structure and workflow.
Phase 2 exit gate
    • UX and workflow are approved.
    • Field semantics are unambiguous.
    • Permission behaviour is approved.
    • Schema impact is known.
    • Implementation slices are approved.

PHASE 3 — TECHNICAL DESIGN AND IMPLEMENTATION PREPARATION
3.1 Architecture decision
    • Identify existing routes and services that can be composed unchanged.
    • Identify any duplicated controller logic that must be moved into reusable services.
    • Ensure service extraction preserves existing route behaviour.
    • Decide whether HTMX partial endpoints are appropriate.
    • Define transaction boundaries for component creation and related side effects.
    • Define concurrency and uniqueness handling.
    • Define audit-event requirements.
    • Define current permission and data-visibility enforcement at query and mutation boundaries without adding tenant predicates.
3.2 Schema decision
    • Explicitly state NO MIGRATION REQUIRED if current structures support the feature.
    • If a migration is required, document the precise gap and why UI/service changes cannot solve it.
    • Require additive, backward-compatible, idempotent migration design where possible.
    • Define forward and rollback verification.
    • Protect historical component, utilisation, overhaul, installation, and audit records.
3.3 Test plan before code
    • Define unit tests for extracted or new service logic.
    • Define request/controller tests for each workspace endpoint.
    • Define validation and duplicate tests.
    • Define permission-denial tests.
    • Define permission-denial and no-visibility-expansion tests; future tenant-isolation tests remain deferred.
    • Define transaction rollback tests.
    • Define E2E tests for the complete happy path.
    • Define E2E tests for missing permissions and validation recovery.
    • Define regression tests for existing screens and routes.
Phase 3 exit gate
    • Technical design is documented.
    • Migration decision is approved.
    • Test plan is approved.
    • Implementation sequence is small, reversible, and reviewable.

PHASE 4 — IMPLEMENTATION SLICE A: WORKSPACE SHELL
    • Add the unified Component Management route and navigation entry.
    • Add the workspace shell with approved tabs/sections.
    • Reuse the existing serialized-component query for the default list.
    • Preserve all existing routes and menu access during transition.
    • Add permission-sensitive visibility without changing underlying permissions.
    • Add empty, error, and unauthorised states.
    • Add tests for route access, navigation, rendering, and list-result parity with current proven visibility.
    • Run focused tests, typecheck, build, and diff checks.
Slice A exit gate
    • Workspace shell is usable and read-only/list behaviour matches existing results.
    • Existing screens continue to work.
    • No data mutation behaviour has changed.

PHASE 5 — IMPLEMENTATION SLICE B: GUIDED SERIALIZED-COMPONENT CREATION
    • Integrate the existing create behaviour into the workspace.
    • Preserve existing validation and server-side authority.
    • Implement approved guided sections/steps.
    • Preserve entered data after validation failure.
    • Implement duplicate-submit protection.
    • Correctly distinguish unknown, zero, and not-applicable operational values.
    • Capture last overhaul date and approved baselines where already supported.
    • Display inherited governance before final save.
    • Save through an atomic transaction where required.
    • Confirm audit/history/side-effect records match the existing safe workflow.
    • Return to the list and visibly identify the created record.
    • Add happy-path, validation, duplicate, rollback, permission, data-visibility, and regression tests.
Slice B exit gate
    • A serialized component can be safely created entirely within the workspace.
    • Resulting database records match the established domain rules.
    • Existing creation route still works.

PHASE 6 — IMPLEMENTATION SLICE C: IN-CONTEXT MANUFACTURER AND MODEL MANAGEMENT
    • Add manufacturer search/selection to the create workflow.
    • Add permission-controlled in-context manufacturer creation.
    • Add model search filtered by the selected manufacturer and existing domain rules.
    • Add permission-controlled in-context model creation.
    • Reuse existing validation, uniqueness, audit, permission, and data-visibility logic.
    • Select newly created records without losing component-form data.
    • Handle concurrent duplicates safely.
    • Add manufacturer/model administration tab using existing safe behaviour.
    • Add permission, duplicate, concurrency, data-visibility, and regression tests.
Slice C exit gate
    • Authorised users can create missing master data without leaving the workspace.
    • Unauthorised users cannot bypass master-data permissions.
    • Existing manufacturer/model screens still work.

PHASE 7 — IMPLEMENTATION SLICE D: LIFE-GOVERNANCE INTEGRATION
    • Load applicable governance when a model is selected.
    • Present inherited limits and tracking bases clearly.
    • Identify incomplete governance without silently inventing defaults.
    • Apply existing rules for whether creation may continue.
    • Add permission-controlled life-governance administration to the workspace.
    • Prevent ordinary component creation from altering controlled governance.
    • Confirm life calculations remain unchanged unless separately approved.
    • Add tests for hours, cycles, calendar, combination rules, missing governance, permissions, data visibility, and regression.
Slice D exit gate
    • Governance is visible and correctly associated with the selected model.
    • No component-life calculation or historical record has been unintentionally changed.

PHASE 8 — DATA AND MIGRATION WORK, ONLY IF PROVEN NECESSARY
    • Reconfirm the migration is required immediately before implementation.
    • Hash and preserve already executed migrations.
    • Add a new migration; do not edit an executed migration.
    • Make the change additive and backward compatible where possible.
    • Test migration status before application.
    • Apply only through guarded test-database commands.
    • Verify constraints, indexes, current proven scoping, existing rows, and rollback behaviour without adding tenant architecture.
    • Confirm no historical values were normalised, replaced, or set to zero.
    • Record exact pre/post migration evidence.
Phase 8 exit gate
    • Migration safety and data preservation are proven.
    • Application works with both the transitional and final schema states as designed.

PHASE 9 — COMPLETE VERIFICATION AND OPERATIONAL REGRESSION
9.1 Automated verification
    • Run formatting/linting checks if configured.
    • Run TypeScript typecheck.
    • Run production build.
    • Run focused component-management tests.
    • Run manufacturer/model tests.
    • Run life-governance and calculation tests.
    • Run installation/removal/overhaul history tests.
    • Run permission tests.
    • Run permission and no-visibility-expansion tests; do not claim future tenant isolation.
    • Run the approved broader regression suite.
    • Run relevant E2E tests against the isolated test environment.
    • Run git diff --check.
    • Run credential/secret-safe changed-file review.
9.2 Manual operational verification
    • Open workspace as ADMIN.
    • Open workspace as each relevant restricted role.
    • Verify role-specific visibility and mutation denial.
    • Search and filter serialized components.
    • Create a component using existing manufacturer/model data.
    • Create a component while adding an authorised new manufacturer/model.
    • Verify validation-error recovery.
    • Verify duplicate handling.
    • Verify last overhaul date and baseline values.
    • Verify inherited governance.
    • Verify resulting audit/history records.
    • Verify existing screens and routes still work.
    • Verify the workspace does not expand visibility through lists, lookups, counts, URLs, validation messages, or direct requests beyond current server-side authority.
    • Verify keyboard use, labels, focus order, and responsive layout.
9.3 Evidence and defect handling
    • Record exact commands and results.
    • Record screenshots or route-level evidence for approved workflows.
    • Separate pre-existing failures from feature regressions.
    • Fix and retest every feature regression before proceeding.
    • Classify final state as SAFE_TO_COMMIT or NOT_SAFE_TO_COMMIT.
Phase 9 exit gate
    • All acceptance criteria pass.
    • No unresolved regression, permission, or data-visibility defect remains.
    • Evidence supports SAFE_TO_COMMIT.

PHASE 10 — CONTROLLED TRANSITION AND CLEANUP
    • Obtain approval before changing or removing old menu entries.
    • Initially redirect old navigation links to the relevant workspace tab only after parity is proven.
    • Retain old URLs as compatible redirects where bookmarks or integrations may exist.
    • Remove duplicate view code only after confirming it has no remaining consumers.
    • Do not remove reusable services, validation, permissions, audit logic, or historical routes required for compatibility.
    • Update the user manual and training material.
    • Update roadmap and phase documentation with exact delivered scope.
    • Record any deferred improvements separately.
Phase 10 exit gate
    • Unified workspace is the approved primary user path.
    • Backward compatibility is preserved or deliberately retired with approval.
    • Documentation reflects the released behaviour.

PHASE 11 — COMMIT AND RELEASE CONTROL
    • Review the complete diff for scope creep.
    • Confirm unrelated dirty files are excluded.
    • Confirm migration and schema status, if applicable.
    • Confirm no credentials, local environment files, generated databases, or test artefacts are included.
    • Produce a concise commit manifest.
    • Commit in approved logical slices where practical.
    • Record commit hashes.
    • Perform post-deployment smoke checks for health, login, workspace access, search, create flow, permissions, and preservation of current data visibility.
    • Confirm rollback/recovery procedure.
    • Update release and roadmap status only after smoke verification passes.

4. Minimum Acceptance Criteria
    • One coherent Component Management workspace exists.
    • Existing serialized components are searchable under the current proven scoping model.
    • A component can be created without navigating away from the workspace.
    • Missing manufacturer/model data can be added in context only by authorised users.
    • Model life governance is visible before component creation is confirmed.
    • Unknown operational values are not silently converted to zero.
    • Last overhaul date and operational baselines follow proven Jupiter domain semantics.
    • No permission is weakened.
    • The workspace does not expand data visibility beyond existing server-side permissions and authority; it makes no tenant-isolation claim.
    • Audit, history, installation, utilisation, and life calculations remain correct.
    • Existing working routes remain functional until controlled retirement is separately approved.
    • Automated and manual regression verification passes.

5. Explicitly Out of Scope Unless Separately Approved
    • Rewriting the component-life calculation engine.
    • Changing utilisation-event immutability.
    • Reconstructing or normalising historical component values.
    • Automatically assigning components to aircraft during component creation.
    • Altering workpack, AD, SB, inventory, or compliance effects.
    • Weakening audit trails or deleting historical records.
    • Replacing established permissions with UI-only controls.
    • Broad database redesign merely to support screen consolidation.
    • Removing legacy routes before feature parity and rollback safety are proven.

6. First Instruction to Give Codex
Start in INVESTIGATE mode only. Load all mandatory Jupiter governance and planning documents, establish the safe repository and test baseline, and then complete Phase 1 of JUPITER_COMPONENT_MANAGEMENT_UNIFIED_WORKSPACE_PHASED_TASK_PLAN.md. Do not modify production code, views, migrations, tests, or documentation other than the explicitly authorised investigation report. Prove the current implementation by inspecting routes, controllers, services, models, tables, migrations, views, permissions, current data-visibility boundaries, and tests. Classify each requested capability as EXACT_MATCH, PARTIAL_MATCH, or NO_MATCH. Stop and report if any required behaviour, data ownership rule, active phase, working-tree overlap, or safety condition is unclear. Return the investigation report for approval before proposing implementation.
