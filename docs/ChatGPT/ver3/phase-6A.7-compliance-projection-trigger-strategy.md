# PHASE 6A.7 - Compliance Projection Trigger Strategy

**Status:** Completed (READ-ONLY Design Phase)  
**Date:** 2026-05-01  
**Purpose:** Define how AD/SB compliance projection should be triggered in Jupiter, using the approved projection design and current compliance projection service shape, without implementing trigger wiring in this phase.

---

## 1. Scope Inspected

- `docs/ChatGPT/ver3/phase-6.5-ad-sb-compliance-projection-design.md`
- `src/modules/compliance/compliance-projection.service.ts`
- `src/modules/compliance/compliance.service.ts`
- `src/modules/compliance/`

---

## 2. Trigger Options

The approved trigger options for compliance projection are:

- manual admin trigger
- post-import trigger
- scheduled trigger

These options all invoke the same projection concept:

- project AD and SB source records into `compliance_items`
- do not create tasks
- do not create workpacks

---

## 3. Selected Primary Strategy

## **Manual trigger first**

This is the selected primary strategy for the current Jupiter phase.

---

## 4. Justification

Manual trigger is preferred first because it is safer during the early projection phase.

Reasons:

- safer during early phase
- avoids uncontrolled bulk writes
- easier debugging
- projection remains observable

Additional rationale:

- operators can explicitly choose when source-library records become operational compliance rows
- failures and duplicate behavior are easier to review during supervised execution
- the system can validate projection behavior before any future automation is introduced

---

## 5. Trigger Location

Approved trigger location strategy:

- projection logic lives in the compliance service layer
- future trigger entry point should be an admin-facing route or admin action
- projection must **not** be embedded inside import logic

Interpretation:

- `src/modules/compliance/compliance-projection.service.ts` owns the projection behavior
- a future admin route may call that service directly
- AD import and SB import remain responsible only for source ingestion and preview/commit of source records

Not approved in this phase:

- implicit trigger inside AD import commit
- implicit trigger inside SB import commit
- background scheduling by default

---

## 6. Safety Rules

The trigger strategy must preserve these projection safety rules:

- idempotent behavior
- duplicate prevention by `source_type + source_id`
- no duplicate `compliance_items`
- returns result summary

Operational interpretation:

- running the projection trigger multiple times must not create duplicate compliance rows for the same source record
- if a compliance projection already exists for a source record, it must be skipped
- the trigger must return an observable summary including inserted rows, duplicate skips, and failures

Current implementation-aligned behavior:

- AD and SB sources are checked separately
- duplicate detection uses:
  - `source_type`
  - `source_id`
- projection runs inside a transaction

---

## 7. Boundaries

This trigger strategy explicitly does **not** allow:

- workpack creation
- task creation
- import modification
- AD source record modification
- SB source record modification

Approved boundary statement:

- projection writes only to `compliance_items`
- source tables remain source-of-truth
- import flows remain independent
- workpack logic remains downstream

---

## 8. Trigger Option Assessment

### Manual admin trigger

Definition:

- an admin explicitly starts compliance projection on demand

Strengths:

- highest control
- safest rollout
- simplest debugging path
- easiest to observe result summaries

Weaknesses:

- requires an extra operator step
- less automated at scale

Current decision:

- approved as primary strategy

### Post-import trigger

Definition:

- projection runs automatically after AD or SB source import completes

Strengths:

- operationally efficient
- keeps import and projection close together

Weaknesses:

- increases coupling between import and compliance logic
- creates risk of unexpected bulk writes
- makes import debugging harder

Current decision:

- not primary in this phase
- possible later once projection behavior is stable

### Scheduled trigger

Definition:

- projection runs on a timer or background schedule

Strengths:

- supports future synchronization scenarios
- useful for large recurring source feeds

Weaknesses:

- least observable in early rollout
- highest risk of silent or poorly supervised bulk writes
- harder failure analysis

Current decision:

- deferred to a later phase

---

## 9. Future Extensions

Future approved extension directions:

- scheduled sync
- incremental projection
- aircraft-specific projection later

Interpretation:

- scheduled sync may be added after manual projection is proven stable
- incremental projection may later limit projection to newly imported or newly eligible source rows
- aircraft-specific projection is a later downstream concern and must not be introduced into the current generic `compliance_items` trigger path prematurely

---

## 10. Actual-System Conclusion

### What exists now

- a dedicated projection design document
- a projection service at:
  - `src/modules/compliance/compliance-projection.service.ts`
- a compliance module that can own the trigger boundary cleanly

### What should happen next

- projection should be exposed first through a supervised manual admin trigger
- trigger wiring should call the projection service directly
- import logic should remain separate

### Final trigger strategy summary

- trigger options considered:
  - manual admin trigger
  - post-import trigger
  - scheduled trigger
- selected primary strategy:
  - manual trigger first
- trigger location:
  - compliance projection service
  - future admin route
  - not inside import logic
- safety rules:
  - idempotent
  - duplicate prevention by `source_type + source_id`
  - no duplicate `compliance_items`
  - observable result summary
- boundaries:
  - no tasks
  - no workpacks
  - no import changes
  - no source-record mutation

---

## 11. Boundaries

This phase was read-only and did not perform implementation work.

- No schema changes
- No migrations
- No service/controller/model edits
- No UI changes
- No trigger implementation
- No import changes
- No workpack logic

---

**END OF TRIGGER STRATEGY DOCUMENT**
