# PHASE 6A.1 - Compliance Linking Design

**Status:** Completed (READ-ONLY Design Phase)  
**Date:** 2026-05-01  
**Purpose:** Define how Airworthiness Directives and Service Bulletins should link from their source-record tables into `compliance_items` without creating workpack tasks or changing schema in this phase.

---

## 1. Scope Inspected

- `docs/ChatGPT/ver3/schema.sql`
- `docs/ChatGPT/ver3/table_inventory.md`
- `docs/ChatGPT/ver3/model_inventory.md`
- `docs/ChatGPT/ver3/ad_schema_definition.md`
- `docs/ChatGPT/ver3/sb_schema_definition.md`
- live schema definitions for:
  - `compliance_items`
  - `workpack_compliance`
  - `airworthiness_directives`
  - `service_bulletins`
- `src/modules/compliance/compliance.service.ts`
- `src/modules/workpacks/services/workpack-lifecycle.service.ts`
- repo search for:
  - `compliance_items`
  - `workpack_compliance`
  - `source_table`
  - `source_id`
  - `item_type`

---

## 2. Source Records

Approved source tables for compliance projection:

- AD source table: `airworthiness_directives`
- SB source table: `service_bulletins`

These are source/library records, not workpack execution records.

---

## 3. Compliance Tracking Target

The target compliance tracking table is:

- `compliance_items`

This table is the existing normalized compliance ledger used by:

- aircraft compliance through `aircraft_compliance`
- workpack compliance through `workpack_compliance`
- workpack reporting and compliance summaries in existing services

Current live evidence:

- `compliance_items.item_type` already supports `AD` and `SB`
- `compliance_items.source_table` and `compliance_items.source_id` already exist
- `ComplianceService` already reads `source_table` and `source_id`

---

## 4. Link Design Decision

## **USE `compliance_items` AS THE COMPLIANCE PROJECTION LAYER FOR BOTH AD AND SB SOURCE RECORDS**

Design rule:

- each AD source record may project into one or more `compliance_items`
- each SB source record may project into one or more `compliance_items`
- `compliance_items` is the compliance-tracking layer
- `airworthiness_directives` and `service_bulletins` remain source-of-truth library tables

Link-back rule:

- AD compliance item links back to `airworthiness_directives.id`
- SB compliance item links back to `service_bulletins.id`

Current schema support:

- direct link fields already exist as polymorphic references:
  - `compliance_items.source_table`
  - `compliance_items.source_id`

Current limitation:

- these are not enforced foreign keys
- the database does not currently validate that `source_id` actually exists in the declared source table

Design implication:

- current linking can proceed through `source_table` + `source_id`
- stronger FK enforcement would require later schema work because a single polymorphic `source_id` cannot directly enforce both AD and SB foreign keys at the DB level

---

## 5. Source Type Rules

Approved source types:

- `AD`
- `SB`

Rules:

- AD-derived compliance rows must use `compliance_items.item_type = 'AD'`
- SB-derived compliance rows must use `compliance_items.item_type = 'SB'`
- AD-derived rows must set `source_table = 'airworthiness_directives'`
- SB-derived rows must set `source_table = 'service_bulletins'`
- `source_id` must point to the originating source row ID

This aligns with:

- the `compliance_items_item_type_check` already present in the live schema
- existing `ComplianceService` logic, which already filters `item_type IN ('AD', 'SB')`

---

## 6. Field Mapping

### AD -> `compliance_items`

Approved mapping:

- reference number:
  - `airworthiness_directives.ad_number` -> `compliance_items.code`
- title/subject:
  - preferred: `airworthiness_directives.subject_heading`
  - fallback: `airworthiness_directives.subject`
  - target: `compliance_items.title`
- descriptive text:
  - preferred: `airworthiness_directives.summary`
  - optional supplement: `airworthiness_directives.comments`
  - target: `compliance_items.description` and/or `compliance_items.notes`
- source type:
  - constant `AD` -> `compliance_items.item_type`
- status:
  - `airworthiness_directives.status` -> normalized `compliance_items.status`
- effective date:
  - `airworthiness_directives.effective_date` -> `compliance_items.effective_on`
- recurrence/interval data:
  - `airworthiness_directives.interval_hours`
  - `airworthiness_directives.interval_months`
  - `airworthiness_directives.is_recurring`
  - current gap: no dedicated recurrence columns exist on `compliance_items`
  - interim storage would have to be textual or deferred
- authority/source:
  - `airworthiness_directives.authority` -> `compliance_items.authority`
- revision:
  - `airworthiness_directives.revision` -> `compliance_items.revision`
- applicability information:
  - `make`
  - `model`
  - `product_type`
  - `product_subtype`
  - current gap: no dedicated structured applicability columns exist on `compliance_items`

### SB -> `compliance_items`

Approved mapping:

- reference number:
  - `service_bulletins.reference` logical field
  - live model mapping uses `ServiceBulletin.sb_number`
  - target: `compliance_items.code`
- title:
  - `service_bulletins.title` -> `compliance_items.title`
- descriptive text:
  - `service_bulletins.summary` logical field
  - live model mapping uses `ServiceBulletin.description`
  - target: `compliance_items.description`
- source type:
  - constant `SB` -> `compliance_items.item_type`
- status:
  - `service_bulletins.status` -> normalized `compliance_items.status`
- issue date:
  - `service_bulletins.issue_date` logical field
  - live model mapping uses `ServiceBulletin.issued_on`
  - target: `compliance_items.issued_on`
- revision:
  - `service_bulletins.revision` -> `compliance_items.revision`
- compliance recommendation/requirement:
  - `service_bulletins.compliance_requirement` logical field
  - live model mapping uses `ServiceBulletin.compliance_type`
  - target: `compliance_items.compliance_basis`
- applicability information:
  - `applicability_make`
  - `applicability_model`
  - `applicability_product_type`
  - `applicability_notes`
  - current gap: no dedicated structured applicability columns exist on `compliance_items`

### Normalization note

`compliance_items` is intentionally narrower than the source tables.

That means:

- source tables keep full AD/SB fidelity
- `compliance_items` stores a normalized operational subset
- rich applicability and recurrence detail may need later schema support if the system wants first-class querying at the compliance layer

---

## 7. Linkage Rules

### AD linkage rule

- create `compliance_items` row with:
  - `item_type = 'AD'`
  - `source_table = 'airworthiness_directives'`
  - `source_id = airworthiness_directives.id`

### SB linkage rule

- create `compliance_items` row with:
  - `item_type = 'SB'`
  - `source_table = 'service_bulletins'`
  - `source_id = service_bulletins.id`

### Current schema behavior

- `source_table` and `source_id` already exist
- no DB foreign key exists from `compliance_items.source_id` to either source table
- no DB constraint enforces that `source_table` value and `source_id` type stay consistent

### Existing live usage

Current `ComplianceService` already assumes:

- SB rows can be resolved when:
  - `ci.item_type = 'SB'`
  - `ci.source_table = 'service_bulletins'`
  - `ci.source_id` matches `service_bulletin_models.service_bulletin_id`

Current AD behavior in `ComplianceService`:

- AD items are treated as generally applicable once active
- no source-table-specific AD applicability resolution exists yet

---

## 8. Duplicate Prevention

Design rule:

- do not create duplicate `compliance_items` for the same source record within the same applicability context

Minimum duplicate prevention rules:

- AD:
  - prevent duplicate `compliance_items` with the same:
    - `item_type = 'AD'`
    - `source_table = 'airworthiness_directives'`
    - `source_id`
    - applicability context
- SB:
  - prevent duplicate `compliance_items` with the same:
    - `item_type = 'SB'`
    - `source_table = 'service_bulletins'`
    - `source_id`
    - applicability context

Current live constraint gap:

- `compliance_items` only has `UNIQUE (item_type, code)`
- that is not sufficient for long-term source-record-safe projection because:
  - one source record may need different applicability contexts later
  - `code` alone does not capture `source_id`
  - SB references may repeat across manufacturers
  - AD revisions and applicability variants are not fully represented by `code` alone

Design implication:

- application-level duplicate checks are required with the current schema
- stronger uniqueness for source-record projection likely needs later schema extension

---

## 9. Applicability Context Rule

Target design rule:

- one compliance item per source record per aircraft/model applicability context

Current live reality:

- `compliance_items` has no dedicated:
  - aircraft_id
  - model_id
  - make
  - model
  - product_type
  - product_subtype

That means:

- full structured applicability context is not stored directly in `compliance_items`
- AD applicability currently remains unresolved at the compliance-item schema level
- SB applicability is partially resolvable indirectly through:
  - `service_bulletin_models`
  - aircraft model and installed component model matching in `ComplianceService`

Design conclusion:

- the intended duplicate rule is clear
- current schema does not fully support storing the applicability context directly
- later schema extension is required if compliance projection must represent multiple contexts explicitly

---

## 10. Workpack Boundary

This phase does **not** create:

- workpack tasks
- task cards
- workpack rows
- workpack compliance rows

Boundaries:

- no workpack tasks created
- no items added to workpacks
- no `workpack_compliance` rows created in this design phase
- workpack linking happens later through `workpack_compliance`

Current live workpack behavior:

- `workpack_lifecycle.service.ts` already inserts into `workpack_compliance`
- it expects `compliance_items` to exist first
- it can later create task cards linked to `compliance_item_id`

Design implication:

- AD/SB -> `compliance_items` projection must happen before any future workpack-compliance linking
- workpack planning remains a downstream phase

---

## 11. Schema Gaps

### Missing direct FK enforcement

Current gap:

- `compliance_items.source_id` has no foreign key to:
  - `airworthiness_directives.id`
  - `service_bulletins.id`

Impact:

- source linkage is application-enforced only
- orphaned `source_id` values are possible if application logic is wrong

Later need:

- schema extension required if the team wants DB-enforced source linkage

### Missing source-specific uniqueness support

Current gap:

- current unique constraint is `UNIQUE (item_type, code)`

Impact:

- this does not fully protect:
  - source-row identity
  - manufacturer-specific SB uniqueness
  - applicability-context uniqueness

Later need:

- schema extension likely required for source-aware duplicate prevention

### Missing recurrence fields on `compliance_items`

Current gap:

- no dedicated fields for:
  - `interval_hours`
  - `interval_months`
  - `is_recurring`

Impact:

- AD recurrence data cannot be stored in a structured way on the current compliance ledger row

Later need:

- schema extension required if recurrence must be first-class on `compliance_items`

### Missing structured applicability/context fields on `compliance_items`

Current gap:

- no dedicated fields for:
  - `make`
  - `model`
  - `product_type`
  - `product_subtype`
  - aircraft/model context identifiers

Impact:

- source applicability can only remain:
  - implicit
  - indirect
  - or flattened into text

Later need:

- schema extension required if applicability context must be explicit at the compliance-item layer

### Missing AD applicability resolution bridge

Current gap:

- SB applicability can already be resolved indirectly via `service_bulletin_models`
- AD source records currently store applicability inline only
- no AD-to-model bridge table or applicability resolution layer exists in the current approved design

Impact:

- AD compliance projection can link source rows, but aircraft/model applicability remains less precise than SB applicability

Later need:

- later design/implementation required for AD applicability resolution

---

## 12. Actual-System Conclusion

### What already exists

- `compliance_items` already supports `AD` and `SB`
- `source_table` and `source_id` already exist
- `workpack_compliance` already links workpacks to `compliance_items`
- `ComplianceService` already reads SB source linkage through `service_bulletins`
- AD and SB source master tables now exist separately from task/workpack tables

### What is missing

- DB-enforced foreign keys from compliance items to AD/SB sources
- structured recurrence fields on `compliance_items`
- structured applicability/context fields on `compliance_items`
- AD applicability resolution support comparable to current SB model linkage behavior
- source-aware uniqueness strong enough for long-term duplicate prevention

### Final link design

- AD source records link into `compliance_items` via polymorphic source fields
- SB source records link into `compliance_items` via polymorphic source fields
- `compliance_items` remains the operational compliance abstraction
- workpack linking remains downstream through `workpack_compliance`
- later schema extension is required if the system needs:
  - DB-enforced source foreign keys
  - explicit applicability context
  - explicit recurrence fields
  - stronger source-aware uniqueness

---

## 13. Boundaries

This phase was read-only and did not perform implementation work.

- No schema changes
- No migrations
- No model edits
- No controller/service edits
- No UI edits
- No import changes
- No workpack task generation

---

**END OF DESIGN DOCUMENT**
