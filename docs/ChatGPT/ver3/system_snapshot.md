# System Snapshot

Snapshot date: 2026-04-30

## System Overview

Jupiter is a TypeScript Express application backed by PostgreSQL and Sequelize, with EJS server-rendered views and a session-based authentication flow.

Core runtime layers:

- HTTP application bootstrap: `src/app.ts`
- Server startup and DB safety checks: `src/server.ts`
- Database access: `src/config/database.ts`, `src/models/index.ts`, `src/models/associations.ts`
- View layer: `src/views/**`
- Feature modules: `src/modules/**`

Active routed modules mounted in `src/app.ts`:

- Authentication: `/auth`, `/auth/staff`
- Library: `/library`
- Service Bulletins: `/service-bulletins`, `/sb`
- Aircraft: `/aircraft`
- Projection: `/projection`
- Reference: `/reference`
- Workpacks: `/workpacks`
- Inventory: `/inventory`
- Audit: `/audit`

Module map:

- `aircraft`: aircraft master records, installed components, lifecycle helpers
- `auth`: login, Passport config, staff routes, password utilities
- `audit`: audit browsing and audit service logic
- `compliance`: compliance item and aircraft/workpack compliance logic
- `inventory`: inventory-facing routes and service layer
- `library`: manufacturer/model/requirement management
- `maintenance`: maintenance trigger logic
- `projection`: fleet status and health views
- `rbac`: permission helpers
- `reference`: reference table CRUD/policies
- `service-bulletins`: bulletin ingestion, sync, adapters, UI
- `tasks`: task services and snapshot support
- `workpacks`: planning, execution, snags, audit, PDF/CRS output

Architecture characteristics observed:

- Monolithic Express app with feature folders under `src/modules`
- Sequelize model layer with explicit association registration
- EJS templates for UI rendering
- PostgreSQL session storage via `connect-pg-simple`
- Background cron startup for service bulletin sync in `src/server.ts`

## Database Summary

Source: live PostgreSQL database dumped with `pg_dump --schema-only --no-owner --no-privileges`.

Current public schema totals:

- 41 tables
- 66 foreign key constraints
- 47 applied Sequelize migrations in `SequelizeMeta`

Reference and identity tables:

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
- `users`
- `user_roles`
- `sessions`

Core operational tables:

- `manufacturers`
- `component_models`
- `maintenance_requirements`
- `aircraft`
- `aircraft_components`
- `task_cards`
- `task_templates`
- `workpacks`
- `workpack_tasks`
- `workpack_requirements`
- `workpack_executions`
- `workpack_measurements`
- `workpack_signatures`
- `workpack_sources`
- `workpack_snags`

Compliance and bulletin tables:

- `service_bulletins`
- `service_bulletin_models`
- `aircraft_sb_compliance`
- `cessna_sids`
- `model_sids`
- `aircraft_sid_status`
- `compliance_items`
- `aircraft_compliance`
- `workpack_compliance`

Audit tables:

- `audit_log`
- `workpack_audit_log`
- `workpack_snag_audit_log`

Key relationship patterns:

- `component_models` is a central hub for `manufacturers`, `aircraft`, `aircraft_components`, `maintenance_requirements`, `task_templates`, `service_bulletin_models`, and `model_sids`
- `aircraft` anchors `aircraft_components`, `task_cards`, `workpacks`, `aircraft_sb_compliance`, `aircraft_sid_status`, and `aircraft_compliance`
- `workpacks` anchors execution flow through `workpack_tasks`, `workpack_executions`, `workpack_sources`, `workpack_snags`, `workpack_audit_log`, `workpack_snag_audit_log`, and `workpack_compliance`
- `users` is referenced across assignments, execution signoff, audit, and RBAC tables
- `service_bulletins` connects to applicability and compliance through `service_bulletin_models`, `aircraft_sb_compliance`, and task-card source linkage

## Migration Audit

Active migration status:

- 47 migration files found in `migrations/`
- 47 migration records found in `SequelizeMeta`
- Active migration chain appears complete with no missing applied entries

Latest active migrations:

- `430_create_compliance_items.ts`
- `440_create_aircraft_compliance.ts`
- `450_create_workpack_compliance.ts`
- `460_add_compliance_item_id_to_task_cards.ts`
- `461_add_mpi_checklist_applicability_fields.ts`

Legacy/duplicate migration findings outside the active chain:

- Duplicate filename `010_create_reference_tables.ts` exists in `migrations/` and `migrationOLD/TEMP`
- Duplicate filename `030_create_all_rf_tables.ts` exists in `migrationOLD/` and `migrationOLD/TEMP`
- Duplicate filename `100_expand_aircraft_and_components.ts` exists in `migrationOLD/` and `migrationOLD/TEMP`
- `migrationOLD/TEMP` contains conflicting numbering history, including two different `120_*` files
- `migrationOLD/` contains mixed `.ts` and `.sql` migration artifacts, which increases ambiguity if old folders are reused accidentally

Conclusion:

- The active `migrations/` folder is internally consistent for current execution
- Legacy migration folders contain duplicates and historical conflicts that should not be treated as executable truth

## Risk Areas

- Large workpack surface area: `src/modules/workpacks` has 17 files and the largest controller in the repo, increasing change risk around planning/execution/snags/PDF workflows
- Stray model artifacts: `src/models/aircraft_sid_applicability` and `src/models/aircraft_sid_tracking` are extensionless migration-style files inside the models folder, which is a structural inconsistency
- Legacy migration noise: `migrationOLD/` and `migrationOLD/TEMP` contain duplicate numbering and overlapping intent, creating risk for human error during manual recovery or rebuild work
- Empty feature folders: `src/modules/assets` and `src/modules/components` currently exist without implementation files, suggesting incomplete or abandoned module boundaries
- Production security posture should be reviewed separately: sensitive credentials are stored in local environment configuration, and remote test mode is enabled in the current app configuration
- Source encoding inconsistency is visible in console strings rendered with mojibake characters in `src/app.ts` and `src/server.ts`, which may indicate file encoding drift
