# JUPITER – Domain Model Refactor State
## 08 – Asset & Manufacturer Structural Correction Phase

---

## 1. Purpose of This Document

This document exists to ensure continuity during the structural refactor phase
where asset modelling is being corrected.

This is NOT a redesign.
This is an architectural correction while the system is still small.

Any AI session must read this before proposing structural changes.

---

## 2. Current Structural Objective

We are correcting the asset hierarchy to support:

- Aircraft
- Engines
- Propellers
- Future component families

The goal is a clean and scalable asset structure:

Asset Type → Manufacturer → Model → Installed Instance

---

## 3. What Has Already Been Done

### 3.1 Asset Type Refactor

- rf_component_categories has been promoted to rf_asset_type
- component_models.category_id now references rf_asset_type(id)
- rf_manufacturers.category_id also references rf_asset_type(id)

Asset Type examples:
- AIRCRAFT
- ENGINE
- PROPELLER

This layer is stable.

---

### 3.2 Manufacturer Promotion

rf_manufacturers is being promoted to a true domain table:

New table name:
manufacturers

It is no longer treated as immutable reference data.

Manufacturers will support:
- website
- logo_url
- address_line_1
- address_line_2
- city
- state
- country
- postal_code
- is_active
- updated_at

Manufacturers are CREATED via the application.
They are NOT seeded-only reference rows.

They are now business entities.

---

## 4. What Is Still Transitional

### 4.1 Aircraft Model Structure

Currently aircraft table has:

- model (string)
- model_id (uuid, nullable)

This is transitional and incorrect long-term.

Target structure:

- Remove aircraft.model (string)
- Make aircraft.model_id NOT NULL
- model_id references component_models(id)
- component_models must be filtered by asset_type = AIRCRAFT

Aircraft must be created from defined models, not free text.

---

## 5. Non-Negotiable Rules During This Phase

1. No schema resets.
2. No database rebuild.
3. No migration deletions.
4. No editing knex_migrations table.
5. No architectural reorganization of modules.
6. No merging UI into backend.
7. No introduction of new frameworks.

All changes must be:
- Backward safe
- Migration-driven
- Verified after each step

---

## 6. Future Direction (After Aircraft Stabilizes)

Once aircraft model refactor is complete:

1. Components will use the same asset modelling pattern.
2. Installed component lifecycle will align with asset types.
3. Inventory and projection modules will consume consistent model hierarchy.
4. UI dropdowns will be driven entirely by domain tables.

---

## 7. What Must Not Happen

AI must NOT:

- Reintroduce string-based model fields.
- Treat manufacturers as reference-only data.
- Re-add category_id to manufacturers.
- Collapse asset types back into component categories.
- Replace lifecycle enforcement logic.

---

## 8. Current Active Task

We are preparing to:

1. Finalize manufacturers domain promotion.
2. Refactor aircraft to enforce model_id usage.
3. Remove aircraft.model string column.
4. Update UI to use dropdown-based model selection.
5. Enforce optimistic locking via version column.

This is the immediate next phase.

---

## 9. Status Summary

The system is stable.
Architecture is intact.
We are in controlled structural correction phase.

Proceed incrementally.
Verify after each migration.
Do not redesign.

---

End of 09_DOMAIN_MODEL_REFACTOR_STATE Document.
