# Model Inventory

Snapshot date: 2026-05-01

## Scope

Sources inspected:

- `src/models/`
- `docs/ChatGPT/ver3/schema.sql`
- `docs/ChatGPT/ver3/table_inventory.md`

## Summary

- Total TypeScript model count: 31
- Category totals:
  - CORE: 19
  - REFERENCE: 5
  - RBAC: 4
  - AUDIT: 3
- No model declares `paranoid: true`
- No model defines explicit `indexes:` blocks

Non-model or duplicate artifacts found under `src/models/`:

- `src/models/index.ts`
- `src/models/associations.ts`
- `src/models/aircraft_sid_applicability`
- `src/models/aircraft_sid_tracking`
- `src/models/cessna_sids`

## Full Model List

| Model | File Path | Table | Category | Notes |
| --- | --- | --- | --- | --- |
| `Aircraft` | `src/models/core/Aircraft.ts` | `aircraft` | CORE | Declares optimistic locking via `version: true` |
| `AircraftComponent` | `src/models/core/AircraftComponent.ts` | `aircraft_components` | CORE | No inline FK refs despite DB FKs |
| `AircraftSbCompliance` | `src/models/AircraftSbCompliance.ts` | `aircraft_sb_compliance` | CORE | Compliance link between aircraft and service bulletins |
| `ComponentModel` | `src/models/ComponentModel.ts` | `component_models` | CORE | Central catalog model used across aircraft/workpack flows |
| `MaintenanceRequirement` | `src/models/MaintenanceRequirement.ts` | `maintenance_requirements` | CORE | Minimal model compared with domain importance |
| `ModelSid` | `src/models/ModelSid.ts` | `model_sids` | CORE | Join model for model-to-SID applicability |
| `ServiceBulletin` | `src/models/ServiceBulletin.ts` | `service_bulletins` | CORE | Uses default timestamps behavior |
| `ServiceBulletinModel` | `src/models/ServiceBulletinModel.ts` | `service_bulletin_models` | CORE | Join model for service bulletin applicability |
| `ServiceBulletinSyncRun` | `src/models/ServiceBulletinSyncRun.ts` | `service_bulletin_sync_runs` | CORE | Model has no matching live table |
| `TaskCard` | `src/models/core/TaskCard.ts` | `task_cards` | CORE | Many workflow fields exist without inline refs |
| `TaskTemplate` | `src/models/core/TaskTemplate.ts` | `task_templates` | CORE | Largest field drift against live DB |
| `User` | `src/models/core/User.ts` | `users` | CORE | Auth model with lowercasing hooks |
| `Workpack` | `src/models/core/Workpack.ts` | `workpacks` | CORE | Optimistic locking enabled |
| `WorkpackExecution` | `src/models/core/WorkpackExecution.ts` | `workpack_executions` | CORE | Optimistic locking enabled |
| `WorkpackMeasurement` | `src/models/core/WorkpackMeasurement.ts` | `workpack_measurements` | CORE | Uses default timestamps behavior |
| `WorkpackSignature` | `src/models/core/WorkpackSignature.ts` | `workpack_signatures` | CORE | Explicitly disables timestamps |
| `WorkpackSnag` | `src/models/core/WorkpackSnag.ts` | `workpack_snags` | CORE | Optimistic locking enabled; field drift vs DB |
| `WorkpackSource` | `src/models/core/WorkpackSource.ts` | `workpack_sources` | CORE | Uses default timestamps behavior |
| `WorkpackTask` | `src/models/core/WorkpackTask.ts` | `workpack_tasks` | CORE | Composite primary key join model |
| `AircraftCategory` | `src/models/core/AircraftCategory.ts` | `rf_aircraft_category` | REFERENCE | Reference table model stored in `core/` |
| `AssetType` | `src/models/AssetType.ts` | `rf_asset_type` | REFERENCE | Reference model missing some DB metadata fields |
| `CessnaSid` | `src/models/cessnaSid.model.ts` | `cessna_sids` | REFERENCE | Active SID model; duplicate artifact also exists |
| `Manufacturer` | `src/models/Manufacturer.ts` | `manufacturers` | REFERENCE | Treated as reference/master data |
| `WorkpackStatus` | `src/models/core/WorkpackStatus.ts` | `rf_workpack_status` | REFERENCE | Reference table model stored in `core/` |
| `AuditLog` | `src/models/audit/AuditLog.ts` | `audit_log` | AUDIT | JSONB before/after values |
| `WorkpackAuditLog` | `src/models/audit/WorkpackAuditLog.ts` | `workpack_audit_log` | AUDIT | Hash-chain style audit record |
| `WorkpackSnagAuditLog` | `src/models/audit/WorkpackSnagAuditLog.ts` | `workpack_snag_audit_log` | AUDIT | Snag audit trail |
| `Permission` | `src/models/rbac/Permission.ts` | `rf_permission` | RBAC | RBAC reference data |
| `Role` | `src/models/rbac/Role.ts` | `rf_role` | RBAC | RBAC reference data |
| `RolePermission` | `src/models/rbac/RolePermission.ts` | `rf_role_permissions` | RBAC | Model shape does not match DB table shape |
| `UserRole` | `src/models/rbac/UserRole.ts` | `user_roles` | RBAC | Model shape does not match DB table shape |

## Per-Model Structure

Format used below:

- Fields: `field:type`
- Primary key: model-declared PK
- Foreign keys: inline field references if declared, otherwise relationship-level FKs from `associations.ts`
- Indexes: explicit model-defined indexes only
- Timestamps: model option behavior
- Paranoid: explicit soft-delete behavior

### CORE

#### `Aircraft`

- Fields: `id:UUID`, `registration:STRING`, `serial_number:STRING`, `model_id:UUID`, `category_id:UUID`, `status:STRING`, `total_time_hours:DECIMAL(10,2)`, `total_time_cycles:INTEGER`, `loaded_into_system_at:DATEONLY`, `manufacture_date:DATEONLY`, `tcds_number:STRING`, `tcds_url:TEXT`, `photo_url:TEXT`, `version:INTEGER`, `created_at:DATE`, `updated_at:DATE`
- Primary key: `id`
- Foreign keys: inline `model_id -> component_models.id`, `category_id -> rf_aircraft_category.id`
- Indexes: none explicit
- Timestamps: default Sequelize timestamps behavior, with explicit `created_at` and `updated_at` fields defined
- Paranoid: no

#### `AircraftComponent`

- Fields: `id:UUID`, `aircraft_id:UUID`, `model_id:UUID`, `serial_number:TEXT`, `position_code:STRING`, `installation_date:DATEONLY`, `tsn_at_install:DECIMAL(10,2)`, `tso_at_install:DECIMAL(10,2)`, `current_status:TEXT`, `install_af_hours:DECIMAL(10,2)`, `is_quarantined:BOOLEAN`, `removed_at:DATE`, `version:INTEGER`
- Primary key: `id`
- Foreign keys: relationship-level `aircraft_id -> Aircraft`, `model_id -> ComponentModel`
- Indexes: none explicit
- Timestamps: `timestamps: false`
- Paranoid: no

#### `AircraftSbCompliance`

- Fields: `id:UUID`, `aircraft_id:UUID`, `service_bulletin_id:UUID`, `status:STRING`, `complied_at:DATE`, `notes:TEXT`
- Primary key: `id`
- Foreign keys: relationship-level `aircraft_id -> Aircraft`, `service_bulletin_id -> ServiceBulletin`
- Indexes: none explicit
- Timestamps: default Sequelize timestamps behavior
- Paranoid: no

#### `ComponentModel`

- Fields: `id:UUID`, `model_name:STRING`, `model_code:STRING`, `default_tbo_hours:DECIMAL(10,2)`, `default_tbo_months:INTEGER`, `service_interval_hours:DECIMAL(10,2)`, `service_interval_months:INTEGER`, `overhaul_interval_hours:DECIMAL(10,2)`, `overhaul_interval_months:INTEGER`, `maintenance_notes:TEXT`, `is_life_limited:BOOLEAN`, `manufacturer_id:UUID`, `asset_type_id:UUID`, `is_active:BOOLEAN`
- Primary key: `id`
- Foreign keys: relationship-level `manufacturer_id -> Manufacturer`, `asset_type_id -> AssetType`; DB also has `category_id -> rf_component_categories.id`
- Indexes: none explicit
- Timestamps: `timestamps: false`
- Paranoid: no

#### `MaintenanceRequirement`

- Fields: `id:UUID`, `model_id:UUID`, `title:STRING`, `interval_hours:INTEGER`, `interval_months:INTEGER`, `description:TEXT`
- Primary key: `id`
- Foreign keys: relationship-level `model_id -> ComponentModel`
- Indexes: none explicit
- Timestamps: `timestamps: false`
- Paranoid: no

#### `ModelSid`

- Fields: `id:UUID`, `model_id:UUID`, `sid_id:UUID`, `is_active:BOOLEAN`, `created_at:DATE`
- Primary key: `id`
- Foreign keys: relationship-level `model_id -> ComponentModel`, `sid_id -> CessnaSid`
- Indexes: none explicit
- Timestamps: `timestamps: false`
- Paranoid: no

#### `ServiceBulletin`

- Fields: `id:UUID`, `sb_number:STRING`, `title:STRING`, `description:TEXT`, `issued_on:DATEONLY`, `compliance_type:STRING`, `source_primary:STRING`, `source_refs:JSONB`, `status:STRING`, `revision:STRING`, `document_url:TEXT`
- Primary key: `id`
- Foreign keys: none inline; relationship-level many-to-many to `ComponentModel`
- Indexes: none explicit
- Timestamps: default Sequelize timestamps behavior
- Paranoid: no

#### `ServiceBulletinModel`

- Fields: `id:UUID`, `service_bulletin_id:UUID`, `model_id:UUID`
- Primary key: `id`
- Foreign keys: relationship-level `service_bulletin_id -> ServiceBulletin`, `model_id -> ComponentModel`
- Indexes: none explicit
- Timestamps: `timestamps: false`
- Paranoid: no

#### `ServiceBulletinSyncRun`

- Fields: `id:UUID`, `trigger_type:STRING`, `status:STRING`, `synced_count:INTEGER`, `created_count:INTEGER`, `updated_count:INTEGER`, `error_message:TEXT`, `started_at:DATE`, `finished_at:DATE`
- Primary key: `id`
- Foreign keys: none
- Indexes: none explicit
- Timestamps: `timestamps: false`
- Paranoid: no

#### `TaskCard`

- Fields: `id:UUID`, `task_card_number:STRING`, `title:STRING`, `description:TEXT`, `status:STRING`, `work_performed:TEXT`, `template_source_id:UUID`, `service_bulletin_id:UUID`, `compliance_item_id:UUID`, `assigned_to:UUID`, `mechanic_completed_by:UUID`, `mechanic_completed_at:DATE`, `engineer_certified_by:UUID`, `engineer_certified_at:DATE`, `aircraft_id:UUID`, `component_id:UUID`, `version:INTEGER`
- Primary key: `id`
- Foreign keys: relationship-level `aircraft_id -> Aircraft`, `assigned_to -> User`, `mechanic_completed_by -> User`, `engineer_certified_by -> User`, `service_bulletin_id -> ServiceBulletin`; DB also has FK on `compliance_item_id`
- Indexes: none explicit
- Timestamps: default Sequelize timestamps behavior with optimistic locking via `version: true`
- Paranoid: no

#### `TaskTemplate`

- Fields: `id:UUID`, `scope:STRING`, `code:STRING`, `task_order_number:STRING`, `task_card_number:STRING(50)`, `sort_order:DECIMAL(10,2)`, `title:STRING`, `description:TEXT`, `aircraft_model_id:UUID`, `aircraft_id:UUID`, `is_active:BOOLEAN`, `applies_to_fabric:BOOLEAN`, `applies_to_metal:BOOLEAN`, `applies_to_wood_prop:BOOLEAN`, `applies_to_fixed_gear:BOOLEAN`, `applies_to_retractable_gear:BOOLEAN`, `is_required:BOOLEAN`, `interval_type:STRING`, `is_required_for_wood:BOOLEAN`, `is_required_for_fabric:BOOLEAN`, `is_required_for_bungees:BOOLEAN`, `is_required_for_woodprop:BOOLEAN`, `is_required_for_retractable:BOOLEAN`
- Primary key: `id`
- Foreign keys: relationship-level `aircraft_model_id -> ComponentModel`, `aircraft_id -> Aircraft`
- Indexes: none explicit
- Timestamps: default Sequelize timestamps behavior
- Paranoid: no

#### `User`

- Fields: `id:UUID`, `email:STRING`, `password_hash:STRING`, `full_name:STRING`, `is_active:BOOLEAN`
- Primary key: `id`
- Foreign keys: none
- Indexes: none explicit
- Timestamps: `timestamps: false`
- Paranoid: no

#### `Workpack`

- Fields: `id:UUID`, `work_order_number:STRING`, `aircraft_id:UUID`, `status_id:UUID`, `version:INTEGER`
- Primary key: `id`
- Foreign keys: relationship-level `aircraft_id -> Aircraft`, `status_id -> WorkpackStatus`
- Indexes: none explicit
- Timestamps: default Sequelize timestamps behavior with optimistic locking via `version: true`
- Paranoid: no

#### `WorkpackExecution`

- Fields: `id:UUID`, `workpack_id:UUID`, `task_id:UUID`, `attempt_no:INTEGER`, `status:STRING`, `started_by:UUID`, `completed_by:UUID`, `certified_by:UUID`, `started_at:DATE`, `completed_at:DATE`, `certified_at:DATE`, `version:INTEGER`
- Primary key: `id`
- Foreign keys: relationship-level `workpack_id -> Workpack`, `task_id -> TaskCard`, `started_by -> User`, `completed_by -> User`, `certified_by -> User`
- Indexes: none explicit
- Timestamps: default Sequelize timestamps behavior with optimistic locking via `version: true`
- Paranoid: no

#### `WorkpackMeasurement`

- Fields: `id:UUID`, `execution_id:UUID`, `field_key:STRING`, `field_label:STRING`, `position:INTEGER`, `value:STRING`
- Primary key: `id`
- Foreign keys: relationship-level `execution_id -> WorkpackExecution`
- Indexes: none explicit
- Timestamps: default Sequelize timestamps behavior
- Paranoid: no

#### `WorkpackSignature`

- Fields: `id:UUID`, `execution_id:UUID`, `role:STRING`, `signature_type:STRING`, `user_id:UUID`, `signed_at:DATE`
- Primary key: `id`
- Foreign keys: relationship-level `execution_id -> WorkpackExecution`, `user_id -> User`
- Indexes: none explicit
- Timestamps: `timestamps: false`
- Paranoid: no

#### `WorkpackSnag`

- Fields: `id:UUID`, `workpack_id:UUID`, `snag_no:INTEGER`, `description:TEXT`, `status:STRING`, `category:STRING`, `priority:STRING`, `parts_used:TEXT`, `time_spent_minutes:INTEGER`, `resolution_notes:TEXT`, `created_by:UUID`, `assigned_to:UUID`, `resolved_by:UUID`, `closed_by:UUID`, `started_by:UUID`, `created_at:DATE`, `started_at:DATE`, `resolved_at:DATE`, `closed_at:DATE`, `version:INTEGER`
- Primary key: `id`
- Foreign keys: relationship-level `workpack_id -> Workpack`, `created_by -> User`, `assigned_to -> User`, `started_by -> User`, `resolved_by -> User`, `closed_by -> User`
- Indexes: none explicit
- Timestamps: default Sequelize timestamps behavior with optimistic locking via `version: true`
- Paranoid: no

#### `WorkpackSource`

- Fields: `id:UUID`, `execution_id:UUID`, `source_type:STRING`, `reference:STRING`
- Primary key: `id`
- Foreign keys: relationship-level `execution_id -> WorkpackExecution`
- Indexes: none explicit
- Timestamps: default Sequelize timestamps behavior
- Paranoid: no

#### `WorkpackTask`

- Fields: `workpack_id:UUID`, `task_id:UUID`
- Primary key: composite `workpack_id`, `task_id`
- Foreign keys: relationship-level `workpack_id -> Workpack`, `task_id -> TaskCard`
- Indexes: none explicit
- Timestamps: `timestamps: false`
- Paranoid: no

### REFERENCE

#### `AircraftCategory`

- Fields: `id:UUID`, `code:STRING`, `label:STRING`, `is_active:BOOLEAN`, `system_locked:BOOLEAN`, `created_at:DATE`
- Primary key: `id`
- Foreign keys: none
- Indexes: none explicit
- Timestamps: `timestamps: false`
- Paranoid: no

#### `AssetType`

- Fields: `id:UUID`, `code:STRING`, `label:STRING`, `is_installable_on_aircraft:BOOLEAN`, `is_required_for_aircraft:BOOLEAN`, `required_quantity:INTEGER`
- Primary key: `id`
- Foreign keys: none
- Indexes: none explicit
- Timestamps: `timestamps: false`
- Paranoid: no

#### `CessnaSid`

- Fields: `id:UUID`, `sid_number:STRING`, `ata_chapter:STRING`, `section_reference:STRING`, `title:STRING`, `initial_interval_hours:INTEGER`, `initial_interval_months:INTEGER`, `repeat_interval_hours:INTEGER`, `repeat_interval_months:INTEGER`, `inspection_operation:STRING`, `source_pdf:STRING`
- Primary key: `id`
- Foreign keys: relationship-level many-to-many to `ComponentModel` through `ModelSid`
- Indexes: none explicit
- Timestamps: `timestamps: true`
- Paranoid: no

#### `Manufacturer`

- Fields: `id:UUID`, `name:STRING`, `code:STRING`, `description:TEXT`, `website:STRING`, `logo_url:TEXT`, `address_line_1:TEXT`, `address_line_2:TEXT`, `city:TEXT`, `state:TEXT`, `country:TEXT`, `postal_code:TEXT`, `current_owner:TEXT`, `is_active:BOOLEAN`, `is_operational:BOOLEAN`, `support_email:TEXT`, `support_phone:TEXT`, `notes:TEXT`
- Primary key: `id`
- Foreign keys: none
- Indexes: none explicit
- Timestamps: `timestamps: false`
- Paranoid: no

#### `WorkpackStatus`

- Fields: `id:UUID`, `code:STRING`, `label:STRING`
- Primary key: `id`
- Foreign keys: none
- Indexes: none explicit
- Timestamps: `timestamps: false`
- Paranoid: no

### AUDIT

#### `AuditLog`

- Fields: `id:UUID`, `table_name:STRING`, `row_id:UUID`, `action:STRING`, `actor_id:UUID`, `old_values:JSONB`, `new_values:JSONB`, `reason:TEXT`, `created_at:DATE`
- Primary key: `id`
- Foreign keys: relationship-level `actor_id -> User`
- Indexes: none explicit
- Timestamps: `timestamps: false`
- Paranoid: no

#### `WorkpackAuditLog`

- Fields: `id:UUID`, `execution_id:UUID`, `workpack_id:UUID`, `task_id:UUID`, `user_id:UUID`, `action:STRING`, `field:STRING`, `old_value:JSONB`, `new_value:JSONB`, `metadata:JSONB`, `hash:TEXT`, `previous_hash:TEXT`, `sequence:INTEGER`, `created_at:DATE`
- Primary key: `id`
- Foreign keys: relationship-level `execution_id -> WorkpackExecution`, `workpack_id -> Workpack`, `task_id -> TaskCard`, `user_id -> User`
- Indexes: none explicit
- Timestamps: `timestamps: false`
- Paranoid: no

#### `WorkpackSnagAuditLog`

- Fields: `id:UUID`, `snag_id:UUID`, `workpack_id:UUID`, `user_id:UUID`, `action:STRING`, `field:STRING`, `old_value:JSONB`, `new_value:JSONB`, `metadata:JSONB`, `hash:TEXT`, `previous_hash:TEXT`, `sequence:INTEGER`, `created_at:DATE`
- Primary key: `id`
- Foreign keys: relationship-level `snag_id -> WorkpackSnag`, `workpack_id -> Workpack`, `user_id -> User`
- Indexes: none explicit
- Timestamps: `timestamps: false`
- Paranoid: no

### RBAC

#### `Permission`

- Fields: `id:UUID`, `code:STRING`, `label:STRING`, `description:TEXT`, `module:STRING`, `is_active:BOOLEAN`
- Primary key: `id`
- Foreign keys: relationship-level many-to-many to `Role` through `RolePermission`
- Indexes: none explicit
- Timestamps: `timestamps: false`
- Paranoid: no

#### `Role`

- Fields: `id:UUID`, `code:STRING`, `label:STRING`, `description:TEXT`, `is_active:BOOLEAN`, `system_locked:BOOLEAN`
- Primary key: `id`
- Foreign keys: relationship-level many-to-many to `User` and `Permission`
- Indexes: none explicit
- Timestamps: `timestamps: false`
- Paranoid: no

#### `RolePermission`

- Fields: `role_id:UUID`, `permission_id:UUID`
- Primary key: composite `role_id`, `permission_id`
- Foreign keys: relationship-level `role_id -> Role`, `permission_id -> Permission`
- Indexes: none explicit
- Timestamps: `timestamps: false`
- Paranoid: no

#### `UserRole`

- Fields: `user_id:UUID`, `role_id:UUID`
- Primary key: composite `user_id`, `role_id`
- Foreign keys: relationship-level `user_id -> User`, `role_id -> Role`
- Indexes: none explicit
- Timestamps: `timestamps: false`
- Paranoid: no

## Relationships

Relationships declared in `src/models/associations.ts` and model files:

| Type | Source | Target | Foreign Key / Through |
| --- | --- | --- | --- |
| `hasMany` | `AssetType` | `ComponentModel` | `asset_type_id` |
| `belongsTo` | `ComponentModel` | `AssetType` | `asset_type_id` |
| `hasMany` | `Manufacturer` | `ComponentModel` | `manufacturer_id` |
| `belongsTo` | `ComponentModel` | `Manufacturer` | `manufacturer_id` |
| `belongsToMany` | `ServiceBulletin` | `ComponentModel` | through `ServiceBulletinModel`, `service_bulletin_id`, `model_id` |
| `belongsToMany` | `ComponentModel` | `ServiceBulletin` | through `ServiceBulletinModel`, `model_id`, `service_bulletin_id` |
| `hasMany` | `ServiceBulletin` | `TaskCard` | `service_bulletin_id` |
| `belongsTo` | `TaskCard` | `ServiceBulletin` | `service_bulletin_id` |
| `belongsToMany` | `ComponentModel` | `CessnaSid` | through `ModelSid`, `model_id`, `sid_id` |
| `belongsToMany` | `CessnaSid` | `ComponentModel` | through `ModelSid`, `sid_id`, `model_id` |
| `belongsTo` | `Aircraft` | `ComponentModel` | `model_id` |
| `hasMany` | `ComponentModel` | `Aircraft` | `model_id` |
| `hasMany` | `Aircraft` | `AircraftSbCompliance` | `aircraft_id` |
| `belongsTo` | `AircraftSbCompliance` | `Aircraft` | `aircraft_id` |
| `hasMany` | `ServiceBulletin` | `AircraftSbCompliance` | `service_bulletin_id` |
| `belongsTo` | `AircraftSbCompliance` | `ServiceBulletin` | `service_bulletin_id` |
| `belongsTo` | `TaskTemplate` | `ComponentModel` | `aircraft_model_id` |
| `belongsTo` | `TaskTemplate` | `Aircraft` | `aircraft_id` |
| `hasMany` | `Aircraft` | `AircraftComponent` | `aircraft_id` |
| `belongsTo` | `AircraftComponent` | `Aircraft` | `aircraft_id` |
| `belongsTo` | `AircraftComponent` | `ComponentModel` | `model_id` |
| `belongsTo` | `Workpack` | `Aircraft` | `aircraft_id` |
| `hasMany` | `Aircraft` | `Workpack` | `aircraft_id` |
| `belongsTo` | `Workpack` | `WorkpackStatus` | `status_id` |
| `belongsToMany` | `Workpack` | `TaskCard` | through `WorkpackTask`, `workpack_id`, `task_id` |
| `belongsToMany` | `TaskCard` | `Workpack` | through `WorkpackTask`, `task_id`, `workpack_id` |
| `belongsTo` | `TaskCard` | `User` | `assigned_to` |
| `hasMany` | `User` | `TaskCard` | `assigned_to` |
| `belongsTo` | `TaskCard` | `User` | `mechanic_completed_by` |
| `belongsTo` | `TaskCard` | `User` | `engineer_certified_by` |
| `hasMany` | `Workpack` | `WorkpackExecution` | `workpack_id` |
| `belongsTo` | `WorkpackExecution` | `Workpack` | `workpack_id` |
| `hasMany` | `TaskCard` | `WorkpackExecution` | `task_id` |
| `belongsTo` | `WorkpackExecution` | `TaskCard` | `task_id` |
| `belongsTo` | `WorkpackExecution` | `User` | `started_by` |
| `belongsTo` | `WorkpackExecution` | `User` | `completed_by` |
| `belongsTo` | `WorkpackExecution` | `User` | `certified_by` |
| `hasMany` | `WorkpackExecution` | `WorkpackMeasurement` | `execution_id` |
| `belongsTo` | `WorkpackMeasurement` | `WorkpackExecution` | `execution_id` |
| `hasMany` | `WorkpackExecution` | `WorkpackSignature` | `execution_id` |
| `belongsTo` | `WorkpackSignature` | `WorkpackExecution` | `execution_id` |
| `belongsTo` | `WorkpackSignature` | `User` | `user_id` |
| `hasMany` | `WorkpackExecution` | `WorkpackSource` | `execution_id` |
| `belongsTo` | `WorkpackSource` | `WorkpackExecution` | `execution_id` |
| `hasMany` | `WorkpackExecution` | `WorkpackAuditLog` | `execution_id` |
| `belongsTo` | `WorkpackAuditLog` | `WorkpackExecution` | `execution_id` |
| `belongsTo` | `WorkpackAuditLog` | `Workpack` | `workpack_id` |
| `belongsTo` | `WorkpackAuditLog` | `TaskCard` | `task_id` |
| `belongsTo` | `WorkpackAuditLog` | `User` | `user_id` |
| `hasMany` | `Workpack` | `WorkpackSnag` | `workpack_id` |
| `belongsTo` | `WorkpackSnag` | `Workpack` | `workpack_id` |
| `belongsTo` | `WorkpackSnag` | `User` | `created_by` |
| `belongsTo` | `WorkpackSnag` | `User` | `assigned_to` |
| `belongsTo` | `WorkpackSnag` | `User` | `started_by` |
| `belongsTo` | `WorkpackSnag` | `User` | `resolved_by` |
| `belongsTo` | `WorkpackSnag` | `User` | `closed_by` |
| `hasMany` | `WorkpackSnag` | `WorkpackSnagAuditLog` | `snag_id` |
| `belongsTo` | `WorkpackSnagAuditLog` | `WorkpackSnag` | `snag_id` |
| `belongsTo` | `WorkpackSnagAuditLog` | `Workpack` | `workpack_id` |
| `belongsTo` | `WorkpackSnagAuditLog` | `User` | `user_id` |
| `belongsTo` | `AuditLog` | `User` | `actor_id` |
| `hasMany` | `User` | `AuditLog` | `actor_id` |
| `hasMany` | `ComponentModel` | `MaintenanceRequirement` | `model_id` |
| `belongsTo` | `MaintenanceRequirement` | `ComponentModel` | `model_id` |
| `belongsToMany` | `User` | `Role` | through `UserRole`, `user_id`, `role_id` |
| `belongsToMany` | `Role` | `User` | through `UserRole`, `role_id`, `user_id` |
| `belongsToMany` | `Role` | `Permission` | through `RolePermission`, `role_id`, `permission_id` |
| `belongsToMany` | `Permission` | `Role` | through `RolePermission`, `permission_id`, `role_id` |

Additional note:

- `Aircraft.belongsTo(ComponentModel, { foreignKey: 'model_id' })` is declared both in `src/models/core/Aircraft.ts` and again in `src/models/associations.ts`

## Model vs DB Comparison

### Models with no matching live table

- `ServiceBulletinSyncRun -> service_bulletin_sync_runs`

### Tables with no matching TypeScript model

- `SequelizeMeta`
- `aircraft_compliance`
- `aircraft_sid_status`
- `compliance_items`
- `rf_component_categories`
- `rf_component_condition`
- `rf_signoff_role`
- `rf_task_state`
- `sessions`
- `workpack_compliance`
- `workpack_requirements`

### Missing fields and structural drift

Notable DB fields missing from models:

- `aircraft`: model omits `owner_name`, `operator_name`, `is_active`, `is_airworthy`, `notes`
- `aircraft_components`: model omits DB `created_at`
- `aircraft_sb_compliance`: model omits DB `created_at`, `updated_at`
- `component_models`: model omits DB `category_id`, `created_at`
- `manufacturers`: model omits DB `created_at`, `updated_at`
- `rf_aircraft_category`: model omits DB `description`
- `rf_asset_type`: model omits DB `description`, `is_active`, `system_locked`, `created_at`
- `rf_permission`: model omits DB `system_locked`, `created_at`
- `rf_role`: model omits DB `created_at`
- `rf_role_permissions`: DB has `id` and `created_at`; model only declares `role_id` and `permission_id`
- `rf_workpack_status`: model omits DB `description`, `is_active`, `system_locked`, `created_at`
- `service_bulletins`: model omits DB `created_at`, `updated_at`
- `task_cards`: model omits DB `signed_by`, `signed_at`, `signature_snapshot_url`, `created_at`, `updated_at`
- `task_templates`: model omits DB `created_at`, `updated_at`
- `users`: model omits DB `created_at`, `updated_at`
- `user_roles`: DB has `id`; model only declares `user_id` and `role_id`
- `workpacks`: model omits DB `created_at`, `updated_at`, `qa_required`, `certified_by`, `certified_at`, `qa_reviewed_by`, `qa_reviewed_at`, `released_by`, `released_at`
- `workpack_executions`: model omits DB `notes`, `failure_reason`, `created_at`, `updated_at`
- `workpack_measurements`: model omits DB `created_at`, `updated_at`
- `workpack_snags`: model omits DB `resolution`, `reported_by`, `completed_by`, `reported_at`, `completed_at`, `updated_at`
- `workpack_sources`: model omits DB `created_at`, `updated_at`

Model fields that do not exist in the live DB:

- `ComponentModel.warning_threshold_percent`
- `TaskTemplate.code`
- `TaskTemplate.task_order_number`
- `TaskTemplate.applies_to_fabric`
- `TaskTemplate.applies_to_metal`
- `TaskTemplate.applies_to_wood_prop`
- `TaskTemplate.applies_to_fixed_gear`
- `TaskTemplate.applies_to_retractable_gear`
- `TaskTemplate.is_required`
- `TaskTemplate.interval_type`

### Type and behavior inconsistencies

- `TaskCard.description` is `allowNull: true` in the model, but the live DB column is `NOT NULL`
- `RolePermission` and `UserRole` are modeled as pure composite-key join tables, but the live DB tables include surrogate `id` columns
- Several models rely on default Sequelize timestamps behavior, but do not declare the timestamp fields locally even when the DB has explicit `created_at` and `updated_at`

## Duplication / Overlap

Models or artifacts representing the same concept:

- `src/models/cessnaSid.model.ts` and `src/models/cessna_sids` both target `cessna_sids`
- `Aircraft.belongsTo(ComponentModel)` is declared twice in code

Redundant or unused model artifacts:

- `src/models/aircraft_sid_applicability` is a migration-style artifact in the models folder and is not part of the exported TypeScript model set
- `src/models/aircraft_sid_tracking` is a migration-style artifact in the models folder and is not part of the exported TypeScript model set
- `ServiceBulletinSyncRun` appears active in code, but its table is absent in the live DB

## Risks, Issues, And Anomalies

- Model coverage is incomplete for several live tables, including `compliance_items`, `workpack_compliance`, and `aircraft_compliance`
- `TaskTemplate` has the largest schema drift of any model, with multiple model-only fields and missing DB timestamp fields
- RBAC join models do not match the actual DB shape because the live tables contain surrogate IDs that the models ignore
- Several workflow models are narrower than the live tables, especially `Workpack`, `WorkpackExecution`, `WorkpackSnag`, and `TaskCard`
- Reference models are inconsistently located: some `rf_*` tables live under `core/`, while others live at the top level or under `rbac/`
- The models folder contains non-model artifacts, which increases the chance of accidental import or future confusion

## Conclusion

The repository currently has 31 TypeScript Sequelize models, and the relationship graph in `src/models/associations.ts` is broad enough to describe the main aircraft, workpack, audit, reference, and RBAC domains. The core domain shape is clear.

The main problem is alignment, not absence. Several real DB tables have no model, several models omit important live columns, one live code model points to a non-existent table, and a few artifacts in `src/models/` are not real runtime models at all. The system can still function with this setup, but the model layer is not a clean, exact representation of the live schema.
