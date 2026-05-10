# PHASE 6A.4A - ComplianceItem Model Decision

**Status:** Completed (READ-ONLY Decision Phase)  
**Date:** 2026-05-01  
**Purpose:** Decide whether a `ComplianceItem` Sequelize model already exists, whether it is aligned to `compliance_items`, and whether model work is required before later compliance-linking implementation.

---

## 1. Scope Inspected

- `docs/ChatGPT/ver3/compliance_schema_extension_definition.md`
- `docs/ChatGPT/ver3/schema.sql`
- `docs/ChatGPT/ver3/table_inventory.md`
- `docs/ChatGPT/ver3/model_inventory.md`
- `src/models/`
- `src/models/index.ts`
- existing compliance-related code as reference only:
  - `src/modules/compliance/compliance.service.ts`

---

## 2. Existing Model Search

### Does a `ComplianceItem` model already exist?

**No.**

Repo search findings:

- no `ComplianceItem` class was found in `src/models/`
- no file targeting `tableName: 'compliance_items'` was found
- `src/models/index.ts` does not export a `ComplianceItem` model

### What file path contains it?

**None.**

There is currently no Sequelize model file in the repository that represents `compliance_items`.

---

## 3. Table Mapping Assessment

### Does the model map to `compliance_items`?

**No existing model is present to map.**

Current state:

- the live/schema snapshot includes `compliance_items`
- the model layer does not currently include a matching `ComplianceItem` Sequelize model

This matches earlier inventory findings that `compliance_items` is a real table without a corresponding TypeScript model.

---

## 4. Source Field Assessment

### Does the model currently include `source_type`?

**No.**

Reason:

- no `ComplianceItem` model exists
- therefore no model field for `source_type` exists

### Does the model currently include `source_id`?

**No.**

Reason:

- no `ComplianceItem` model exists
- therefore no model field for `source_id` exists

---

## 5. Live / Schema Snapshot Field Assessment

### Does the live/schema snapshot table include `source_type` and `source_id`?

**Partially.**

Current schema snapshot support:

- `source_id` exists on `compliance_items`
- `source_type` does **not** exist on `compliance_items`

Current live compatibility note:

- the older schema shape still uses:
  - `item_type`
  - `source_table`
  - `source_id`

Phase 6.3 defines a future extension shape centered on:

- `source_type`
- `source_id`

That means model alignment is not just missing because there is no model file, but also because the current schema snapshot does not yet include the future `source_type` column.

---

## 6. Alignment Assessment

### Is model alignment required?

**Yes.**

Reasons:

- there is no `ComplianceItem` model file at all
- no Sequelize model currently maps to `compliance_items`
- the future extension definition explicitly requires a model to include:
  - `source_type`
  - `source_id`

Conclusion:

- model alignment is required before later linking implementation can proceed cleanly in the model layer

---

## 7. Association Assessment

### Are polymorphic associations required now?

**No.**

Approved association decision:

- no Sequelize polymorphic associations are required in this phase
- `source_type` + `source_id` remain plain fields for now
- linking logic will interpret them later

Reasoning:

- the extension definition already establishes polymorphic identity behavior
- this phase is only deciding model existence/alignment
- no association layer is needed yet to make that decision explicit

---

## 8. Decision

## **MODEL MISSING — CREATE REQUIRED**

### Why this decision was chosen

The current repository contains:

- a real `compliance_items` table in the schema snapshot
- compliance service logic that reads from `compliance_items`

But it does **not** contain:

- a `ComplianceItem` Sequelize model file
- an export entry for such a model
- model fields for `source_type`
- model fields for `source_id`

Therefore the correct model decision is:

## **MODEL MISSING — CREATE REQUIRED**

---

## 9. Actual-System Conclusion

### What exists today

- `compliance_items` exists in the schema snapshot
- `compliance.service.ts` reads `compliance_items` through raw SQL
- `source_id` exists in the current schema snapshot

### What does not exist today

- `ComplianceItem` Sequelize model
- model path for `ComplianceItem`
- model export for `ComplianceItem`
- model-level `source_type`
- model-level `source_id`
- schema-level `source_type` in the current snapshot

### Final conclusion

- a `ComplianceItem` model does not currently exist
- no polymorphic Sequelize associations are required now
- plain-field model alignment is the correct later path

## **MODEL MISSING — CREATE REQUIRED**

---

## 10. Boundaries

This phase was read-only and did not perform implementation work.

- No schema changes
- No migrations
- No model edits
- No controller/service edits
- No UI edits
- No linking implementation

---

**END OF DECISION DOCUMENT**
