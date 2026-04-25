# JUPITER – Asset Modeling Rules
## 10 – Permanent Asset Hierarchy & Domain Discipline

---

## 1. Purpose

This document defines the permanent asset modeling philosophy of Jupiter.

It exists to prevent:

- Schema drift
- Category confusion
- Manufacturer misclassification
- String-based model regressions
- Inconsistent lifecycle logic

This document is authoritative.

If future development contradicts this, this document wins.

---

## 2. Asset Hierarchy (Permanent Structure)

Jupiter follows this hierarchy:

Asset Type
    ↓
Manufacturer
    ↓
Model
    ↓
Installed Instance

This structure must never be flattened.

---

## 3. Asset Type (rf_asset_type)

Table: rf_asset_type

Examples:
- AIRCRAFT
- ENGINE
- PROPELLER
- APU
- LANDING_GEAR
- AVIONICS

Rules:

1. Asset Type is reference data.
2. Asset Type is system-seeded.
3. Asset Type is stable.
4. Asset Type defines classification of models.
5. Asset Type does NOT contain business metadata.

Asset Type is structural, not operational.

---

## 4. Manufacturer (Domain Table)

Table: manufacturers

Manufacturer is a business entity, not reference-only data.

Manufacturer supports:

- name
- website
- logo_url
- address fields
- is_active
- updated_at

Rules:

1. Manufacturers are created via application.
2. Manufacturers are not immutable.
3. Manufacturers may be deactivated.
4. Manufacturers belong to one Asset Type.
5. Manufacturers are not system_locked.

Manufacturer is a domain entity.

---

## 5. Model (component_models)

Table: component_models

Model represents a design or product definition.

Model contains:

- manufacturer_id
- asset_type_id
- model_name
- maintenance baseline fields (TBO, etc.)

Rules:

1. Model must reference:
   - manufacturer_id
   - asset_type_id
2. Model defines technical behavior.
3. Model is not free text.
4. Model is selected via dropdown in UI.
5. No entity may use free-text model definitions.

Model is the technical anchor of the system.

---

## 6. Installed Instance

Examples:

- aircraft
- components
- installed engines

Installed instance must:

- Reference model_id (NOT string)
- Capture installation metrics
- Capture lifecycle state
- Be auditable

Installed instance represents a physical asset.

---

## 7. Aircraft Modeling Rules

Aircraft table must:

- NOT store free-text model long-term
- Store model_id referencing component_models
- Use asset_type = AIRCRAFT
- Enforce lifecycle transitions
- Enforce optimistic locking

Aircraft creation must:

- Select asset_type = AIRCRAFT
- Select manufacturer
- Select model
- Not allow arbitrary model strings

---

## 8. Component Modeling Rules

Components must:

- Reference component_models
- Inherit asset_type from model
- Not duplicate manufacturer data
- Not duplicate asset type

Component lifecycle must be separate from model definition.

---

## 9. Forbidden Patterns

The following are permanently forbidden:

- String-based model fields
- Multiple asset category systems
- Manufacturer treated as rf reference table
- Model without manufacturer
- Model without asset type
- Hardcoded asset type logic in controllers
- Lifecycle transitions without audit

---

## 10. UI Enforcement Rules

Dropdown order must be:

1. Asset Type
2. Manufacturer (filtered by asset type)
3. Model (filtered by manufacturer + asset type)

No free text fields for model.

---

## 11. Testing Rules

Integration tests must verify:

- Model_id is required
- Aircraft cannot be created without valid model
- Manufacturer must exist
- Asset type must align
- No orphaned model references

---

## 12. Long-Term Scalability

This structure must support:

- Owner Portal
- Inventory tracking
- Projection engine
- Maintenance scheduling
- Future multi-fleet support

Without redesign.

---

## 13. Stability Clause

This asset modeling structure is locked.

Future AI sessions must not:

- Reinterpret asset type
- Collapse hierarchy
- Introduce polymorphic shortcuts
- Replace model_id with string

Structural discipline is mandatory.

---

End of 10_ASSET_MODELING_RULES Document.
