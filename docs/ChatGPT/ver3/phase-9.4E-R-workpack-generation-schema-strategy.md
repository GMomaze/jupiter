# PHASE 9.4E-R - WORKPACK GENERATION SCHEMA STRATEGY

**Status:** Completed (READ-ONLY Strategy Decision Phase)  
**Date:** 2026-05-02  
**Purpose:** Decide the safest schema strategy for Phase 9.4C workpack generation after the Phase 9.4D compatibility review.

---

## 1. Scope

This phase is read-only.

It does not perform:

- schema changes
- migrations
- model edits
- service code changes
- implementation fixes

This document records a strategy decision only.

---

## 2. Decision

**DO NOT EXTEND — ADAPT GENERATION TO CURRENT SCHEMA**

---

## 3. What Phase 9.4D Decided

Phase 9.4D decided:

- `BLOCK IMPLEMENTATION`

That decision applied to the corrected 9.4A / 9.4B persistence model as written.

Reason:

- the current schema does not support direct source-linked persistence in `workpack_tasks`
- the current schema does not support `workpack_executions.workpack_task_id`
- the current schema does not support `workpacks.created_by`
- the current workpack status model does not expose direct `status = OPEN` on `workpacks`

Important clarification:

- Phase 9.4D blocked implementation of the clarified source-linked persistence design
- it did not prove that all workpack generation is impossible under the current Jupiter schema

---

## 4. Missing Fields From `workpack_tasks`

Phase 9.4D confirmed that the following required clarified fields are missing from `workpack_tasks`:

- `sequence_no`
- `is_required`
- `notes`
- `task_template_id`
- `compliance_item_id`
- `sid_id`

Current live `workpack_tasks` columns are only:

- `workpack_id`
- `task_id`

This means `workpack_tasks` is a task-card junction table, not a polymorphic source-link table.

---

## 5. Does Current Schema Already Represent Task Source Linkage Another Way?

- Yes

Current schema already represents source linkage through existing task/execution structures instead of through `workpack_tasks`.

Existing linkage paths include:

- `task_cards.template_source_id` for template-derived standard task linkage
- `task_cards.compliance_item_id` for compliance-linked task linkage
- `workpack_compliance` for workpack-to-compliance planning/linkage
- `workpack_sources.execution_id` for execution-level source-reference support

Important note:

- the current schema is task-card-centric
- it expects generated work to exist as `task_cards`, then be linked into `workpack_tasks` and `workpack_executions`

SID linkage is the weakest current area:

- there is no direct `sid_id` column on `task_cards`
- however, this still argues against extending `workpack_tasks` first, because source linkage is already designed elsewhere in the execution model, not in the junction table

---

## 6. Would Adding `task_template_id`, `compliance_item_id`, and `sid_id` Duplicate Existing Design?

- Yes

Adding those columns to `workpack_tasks` would duplicate the current execution design direction because:

- `workpack_tasks` is currently a pure join table
- current source linkage already exists on `task_cards` and adjacent workpack/compliance/source structures
- `workpack_executions` currently links to `task_id`, not to a source-linked workpack-task entity

Design duplication risk:

- source identity would then be split between `task_cards` and `workpack_tasks`
- execution linkage would still remain task-card-based unless more schema changes followed
- this would create two competing designs in the same workflow

---

## 7. Safest Path For Phase 9.4C Service Implementation

The safest path is:

- adapt generation to current schema

Meaning:

- generate `task_cards` where the current schema requires concrete executable task entities
- link those generated `task_cards` through current `workpack_tasks`
- create `workpack_executions` using current `workpack_id + task_id + attempt_no` linkage
- use existing source-link fields and related tables where available

This is safer than extending `workpack_tasks` because:

- it matches the live schema
- it matches the live foreign keys
- it matches the live `NOT NULL` constraints
- it matches the current `workpack_executions` linkage model
- it avoids introducing a second competing persistence pattern without an approved schema phase

Boundary note:

- this strategy does not authorize code changes in this phase
- it identifies the safest implementation direction for a later implementation phase

---

## 8. Is Phase 9.4E Still Required?

- No

If the strategy is to adapt generation to the current schema, then a schema-extension phase for `workpack_tasks` is not currently required.

What is still required instead:

- a revised implementation/design alignment phase that updates the workpack generation service approach to the current schema realities

Meaning:

- a new design/implementation correction is needed
- a `workpack_tasks` extension phase is not the recommended next step

---

## 9. Strategy Summary

The current Jupiter schema does not support the clarified 9.4A / 9.4B source-linked `workpack_tasks` model.

However:

- the current schema already has a task-card-centric way of representing generated work
- source linkage is already handled in other parts of the design
- extending `workpack_tasks` would duplicate the existing execution model rather than align with it

Therefore the safest strategy is:

- do not extend `workpack_tasks`
- adapt workpack generation to the current schema

---

## 10. Conclusion

This phase resolves the strategy question as follows:

- Phase 9.4D blocked the clarified source-linked schema interpretation
- `workpack_tasks` is missing the clarified source-link fields
- current schema already represents source linkage elsewhere
- adding polymorphic source columns to `workpack_tasks` would duplicate the current task-card-based design
- the safest path for Phase 9.4C is to adapt generation to the current schema
- a schema-extension phase for `workpack_tasks` is not the recommended next step

---

**END OF PHASE 9.4E-R WORKPACK GENERATION SCHEMA STRATEGY**
