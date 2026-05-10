# PHASE 9.4F - ADAPT WORKPACK GENERATION TO CURRENT SCHEMA

**Status:** Completed (READ-ONLY Design Phase)  
**Date:** 2026-05-02  
**Purpose:** Define how future workpack generation should be adapted to the current Jupiter schema after Phase 9.4E-R selected the current-schema strategy.

---

## 1. Scope

This phase is design-only.

It does not perform:

- schema changes
- migrations
- model edits
- service code
- UI, route, or controller work
- execution logic changes

This document defines adaptation of workpack generation to the current live schema only.

---

## 2. Dependency Check

Phase 9.4E-R states:

- `DO NOT EXTEND — ADAPT GENERATION TO CURRENT SCHEMA`

This phase proceeds on that basis.

---

## 3. Current Schema-Supported Persistence Path

The current Jupiter schema supports a task-card-centric workpack generation path.

Supported persistence flow:

1. Create one `workpacks` row using the current live workpack structure.
2. For each selected template item, create one concrete executable `task_cards` row.
3. Link each generated `task_cards` row into the workpack through one `workpack_tasks` row.
4. Create one `workpack_executions` row for each generated task using the current execution linkage shape.

Meaning:

- generated work is not stored directly in `workpack_tasks`
- `workpack_tasks` remains a junction between `workpacks` and `task_cards`
- `workpack_executions` remains linked by `workpack_id + task_id`

---

## 4. Template Item Mapping Into Existing Workpack/Task Structures

Under the current schema, each `maintenance_template_items` row must be transformed into a concrete `task_cards` row first.

Required mapping flow:

1. Load template header and ordered template items.
2. Resolve the source item referenced by each template item.
3. Generate one `task_cards` row per template item.
4. Create one `workpack_tasks` row linking the generated task to the generated workpack.
5. Create one `workpack_executions` row for that generated task within the workpack.

Ordering rule:

- template items are processed in ascending `sequence_no`
- generated task creation should preserve the same order in the generation loop

Current-schema implication:

- `sequence_no`, `is_required`, and `notes` are generation-time inputs, not native `workpack_tasks` fields
- those values must be mapped into existing supported structures where possible, or be retained only in the source template records if no destination field exists

---

## 5. Preserving Source Identity Using Existing Fields

Because the current schema does not support source-linked columns on `workpack_tasks`, source identity must be preserved through fields that already exist elsewhere.

Existing supported source-link paths:

- `task_cards.template_source_id`
- `task_cards.compliance_item_id`
- `workpack_compliance`
- `workpack_sources`

Design rule:

- source identity should be attached to the generated concrete task/execution records, not to `workpack_tasks`

Preferred current-schema source preservation:

- standard-task lineage through `task_cards.template_source_id`
- compliance lineage through `task_cards.compliance_item_id`
- execution/source audit linkage through `workpack_sources` where that existing structure is already intended for source-reference capture

---

## 6. Compliance-Linked Item Representation Without New Columns

Compliance-linked items must be represented using the current compliance-aware schema rather than new `workpack_tasks` columns.

Supported current-schema pattern:

- generate a concrete `task_cards` row
- set `task_cards.compliance_item_id` to the selected compliance source
- link the task into the workpack through `workpack_tasks`
- create `workpack_executions` for execution tracking
- use `workpack_compliance` if the later implementation phase requires explicit workpack-to-compliance planning linkage

Boundary:

- this phase does not authorize compliance projection
- this phase does not authorize compliance creation
- this phase does not authorize compliance state mutation

---

## 7. SID Item Representation Without New Columns

SID items must also be adapted to the current schema without adding `sid_id` to `workpack_tasks`.

Current-schema limitation:

- there is no direct `sid_id` field on `task_cards`
- there is no direct `sid_id` field on `workpack_tasks`

Supported adaptation approach:

- generate a concrete `task_cards` row from the SID source content
- preserve SID identity through existing source-reference mechanisms rather than new workpack-task columns
- prefer execution-level or adjacent-source linkage structures already present in the schema where the later implementation phase can safely attach source reference metadata

Practical meaning:

- SID-generated work can still exist as executable work in the current schema
- direct SID FK persistence is weaker than compliance linkage under the current schema
- SID lineage may need to rely on existing source-reference support rather than a dedicated task-card column

---

## 8. Limitations With No Schema Extension

Adapting to the current schema introduces real limitations.

Known limitations:

- `workpack_tasks` cannot directly store:
  - `sequence_no`
  - `is_required`
  - `notes`
  - `task_template_id`
  - `compliance_item_id`
  - `sid_id`
- `workpack_executions` is linked to `task_id`, not to `workpack_task_id`
- `workpacks` uses `status_id`, not direct `status`
- `workpacks` does not have `created_by`
- SID source linkage is less direct than compliance linkage

Design consequence:

- some clarified 9.4A / 9.4B semantics cannot be represented one-to-one in the live schema
- the adapted design must prioritize compatibility with current constraints over ideal source-linked persistence purity

---

## 9. Adaptation Summary

The adapted current-schema workpack generation design is:

- create the workpack using the live `workpacks` structure
- create one concrete `task_cards` row per template item
- link generated tasks through `workpack_tasks`
- create execution rows through current `workpack_executions`
- preserve source identity through existing task/execution/compliance/source-reference fields rather than by extending `workpack_tasks`

This keeps workpack generation aligned with:

- current live foreign keys
- current live `NOT NULL` constraints
- current execution linkage design
- current task-card-based workflow architecture

---

## 10. Conclusion

Phase 9.4F defines the current-schema adaptation path for future implementation:

- workpack generation must use the existing `workpacks -> task_cards -> workpack_tasks -> workpack_executions` persistence path
- standard-task, compliance, and SID source identity must be preserved through existing supported fields and related tables
- compliance-linked items can use existing compliance-aware linkage
- SID items must rely on weaker existing source-reference support because no direct SID task/workpack columns exist
- limitations caused by the live schema must be accepted unless a later schema phase is explicitly approved

---

**END OF PHASE 9.4F ADAPT WORKPACK GENERATION TO CURRENT SCHEMA**
