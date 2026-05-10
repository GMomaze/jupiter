# Table Inventory

Snapshot date: 2026-04-30

## Scope

Sources inspected:

- Live PostgreSQL database table metadata
- `docs/ChatGPT/ver3/schema.sql`
- `src/models/` as reference only

## Database Summary

- Total DB tables: 41
- Schema names used by application tables: `public`
- Note: a database view named `vw_component_status` also exists in `public`, but it is not counted as a table

## Full Table List

| Table | Category | Approx. Rows |
| --- | --- | ---: |
| `SequelizeMeta` | SYSTEM | 47 |
| `aircraft` | CORE | 1 |
| `aircraft_compliance` | CORE | 0 |
| `aircraft_components` | CORE | 1 |
| `aircraft_sb_compliance` | CORE | 0 |
| `aircraft_sid_status` | CORE | 0 |
| `audit_log` | AUDIT | 5 |
| `cessna_sids` | REFERENCE | 0 |
| `compliance_items` | CORE | 0 |
| `component_models` | CORE | 7 |
| `maintenance_requirements` | CORE | 8 |
| `manufacturers` | REFERENCE | 7 |
| `model_sids` | CORE | 0 |
| `rf_aircraft_category` | REFERENCE | 2 |
| `rf_asset_type` | REFERENCE | 3 |
| `rf_component_categories` | REFERENCE | 0 |
| `rf_component_condition` | REFERENCE | 3 |
| `rf_permission` | SYSTEM | 4 |
| `rf_role` | SYSTEM | 7 |
| `rf_role_permissions` | SYSTEM | 0 |
| `rf_signoff_role` | REFERENCE | 3 |
| `rf_task_state` | REFERENCE | 4 |
| `rf_workpack_status` | REFERENCE | 6 |
| `service_bulletin_models` | CORE | 0 |
| `service_bulletins` | CORE | 0 |
| `sessions` | SYSTEM | 1 |
| `task_cards` | CORE | 6 |
| `task_templates` | CORE | 37 |
| `user_roles` | SYSTEM | 15 |
| `users` | SYSTEM | 9 |
| `workpack_audit_log` | AUDIT | 0 |
| `workpack_compliance` | CORE | 0 |
| `workpack_executions` | CORE | 0 |
| `workpack_measurements` | CORE | 0 |
| `workpack_requirements` | CORE | 0 |
| `workpack_signatures` | CORE | 0 |
| `workpack_snag_audit_log` | AUDIT | 0 |
| `workpack_snags` | CORE | 0 |
| `workpack_sources` | CORE | 0 |
| `workpack_tasks` | CORE | 4 |
| `workpacks` | CORE | 1 |

## Reference Tables

All `rf_*` tables detected:

- `rf_aircraft_category`
- `rf_asset_type`
- `rf_component_categories`
- `rf_component_condition`
- `rf_permission`
- `rf_role`
- `rf_role_permissions`
- `rf_signoff_role`
- `rf_task_state`
- `rf_workpack_status`

## Audit And Log Tables

- `audit_log`
- `workpack_audit_log`
- `workpack_snag_audit_log`

## Core Table Detail

### `workpacks`

- Columns: `id`, `work_order_number`, `status_id`, `aircraft_id`, `version`, `created_at`, `updated_at`, `qa_required`, `certified_by`, `certified_at`, `qa_reviewed_by`, `qa_reviewed_at`, `released_by`, `released_at`
- Primary key: `id`
- Foreign keys:
  - `aircraft_id -> aircraft.id`
  - `status_id -> rf_workpack_status.id`
  - `certified_by -> users.id`
  - `qa_reviewed_by -> users.id`
  - `released_by -> users.id`
- Key constraints:
  - `UNIQUE (work_order_number)`
- Observations:
  - Workflow state is normalized through `rf_workpack_status`
  - QA, certification, and release are captured directly on the master workpack row

### `task_cards`

- Columns: `id`, `task_card_number`, `title`, `description`, `status`, `aircraft_id`, `assigned_to`, `component_id`, `signed_by`, `signed_at`, `signature_snapshot_url`, `work_performed`, `mechanic_completed_by`, `mechanic_completed_at`, `engineer_certified_by`, `engineer_certified_at`, `template_source_id`, `service_bulletin_id`, `version`, `created_at`, `updated_at`, `compliance_item_id`
- Primary key: `id`
- Foreign keys:
  - `aircraft_id -> aircraft.id`
  - `assigned_to -> users.id`
  - `signed_by -> users.id`
  - `compliance_item_id -> compliance_items.id`
- Key constraints:
  - No database unique constraint was found on `task_card_number`
- Observations:
  - DB columns support service bulletin, template, component, mechanic, and engineer linkage
  - Several of those linkage columns do not have DB foreign keys: `component_id`, `template_source_id`, `service_bulletin_id`, `mechanic_completed_by`, `engineer_certified_by`
  - Sequelize associations reference some of these user links even though the DB does not enforce them

### `workpack_tasks`

- Columns: `workpack_id`, `task_id`
- Primary key: composite `workpack_id, task_id`
- Foreign keys:
  - `workpack_id -> workpacks.id`
  - `task_id -> task_cards.id`
- Key constraints:
  - Composite primary key prevents duplicate task attachment within the same workpack
- Observations:
  - This is the core junction table between planning (`workpacks`) and execution units (`task_cards`)

### `workpack_executions`

- Columns: `id`, `workpack_id`, `task_id`, `attempt_no`, `status`, `started_by`, `completed_by`, `certified_by`, `started_at`, `completed_at`, `certified_at`, `notes`, `failure_reason`, `version`, `created_at`, `updated_at`
- Primary key: `id`
- Foreign keys:
  - `workpack_id -> workpacks.id`
  - `task_id -> task_cards.id`
  - `started_by -> users.id`
  - `completed_by -> users.id`
  - `certified_by -> users.id`
- Key constraints:
  - `UNIQUE (workpack_id, task_id, attempt_no)`
  - Status check limits values to `OPEN`, `IN_PROGRESS`, `COMPLETED_BY_MECHANIC`, `CERTIFIED_BY_ENGINEER`
- Observations:
  - Execution history supports retries/rework through `attempt_no`
  - This table is the anchor for measurements, signatures, sources, and workpack audit entries

### `workpack_measurements`

- Columns: `id`, `execution_id`, `field_key`, `field_label`, `position`, `value`, `created_at`, `updated_at`
- Primary key: `id`
- Foreign keys:
  - `execution_id -> workpack_executions.id`
- Key constraints:
  - `UNIQUE (execution_id, field_key)`
  - `UNIQUE (execution_id, position)`
- Observations:
  - The table supports ordered structured measurements per execution
  - Dual uniqueness prevents duplicate semantic fields and duplicate display positions in the same execution

### `workpack_signatures`

- Columns: `id`, `execution_id`, `role`, `signature_type`, `user_id`, `signed_at`
- Primary key: `id`
- Foreign keys:
  - `execution_id -> workpack_executions.id`
  - `user_id -> users.id`
- Key constraints:
  - `UNIQUE (execution_id, role, signature_type, user_id)`
  - Role check limits values to `MECHANIC`, `ENGINEER`
  - Signature type check limits values to `WORK`, `REVIEW`, `APPROVAL`
- Observations:
  - Signature granularity is execution-scoped rather than workpack-scoped
  - The schema allows multiple signature types per user/role combination across one execution, but not duplicates

### `workpack_snags`

- Columns: `id`, `workpack_id`, `description`, `status`, `resolution`, `reported_by`, `started_by`, `completed_by`, `reported_at`, `started_at`, `completed_at`, `version`, `created_at`, `updated_at`, `assigned_to`, `resolved_by`, `resolved_at`, `closed_by`, `closed_at`, `resolution_notes`, `created_by`, `category`, `priority`, `parts_used`, `time_spent_minutes`, `snag_no`
- Primary key: `id`
- Foreign keys:
  - `workpack_id -> workpacks.id`
  - `reported_by -> users.id`
  - `started_by -> users.id`
  - `completed_by -> users.id`
  - `assigned_to -> users.id`
  - `resolved_by -> users.id`
  - `closed_by -> users.id`
  - `created_by -> users.id`
- Key constraints:
  - `UNIQUE (workpack_id, snag_no)`
  - Lifecycle check enforces timestamp progression for `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`
- Observations:
  - This table has the richest lifecycle enforcement among the core tables
  - `reported_by` and `created_by` both exist, which may reflect different business meanings or duplicated actor capture

### `aircraft`

- Columns: `id`, `registration`, `serial_number`, `category_id`, `status`, `total_time_hours`, `total_time_cycles`, `created_at`, `updated_at`, `version`, `model_id`, `owner_name`, `operator_name`, `is_active`, `is_airworthy`, `notes`, `loaded_into_system_at`, `manufacture_date`, `tcds_number`, `tcds_url`, `photo_url`
- Primary key: `id`
- Foreign keys:
  - `category_id -> rf_aircraft_category.id`
  - `model_id -> component_models.id`
- Key constraints:
  - `UNIQUE (registration)`
  - `UNIQUE (serial_number)`
- Observations:
  - Aircraft is the anchor record for workpacks, task cards, installed components, compliance, and SID status
  - Operational state is partly normalized (`category_id`) and partly free-form (`status`)

### `component_models`

- Columns: `id`, `manufacturer_id`, `model_name`, `category_id`, `default_tbo_hours`, `default_tbo_months`, `service_interval_hours`, `service_interval_months`, `overhaul_interval_hours`, `overhaul_interval_months`, `maintenance_notes`, `is_life_limited`, `asset_type_id`, `is_active`, `created_at`, `model_code`
- Primary key: `id`
- Foreign keys:
  - `manufacturer_id -> manufacturers.id`
  - `category_id -> rf_component_categories.id`
  - `asset_type_id -> rf_asset_type.id`
- Key constraints:
  - Duplicate FK definitions exist on `asset_type_id`
- Observations:
  - This is the central model catalogue table used by aircraft, components, task templates, maintenance requirements, and applicability mappings
  - Two foreign key constraints point from `asset_type_id` to `rf_asset_type.id`, which is redundant

### `compliance_items`

- Columns: `id`, `item_type`, `code`, `title`, `description`, `authority`, `revision`, `issued_on`, `effective_on`, `source_table`, `source_id`, `compliance_basis`, `status`, `notes`, `created_at`, `updated_at`
- Primary key: `id`
- Foreign keys:
  - None
- Key constraints:
  - `UNIQUE (item_type, code)`
  - `item_type` check limits values to `AD`, `SB`
  - `compliance_basis` check limits values to `MANDATORY`, `RECOMMENDED`, `MANUAL`
  - `status` check limits values to `ACTIVE`, `SUPERSEDED`, `CANCELLED`, `INACTIVE`
- Observations:
  - `source_table` and `source_id` behave like polymorphic references and are not DB-enforced
  - This table is a normalization layer between regulatory content and aircraft/workpack compliance state

### `workpack_compliance`

- Columns: `id`, `workpack_id`, `compliance_item_id`, `task_id`, `status`, `linked_at`, `completed_at`, `notes`, `created_at`, `updated_at`
- Primary key: `id`
- Foreign keys:
  - `workpack_id -> workpacks.id`
  - `compliance_item_id -> compliance_items.id`
  - `task_id -> task_cards.id`
- Key constraints:
  - `UNIQUE (workpack_id, compliance_item_id)`
  - Status check limits values to `PLANNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- Observations:
  - This table connects work planning directly to compliance obligations
  - `task_id` is optional, which allows a compliance item to be linked to a workpack before a concrete task exists

## Model Vs DB Comparison

### DB tables without explicit Sequelize models

- `SequelizeMeta`
- `aircraft_compliance`
- `aircraft_sid_status`
- `compliance_items`
- `rf_component_condition`
- `rf_signoff_role`
- `rf_task_state`
- `sessions`
- `workpack_compliance`
- `workpack_requirements`

### Models or model artifacts without matching live DB tables

- `ServiceBulletinSyncRun` declares `tableName: 'service_bulletin_sync_runs'`, but that table is not present in the live DB
- `src/models/aircraft_sid_applicability` contains migration-style `createTable('aircraft_sid_applicability', ...)`, but no such live DB table exists
- `src/models/aircraft_sid_tracking` contains migration-style `createTable('aircraft_sid_tracking', ...)`, but no such live DB table exists

### Additional model-side anomalies

- `src/models/cessna_sids` is an extensionless duplicate artifact targeting `cessna_sids`, while `src/models/cessnaSid.model.ts` is the active TypeScript model
- `src/models/associations.ts` declares `TaskCard` associations for `mechanic_completed_by` and `engineer_certified_by`, but those columns do not have DB foreign key constraints

## Risks, Issues, And Anomalies

- The live database contains a view `vw_component_status`, which indicates schema objects exist beyond the 41 counted tables
- `task_cards` has multiple linkage columns without DB-enforced foreign keys: `component_id`, `template_source_id`, `service_bulletin_id`, `mechanic_completed_by`, `engineer_certified_by`
- `component_models` has redundant foreign keys on `asset_type_id`
- Several real DB tables have no Sequelize model in `src/models`, especially `compliance_items`, `workpack_compliance`, `aircraft_compliance`, and `sessions`
- Several model-side artifacts point to missing tables or appear to be misplaced migration remnants
- `inventory.service.ts` references `inventory_movements`, but no such table appears in the live database table inventory
- `src/modules/auth/ability.ts` references `rf_component_type`, while the current DB uses `rf_component_categories` and `rf_asset_type`

## Conclusion

The live database table inventory is concentrated entirely in the `public` schema and currently contains 41 application tables plus at least one view. The workpack/aircraft/compliance workflow core is present and structurally rich, with strong constraint coverage around execution, measurements, signatures, and snag lifecycle.

The biggest issues are not missing core tables, but alignment gaps between code and schema: missing Sequelize models for several real tables, model artifacts that target non-existent tables, non-enforced foreign-key-like columns in `task_cards`, and at least one redundant foreign key on `component_models`. Overall, the live DB looks coherent for current operation, but schema-to-model hygiene is not fully clean.
