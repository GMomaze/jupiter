# PHASE 3.1 — Standard Task Schema Decision

**Status:** Completed (READ-ONLY Decision Phase)  
**Date:** 2026-05-01  
**Context:** Design Phase for Phase 3.2 — Standard Task Import/Management

---

## 1. Existing Schema Findings

### Task Schema Inventory

| Artifact | Type | Status | Rows | Notes |
|---|---|---|---|---|
| `task_templates` | TABLE | EXISTS | 37 | Reusable template/standard task table ✓ |
| `task_cards` | TABLE | EXISTS | 6 | Instantiated task instances ✓ |
| `workpack_tasks` | TABLE | EXISTS | 4 | Workpack-to-task-card junction table ✓ |
| `workpack_executions` | TABLE | EXISTS | 0 | Execution tracking for tasks ✓ |
| `workpack_measurements` | TABLE | EXISTS | 0 | Structured measurement values per execution ✓ |
| `workpack_signatures` | TABLE | EXISTS | 0 | Sign-offs per execution ✓ |
| `workpack_sources` | TABLE | EXISTS | 0 | Audit trail for execution sources (AD/SB) ✓ |
| `workpack_snags` | TABLE | EXISTS | 0 | Defect/deviation tracking linked to workpacks ✓ |
| `workpack_audit_log` | TABLE | EXISTS | 0 | Transaction audit trail ✓ |

### Schema Analysis

| Requirement | Finding |
|---|---|
| **Reusable task template table exists** | ✅ YES — `task_templates` |
| **Standard task table exists** | ✅ YES — `task_templates` serves as the blueprint/standard task table |
| **Task applicability table exists** | ✅ PARTIAL — Applicability integrated directly into `task_templates` via model and aircraft FKs + flags |
| **Model applicability support exists** | ✅ YES — `task_templates.aircraft_model_id` |
| **Aircraft-specific task support exists** | ✅ YES — `task_templates.aircraft_id` |
| **Workpack task link table exists** | ✅ YES — `task_templates` → `task_cards` → `workpack_tasks` |
| **Audit timestamps exist** | ✅ YES — Both tables have `created_at`, `updated_at` |
| **Applicability flags exist** | ✅ YES — Fabric, wood, bungees, woodprop, retractable configuration flags |

---

## 2. Decision

### **DECISION: USE EXISTING SCHEMA**

**Rationale:**

The existing PostgreSQL schema is **complete, well-designed, and production-ready** for standard reusable task management. No extensions or new tables are required.

**Justification:**

1. **Template/Blueprint Layer Exists**: `task_templates` is a fully-featured reusable task blueprint table with 37 existing rows. It serves exactly the purpose of a standard task catalog.

2. **Instantiation Layer Exists**: `task_cards` provides the layer for binding templates to specific aircraft, workpacks, and personnel. It supports template source linkage via `template_source_id`.

3. **Workpack Binding Exists**: `workpack_tasks` is a mature junction table with composite primary key preventing duplicate task attachments within the same workpack.

4. **Applicability is Comprehensive**:
   - Model-level applicability: `aircraft_model_id` (e.g., "applies to Cessna 172")
   - Aircraft-level applicability: `aircraft_id` (e.g., "applies to N1234AB only")
   - Configuration applicability: Boolean flags for fabric, wood, bungees, woodprop, retractable variants
   - Scope field: Allows categorization by scope (e.g., "preflight", "100-hour", "maintenance")

5. **Audit Trail is Built In**: Both `task_templates` and `task_cards` have `created_at` and `updated_at` timestamps. Additionally, `workpack_audit_log` provides transaction-level audit tracking for execution changes.

6. **Execution Tracking is Mature**: `workpack_executions` with retry support (`attempt_no`), status constraints, measurement values, and multi-party sign-offs.

7. **No Structural Gaps**: Testing against Phase 3 requirements reveals no missing columns or relationships. The schema naturally supports all future import, search, filter, and assignment operations.

---

## 3. Reusable Standard Task Data Shape

### Required Fields (Already Present in `task_templates`)

| Field | Type | Constraint | Purpose |
|---|---|---|---|
| `id` | UUID | PK | Unique task template identifier |
| `task_card_number` | VARCHAR(255) | NOT NULL | Operator-visible task identifier (e.g., "TASK-001") |
| `scope` | VARCHAR(255) | NOT NULL | Category/classification (e.g., "preflight", "100-hour", "emergency") |
| `title` | VARCHAR(255) | NOT NULL | Human-readable task name |
| `description` | TEXT | NOT NULL | Operational instructions and steps |
| `sort_order` | DECIMAL(10,2) | NOT NULL DEFAULT 0 | Display/execution sequence within scope |
| `aircraft_model_id` | UUID | FK → component_models | Applicability: which aircraft model(s) |
| `aircraft_id` | UUID | FK → aircraft | Applicability: specific aircraft (if not model-wide) |
| `is_active` | BOOLEAN | NOT NULL DEFAULT true | Enable/disable this standard task |
| `is_required_for_wood` | BOOLEAN | NOT NULL DEFAULT false | Applicability: required for wood aircraft? |
| `is_required_for_fabric` | BOOLEAN | NOT NULL DEFAULT false | Applicability: required for fabric aircraft? |
| `is_required_for_bungees` | BOOLEAN | NOT NULL DEFAULT false | Applicability: required for gear with bungees? |
| `is_required_for_woodprop` | BOOLEAN | NOT NULL DEFAULT false | Applicability: required for wood props? |
| `is_required_for_retractable` | BOOLEAN | NOT NULL DEFAULT false | Applicability: required for retractable gear? |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Audit: when task template was added |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Audit: when task template was last modified |

### Instantiation Fields (In `task_cards`, referencing template)

| Field | Type | Purpose |
|---|---|---|
| `template_source_id` | UUID | FK to the `task_templates.id` that spawned this task |
| `task_card_number` | VARCHAR(255) | Instance number (e.g., "WORKPACK-001-TASK-001") |
| `title`, `description` | VARCHAR, TEXT | Copied or inherited from template at instantiation |
| `aircraft_id` | UUID | Which aircraft this task instance applies to |
| `status` | VARCHAR(255) | Execution state (OPEN, IN_PROGRESS, COMPLETED, etc.) |
| `assigned_to` | UUID | FK → users.id (who is assigned) |
| `mechanic_completed_by`, `engineer_certified_by` | UUID | Sign-off by role |

---

## 4. Relationship Rules

### Template → Instantiation → Execution → Audit

```
task_templates (blueprint)
    ↓
    └─→ task_cards (instance, template_source_id FK)
            ↓
            └─→ workpack_tasks (junction: workpack_id, task_id)
                    ↓
                    └─→ workpack_executions (execution: task_id, attempt_no)
                            ↓
                            ├─→ workpack_measurements (structured data)
                            ├─→ workpack_signatures (sign-offs)
                            ├─→ workpack_sources (source audit)
                            └─→ workpack_audit_log (transaction log)
```

### Forward Relationships

| Relationship | From | To | Type | Notes |
|---|---|---|---|---|
| Model Applicability | `task_templates.aircraft_model_id` | `component_models.id` | FK | Which aircraft models support this standard task |
| Aircraft Override | `task_templates.aircraft_id` | `aircraft.id` | FK | Optionally restrict to specific aircraft instance |
| Template Instantiation | `task_cards.template_source_id` | `task_templates.id` | FK | Source blueprint for this task instance |
| Aircraft Binding | `task_cards.aircraft_id` | `aircraft.id` | FK | Which aircraft this task instance is for |
| Workpack Assignment | `workpack_tasks.(task_id, workpack_id)` | `(task_cards.id, workpacks.id)` | Composite FK | Adds task instance to workpack |
| Execution Tracking | `workpack_executions.(task_id, workpack_id)` | `(task_cards.id, workpacks.id)` | FK | Execution history per task within workpack |

### Backward Relationships (for querying)

- **"Which task templates apply to this aircraft?"**
  - `task_templates` WHERE `aircraft_model_id = ?` OR `aircraft_id = ?` AND `is_active = true` AND (configuration flags match aircraft)

- **"Which task instances are in this workpack?"**
  - `task_cards` JOIN `workpack_tasks` WHERE `workpack_id = ?` JOIN `task_templates` ON `task_cards.template_source_id = task_templates.id`

- **"What was executed for this task in this workpack?"**
  - `workpack_executions` WHERE `workpack_id = ?` AND `task_id = ?`

---

## 5. Schema Readiness Assessment

### Completeness Checklist

| Aspect | Ready? | Evidence |
|---|---|---|
| **Blueprint/Template Layer** | ✅ YES | `task_templates` table with 37 existing rows, all required fields present |
| **Instantiation Layer** | ✅ YES | `task_cards` with `template_source_id` FK, timestamp, status, assignment fields |
| **Workpack Binding** | ✅ YES | `workpack_tasks` with composite PK and cascade delete policy |
| **Execution History** | ✅ YES | `workpack_executions` with retry support, status constraints, user FKs |
| **Audit Trail** | ✅ YES | `created_at`, `updated_at` on templates and cards; `workpack_audit_log` for transactions |
| **Applicability Rules** | ✅ YES | Model FK, aircraft FK, configuration flags (fabric, wood, bungees, etc.) |
| **Source Tracking** | ✅ YES | `task_cards.service_bulletin_id`, `task_cards.compliance_item_id`, `workpack_sources` |
| **Measurements** | ✅ YES | `workpack_measurements` with structured key-value, ordering, uniqueness |
| **Sign-Offs** | ✅ YES | `workpack_signatures` with role and type constraints |
| **Status Flow** | ✅ YES | `rf_task_state` reference table for task states |

### No Extensions Needed

All required capabilities exist in the current schema:

- ✅ **Reusability**: Task templates are reusable by design
- ✅ **Standard Library**: `task_templates` is the standard task library
- ✅ **Model Mapping**: `aircraft_model_id` FK enables model-level applicability
- ✅ **Aircraft Mapping**: `aircraft_id` FK enables aircraft-level applicability
- ✅ **Configuration Awareness**: Boolean flags for aircraft types
- ✅ **Versioning**: `version` column on `task_cards` supports optimistic locking
- ✅ **Audit**: `created_at`, `updated_at` on both tables
- ✅ **Status Tracking**: `status` field with constraints
- ✅ **User Assignment**: `assigned_to`, mechanic/engineer sign-offs

---

## 6. Boundaries (What This Phase Did NOT Do)

This phase is **READ-ONLY decision-making only**. The following are **explicitly NOT done**:

- ❌ No migrations created or modified
- ❌ No schema changes (no new columns, tables, indexes, or constraints added)
- ❌ No Sequelize models created or modified
- ❌ No controller or service logic changes
- ❌ No data imported or seeded
- ❌ No UI components created
- ❌ No API endpoints added
- ❌ No business logic implemented

**What IS done:**
- ✅ Inspection of existing schema (`schema.sql`)
- ✅ Inspection of table inventory (`table_inventory.md`)
- ✅ Inspection of model layer documentation (`model_inventory.md`)
- ✅ Inspection of migration history (`migrations/` folder, `migration_inventory.md`)
- ✅ Formal decision documented

---

## 7. Implications for Phase 3.2

**Phase 3.2 will:**

1. **Create Import Service** to populate `task_templates` from external sources (CSV, API, etc.)
2. **Add Search/Filter UI** to browse standard tasks in the library
3. **Add Assignment Logic** to bind templates to aircraft models and specific aircraft
4. **Create Workpack Builder** that lets users select applicable tasks for a workpack
5. **Implement Task Instantiation** when tasks are added to a workpack

**No schema changes will be needed** — all of the above work within the existing structures.

---

## 8. Sign-Off

**Decision Made By:** ChatGPT (Analysis Phase)  
**Decision Approved By:** Codex (will implement per this schema)  
**Decision Quality:** FINAL  
**Effective For:** All subsequent Phase 3.x phases

---

## Appendix: Full Schema Context

### `task_templates` Table Definition

```sql
CREATE TABLE public.task_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    task_card_number character varying(255) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    scope character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    aircraft_model_id uuid REFERENCES component_models(id),
    aircraft_id uuid REFERENCES aircraft(id),
    is_active boolean DEFAULT true NOT NULL,
    is_required_for_wood boolean DEFAULT false NOT NULL,
    is_required_for_fabric boolean DEFAULT false NOT NULL,
    is_required_for_bungees boolean DEFAULT false NOT NULL,
    is_required_for_woodprop boolean DEFAULT false NOT NULL,
    is_required_for_retractable boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX task_templates_scope_idx ON task_templates USING btree (scope);
CREATE INDEX task_templates_model_idx ON task_templates USING btree (aircraft_model_id);
CREATE INDEX task_templates_aircraft_idx ON task_templates USING btree (aircraft_id);
CREATE INDEX task_templates_number_idx ON task_templates USING btree (task_card_number);
CREATE INDEX task_templates_sort_order_idx ON task_templates USING btree (sort_order);
```

### `task_cards` Reference to Templates

```sql
CREATE TABLE public.task_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    task_card_number character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    status character varying(255) DEFAULT 'OPEN'::character varying NOT NULL,
    aircraft_id uuid NOT NULL REFERENCES aircraft(id),
    assigned_to uuid REFERENCES users(id),
    template_source_id uuid REFERENCES task_templates(id),
    -- ... other fields ...
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

---

**END OF DECISION DOCUMENT**
