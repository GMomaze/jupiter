# PHASE 4.1 - AD Schema Decision

**Status:** Completed (READ-ONLY Decision Phase)  
**Date:** 2026-05-01  
**Purpose:** Define how Airworthiness Directives should be represented based on the live Jupiter schema, existing compliance logic, and the real AD dataset structure.

---

## 1. Scope Inspected

- `docs/ChatGPT/ver3/schema.sql`
- `docs/ChatGPT/ver3/table_inventory.md`
- `docs/ChatGPT/ver3/model_inventory.md`
- `docs/ChatGPT/ver3/migration_inventory.md`
- `migrations/430_create_compliance_items.ts`
- `migrations/440_create_aircraft_compliance.ts`
- `migrations/450_create_workpack_compliance.ts`
- `src/modules/compliance/compliance.service.ts`
- existing AD/compliance usage in `src/modules/workpacks/` and `src/views/library/index.ejs`

---

## 2. Existing Support

### Does a dedicated AD table exist?

**No.**

There is no live table dedicated to Airworthiness Directives. The current schema contains:

- `compliance_items`
- `aircraft_compliance`
- `workpack_compliance`

but no table such as:

- `airworthiness_directives`
- `ad_items`
- `ad_applicability`
- `ad_relationships`

### Does `compliance_items` represent ADs?

**Partially, yes.**

`compliance_items` is the current generic compliance master table and explicitly supports:

- `item_type = 'AD'`
- `item_type = 'SB'`

Existing compliance logic in `src/modules/compliance/compliance.service.ts` already queries ADs through `compliance_items` and treats them as aircraft/workpack compliance drivers.

### Which AD fields are currently supported?

The current live structure can directly support only a limited subset of the dataset:

Supported in `compliance_items`:

- `AD Number` -> `code`
- `Subject` or `Subject Heading` -> `title`
- `Summary` or narrative text -> `description`
- `Service/Office` or authority-like source -> `authority`
- `Status` -> `status`
- `Effective Date` -> `effective_on`
- `Citation Publish Date` or issue-like date -> `issued_on`
- `Comments` -> `notes`

Indirectly supported:

- planning/execution linkage through `workpack_compliance`
- per-aircraft status through `aircraft_compliance`

Not directly supported:

- CFR Part Reference
- Office of Primary Responsibility
- Docket Number
- Citation
- Make
- Model
- Product Type
- Product Subtype
- Affected AD
- Superseded AD
- Affected By
- Superseded By
- structured applicability normalization
- AD-to-AD relationship normalization

---

## 3. Decision

## **CREATE NEW AD SCHEMA**

### Why this decision was chosen

The live compliance structure is useful, but it is too small and too generic to represent the full FAA-style AD dataset faithfully.

`compliance_items` is still valuable and should remain the downstream normalized compliance ledger used by:

- aircraft compliance
- workpack compliance
- future compliance tracking

However, the real AD dataset is substantially richer than the current generic shape. A dedicated AD schema is required to preserve:

- full regulatory metadata
- applicability dimensions
- AD-to-AD relationship chains
- future search/filter/reporting needs

Using `compliance_items` alone would collapse too much structure and lose important meaning.

---

## 4. Full AD Data Shape

The AD solution must support **all** required dataset fields below.

### Dataset fields to support

- `AD Number`
- `Subject Heading`
- `Subject`
- `Status`
- `CFR Part Reference`
- `Effective Date`
- `Service/Office`
- `Office of Primary Responsibility`
- `Docket Number`
- `Citation`
- `Citation Publish Date`
- `Make`
- `Model`
- `Product Type`
- `Product Subtype`
- `Affected AD`
- `Superseded AD`
- `Affected By`
- `Superseded By`
- `Comments`
- `Summary`

### Required logical structure

#### Core AD master record

A dedicated core AD table should logically carry:

- `id`
- `ad_number`
- `subject_heading`
- `subject`
- `status`
- `cfr_part_reference`
- `effective_date`
- `service_office`
- `office_of_primary_responsibility`
- `docket_number`
- `citation`
- `citation_publish_date`
- `comments`
- `summary`
- audit timestamps

#### Applicability structure

Applicability must support:

- `make`
- `model`
- `product_type`
- `product_subtype`

This should not be flattened into one text column if long-term filtering is required.

#### Relationship structure

The schema must represent:

- `affected_ad`
- `superseded_ad`
- `affected_by`
- `superseded_by`

These are graph-style relationships and should not be stored only as denormalized free text if the system needs reliable traceability.

---

## 5. Normalization Design

### Core AD table

Create a dedicated AD master entity as the source of truth for AD records.

Purpose:

- preserve full external dataset fidelity
- support import history and regulatory metadata
- avoid overloading `compliance_items` with AD-only fields

### Applicability structure

Applicability should be normalized separately from the core AD record.

Minimum logical shape:

- AD master
- AD applicability rows
- optional lookup/bridging to `component_models`

Fields per applicability row:

- `ad_id`
- `make`
- `model`
- `product_type`
- `product_subtype`

Why:

- one AD can apply to multiple makes/models/products
- make/model/product data is not the same thing as a single aircraft or even necessarily a single internal `component_model`

### Relationship structure

AD-to-AD links should be represented separately from the core AD row.

Minimum logical shape:

- `ad_id`
- `related_ad_id`
- `relationship_type`

Expected relationship types:

- `AFFECTS`
- `SUPERSEDES`
- `AFFECTED_BY`
- `SUPERSEDED_BY`

Why:

- one AD can reference many others
- relationship chains should be queryable and not only preserved as text blobs

### Compliance projection layer

`compliance_items` should remain the normalized operational compliance layer, not the full AD master table.

Recommended conceptual role:

- one AD master record projects into one `compliance_items` record for operational planning/tracking
- `compliance_items.item_type = 'AD'`
- `compliance_items.source_table` should reference the AD master table
- `compliance_items.source_id` should point to the AD master row

This keeps aircraft/workpack compliance workflows stable while allowing richer AD storage upstream.

---

## 6. Relationship Rules

### AD -> `component_models`

Relationship type:

- indirect and normalized through AD applicability

Rule:

- AD applicability may map to one or more internal `component_models`
- mapping should not assume every incoming AD make/model string matches one internal model exactly
- unresolved applicability must be allowed until mapping rules exist

### AD -> `aircraft`

Relationship type:

- indirect through aircraft model and explicit compliance status

Rule:

- an AD becomes relevant to an aircraft when applicability resolves against that aircraft or its installed components
- per-aircraft state belongs in `aircraft_compliance`, not in the core AD record

### AD -> `compliance_items`

Relationship type:

- operational projection

Rule:

- each tracked AD should produce or correspond to a `compliance_items` row with `item_type = 'AD'`
- `compliance_items` remains the operational compliance abstraction used elsewhere in the system

### AD -> `workpack_compliance`

Relationship type:

- planning/execution linkage through `compliance_items`

Rule:

- workpacks should reference AD obligations through `workpack_compliance.compliance_item_id`
- the workpack layer should not need to know the full AD dataset shape directly

### AD -> future task generation

Relationship type:

- concept only, not storage identity

Rule:

- an AD may later generate or recommend workpack tasks
- generated tasks are execution artifacts
- the AD itself remains a regulatory record, not a task record

---

## 7. Separation Rules

### ADs are NOT tasks

**Confirmed.**

Airworthiness Directives are regulatory compliance records, not reusable maintenance task templates and not workpack execution rows.

### ADs must not be stored in these task/workpack tables

- `task_templates`
- `task_cards`
- `workpacks`

### Why this separation matters

- ADs describe regulatory obligations and metadata
- tasks describe executable work instructions
- workpacks describe planning/execution bundles

An AD may lead to tasks and workpacks, but it is not itself one of those entities.

---

## 8. Gap Analysis

### Missing fields in current live structure

Current live `compliance_items` does not natively store:

- `Subject Heading`
- `CFR Part Reference`
- `Service/Office`
- `Office of Primary Responsibility`
- `Docket Number`
- `Citation`
- `Citation Publish Date`
- `Make`
- `Model`
- `Product Type`
- `Product Subtype`
- `Affected AD`
- `Superseded AD`
- `Affected By`
- `Superseded By`

### Structural limitations

`compliance_items` is a generic compliance row, not a regulatory master record. It is too narrow for full AD fidelity because it has:

- one code
- one title
- one description
- a few generic metadata fields
- no applicability child structure
- no self-referential relationship structure

### Normalization issues

If the AD dataset were forced into `compliance_items` only:

- applicability would be flattened or lost
- AD relationship chains would be flattened or lost
- make/model/product values would become hard-to-query text blobs
- one-table storage would mix operational compliance abstraction with external regulatory source-of-truth data

### Scalability risks

If ADs are stored only in the existing generic structure:

- filtering by make/model/product becomes weak
- deduplication and supersedure tracking become brittle
- future synchronization/import updates become harder
- aircraft applicability resolution becomes ambiguous
- reporting on regulatory lineage becomes difficult

---

## 9. Actual-System Conclusion

### What exists today

- `compliance_items` already supports `item_type = 'AD'`
- `aircraft_compliance` tracks per-aircraft state
- `workpack_compliance` tracks planning/execution linkage
- `src/modules/compliance/compliance.service.ts` already assumes ADs and SBs live in the same operational compliance stream

### What does not exist today

- a dedicated AD master table
- AD applicability normalization
- AD self-relationship normalization
- a structure capable of preserving the full external AD dataset without flattening

### Final decision

## **CREATE NEW AD SCHEMA**

Keep `compliance_items` as the operational compliance abstraction, but introduce a dedicated AD schema as the source-of-truth layer for the full Airworthiness Directive dataset.

---

## 10. Boundaries

This phase was read-only and did not perform implementation work.

- No schema changes
- No migrations
- No model edits
- No controller/service edits
- No UI edits

---

**END OF DECISION DOCUMENT**
