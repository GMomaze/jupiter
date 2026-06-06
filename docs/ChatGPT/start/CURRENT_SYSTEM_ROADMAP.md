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
