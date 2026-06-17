# Aircraft Utilisation And Due Tracking Master Plan

## Purpose

Define the full phased roadmap for making aircraft utilisation the backend authority for installed component life tracking, engine/propeller time, AD/SB/SID due status, scheduled task due status, calendar due monitoring, component TBO/retirement monitoring, audit evidence, and explainability.

This document is a planning artifact only.

No implementation. No migrations. No schema changes.

## Non-Breaking Rule and Mandatory Stop Gates

This work must extend the existing system only.

It must not remove, weaken, bypass, or break existing working aircraft, component, serialized component, workpack, compliance, library, audit, RBAC, document, MOP, or lifecycle functionality.

Do not replace working behavior.
Add guarded new behavior behind explicit services/routes.
Preserve existing paths unless the phase explicitly approves changing them.
If existing behavior must change, STOP and report before implementation.

Every DEFINE, IMPLEMENT and VERIFY phase must include these stop gates:

[ ] Existing aircraft create/edit/view still works
[ ] Existing component install/remove still works
[ ] Existing serialized component life-state screens still work
[ ] Existing workpack flows still work
[ ] Existing AD/SB/SID/compliance views still work
[ ] Existing document/MOP functionality still works
[ ] Existing RBAC still works
[ ] Existing audit logging still works
[ ] Existing migrations still run
[ ] Existing seeders still run
[ ] Existing smoke tests pass
[ ] Typecheck passes
[ ] Build passes
[ ] No unrelated files changed

## Master Phase Checklist

### 1. Utilisation Event Architecture

Goal:
Define aircraft utilisation as an immutable backend event stream.

Checklist:

[ ] Define `utilisation_events` table concept
[ ] Define required event fields
[ ] Define source types
[ ] Define validation rules
[ ] Define correction rules
[ ] Define immutability rules
[ ] Define relationship to `aircraft.total_time_hours`
[ ] Define relationship to future aircraft cycles authority
[ ] Define relationship to installed component propagation
[ ] Define relationship to due-status recalculation
[ ] Define audit-log integration
[ ] Define rollback/correction strategy
[ ] Define UI preview expectations
[ ] Define future VERIFY criteria

Exit criteria:
Architecture is documented and accepted before schema or code work begins.

### 2. Aircraft Cycles Authority

Goal:
Define and implement aircraft cycles as a first-class utilisation authority.

Checklist:

[ ] Confirm current aircraft cycle field behavior
[ ] Define aircraft cycle snapshot authority
[ ] Define cycle event validation
[ ] Define cycle correction rules
[ ] Define cycle display rules
[ ] Define cycle audit requirements
[ ] Define how cycle-based due rules consume cycle state
[ ] Verify no existing aircraft workflows break

Exit criteria:
Aircraft cycles have a clear backend authority model compatible with utilisation events.

### 3. Installed Component Tracking Basis

Goal:
Define how each installed component determines its tracking source.

Checklist:

[ ] Define tracking basis values
[ ] Support aircraft-hours tracked components
[ ] Support aircraft-cycles tracked components
[ ] Support calendar tracked components
[ ] Support independent engine meter tracking
[ ] Support independent propeller meter tracking
[ ] Support manual-authorised tracking for exceptional components
[ ] Define tracking basis for serialized components
[ ] Define tracking basis for legacy `aircraft_components`
[ ] Define unknown/uncertain tracking behavior
[ ] Define UI display expectations
[ ] Define audit requirements for tracking basis changes

Exit criteria:
Every installed component can be classified by an explicit backend-owned tracking basis.

### 4. Backend Component Life Calculation

Goal:
Create backend-owned life calculation rules without relying on hidden view logic.

Checklist:

[ ] Define current TSN calculation
[ ] Define current TSO calculation
[ ] Define current CSN calculation
[ ] Define current CSO calculation
[ ] Define install baseline inputs
[ ] Define overhaul baseline inputs
[ ] Define removal baseline outputs
[ ] Define serialized component calculation rules
[ ] Define legacy component calculation rules
[ ] Define engine calculation rules
[ ] Define propeller calculation rules
[ ] Define stored versus derived values
[ ] Define explainability output
[ ] Define stale/unknown baseline behavior

Exit criteria:
Backend service contract can calculate component life consistently and explainably.

### 5. Utilisation Propagation Preview

Goal:
Preview the effects of a utilisation update before accepting it.

Checklist:

[ ] Preview aircraft hour delta
[ ] Preview aircraft cycle delta
[ ] Preview affected installed components
[ ] Preview affected engines
[ ] Preview affected propellers
[ ] Preview affected serialized components
[ ] Preview components with unknown tracking basis
[ ] Preview due items likely to change
[ ] Preview overdue risks
[ ] Preview correction impact
[ ] Require backend-generated preview
[ ] Prevent frontend-only calculations from becoming authoritative

Exit criteria:
Users can see affected component and due-tracking impact before committing utilisation changes.

### 6. Due Status Model

Goal:
Define one backend-owned due status model for all due-tracked entities.

Checklist:

[ ] Define due states
[ ] Define due basis types
[ ] Define hours due fields
[ ] Define cycles due fields
[ ] Define calendar due fields
[ ] Define mixed-limit evaluation
[ ] Define recurring interval handling
[ ] Define last compliance basis
[ ] Define warning thresholds
[ ] Define unknown status behavior
[ ] Define not-applicable behavior
[ ] Define explainability output
[ ] Define audit requirements

Exit criteria:
AD, SB, SID, task, and component due tracking can share a consistent due model.

### 7. Component TBO / Retirement Monitoring

Goal:
Monitor component overhaul and retirement limits from authoritative component life.

Checklist:

[ ] Define TBO hour limit handling
[ ] Define TBO cycle limit handling
[ ] Define calendar overhaul handling
[ ] Define retirement life handling
[ ] Define hard life expiry behavior
[ ] Define warning thresholds
[ ] Define expired/overdue behavior
[ ] Define aircraft status impact rules
[ ] Define engine-specific TBO behavior
[ ] Define propeller-specific TBO behavior
[ ] Define serialized component behavior
[ ] Define legacy component behavior
[ ] Define audit and explanation output

Exit criteria:
Component TBO and retirement monitoring can be recalculated from backend component life.

### 8. AD / SB / SID Due Recalculation

Goal:
Recalculate regulatory and manufacturer due status after utilisation or calendar changes.

Checklist:

[ ] Define AD hour due calculation
[ ] Define AD cycle due calculation
[ ] Define AD calendar due calculation
[ ] Define SB hour due calculation
[ ] Define SB cycle due calculation
[ ] Define SB calendar due calculation
[ ] Define SID hour due calculation
[ ] Define SID cycle due calculation
[ ] Define SID calendar due calculation
[ ] Define mixed applicability rules
[ ] Define component-linked applicability
[ ] Define recalculation trigger from utilisation events
[ ] Define recalculation trigger from calendar monitor
[ ] Define audit/explainability output

Exit criteria:
AD/SB/SID due status can be recalculated deterministically by backend services.

### 9. Scheduled Task Due Recalculation

Goal:
Recalculate scheduled task due status after utilisation or calendar changes.

Checklist:

[ ] Define scheduled task hour intervals
[ ] Define scheduled task cycle intervals
[ ] Define scheduled task calendar intervals
[ ] Define recurring task behavior
[ ] Define last compliance source
[ ] Define task reset behavior after completion
[ ] Define task due soon thresholds
[ ] Define overdue behavior
[ ] Define workpack relationship rules
[ ] Define recalculation trigger from utilisation events
[ ] Define recalculation trigger from calendar monitor
[ ] Define audit/explainability output

Exit criteria:
Scheduled task due status is backend-owned and recalculates from authoritative utilisation and compliance evidence.

### 10. Calendar Due Monitor

Goal:
Ensure calendar-based due statuses advance even when aircraft hours/cycles do not change.

Checklist:

[ ] Define calendar monitor service responsibility
[ ] Define current date authority
[ ] Define evaluation cadence
[ ] Define AD calendar checks
[ ] Define SB calendar checks
[ ] Define SID calendar checks
[ ] Define task calendar checks
[ ] Define component calendar/TBO checks
[ ] Define warning threshold behavior
[ ] Define audit behavior for calendar recalculation
[ ] Define stale status prevention
[ ] Define dashboard refresh expectations

Exit criteria:
Calendar due status cannot become stale merely because no utilisation update occurred.

### 11. Aircraft Utilisation UI

Goal:
Provide controlled UI for utilisation updates and correction workflows.

Checklist:

[ ] Add aircraft utilisation update screen definition
[ ] Show current aircraft hours
[ ] Show current aircraft cycles when available
[ ] Capture new hours
[ ] Capture new cycles when available
[ ] Capture effective date
[ ] Capture source type
[ ] Capture source reference
[ ] Capture reason
[ ] Show backend pre-confirmation summary
[ ] Show affected component/due item preview
[ ] Show correction warning on decreases
[ ] Require correction reason on decreases
[ ] Show post-update due dashboard
[ ] Preserve existing aircraft edit/view behavior unless explicitly approved

Exit criteria:
Users can update utilisation through an explicit workflow without hidden lifecycle edits.

### 12. Audit / Explainability Review

Goal:
Verify every utilisation, propagation, and due-status decision is traceable.

Checklist:

[ ] Utilisation event audit exists
[ ] Aircraft snapshot update audit exists
[ ] Component propagation explanation exists
[ ] Component life calculation explanation exists
[ ] Due recalculation explanation exists
[ ] Correction linkage exists
[ ] Previous/new values are preserved
[ ] Actor/source/reason are preserved
[ ] Frontend displays audit references
[ ] Reports can explain due status
[ ] No silent overwrites exist
[ ] No hidden frontend calculations exist

Exit criteria:
Lifecycle state can be explained from backend records and event history.

### 13. Final Regression / Governance Lock

Goal:
Verify the full utilisation and due tracking architecture is stable without breaking existing system behavior.

Checklist:

[ ] Run aircraft workflow regression
[ ] Run component workflow regression
[ ] Run serialized component workflow regression
[ ] Run workpack workflow regression
[ ] Run compliance workflow regression
[ ] Run library workflow regression
[ ] Run audit regression
[ ] Run RBAC regression
[ ] Run document/MOP regression
[ ] Run migration checks
[ ] Run seeder checks
[ ] Run smoke tests
[ ] Run typecheck
[ ] Run build
[ ] Confirm no unrelated files changed
[ ] Lock governance rules for future phases

Exit criteria:
Existing system behavior is preserved and new utilisation/due tracking authority is governed by backend services, audit, and explainability.

## Final Governance Statement

Aircraft utilisation and due tracking must be introduced as additive, guarded backend authority.

The system must preserve existing operational workflows while adding explicit utilisation events, backend-owned component life calculation, due-status recalculation, audit traceability, and explainability through phased delivery.
