# PHASE 6A.8 - Manual Compliance Projection Trigger

**Status:** Completed (READ-ONLY Design Phase)  
**Date:** 2026-05-01  
**Purpose:** Define the manual-only compliance projection trigger shape for Jupiter, using the approved trigger strategy and current projection service, without implementing trigger wiring in this phase.

---

## 1. Scope Inspected

- `docs/ChatGPT/ver3/phase-6.7-compliance-projection-trigger-strategy.md`
- `src/modules/compliance/compliance-projection.service.ts`

---

## 2. Manual Trigger Only

This phase defines:

- manual trigger only

This phase does **not** define:

- automatic trigger
- scheduled trigger
- import-coupled trigger

Approved decision:

- compliance projection must run only when explicitly invoked by an operator-facing action or internal supervised call

---

## 3. Entry Point

Approved entry-point sequence:

- internal service method first
- future admin route documented only, not implemented

### Internal service entry point

Primary execution entry point:

- `src/modules/compliance/compliance-projection.service.ts`

Recommended method:

- `ComplianceProjectionService.projectAdAndSbSources()`

Purpose:

- provide one supervised internal trigger that projects both AD and SB source records
- keep projection logic inside the compliance module

### Future admin route

Documented future entry point only:

- an admin route may later call the projection service directly

Not implemented in this phase:

- route wiring
- controller wiring
- UI trigger

---

## 4. Service Call Definition

The manual trigger must call projection through:

- `compliance-projection.service.ts`

Required service behavior:

- calls AD projection
- calls SB projection

Current service-aligned flow:

1. call AD projection
2. call SB projection
3. return one combined result summary

Approved manual trigger interpretation:

- the manual trigger should use the combined projection path where possible
- AD and SB remain separate source domains internally
- result reporting remains aggregated for operator review

---

## 5. Response Format

The manual trigger response must report:

- AD records processed
- AD inserted
- AD duplicates skipped
- SB records processed
- SB inserted
- SB duplicates skipped
- errors if any

Approved summary shape:

- `totalAdSourcesInspected`
- `adComplianceItemsInserted`
- `adDuplicatesSkipped`
- `totalSbSourcesInspected`
- `sbComplianceItemsInserted`
- `sbDuplicatesSkipped`
- `failures`

Response purpose:

- make projection observable
- support supervised review
- support debugging during early rollout

---

## 6. Safety Rules

The manual trigger must preserve these rules:

- idempotent
- duplicate safe by `source_type + source_id`
- safe to run multiple times

Operational meaning:

- re-running the trigger must not create duplicate `compliance_items` rows for the same source record
- if a projected compliance row already exists, the source row must be skipped
- the trigger must remain safe for repeated supervised use

Current implementation-aligned expectation:

- projection checks existing rows before insert
- duplicate identity is:
  - `source_type`
  - `source_id`

---

## 7. Boundaries

The manual trigger does **not**:

- create tasks
- create workpacks
- modify imports
- modify AD source records
- modify SB source records
- run automatically

Approved boundary statement:

- manual projection writes only to `compliance_items`
- AD and SB source tables remain source-of-truth
- import workflows remain separate
- no background automation is introduced here

---

## 8. Future Extensions

Documented later extensions:

- admin UI trigger later
- scheduled trigger later
- controlled post-import trigger later

Interpretation:

- a future admin UI may expose the manual trigger once projection behavior is proven stable
- a scheduled trigger may be introduced only after supervised manual behavior is validated
- a controlled post-import trigger may be considered later, but only with explicit safeguards and clear separation from import normalization logic

---

## 9. Actual-System Conclusion

### What exists now

- a trigger strategy selecting manual-first projection
- a projection service that can execute:
  - AD projection
  - SB projection
  - combined summary reporting

### What this manual trigger phase defines

- use internal service method first
- keep future admin route documented only
- use supervised, explicit execution only

### Final manual trigger summary

- manual trigger only
- primary entry point:
  - internal compliance projection service
- future route:
  - documented only
- service behavior:
  - call AD projection
  - call SB projection
  - return summary
- safety:
  - idempotent
  - duplicate safe
  - safe for repeated runs
- boundaries:
  - no tasks
  - no workpacks
  - no import changes
  - no source-record mutation
  - no automatic execution

---

## 10. Boundaries

This phase was read-only and did not perform implementation work.

- No schema changes
- No migrations
- No service/controller/model edits
- No UI changes
- No trigger implementation
- No import changes
- No workpack logic

---

**END OF MANUAL TRIGGER DOCUMENT**
