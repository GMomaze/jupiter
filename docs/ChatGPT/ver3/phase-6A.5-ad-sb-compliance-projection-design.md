# PHASE 6A.5 - AD/SB Compliance Projection Design

**Status:** Completed (READ-ONLY Design Phase)  
**Date:** 2026-05-01  
**Purpose:** Define how Airworthiness Directives and Service Bulletins should project from source/library records into `compliance_items` as operational compliance records, without creating tasks or workpack records in this phase.

---

## 1. Scope Inspected

- `docs/ChatGPT/ver3/ad_schema_definition.md`
- `docs/ChatGPT/ver3/sb_schema_definition.md`
- `docs/ChatGPT/ver3/compliance_schema_extension_definition.md`
- `docs/ChatGPT/ver3/schema.sql`
- `docs/ChatGPT/ver3/table_inventory.md`
- `docs/ChatGPT/ver3/model_inventory.md`
- `src/models/ComplianceItem.ts`
- `src/models/AirworthinessDirective.ts`
- `src/models/ServiceBulletin.ts`

---

## 2. Projection Definition

Projection means:

- creating `compliance_items` records from AD or SB source records

Projection does **not** mean:

- creating tasks
- creating task cards
- creating workpacks
- linking records into `workpack_compliance`

Design rule:

- projection creates operational compliance records, not execution artifacts

Source/master records remain in:

- `airworthiness_directives`
- `service_bulletins`

Projected operational records live in:

- `compliance_items`

---

## 3. Source Type Rules

Approved source type rules:

- AD -> `source_type = 'AD'`
- SB -> `source_type = 'SB'`

Operational meaning:

- AD-derived compliance rows represent AD obligations
- SB-derived compliance rows represent SB obligations

This source type is for compliance projection identity and must not be confused with:

- task type
- workpack state
- task template source fields

---

## 4. Source Linkage

Approved source linkage rules:

- AD `source_id` -> `airworthiness_directives.id`
- SB `source_id` -> `service_bulletins.id`

Source-link identity:

- `compliance_items.source_type + compliance_items.source_id`

Interpretation:

- every projected compliance row must point back to exactly one source record
- source records remain the source-of-truth
- `compliance_items` remains the operational projection layer

No polymorphic Sequelize associations are required in this design phase.

---

## 5. AD Field Mapping

### AD source record

Source table:

- `airworthiness_directives`

### Required projection mapping

- reference -> `ad_number`
- title -> `subject`
- status -> AD `status`
- effective_date -> AD `effective_date`
- recurrence -> `interval_hours` / `interval_months`
- applicability -> `make` / `model` / `product_type` / `product_subtype`

### Operational projection interpretation

Recommended AD -> `compliance_items` mapping:

- `code`
  - from `airworthiness_directives.ad_number`
- `title`
  - preferred from `airworthiness_directives.subject`
  - optional fallback from `subject_heading` if subject is empty
- `status`
  - normalized from AD `status`
- `effective_on`
  - from `airworthiness_directives.effective_date`
- `authority`
  - from `airworthiness_directives.authority`
- `revision`
  - from `airworthiness_directives.revision`
- `source_type`
  - constant `AD`
- `source_id`
  - from `airworthiness_directives.id`

### AD recurrence note

AD source records include:

- `interval_hours`
- `interval_months`
- `is_recurring`

Current limitation:

- the present `compliance_items` shape does not include dedicated recurrence fields in the approved extension definition

Design implication:

- recurrence remains source-side truth for now
- projection may expose recurrence conceptually, but should not invent unsupported compliance columns

### AD applicability note

AD source records store applicability inline:

- `make`
- `model`
- `product_type`
- `product_subtype`

Current limitation:

- projection schema does not yet define structured applicability columns on `compliance_items`

Design implication:

- AD applicability remains source-side truth until a later applicability-aware compliance extension exists

---

## 6. SB Field Mapping

### SB source record

Source table:

- `service_bulletins`

### Required projection mapping

- reference -> `reference`
- title -> `title`
- status -> SB `status`
- issue_date -> `issue_date`
- applicability -> `applicability_make` / `applicability_model` / `applicability_product_type` / `applicability_notes`

### Operational projection interpretation

Recommended SB -> `compliance_items` mapping:

- `code`
  - from SB reference
  - live model uses `ServiceBulletin.sb_number`
- `title`
  - from `service_bulletins.title`
- `status`
  - normalized from SB `status`
- `issued_on`
  - from SB `issue_date`
  - live model uses `ServiceBulletin.issued_on`
- `revision`
  - from `service_bulletins.revision`
- `compliance_basis`
  - from SB `compliance_requirement`
  - live model uses `ServiceBulletin.compliance_type`
- `source_type`
  - constant `SB`
- `source_id`
  - from `service_bulletins.id`

### SB applicability note

SB source records carry:

- `applicability_make`
- `applicability_model`
- `applicability_product_type`
- `applicability_notes`

Current limitation:

- `compliance_items` still does not provide structured applicability context in the approved extension definition

Design implication:

- SB applicability remains source-side truth
- model-level applicability may still be resolved later through `service_bulletin_models`
- projection must not invent unsupported compliance columns

---

## 7. Projection Timing Options

Supported timing options:

- manual projection
- batch projection after import
- scheduled projection later

### Manual projection

Definition:

- an admin explicitly selects source records and projects them into `compliance_items`

Strengths:

- highest operator control
- easiest to review source quality before projection
- lowest risk of accidental bulk duplication

Tradeoffs:

- slower for large imports
- creates additional operational steps

### Batch projection after import

Definition:

- after AD/SB import completes, approved source rows are projected into `compliance_items` in a deliberate bulk step

Strengths:

- keeps import and projection closely connected
- efficient for newly loaded source libraries
- still allows review boundary between source ingestion and operational projection

Tradeoffs:

- requires strong duplicate safeguards
- requires careful reporting and rollback behavior

### Scheduled projection later

Definition:

- a timed job projects qualifying source rows after import

Strengths:

- operationally convenient at scale
- useful for synchronization-style source feeds

Tradeoffs:

- harder to supervise
- higher risk of silent duplication or unexpected projection timing
- less appropriate before projection rules are mature

### Preferred approach

## **Preferred: batch projection after import**

Justification:

- it preserves a clean separation between:
  - source import
  - operational compliance projection
- it is more scalable than purely manual projection
- it is easier to audit and reason about than scheduled background projection
- it allows a review boundary after source records are normalized but before any workpack-facing logic exists

---

## 8. Duplicate Prevention

Primary duplicate rule:

- no duplicate `compliance_items` for the same `source_type + source_id`

Required projection identity:

- AD duplicate prevention:
  - `source_type = 'AD'`
  - `source_id = airworthiness_directives.id`
- SB duplicate prevention:
  - `source_type = 'SB'`
  - `source_id = service_bulletins.id`

### Applicability-context note

Include applicability context in duplicate logic only if current schema supports it.

Current schema limitation:

- the approved extension definition does **not** add dedicated applicability context fields to `compliance_items`

Therefore:

- current duplicate prevention should be based on:
  - `source_type`
  - `source_id`
- applicability-context-specific duplication cannot be represented directly yet

Limitation:

- one source record cannot currently project into multiple context-specific compliance rows without further schema support

This limitation must remain explicit until a later applicability-aware extension is approved.

---

## 9. Applicability Context

### Model-level approach

Current approved model-level approach:

- keep model applicability truth in the source systems

For ADs:

- applicability remains inline on `airworthiness_directives`

For SBs:

- applicability remains inline on `service_bulletins`
- additional model linkage may be resolved later through `service_bulletin_models`

Projection rule:

- projection should not guess model-context fields that do not exist on `compliance_items`

### Aircraft-level approach

Current approved aircraft-level approach:

- aircraft-specific applicability is not created during projection
- aircraft resolution happens later through aircraft compliance workflows

Reason:

- `compliance_items` is an operational compliance definition layer
- `aircraft_compliance` is the aircraft-specific compliance state layer

Design implication:

- projection creates reusable operational compliance rows
- aircraft-level activation or tracking is a downstream phase

### Limitation statement

Current schema does not support explicit applicability context fields on `compliance_items`.

Therefore:

- model-level and aircraft-level applicability remain defined conceptually
- they must not be implemented or guessed beyond the approved schema

---

## 10. Workpack Boundary

This phase explicitly does **not** include:

- task creation
- task card creation
- workpack creation
- workpack linking
- `workpack_compliance` insertion

Approved boundary:

- projection creates compliance records only
- later workpack linkage happens through `workpack_compliance`

Design implication:

- `compliance_items` must exist before future workpack linking
- workpack planning remains a later downstream phase

---

## 11. Actual-System Conclusion

### What projection means in Jupiter

- source-library AD/SB rows are authoritative
- `compliance_items` is the operational compliance projection layer
- projected rows represent compliance obligations, not execution work

### What is supported cleanly now

- source identity through:
  - `source_type`
  - `source_id`
- AD and SB projection as separate source domains
- duplicate prevention at source-record identity level

### What remains limited

- recurrence is not yet first-class in the compliance projection schema
- applicability context is not yet first-class in the compliance projection schema
- projection should not create multiple context-specific compliance rows until schema support exists

### Final projection design summary

- AD source rows project to `compliance_items` with `source_type = 'AD'`
- SB source rows project to `compliance_items` with `source_type = 'SB'`
- source linkage uses source-row UUIDs
- preferred projection timing is batch projection after import
- duplicate prevention is `source_type + source_id`
- projection creates compliance rows only
- no tasks, workpacks, or workpack links are created in this phase

---

## 12. Boundaries

This phase was read-only and did not perform implementation work.

- No schema changes
- No migrations
- No model edits
- No controller/service edits
- No UI changes
- No projection implementation
- No workpack task generation

---

**END OF DESIGN DOCUMENT**
