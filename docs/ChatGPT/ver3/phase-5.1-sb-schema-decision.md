# PHASE 5.1 - SB Schema Decision

**Status:** Completed (READ-ONLY Decision Phase)  
**Date:** 2026-05-01  
**Purpose:** Define how Service Bulletins should be represented based on the live Jupiter schema, current SB modules, compliance linkages, and known source-format variability.

---

## 1. Scope Inspected

- `docs/ChatGPT/ver3/schema.sql`
- `docs/ChatGPT/ver3/table_inventory.md`
- `docs/ChatGPT/ver3/model_inventory.md`
- `docs/ChatGPT/ver3/migration_inventory.md`
- `src/models/ServiceBulletin.ts`
- `src/models/ServiceBulletinModel.ts`
- `src/models/AircraftSbCompliance.ts`
- `src/modules/service-bulletins/service-bulletin.service.ts`
- `src/modules/service-bulletins/service-bulletin-sync.service.ts`
- `src/modules/service-bulletins/service-bulletin.routes.ts`
- `src/modules/service-bulletins/adapters/VeryonAdapter.ts`
- `src/modules/service-bulletins/adapters/PiperPdfAdapter.ts`
- `src/modules/service-bulletins/adapters/ATPAdapter.ts`
- `src/modules/service-bulletins/adapters/types.ts`
- `src/modules/library/library.service.ts`
- `src/modules/library/library.routes.ts`
- `src/modules/compliance/compliance.service.ts`
- `src/modules/workpacks/services/workpack-service-bulletin.service.ts`
- `src/views/library/index.ejs`
- `migrations/240_create_service_bulletins.ts`
- `migrations/250_create_service_bulletin_models.ts`
- `migrations/270_create_aircraft_sb_compliance.ts`

---

## 2. Existing Support

### Dedicated SB table exists: YES

The live schema already contains a dedicated source/library SB table:

- `service_bulletins`

Related SB-specific supporting tables already exist:

- `service_bulletin_models`
- `aircraft_sb_compliance`

This means Jupiter already stores Service Bulletins separately from tasks and separately from generic compliance execution state.

### `compliance_items` represents SBs: PARTIAL

`compliance_items` explicitly supports:

- `item_type = 'SB'`

and existing compliance logic already uses it as an operational compliance abstraction. However, `compliance_items` is not the full SB master shape. It only stores:

- code
- title
- description
- authority
- revision
- issued/effective dates
- generic source tracking
- generic status/basis/notes

It does not hold the complete manufacturer-oriented source-library structure that the SB master layer needs.

### Existing SB import/module exists: YES

Existing SB-specific code is already present outside the `/library` import flow:

- `src/modules/service-bulletins/service-bulletin.service.ts`
- `src/modules/service-bulletins/service-bulletin-sync.service.ts`
- `src/modules/service-bulletins/service-bulletin.routes.ts`

The current implementation supports:

- manual SB creation
- bulk external sync/import orchestration
- model applicability attachment through `service_bulletin_models`

### Manufacturer/source-specific format handling exists: PARTIAL

Current state:

- `VeryonAdapter` exists and parses CSV-like folder/file structures
- `PiperPdfAdapter` exists and parses Piper PDF index content
- `ATPAdapter` exists only as a stub and currently returns no data
- `/library` currently shows SB actions as disabled placeholders

This means manufacturer/source-specific handling exists, but it is incomplete and not yet normalized into a final Jupiter library import workflow.

---

## 3. Decision

## **EXTEND EXISTING COMPLIANCE STRUCTURE**

### Why this decision was chosen

Jupiter already has a real SB storage structure:

- `service_bulletins` as source/library data
- `service_bulletin_models` as applicability linkage
- `aircraft_sb_compliance` as aircraft status tracking
- `compliance_items` as generic operational compliance projection

Because that SB-specific foundation already exists, creating a second parallel SB schema would duplicate intent and create avoidable drift.

However, the current shape is not yet rich enough for the normalized import workflow described in Phase 5. It needs extension for:

- broader manufacturer/source variability
- normalized internal import shape
- preserved raw source details
- better applicability/context capture
- preview-first import safety

So the correct path is not to replace the current structure, and not to force everything into `compliance_items` alone. The correct path is to extend the existing SB source/compliance structure.

---

## 4. Normalized Internal SB Shape

The internal normalized SB shape must support at minimum:

- `manufacturer`
- `bulletin/reference number`
- `title`
- `issue date`
- `revision`
- `status`
- `category/type`
- `applicability make`
- `applicability model`
- `applicability product type`
- `applicability notes`
- `summary/description`
- `compliance recommendation/requirement`
- `source file/source format`
- `raw source row/text`
- `active/inactive flag`
- `created/updated timestamps`

### Current live support

Currently supported directly in `service_bulletins`:

- bulletin/reference number via `sb_number`
- title
- issue date via `issued_on`
- revision
- status
- summary/description via `description`
- compliance recommendation/requirement via `compliance_type`
- source format via `source_primary`
- source references/metadata via `source_refs`
- created/updated timestamps

Currently supported indirectly:

- applicability model via `service_bulletin_models`
- aircraft compliance status via `aircraft_sb_compliance`
- compliance projection via `compliance_items`

Currently missing or under-modeled:

- manufacturer as a first-class SB field
- inline make/model/product-type import shape
- applicability notes
- raw source row/text preservation in a consistent field
- explicit source file path/format fields beyond JSON metadata
- category/type beyond generic `compliance_type`

---

## 5. Manufacturer Adapter Design

### Manufacturer-specific adapters required

**Yes.**

The current repository already proves that SB source formats vary enough that a single fixed-header importer is not safe.

### Piper adapter concept

Current evidence:

- `PiperPdfAdapter` extracts bulletin rows from a Piper PDF index
- It parses:
  - SB number
  - title
  - issue date
  - model lines
- It resolves applicability by matching parsed model lines against internal models

Design implication:

- Piper imports should continue through a Piper-specific parser
- raw extracted text/model-line context should be preserved for preview and audit

### Future Cessna adapter concept

Current evidence:

- no finalized Cessna SB adapter exists in the inspected code
- future format variability is already expected by Phase 5 requirements

Design implication:

- Cessna should get its own adapter
- the core importer must accept a normalized adapter output, not force Cessna into Piper or Veryon assumptions

### Generic/manual fallback adapter concept

Current evidence:

- manual SB creation already exists
- raw converted/pasted files with irregular rows are part of the expected future workload

Design implication:

- a fallback adapter is required for:
  - inconsistent CSVs
  - pasted/converted rows
  - partial manual cleanup cases
- this fallback must preserve raw row/text content and produce preview warnings instead of guessing silently

### Core importer rules

The final SB importer must follow these rules:

- must not assume fixed CSV headers
- must accept normalized adapter outputs from manufacturer-specific parsers
- unknown or extra columns must be preserved in metadata or reported in preview
- invalid rows must be shown in preview before commit
- raw/imported source context must remain traceable

---

## 6. Relationship Rules

### SB -> `manufacturers`

Relationship type:

- indirect today, should become explicit in normalized import handling

Rule:

- manufacturer context is critical for source parsing and uniqueness interpretation
- current matching often derives manufacturer from applicable models
- imported SB records should retain manufacturer identity in a consistent normalized way

### SB -> `component_models`

Relationship type:

- direct applicability relationship through `service_bulletin_models`

Rule:

- `service_bulletin_models` remains the core applicability bridge
- one SB may apply to many internal models
- model resolution must allow partial/unresolved imports when external naming does not cleanly match internal models

### SB -> `aircraft`

Relationship type:

- indirect through model applicability and aircraft compliance state

Rule:

- SB master records do not belong directly to a single aircraft
- per-aircraft applicability/compliance state belongs in `aircraft_sb_compliance`

### SB -> `compliance_items`

Relationship type:

- operational projection

Rule:

- `compliance_items` should continue to represent SB obligations in operational compliance flows
- `item_type = 'SB'`
- `source_table = 'service_bulletins'`
- `source_id = service_bulletins.id`

### SB -> `workpack_compliance`

Relationship type:

- indirect through `compliance_items`

Rule:

- workpack compliance should track SB obligations through `compliance_items`, not by turning the SB master row itself into an execution record

### SB -> future task generation

Relationship type:

- source-to-execution derivation

Rule:

- SBs may generate work tasks later
- generated tasks are execution artifacts
- the SB itself remains source/library compliance data

---

## 7. Separation Rules

### SBs are NOT task templates

Confirmed:

- SBs are not `task_templates`

### SBs are NOT task cards

Confirmed:

- SBs are not `task_cards`

### SBs are NOT stored directly in workpacks

Confirmed:

- SBs are not `workpacks`
- workpacks may reference tasks or compliance items derived from SBs, but not use the SB master record as the execution row

### SBs are source/library compliance data, not execution records

This separation matters because:

- SBs are manufacturer-issued source documents
- tasks are work instructions
- workpacks are execution/planning bundles
- compliance rows are operational tracking projections

Those are related, but they are not the same entity.

---

## 8. Gap Analysis

### Missing fields

The current `service_bulletins` structure does not fully support the required normalized import shape for:

- manufacturer as first-class SB data
- applicability make
- applicability model as source text separate from resolved internal models
- applicability product type
- applicability notes
- raw source row/text
- stable source file/source format fields beyond generic metadata JSON
- richer category/type handling

### Missing tables

No brand-new SB master table is required today because `service_bulletins` already exists.

However, the current extension points may still need additional approved structure later if the team decides that:

- inline applicability fields are insufficient
- raw source preservation should be first-class
- manufacturer/source metadata needs normalization beyond JSON

That is an extension problem, not a reason to create a second competing SB master table now.

### Manufacturer-format limitations

Current limitations in the inspected repo:

- `PiperPdfAdapter` is specialized and useful, but format-specific
- `VeryonAdapter` assumes a predictable CSV/file-folder pattern
- `ATPAdapter` is currently a placeholder
- no `/library` preview/commit flow exists yet for SB imports
- current library dashboard still leaves SB actions disabled

### Normalization risks

If Jupiter tries to force all SB sources into a fixed-header importer:

- Piper PDF parsing will be lossy
- raw converted files will become fragile
- future Cessna sources will require hacks instead of clean adapters
- important context may be lost before validation

### Import risks

Primary import risks are:

- over-assuming source column layouts
- losing raw source traceability
- incorrectly resolving applicability to internal models
- creating duplicates across manufacturers or revisions
- mixing source-library rows with execution logic too early

---

## 9. Actual-System Conclusion

### What exists today

- a dedicated SB master table: `service_bulletins`
- an SB-to-model applicability bridge: `service_bulletin_models`
- aircraft SB status tracking: `aircraft_sb_compliance`
- generic compliance projection support: `compliance_items`
- workpack/task usage paths built on top of SB records
- partial manufacturer-specific import adapters:
  - `VeryonAdapter`
  - `PiperPdfAdapter`
  - `ATPAdapter` placeholder

### What does not yet exist in the final Jupiter shape

- a final `/library` SB preview/commit workflow
- a fully normalized manufacturer-flexible import contract
- complete raw-source preservation conventions
- complete source-format-agnostic adapter pipeline
- final handling for future Cessna variability

### Final decision

## **EXTEND EXISTING COMPLIANCE STRUCTURE**

Keep `service_bulletins` as the source/library SB master layer, keep `service_bulletin_models` as the applicability bridge, keep `compliance_items` as the operational compliance projection, and extend the current structure only where needed to support the normalized import shape and manufacturer-specific adapter workflow.

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
