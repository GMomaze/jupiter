# Jupiter SaaS Migration Release Inventory — 582 through 603

## Scope and authority

This is a read-only SHA-256 inventory of the current repository working-tree
migration files relevant to the planned SaaS release. It is not a database
ledger, deployment approval, or assertion that production has applied them.
Hashes were calculated on 2026-09-15. Recalculate from the immutable release
artifact and compare with quoted `public."SequelizeMeta"` before any release.

| Order | Migration filename | SHA-256 |
| ---: | --- | --- |
| 582 | `582_repair_component_life_limit_governance_ownership.ts` | `802db29c25c8553223adabda91e4c7382bf596584fc41fda09becc1567977c83` |
| 583 | `583_repair_component_life_limit_governance_gate_acl.ts` | `f785536f0ca336bb8779adc87a8f9382f8e65da92fa30db7bf2e44f10cb8ffde` |
| 584 | `584_repair_component_life_limit_governance_activation_gate_write.ts` | `7983f0269e88645658288bc9f5301c2ad22e210d5c33990c67667c0a57ac13cb` |
| 585 | `585_retire_component_model_obsolete_overhaul_intervals.ts` | `80581bdd6825323f295e4281f33efcbeaacdd6b0e8a1ee25da1a8bb92ce40086` |
| 586 | `586_create_manufacturer_source_names.ts` | `430a9c39932e7c033b4bdd6ebc9b4a262b7698ef7011e48485a533e899a112ef` |
| 587 | `587_create_tenants.ts` | `cbd20aa73048fe06b714efda3eb874d4fe7a04fe155c86156dfd536fe4f593fe` |
| 588 | `588_create_tenant_membership_foundation.ts` | `cd97720881e728c62923b724ea65b15db3e9b84630696277686e40d20e7ef333` |
| 589 | `589_create_tenant_context_switch_attempts.ts` | `e9578b70e26cb32058b10b78cbb340f2cda05f3ebec1efa254f8175ac2aed72a` |
| 590 | `590_add_root_operational_tenant_ownership.ts` | `bd7a301aedc28c3d6b1acfb179d3f5048bf721399b84fbac3d4511e361f43edb` |
| 591 | `591_allow_standalone_snag_audit_history.ts` | `572a6a87e1f9386c20565fb84ba484f30e6f3a05badb3195137bafd154a22264` |
| 592 | `592_allow_standalone_workpack_snags.ts` | `2bcf230df518af9eccd33ece7ce1b9b128eef26407f817b7973c1420daee0265` |
| 593 | `593_enforce_standalone_snag_nullability.ts` | `8f8d3af4318f709292368845d6a1ed024add4de3c557a96719199e6b6c3d58a5` |
| 594 | `594_grant_tenant_login_provisioning_access.ts` | `e56cc2840e0c9839b5fb9144f51644eccb385d8b4a64858a034317394722bb6f` |
| 595 | `595_add_legacy_component_custody_and_movement_history.ts` | `1e7069d25ef5247ebf047b5a8b293f2fefeccbb6a6c6cecabf6b6b9b7ec33c5d` |
| 596 | `596_restrict_legacy_component_history_runtime_privileges.ts` | `d44f49259eef61614a01a2f3eeaf8ae06e4816ddc18fc61f6ab1a406dda0cce9` |
| 597 | `597_add_migration_batch_tenant_ownership.ts` | `cc2ad7765b9ea6e2604182813f8f591074bdb6c1ae47af195e8ab5be4ed4e8f9` |
| 598 | `598_create_platform_authority_foundation.ts` | `17e6b692af0625c7dac72cf22e885718649bbfdccc6960fc1e2bc6ca156f09ce` |
| 599 | `599_seed_fail_closed_platform_capabilities.ts` | `543972a026de9008ee987e405e6ead3651fb791c6a11c6256c98dccbaa69faba` |
| 600 | `600_create_platform_file_operations.ts` | `f27aa83fd86f5cc96bc6aea1bd73872352071d53d79fe51a4d84026216d4de90` |
| 601 | `601_create_tenant_lifecycle_foundation.ts` | `6304d6ade488f4aa1944cd31faf5ceca7867ab5efee7dbe1a2fded81229ffa29` |
| 602 | `602_create_staff_membership_administration.ts` | `a84c5f2aa3cc5b11a25978560c67a71c4d3804037c8545a2254225174d947548` |
| 603 | `603_remove_deferred_last_admin_enforcement.ts` | `20572bc475764f94b02b4ee0f15cbc7038ae1b732524885a2f6b44786565ea13` |

## Release use

The production starting head is target evidence, not defined here. Inventory
the exact pending suffix, verify every predecessor once and in order, compare
hashes with the immutable release artifact, and stop on missing, unexpected,
duplicate, reordered, modified, or already-applied discrepancies. The current
workspace is dirty and migrations 586–603 are currently untracked, so this
inventory must not be treated as a releasable artifact or committed baseline.

