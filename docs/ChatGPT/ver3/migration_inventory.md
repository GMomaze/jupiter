# Migration Inventory

Snapshot date: 2026-04-30

## Scope

Inspected sources:

- `migrations/`
- `migrationOLD/`
- `migrationOLD/TEMP/`
- `node_modules/sequelize-cli/lib/assets/migrations/` as a tool asset folder only
- Live PostgreSQL `SequelizeMeta` table

## Active Migration Totals

- Total active migrations in `migrations/`: 47
- Total applied migrations in live `SequelizeMeta`: 47

## Active Migration Status

All active migrations are currently applied in the live database.

| Migration | Status |
| --- | --- |
| `010_create_reference_tables.ts` | Applied |
| `020_create_identity_schema.ts` | Applied |
| `030_create_manufacturers.ts` | Applied |
| `040_create_audit_function.ts` | Applied |
| `050_create_aircraft_table.ts` | Applied |
| `060_create_task_cards_table.ts` | Applied |
| `070_create_workpacks.ts` | Applied |
| `080_expand_aircraft_and_components.ts` | Applied |
| `090_refactor_component_categories_to_asset_type.ts` | Applied |
| `100_backfill_aircraft_model_id.ts` | Applied |
| `110_enforce_aircraft_model_fk_and_version.ts` | Applied |
| `120_component_models_asset_type_refactor.ts` | Applied |
| `130_create_maintenance_requirements.ts` | Applied |
| `140_create_user_sessions.ts` | Applied |
| `150_add_rbac_permission_matrix.ts` | Applied |
| `160_phase0_structural_hardening.ts` | Applied |
| `170_phase0_remove_cascade_maintenance_requirements.ts` | Applied |
| `180_create_audit_log.ts` | Applied |
| `190_workpack_workflow_foundation.ts` | Applied |
| `200_add_task_work_performed.ts` | Applied |
| `210_create_task_templates.ts` | Applied |
| `220_add_task_template_applicability_flags.ts` | Applied |
| `230_add_task_template_source_to_task_cards.ts` | Applied |
| `240_create_service_bulletins.ts` | Applied |
| `250_create_service_bulletin_models.ts` | Applied |
| `260_add_task_card_service_bulletin_source.ts` | Applied |
| `270_create_aircraft_sb_compliance.ts` | Applied |
| `280_expand_manufacturers_and_models_master_data.ts` | Applied |
| `290_expand_aircraft_master_data.ts` | Applied |
| `300_add_aircraft_document_fields.ts` | Applied |
| `310_create-workpack-executions.ts` | Applied |
| `320_create-workpack-measurements.ts` | Applied |
| `330_create-workpack-signatures.ts` | Applied |
| `340_create-workpack-sources.ts` | Applied |
| `350_create-workpack-audit-log.ts` | Applied |
| `360_create-workpack-snags.ts` | Applied |
| `370_upgrade-workpack-snags-lifecycle.ts` | Applied |
| `380_add-snag-numbering.ts` | Applied |
| `390_create_cessna_sids.ts` | Applied |
| `400_create_model_sids.ts` | Applied |
| `410_create_aircraft_sid_status.ts` | Applied |
| `420_create_workpack_snag_audit_log.ts` | Applied |
| `430_create_compliance_items.ts` | Applied |
| `440_create_aircraft_compliance.ts` | Applied |
| `450_create_workpack_compliance.ts` | Applied |
| `460_add_compliance_item_id_to_task_cards.ts` | Applied |
| `461_add_mpi_checklist_applicability_fields.ts` | Applied |

## Legacy Migration List

### `migrationOLD/`

- `020_create_reference_tables.ts`
- `022__harden_audit_log_permissions.ts`
- `023_harden_audit_log.ts`
- `030_create_all_rf_tables.ts`
- `030_initial_references.ts`
- `040_create_all_rf_tables.ts`
- `050_create_identity_schema.ts`
- `070xxx_create_task_cards_table.ts`
- `090_expand_aircraft_and_components.sql`
- `100_add_version_to_aircraft.ts`
- `100_create_maintenance_requirements.ts`
- `100_expand_aircraft_and_components.ts`
- `110_create_user_sessions.ts`
- `120_add_version_column_to_aircraft.ts`
- `130_refactor_component_categories_to_asset_type.ts`
- `150_component_models_asset_type_refactor.ts`
- `160_enforce_aircraft_model_fk_and_version.ts`
- `170_component_models_asset_type_refactor.ts`
- `190_add_rbac_permission_matrix.sql`
- `200_phase0_structural_hardening.sql`
- `205_create_audit_log_table.ts`
- `210_harden_audit_log_permissions.ts`
- `210_phase0_remove_cascade_maintenance_requirements.sql`
- `220_harden_audit_log.ts`
- `230_fix_aircraft_schema_alignment.ts`
- `240_fix_component_model_tbo.ts`
- `260_add_service_bulletin_source.ts`
- `270_add_service_bulletin_source_visibility.ts`
- `270_create_service_bulletin_models.ts`
- `280_create_service_bulletin_sync_runs.ts`
- `999_audit_security.sql`
- `999_audit_security.ts`

### `migrationOLD/TEMP/`

- `010_create_reference_tables.ts`
- `020_initial_references.ts`
- `030_create_all_rf_tables.ts`
- `040_create_identity_schema.ts`
- `040_create_manufacturers.ts`
- `050_create_manufacturers.ts`
- `060_create_audit_function.ts`
- `070_create_aircraft_table.ts`
- `080_create_task_cards_table.ts`
- `090_create_workpacks.ts`
- `100_expand_aircraft_and_components.ts`
- `110_add_version_column_to_aircraft.ts`
- `120_promote_manufacturers_to_domain_table.ts`
- `120_refactor_component_categories_to_asset_type.ts`
- `130_promote_manufacturers_to_domain_table.ts`
- `140_backfill_aircraft_model_id.ts`
- `150_enforce_aircraft_model_fk_and_version.ts`
- `160_component_models_asset_type_refactor.ts`
- `170_create_maintenance_requirements.ts`
- `180_create_user_sessions.ts`
- `190_add_rbac_permission_matrix.ts`
- `200_phase0_structural_hardening.ts`
- `210_phase0_remove_cascade_maintenance_requirements.ts`

## Duplicate Filename Detection

Exact duplicate filenames detected across active and legacy folders:

- `010_create_reference_tables.ts`
  - `migrations/010_create_reference_tables.ts`
  - `migrationOLD/TEMP/010_create_reference_tables.ts`
- `030_create_all_rf_tables.ts`
  - `migrationOLD/030_create_all_rf_tables.ts`
  - `migrationOLD/TEMP/030_create_all_rf_tables.ts`
- `100_expand_aircraft_and_components.ts`
  - `migrationOLD/100_expand_aircraft_and_components.ts`
  - `migrationOLD/TEMP/100_expand_aircraft_and_components.ts`

## Possible Conflicting Migration Detection

Numeric-prefix conflicts detected across the broader migration history:

- Prefix `030` has multiple different meanings: `create_manufacturers`, `create_all_rf_tables`, `initial_references`
- Prefix `040` has multiple different meanings: `create_audit_function`, `create_all_rf_tables`, `create_identity_schema`, `create_manufacturers`
- Prefix `050` has multiple different meanings: `create_aircraft_table`, `create_identity_schema`, `create_manufacturers`
- Prefix `070` has multiple different meanings: `create_workpacks`, `create_task_cards_table`, `create_aircraft_table`
- Prefix `090` has multiple different meanings: `refactor_component_categories_to_asset_type`, `expand_aircraft_and_components`, `create_workpacks`
- Prefixes `100` through `210` contain many overlapping historical variants with different intents
- Prefix `270` has multiple different meanings: `create_aircraft_sb_compliance`, `add_service_bulletin_source_visibility`, `create_service_bulletin_models`
- Prefix `999` exists as both `.sql` and `.ts` for `audit_security`

Conflict interpretation:

- The active `migrations/` chain itself is internally consistent
- The legacy folders are not a reliable linear history and should not be treated as executable migration truth

## Missing, Out-Of-Order, And Gap Risks

Active chain observations:

- No missing active migrations relative to live `SequelizeMeta`
- No extra applied migrations in `SequelizeMeta` beyond the active `migrations/` folder
- Active numbering is ordered from `010` through `460`, followed by `461`
- No active numbering gaps were detected within the current chain

Risk areas outside the active chain:

- Legacy folders contain out-of-order and overlapping numbering schemes
- `migrationOLD/` mixes `.ts` and `.sql` migration styles
- `migrationOLD/TEMP/` contains duplicate-number collisions, including two separate `120_*` files
- Historical filenames indicate prior renumbering and replaced intent, which creates recovery risk if someone reuses legacy folders during rebuild or restore work
- `node_modules/sequelize-cli/lib/assets/migrations/` exists but is a package asset path, not a project migration source

## Conclusion

The live database and the active `migrations/` folder are aligned: 47 active migrations exist and all 47 are applied in `SequelizeMeta`.

The current execution risk is not in the active migration chain. The risk is in the historical migration archives, where duplicate filenames, conflicting numbering, mixed file types, and overlapping migration intent create ambiguity. For any future migration work, `migrations/` should be treated as the only active source of truth, while `migrationOLD/` and `migrationOLD/TEMP/` should be treated as archival reference only.
