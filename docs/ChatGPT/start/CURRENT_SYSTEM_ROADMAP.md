# CURRENT_SYSTEM_ROADMAP.md

# PURPOSE

This document records what ACTUALLY EXISTS in Jupiter.

It is not a future roadmap.

It is not a wish list.

It is not a design document.

It is the authoritative capability map used to prevent reinvention of existing functionality.

Before any implementation:

1. Inspect this document.
2. Determine whether the capability already exists.
3. Classify:

* ALREADY_IMPLEMENTED
* PARTIALLY_IMPLEMENTED
* NOT_IMPLEMENTED

4. If ALREADY_IMPLEMENTED:

   * STOP
   * Return evidence
   * Do not modify files

5. If PARTIALLY_IMPLEMENTED:

   * Extend existing implementation only
   * Do not create parallel implementations

6. If NOT_IMPLEMENTED:

   * Follow approved roadmap phases
   * Implement the smallest safe change

---

# OPERATIONAL TRUTHS

## Serialized Components Are Authoritative For

The serialized architecture is the authority for:

* Serialized component identity
* Serialized component inventory
* Serialized installation history
* Serialized removal history
* Serialized life state
* Serialized maintenance history
* Serialized overhaul tracking
* Serialized life-limit calculations
* Serialized due status
* Serialized component dashboard
* Serialized component compliance visibility

Primary tables:

* serialized_components
* aircraft_component_installations
* serialized_component_life_states
* serialized_component_maintenance_events
* component_life_limits

---

## aircraft_components Remains Operationally Active

aircraft_components is NOT retired.

aircraft_components remains active for:

* TaskCard.component_id
* WorkpackSnag.component_id
* Aircraft configuration services
* Return-to-service blocking
* Legacy TBO grounding
* Current compliance scope
* SB applicability scope
* Historical compatibility
* Existing operational workflows

Do NOT:

* Remove aircraft_components
* Blindly migrate aircraft_components
* Treat aircraft_components as retired

without an approved roadmap phase.

---

## Compliance Authority

Compliance authority remains:

* compliance_items
* aircraft_compliance
* workpack_compliance

Serialized components currently contribute:

* Visibility
* Applicability analysis
* Scope analysis

Serialized components do NOT currently:

* Complete compliance
* Create compliance
* Close compliance
* Mutate compliance

---

## Workpack Authority

Workpacks remain authoritative for:

* Workpack lifecycle
* Task execution
* Certification
* Signoff
* QA workflow

Serialized component integration is currently:

* Read-only visibility
* Read-only due status
* Read-only context

Workpacks do NOT currently:

* Create serialized maintenance events
* Create overhaul events
* Create return-to-service events
* Mutate serialized life state

automatically.

---

# COMPLETED + LOCKED CAPABILITIES

## Workpack Operational Authority

Status:

COMPLETE + LOCKED

Workpack lifecycle authority:

* WorkpackLifecycleService

Current workpack state machine:

* DRAFT
* ISSUED
* IN_PROGRESS
* CERTIFIED
* CLOSED

Lifecycle rules:

* DRAFT can be deleted.
* DRAFT can be issued only if it has tasks and all tasks are OPEN.
* ISSUED can start into IN_PROGRESS.
* Certification requires IN_PROGRESS, engineer role, certified/locked tasks, certified executions, completed compliance, and no open snags.
* Close requires CERTIFIED status, certification metadata, completed compliance, certified executions, and all snags closed.

Do Not Recreate.

---

## Workpack Task Execution Workflow

Status:

COMPLETE + LOCKED

Task execution authority:

* TaskExecutionService

Current task state machine:

* OPEN
* IN_PROGRESS
* COMPLETED_BY_MECHANIC
* CERTIFIED_BY_ENGINEER
* LOCKED

Task rules:

* Mechanic starts and completes tasks.
* Completion records work performed, measurements, mechanic signature, execution audit.
* Engineer certifies completed tasks.
* Supervisor locks certified tasks.
* workpack_executions mirrors task execution state.

Do Not Recreate.

---

## Workpack Certification Gate

Status:

COMPLETE + LOCKED

Certification authority:

* WorkpackLifecycleService
* TaskExecutionService

Certification is blocked unless:

* Workpack is IN_PROGRESS.
* User has engineer authority.
* All tasks/executions are certified or locked.
* Compliance is complete.
* Snags are closed.

Do Not Recreate.

---

## Workpack Close Gate

Status:

COMPLETE + LOCKED

Close is blocked unless:

* Workpack is CERTIFIED.
* Certification metadata exists.
* Compliance is complete.
* Executions are certified.
* Snags are closed.

Do Not Recreate.

---

## Workpack Snag Workflow

Status:

COMPLETE + LOCKED

Snag authority:

* SnagService

Current snag state machine:

* OPEN
* IN_PROGRESS
* RESOLVED
* CLOSED

Rules:

* Snags may be workpack-linked or standalone.
* Snags may reference legacy aircraft_components.component_id.
* Start allowed for mechanic, engineer, supervisor, admin.
* Resolve allowed for assigned mechanic/engineer or supervisor/admin.
* Close allowed for engineer/supervisor/admin.
* Open/non-closed snags block workpack certification/close.
* Snag audit is recorded through WorkpackSnagAuditLog.

Do Not Recreate.

---

## Workpack Audit Trail

Status:

COMPLETE + LOCKED

Audit authority:

* WorkpackAuditLog
* WorkpackSnagAuditLog
* WorkpackAuditService

Provides:

* Workpack lifecycle audit
* Task execution audit
* Snag audit
* Certification audit

Do Not Recreate.

---

## Workpack Planning And Generation

Status:

COMPLETE + LOCKED

Planning/generation authority:

* WorkpackPlanningService
* WorkpackGenerationService

Provides:

* Workpack task planning
* Workpack template/generation support
* Planning/edit lock boundaries

Do Not Recreate.

---

## Workpack Compliance Attachment

Status:

COMPLETE + LOCKED

Compliance attachment occurs during workpack creation through existing compliance/workpack services.

Authority remains:

* compliance_items
* aircraft_compliance
* workpack_compliance

Important:

* Workpacks may attach applicable DUE/OVERDUE compliance.
* Serialized due visibility does not create compliance.
* Serialized due visibility does not attach workpack compliance.

Do Not Recreate.

---

## Printed Workpack / CRS / CRMA Document Maturity

Status:

COMPLETE + LOCKED

Implemented document/print services include:

* PrintableWorkpackService
* PrintableWorkpackPdfService
* DocumentVerificationService
* CrsDocumentService
* CrmaDocumentService

Provides:

* Printable workpack snapshots
* Service/CRS PDF routes
* CRS generation
* CRMA generation
* Document verification gating

Important:

* Printable workpack snapshots are read-only.
* workflow_mutation_permitted = false.
* Printing must not mutate workflow state.

Do Not Recreate.

---

## QA Workflow

Status:

PARTIALLY_IMPLEMENTED

Existing:

* /workpacks/qa shows CERTIFIED workpacks to supervisor users.
* QA view calculates task lock percentage.
* Supervisor can lock certified tasks.

Not confirmed / not fully implemented:

* Full QA review mutation route.
* Full QA release mutation route.

Do Not Recreate existing QA queue/task-lock behaviour.
Extend only through an approved QA maturity phase.

---

## Serialized Component Foundation

Status:

COMPLETE + LOCKED

Exists:

* serialized_components
* aircraft_component_installations
* serialized_component_life_states
* serialized_component_maintenance_events

Provides:

* Serialized identity
* Serialized lifecycle tracking
* Serialized maintenance history

Do Not Recreate.

---

## Serialized Due Engine

Status:

COMPLETE + LOCKED

Exists:

* ComponentLifeLimit
* LibraryService.evaluateSerializedComponentLifeLimits()

Provides:

* UNKNOWN
* COMPLIANT
* DUE_SOON
* DUE
* OVERDUE

Used by:

* Serialized component dashboard
* Workpack due visibility

Do Not Recreate.

---

## Serialized LIFE_ADJUSTMENT Workflow

Status:

COMPLETE + LOCKED

Exists:

* Serialized component life adjustment workflow
* Serialized life state updates
* Audit/evidence preservation

Provides:

* Controlled TSN/TSO adjustments
* Serialized life-state corrections
* Historical traceability

Do Not Recreate.

---

## Serialized OVERHAUL Workflow

Status:

COMPLETE + LOCKED

Exists:

* Serialized overhaul workflow
* Overhaul maintenance event recording
* Life-state overhaul handling

Provides:

* Overhaul tracking
* Overhaul evidence
* Overhaul history

Do Not Recreate.

---

## Generic Serialized Maintenance Event Recording

Status:

COMPLETE + LOCKED

Exists:

* LibraryService.recordSerializedComponentGenericMaintenanceEvent()

Provides:

* Generic maintenance event recording
* Maintenance history preservation
* Serialized maintenance evidence

Do Not Recreate.

---

## Serialized Component Dashboard

Status:

COMPLETE + LOCKED

Provides:

* Life state visibility
* Due visibility
* Maintenance history visibility
* Compliance visibility

Read-only.

Do Not Recreate.

---

## Workpack Serialized Due Visibility

Status:

COMPLETE + LOCKED

Exists:

* WorkpackComponentIntegrationService
* Execution page visibility
* Tasks page visibility

Provides:

* Serialized component context
* Due visibility
* Advisory status

Read-only.

Does not mutate lifecycle.

Do Not Recreate.

---

## Serialized Compliance Visibility

Status:

COMPLETE + LOCKED

Provides:

* Applicable SB visibility
* Maintenance history visibility
* Compliance context

Read-only.

Does not:

* Create compliance
* Complete compliance
* Mutate compliance

Do Not Recreate.

---

## Compliance Scope Framework

Status:

COMPLETE + LOCKED

Exists:

* ComplianceScopeMode

Modes:

* CURRENT
* SERIALIZED_PREVIEW
* SERIALIZED_ACTIVE

Exists:

* resolveComplianceModelScopeForAircraft()
* getSerializedComplianceScopeComparisonForAircraft()

Current live system:

CURRENT

Important:

SERIALIZED_ACTIVE is defined.

SERIALIZED_ACTIVE is NOT activated.

Workpack generation MUST NOT use SERIALIZED_ACTIVE.

Do Not Recreate.

---

## Serialized Reconciliation Report

Status:

COMPLETE + LOCKED

Provides:

* MATCHED
* LEGACY_ONLY
* SERIALIZED_ONLY
* MODEL_MISMATCH
* SERIAL_MISMATCH
* POSITION_MISMATCH
* INSTALLATION_CONFLICT
* LIFE_STATE_MISSING
* UNMAPPED

Provides:

* Migration readiness metrics
* Reconciliation visibility

Read-only.

Do Not Recreate.

---

## Migration Ledger Foundation

Status:

COMPLETE + LOCKED

Exists:

* migration_batches
* migration_batch_rows
* migration_created_targets

Exists:

* MigrationLedgerService

Provides:

* Migration tracking
* Migration audit support

Does NOT:

* Execute migrations
* Create serialized records
* Perform rollback

Do Not Recreate.

---

## Migration Dry Run Engine

Status:

COMPLETE + LOCKED

Exists:

* MigrationDryRunService

Provides:

* UNSAVED_DRY_RUN

Read-only.

No DB writes.

Do Not Recreate.

---

## Saved Dry Run Workflow

Status:

COMPLETE + LOCKED

Exists:

* Save dry run
* DRY_RUN batch creation
* Saved batch review page
* Audit logging

Creates:

* migration_batches
* migration_batch_rows
* audit_log entry

Does NOT create:

* migration_created_targets
* serialized_components
* aircraft_component_installations
* serialized_component_life_states
* serialized_component_maintenance_events

Does NOT:

* Approve
* Execute
* Rollback
* Create serialized records

Do Not Recreate.

---

## Auth / RBAC Authority

Status:

PARTIALLY_IMPLEMENTED

Authority:

* Passport session authentication
* UserService
* RBAC middleware
* requirePermission()
* requireRole()
* rf_role
* rf_permission
* rf_role_permissions
* user_roles

Exists:

* /auth login/logout routes
* /auth/staff staff role-management route
* Staff list view
* Role toggle workflow
* Session authentication middleware
* Permission and role enforcement middleware

Boundaries:

* Auth/RBAC controls access and permissions.
* Staff role toggling mutates user-role links only.
* Auth/RBAC does not own aircraft, workpack, compliance, library, customer, or serialized lifecycle data.

Known Gaps:

* Full administrative user-management maturity is not confirmed.
* Permission coverage is route-dependent and must be verified before extending sensitive workflows.

Do Not Recreate existing auth, session, RBAC, or staff role-toggle behaviour.

---

## Aircraft Operational Authority

Status:

PARTIALLY_IMPLEMENTED

Authority:

* AircraftService
* AircraftController
* aircraft routes
* Aircraft
* AircraftComponent compatibility layer

Exists:

* Aircraft create/edit/view routes
* Aircraft registration normalization
* Aircraft status transitions
* Aircraft audit logging
* Aircraft photo/document metadata fields
* Aircraft customer link routes
* Aircraft service bulletin visibility
* Aircraft service bulletin compliance actions
* Legacy component install compatibility route
* Serialized component install/remove/baseline-capture routes

Boundaries:

* AircraftService owns aircraft records and aircraft status transitions.
* aircraft_components remains active for legacy component compatibility.
* Serialized component lifecycle authority remains with serialized component workflows.
* Compliance authority remains with compliance_items, aircraft_compliance, and workpack_compliance.

Known Gaps:

* Aircraft lifecycle maturity is partial outside verified create/edit/status workflows.
* Legacy and serialized component surfaces coexist.

Do Not Recreate existing aircraft routes, aircraft status transitions, install/remove compatibility, or aircraft service bulletin visibility.

---

## Aircraft Time / Cycle Authority

Status:

PARTIALLY_IMPLEMENTED

Authority:

* AircraftService.updateHours()
* Aircraft.total_time_hours
* SerializedComponentLifeState for serialized component life values
* ComponentLifeLimit for serialized component limits

Exists:

* Aircraft total time hours support
* Aircraft hour update workflow
* Legacy TBO grounding check against installed aircraft_components
* Serialized component TSN/TSO/CSN/CSO life-state fields
* Serialized life-limit hour, cycle, and calendar calculation engine
* Workpack serialized due visibility

Boundaries:

* Aircraft total hours are aircraft-level values.
* Serialized component life state is serialized-component-level authority.
* Aircraft hour updates do not automatically propagate hidden serialized life-state mutations.
* Workpack due visibility is read-only.

Known Gaps:

* Aircraft total cycles are not confirmed as an operational aircraft-level authority.
* Hobbs time is not confirmed as a separate operational value.
* Tach time is not confirmed as a separate operational value.
* Landings are not confirmed as a separate operational value.
* Automatic propagation from aircraft hour/cycle updates into installed serialized components is not implemented.

Do Not Recreate aircraft hour update, serialized life-state, or serialized life-limit logic.

---

## Customer And Customer Portal Authority

Status:

PARTIALLY_IMPLEMENTED

Authority:

* CustomersService
* CustomersController
* customer routes
* customer-auth routes
* customer-portal routes
* Customer
* CustomerUser
* CustomerAircraftLink

Exists:

* Customer CRUD routes
* Customer-aircraft relationship links
* Customer login/logout
* Customer reset-password flow
* Customer portal landing page
* Customer aircraft visibility
* Customer workpack visibility
* Customer document visibility
* Customer compliance summary visibility

Boundaries:

* Customer records and customer-aircraft links are customer authority.
* Customer portal is read-only visibility into aircraft, workpacks, documents, and compliance summaries.
* Customer portal does not mutate workpack, compliance, aircraft, or serialized component lifecycle state.

Known Gaps:

* Customer portal maturity is partial.
* Customer permission model and portal access rules must be verified before expanding customer-facing workflows.

Do Not Recreate customer CRUD, customer-auth, customer-aircraft link, or customer portal visibility workflows.

---

## Library Master Data Authority

Status:

PARTIALLY_IMPLEMENTED

Authority:

* LibraryService
* LibraryController
* library routes
* Manufacturer
* ComponentModel
* AssetType
* MaintenanceRequirement
* TaskTemplate
* MaintenanceTemplate
* MaintenanceTemplateItem
* AirworthinessDirective
* ServiceBulletin
* SupplementalInspectionDocument

Exists:

* Manufacturer management
* Component/aircraft model management
* Asset type model filtering
* Maintenance requirement management
* Compliance item library visibility
* AD library and import workflows
* SB library, import, allocation, and model attachment workflows
* SID library, import, and model assignment workflows
* Standard task library, import, and model assignment workflows
* Maintenance template visibility
* Serialized component library management

Boundaries:

* LibraryService owns master-data CRUD and library-level applicability assignment helpers.
* Compliance authority remains with compliance services and compliance tables.
* Serialized lifecycle authority remains with serialized component workflows.

Known Gaps:

* Library maturity varies by domain.
* Some import/allocation paths are operational but require data-quality verification during real data loading.

Do Not Recreate LibraryService master-data, import, assignment, or serialized component library functions.

---

## Reference Governance Authority

Status:

PARTIALLY_IMPLEMENTED

Authority:

* BaseReferenceService
* reference routes
* RF/reference tables
* RBAC reference tables

Exists:

* /reference/:tableName/options
* /reference/:tableName/gap-create
* /reference/:tableName/:id deactivate
* /reference/:tableName list view
* CASL ability integration for reference create/deactivate operations
* System-locked reference handling through BaseReferenceService

Boundaries:

* Reference routes govern generic reference-data access and controlled gap creation.
* Domain-specific master data remains with its owning service when a domain service exists.

Known Gaps:

* Reference governance is partial and table-dependent.
* Not all operational state machines are proven to be RF-table-driven.

Do Not Recreate generic reference options, gap-create, deactivate, or BaseReferenceService behaviour.

---

## Service Bulletin Authority

Status:

PARTIALLY_IMPLEMENTED

Authority:

* ServiceBulletinService
* ServiceBulletinSyncService
* ServiceBulletin
* ServiceBulletinModel
* ServiceBulletinSyncRun
* SbModelApplicabilityAllocation
* AircraftSbCompliance

Exists:

* Service bulletin list/create routes
* Service bulletin sync status route
* Service bulletin sync route
* Service bulletin model applicability
* Service bulletin library import workflow
* Service bulletin allocation issue review
* Manual model linking for SB allocation issues
* Safe shorthand allocation expansion
* Aircraft service bulletin visibility
* Aircraft service bulletin compliance actions

Boundaries:

* SB model applicability is managed through ServiceBulletinModel and allocation workflows.
* Aircraft SB compliance uses AircraftSbCompliance.
* Workpack compliance authority remains with workpack_compliance.
* Serialized compliance visibility is read-only and does not complete SB compliance.

Known Gaps:

* SB import/sync provider maturity is partial.
* SB operational impact must be verified with positive real data before changing compliance/workpack attachment behaviour.

Do Not Recreate service bulletin service, import, allocation, sync, or aircraft SB visibility behaviour.

---

## Airworthiness Directive Authority

Status:

PARTIALLY_IMPLEMENTED

Authority:

* AirworthinessDirective
* LibraryService AD assignment helpers
* ComplianceItem
* ComplianceAssignment
* ApplicabilityEngineService

Exists:

* AD library list route
* AD import preview/commit workflow
* AD model assignment route
* AD-to-compliance item creation during assignment
* Model-level compliance assignment support
* AD visibility through applicability/compliance projection paths

Boundaries:

* AD source records are library/reference data.
* Compliance authority remains with compliance_items, aircraft_compliance, and workpack_compliance.
* AD assignment may create or reuse compliance_items and compliance_assignments.

Known Gaps:

* AD operational maturity is partial.
* Real AD data loading requires positive-row verification and duplicate checks.

Do Not Recreate AD import, AD model assignment, or AD compliance item linkage behaviour.

---

## SID Authority

Status:

PARTIALLY_IMPLEMENTED

Authority:

* SupplementalInspectionDocument
* SidModelApplicability
* ModelSid
* LibraryService SID helpers
* ApplicabilityEngineService

Exists:

* SID library list route
* SID detail route
* SID import workflow for models
* SID model assignment route
* SID applicability visibility through ApplicabilityEngineService

Boundaries:

* Library SID management is available.
* SID applicability is model-based through SID/model linking.
* SID visibility does not mutate compliance/workpack state by itself.

Known Gaps:

* SID implementation is partial.
* Cessna-specific operational gating is not fully proven across all aircraft views.
* Non-Cessna aircraft SID visibility requires hardening before real SID data rollout.

Do Not Recreate SID library, import, assignment, or applicability visibility behaviour.

---

## Standard Task And Maintenance Template Authority

Status:

PARTIALLY_IMPLEMENTED

Authority:

* TaskTemplate
* MaintenanceTemplate
* MaintenanceTemplateItem
* StandardTaskImportController
* LibraryService standard task helpers
* WorkpackPlanningService
* WorkpackGenerationService

Exists:

* Standard task library visibility
* Standard task CSV import map/preview/commit workflow
* Standard task model assignment route
* Task template applicability fields
* Maintenance template list/detail visibility
* Workpack planning and generation integration

Boundaries:

* TaskTemplate is the standard task/template authority.
* WorkpackTask is the workpack execution task authority once generated or attached.
* Maintenance templates support planning/generation but do not replace workpack execution authority.

Known Gaps:

* Standard task and maintenance template maturity is partial.
* Positive-row verification is required before operational training data loading.

Do Not Recreate standard task import, task template, maintenance template, or workpack generation integration behaviour.

---

## Applicability Engine Authority

Status:

PARTIALLY_IMPLEMENTED

Authority:

* ApplicabilityEngineService
* ComplianceService
* ComplianceProjectionService
* ComplianceAssignment
* ServiceBulletinModel
* SidModelApplicability

Exists:

* Read-only aircraft applicability route
* Model-level AD compliance assignment visibility
* Model-level SB applicability visibility
* Model-level SID applicability visibility
* Applicability result deduplication by source type and source id
* Compliance projection support

Boundaries:

* ApplicabilityEngineService produces visibility/projection context.
* ApplicabilityEngineService does not mutate compliance, workpack, aircraft, or serialized records.
* Live compliance authority remains ComplianceService and compliance tables.
* Serialized active model scope exists but is not activated as the default live scope.

Known Gaps:

* ApplicabilityEngineService currently evaluates aircraft model scope, not full active serialized installation scope by default.
* Maintenance requirements and standard tasks are handled elsewhere, not fully by ApplicabilityEngineService.
* Manufacturer-specific SID gating requires hardening.

Do Not Recreate ApplicabilityEngineService, ComplianceService scope handling, or ComplianceProjectionService.

---

## Dashboard Authority

Status:

PARTIALLY_IMPLEMENTED

Authority:

* root dashboard route
* dashboard/index view
* Aircraft
* Workpack
* WorkpackStatus
* WorkpackSnag
* SerializedComponent
* Customer

Exists:

* Root authenticated dashboard
* Operational count cards
* Aircraft count
* Active aircraft count
* Open workpack count
* Awaiting certification count
* Open snag count
* Serialized component count
* Active customer count
* Navigation cards

Boundaries:

* Dashboard counts are calculated read-only from backend models.
* Dashboard does not mutate operational state.
* Dashboard is system visibility, not workflow authority.

Known Gaps:

* Dashboard is partial and count-focused.
* Deeper operational analytics remain separate from current dashboard authority.

Do Not Recreate existing root dashboard route or operational count calculations.

---

## Projection / Fleet Health Reporting Authority

Status:

PARTIALLY_IMPLEMENTED

Authority:

* ProjectionController
* projection routes

Exists:

* /projection/fleet-health
* /projection/summary
* Fleet-health reporting view
* Projection summary partial

Boundaries:

* Projection is reporting only.
* Projection does not mutate aircraft, component, workpack, compliance, or serialized lifecycle state.

Known Gaps:

* Projection currently references legacy/stale component reporting objects such as components and vw_component_status.
* Projection should not be treated as serialized lifecycle authority.
* Projection requires hardening before real operational reporting reliance.

Do Not Recreate projection routes without first deciding whether to harden or retire the existing projection implementation.

---

## General Audit Authority

Status:

PARTIALLY_IMPLEMENTED

Authority:

* AuditService
* audit routes
* AuditLog
* audit_log
* WorkpackAuditLog
* WorkpackSnagAuditLog
* WorkpackAuditService

Exists:

* /audit system audit log view
* /audit/export JSON export
* AuditService.log()
* Aircraft audit logging
* Workpack audit logging
* Workpack snag audit logging
* Migration dry-run audit logging

Boundaries:

* audit_log is the general audit authority.
* Workpack-specific audit tables remain workpack audit authority.
* Audit reporting must not mutate workflow state.

Known Gaps:

* Audit coverage is partial and subsystem-dependent.
* Export format maturity is limited.

Do Not Recreate AuditService, audit_log, workpack audit log, or workpack snag audit log behaviour.

---

## Inventory Boundary

Status:

PARTIALLY_IMPLEMENTED / RISK BOUNDARY

Authority:

* inventory routes
* InventoryService

Exists:

* /inventory/remove/:componentId route
* /inventory/install/:componentId route
* InventoryService remove/install methods

Boundaries:

* Current serialized lifecycle authority is NOT the inventory module.
* Serialized component inventory authority remains serialized_components and aircraft_component_installations.
* InventoryService currently uses legacy component/inventory movement concepts.

Known Gaps:

* InventoryService references components and inventory_movements.
* No full serialized-aware inventory authority is verified.
* Inventory requires hardening before real inventory data loading.

Do Not treat /inventory as serialized inventory authority without an approved hardening phase.

---

## Standalone Tasks Module Boundary

Status:

PARTIALLY_IMPLEMENTED / ORPHANED SURFACE

Authority:

* TaskService
* TaskController
* task routes

Exists:

* Task creation route file
* Task sign-off route file
* TaskService

Boundaries:

* Workpack task execution authority remains TaskExecutionService and WorkpackTask.
* The standalone task routes are not confirmed as mounted in app.ts.

Known Gaps:

* Standalone task module operational role is unclear.
* Do not expand this surface without first confirming mount status and intended authority.

Do Not Recreate or extend standalone task workflows until their operational role is verified.

---

## Maintenance Trigger Boundary

Status:

PARTIALLY_IMPLEMENTED

Authority:

* MaintenanceTriggerService

Exists:

* Maintenance trigger service module

Boundaries:

* Workpack planning and generation remain workpack authority.
* Compliance authority remains compliance services and compliance tables.

Known Gaps:

* Operational route/UI integration is not confirmed.
* Service role must be verified before extending maintenance automation.

Do Not Recreate maintenance trigger behaviour without confirming existing service intent and integration points.

---

# TRANSITIONAL ARCHITECTURE

## Legacy / Serialized Coexistence

Status:

ACTIVE TRANSITIONAL STATE

Current reality:

Legacy and serialized architectures coexist.

Legacy remains operationally active.

Serialized is authoritative for serialized lifecycle features.

Compatibility layers remain required.

Do NOT:

* Remove compatibility layers
* Remove legacy references
* Remove legacy routes

until approved retirement phases exist.

---

# DEFINED BUT NOT IMPLEMENTED

## Migration Approval Workflow

Status:

DEFINE ONLY

Not Implemented.

No operational approval route exists.

No operational approval UI exists.

---

## Migration Execution Engine

Status:

DEFINE ONLY

Not Implemented.

No migration execution service exists.

No serialized records are created through migration tooling.

---

## Migration Rollback Engine

Status:

DEFINE ONLY

Not Implemented.

Rollback metadata/status fields may exist in ledger models.

Operational rollback workflow does NOT exist.

---

## Workpack Component Event Recording

Status:

DEFINE ONLY

Not Implemented.

Workpacks do not currently create serialized maintenance events.

Workpack serialized visibility remains read-only.

---

## Reporting Modernisation

Status:

DEFINE ONLY

Not Implemented.

---

## Legacy Operational Retirement

Status:

DEFINE ONLY

Not Implemented.

---

## Full Serialized Compliance Activation

Status:

PARTIALLY_IMPLEMENTED

Framework exists.

Not activated.

CURRENT remains live authority.

SERIALIZED_ACTIVE remains inactive.

---

# NEVER REIMPLEMENT

Never recreate:

* LibraryService.evaluateSerializedComponentLifeLimits()
* Serialized due engine
* Serialized component dashboard
* Serialized LIFE_ADJUSTMENT workflow
* Serialized OVERHAUL workflow
* Generic serialized maintenance event recording
* Workpack serialized due visibility
* Serialized compliance visibility panel
* ComplianceScopeMode framework
* Serialized compliance scope comparison report
* Serialized reconciliation report
* MigrationLedgerService
* MigrationDryRunService
* Saved dry-run workflow

If enhancement is required:

1. Inspect existing implementation.
2. Classify:

   * ALREADY_IMPLEMENTED
   * PARTIALLY_IMPLEMENTED
   * NOT_IMPLEMENTED
3. Extend existing implementation.
4. Never create parallel implementations.

---

# CORRECT NEXT WORK

Before any new implementation:

1. Run applicable stop-gate verification.
2. Verify roadmap alignment.
3. Verify CURRENT_SYSTEM_ROADMAP.md remains accurate.
4. Verify the capability is not already implemented.

No migration execution work may proceed until:

* Migration Approval Workflow exists
* Migration Execution phase is approved
* Migration Rollback strategy is approved
* Legacy retirement roadmap exists

Current migration tooling remains:

* Planning
* Analysis
* Audit
* Reconciliation
* Dry-run
* Saved dry-run review

only.

No operational migration execution currently exists.

---

# DOCUMENT GOVERNANCE

This document is intended to be loaded by:

* SESSION_BOOT.md
* CODEX_EXECUTION_RULES.md workflows
* Future ChatGPT sessions
* Future Codex sessions

This document must be:

* Tracked in git
* Reviewed when major capabilities are added
* Updated when COMPLETE + LOCKED capabilities change
* Updated when DEFINE ONLY capabilities become implemented

If this document conflicts with implementation:

Implementation wins.

The document must then be corrected.
