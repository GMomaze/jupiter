# PHASE 6A.2 - Compliance Schema Extension Decision

**Status:** Completed (READ-ONLY Decision Phase)  
**Date:** 2026-05-01  
**Purpose:** Decide whether the current `compliance_items` schema is sufficient for safe AD/SB compliance linking, or whether schema extension is required before implementation proceeds.

---

## 1. Scope Inspected

- `docs/ChatGPT/ver3/schema.sql`
- `docs/ChatGPT/ver3/table_inventory.md`
- `docs/ChatGPT/ver3/model_inventory.md`
- `docs/ChatGPT/ver3/phase-6.1-compliance-linking-design.md`
- `docs/ChatGPT/ver3/ad_schema_definition.md`
- `docs/ChatGPT/ver3/sb_schema_definition.md`
- `migrations/430_create_compliance_items.ts`
- `migrations/440_create_aircraft_compliance.ts`
- `migrations/450_create_workpack_compliance.ts`
- `migrations/460_add_compliance_item_id_to_task_cards.ts`
- `migrations/480_create_airworthiness_directive_schema.ts`
- `migrations/490_align_service_bulletins_with_phase5_schema.ts`
- `src/modules/compliance/compliance.service.ts`
- `src/models/AirworthinessDirective.ts`
- `src/models/ServiceBulletin.ts`

---

## 2. Existing `compliance_items` Support

### Does `compliance_items` currently support source type?

**Yes.**

Current live support:

- `item_type` exists on `compliance_items`
- DB check constraint limits `item_type` to:
  - `AD`
  - `SB`

This means the system already supports the core source type distinction required for AD/SB compliance projection.

### Does `compliance_items` currently support source record linkage?

**Partially, yes.**

Current live support:

- `source_table` exists
- `source_id` exists
- index exists on:
  - `(source_table, source_id)`

Current limitation:

- there is no DB-enforced foreign key from `source_id` to:
  - `airworthiness_directives.id`
  - `service_bulletins.id`
- the link is polymorphic and application-enforced only

Conclusion:

- source linkage fields exist
- source linkage is not strongly enforced at the database level

---

## 3. AD Linking Assessment

### Can AD records link safely to `compliance_items` without schema changes?

**No.**

Reasoning:

- AD rows can technically point into `compliance_items` through:
  - `item_type = 'AD'`
  - `source_table = 'airworthiness_directives'`
  - `source_id = airworthiness_directives.id`
- however, safe linking is not just about storing a source pointer
- AD projection also depends on:
  - reliable source identity
  - recurrence/interval support
  - applicability/context support
  - duplicate prevention strong enough for source-aware linking

Current gaps that block safe AD linking:

- no DB-enforced source foreign key
- no recurrence fields on `compliance_items`
  - no `interval_hours`
  - no `interval_months`
  - no `is_recurring`
- no structured applicability/context fields
- no AD-specific applicability resolution bridge comparable to SB model linkage
- existing uniqueness on `(item_type, code)` is too weak for source-aware projection

Conclusion:

- AD linkage is technically possible
- AD linkage is not safe enough to approve without schema extension

---

## 4. SB Linking Assessment

### Can SB records link safely to `compliance_items` without schema changes?

**No.**

Reasoning:

- SB rows can technically point into `compliance_items` through:
  - `item_type = 'SB'`
  - `source_table = 'service_bulletins'`
  - `source_id = service_bulletins.id`
- current `ComplianceService` already assumes SB rows use:
  - `source_table = 'service_bulletins'`
  - `source_id` joined indirectly through `service_bulletin_models`

However, safe linking is still blocked because:

- there is no DB-enforced foreign key from `compliance_items.source_id` to `service_bulletins.id`
- applicability/context is not stored directly in `compliance_items`
- current uniqueness on `(item_type, code)` does not safely cover:
  - manufacturer-specific SB identity
  - source-row identity
  - applicability context

Important note:

- SB is in a stronger position than AD because indirect applicability resolution already exists through `service_bulletin_models`
- but that is still not enough to approve safe general linking without schema extension

Conclusion:

- SB linkage is technically possible
- SB linkage is not safe enough to approve without schema extension

---

## 5. Applicability / Context Assessment

### Are applicability/context fields sufficient?

**No.**

Current `compliance_items` columns do **not** include dedicated fields for:

- aircraft applicability context
- model applicability context
- make
- model
- product type
- product subtype

Impact:

- source applicability cannot be represented explicitly on the compliance ledger row
- AD applicability remains especially under-supported
- SB applicability can be resolved indirectly in some cases, but not represented directly in the compliance item schema
- the design rule from Phase 6.1:
  - one compliance item per source record per aircraft/model applicability context
  - cannot be cleanly enforced with the current schema

Conclusion:

- applicability/context support is insufficient
- schema extension is required before safe linking implementation

---

## 6. Decision

## **BLOCK LINKING — COMPLIANCE SCHEMA EXTENSION REQUIRED**

### Why this decision was chosen

The current schema already provides a useful starting point:

- `item_type`
- `source_table`
- `source_id`
- source lookup index

But those fields only provide a basic polymorphic pointer. They do not provide the level of safety and structure required for approved AD/SB compliance linking because the current schema still lacks:

- DB-enforced source-record linkage
- explicit applicability/context support
- explicit AD recurrence/interval support
- source-aware uniqueness strong enough to prevent duplicate compliance projection safely

Therefore:

- the current schema is not sufficient for safe linking implementation
- linking must stay blocked until compliance schema extension is explicitly defined and approved

---

## 7. Schema Gaps

### Missing source type field if absent

- **Not missing**
- `compliance_items.item_type` already exists and supports `AD` and `SB`

### Missing source table/source record linkage fields if absent

- **Not missing as columns**
- `source_table` and `source_id` already exist
- but they are not DB-enforced foreign keys

### Missing AD source linkage if absent

- **Missing safe enforced AD linkage**
- current schema has no FK from `compliance_items.source_id` to `airworthiness_directives.id`
- current schema has no AD-specific applicability/context support
- current schema has no AD recurrence support on the compliance ledger

### Missing SB source linkage if absent

- **Missing safe enforced SB linkage**
- current schema has no FK from `compliance_items.source_id` to `service_bulletins.id`
- current schema has no direct structured applicability/context support on `compliance_items`

### Missing applicability/context fields if absent

- missing direct fields for:
  - aircraft applicability context
  - model applicability context
  - make
  - model
  - product type
  - product subtype

### Additional structural gaps

- missing stronger uniqueness beyond `UNIQUE (item_type, code)`
- missing recurrence fields needed for AD projection:
  - `interval_hours`
  - `interval_months`
  - `is_recurring`

---

## 8. Actual-System Conclusion

### What exists today

- `compliance_items.item_type`
- `compliance_items.source_table`
- `compliance_items.source_id`
- source lookup index on `(source_table, source_id)`
- `workpack_compliance` linkage to `compliance_items`
- indirect SB applicability logic already used in `ComplianceService`

### What is not sufficient today

- no DB-enforced source FK for AD or SB source rows
- no structured applicability/context fields
- no recurrence fields for AD compliance projection
- no strong source-aware uniqueness model

### Final conclusion

The current compliance schema is not sufficient for safe AD/SB linking implementation.

## **BLOCK LINKING — COMPLIANCE SCHEMA EXTENSION REQUIRED**

---

## 9. Boundaries

This phase was read-only and did not perform implementation work.

- No schema changes
- No migrations
- No model edits
- No controller/service edits
- No UI edits
- No linking implementation

---

**END OF DECISION DOCUMENT**
