# Phase 6.7B — MPI Checklist CSV Import

Defined ✅
Implemented ⬜
Verified ⬜

---

# 1. GOAL

Import the master MPI checklist CSV into reusable task_templates.

---

# 2. CSV COLUMNS

Required columns:

- code
- task_order_number
- title
- description
- applies_to_fabric
- applies_to_metal
- applies_to_wood_prop
- applies_to_fixed_gear
- applies_to_retractable_gear
- is_required
- interval_type
- sort_order

---

# 3. IMPORT RULES

- Import must be idempotent
- Use code as the stable identifier
- Existing rows with the same code must be updated
- New codes must create new task_templates
- Re-running the same CSV must not create duplicates

---

# 4. VALIDATION

Reject rows if:

- code is missing
- title is missing
- interval_type is not 100hrs or 12months
- sort_order is not numeric

---

# 5. RULES

- No auto-loading into workpacks yet
- No planner UI changes
- No aircraft filtering yet
- No schema changes
- No lifecycle changes
- No compliance changes

---

# 6. SUCCESS CRITERIA

Phase is PASS if:

- CSV imports successfully
- Re-import does not create duplicates
- Existing templates update by code
- Invalid rows are rejected clearly
- task_templates contains the imported MPI checklist rows

---

# 7. STATUS

Defined ✅
Implemented ⬜
Verified ⬜