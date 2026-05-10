# Phase 6.7 — MPI Checklist CSV Import and Aircraft Applicability

Defined ✅
Implemented ✅
Verified ✅

---

# 1. GOAL

Define how a master MPI checklist CSV is imported once and used to automatically load applicable tasks into MPI workpacks for each aircraft.

---

# 2. CSV STRUCTURE

The system must accept a CSV with the following columns:

- code
- task_order_number
- title
- description
- applies_to_fabric (boolean)
- applies_to_metal (boolean)
- applies_to_wood_prop (boolean)
- applies_to_fixed_gear (boolean)
- applies_to_retractable_gear (boolean)
- is_required (boolean)
- interval_type (100hrs | 12months)
- sort_order (integer)

---

# 3. TASK TEMPLATE CREATION

Each CSV row creates a reusable MPI task template.

These templates are NOT tied to a specific workpack.

---

# 4. AIRCRAFT APPLICABILITY MODEL

Each aircraft must define:

- structure_type: fabric | metal
- propeller_type: wood | other
- gear_type: fixed | retractable

---

# 5. APPLICABILITY RULES

A checklist task is applicable if:

- structure_type matches applies_to_fabric / applies_to_metal
- propeller_type matches applies_to_wood_prop
- gear_type matches applies_to_fixed_gear / applies_to_retractable_gear

Non-applicable tasks must NOT be added to workpacks.

---

# 6. WORKPACK BEHAVIOUR

When creating an MPI workpack:

- System automatically selects all applicable checklist templates
- Creates task_cards from those templates
- Orders tasks using sort_order

---

# 7. RULES

- No manual selection required for standard MPI tasks
- No non-applicable tasks added
- No planner interaction required for standard checklist loading
- No schema overengineering

---

# 8. SUCCESS CRITERIA

Phase is PASS if:

- CSV imports correctly
- Aircraft applicability filters tasks correctly
- MPI workpack auto-loads correct tasks
- Tasks appear in correct order
- No irrelevant tasks appear

---

# 9. STATUS

Defined ✅
Implemented ✅
Verified ✅
