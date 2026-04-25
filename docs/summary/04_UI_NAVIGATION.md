# JUPITER – Aircraft Maintenance Management System  
## 04 – UI Navigation Map

---

## 1. Navigation Philosophy

Jupiter follows a structured navigation spine.

Rules:

- Dashboard is the root anchor.
- Every domain must be reachable within 2 clicks.
- No page may become a navigation dead-end.
- Detail views must provide a return path.

---

## 2. Root Level

### `/`
Dashboard

Purpose:
- High-level operational entry point.
- Links to major modules.
- Must remain simple and stable.

---

## 3. Fleet (Aircraft)

### `/aircraft`
Fleet list view.

Displays:
- Registration
- Model
- Serial
- Status
- Total hours

Links:
- Registration → `/aircraft/:registration`
- Add Aircraft → `/aircraft/create`

---

### `/aircraft/:registration`
Aircraft detail page.

Displays:
- Aircraft details
- Installed components
- Component installation form

Navigation:
- Back to Fleet link
- Header always visible

---

## 4. Workpacks

### `/workpacks`
Workpack list view.

Displays:
- Work order number
- Aircraft registration (clickable)
- Status
- Created date

Links:
- Aircraft registration → `/aircraft/:registration`
- Workpack detail → `/workpacks/:id/tasks`
- Planner → `/workpacks/planner`

---

### `/workpacks/:id/tasks`
Workpack detail view.

Purpose:
- Manage tasks
- Transition states
- Execute work

Must:
- Link back to workpack list
- Show aircraft context clearly

---

## 5. Library

### `/library`
Master reference data management.

Includes:
- Manufacturers
- Models
- Requirements

Library is foundational.
It feeds aircraft and workpack logic.

---

## 6. Cross-Module Navigation Rules

Mandatory:

- Workpack must link to Aircraft.
- Aircraft may eventually show active Workpacks.
- Dashboard must link to Fleet and Workpacks.
- Header logo must link to Dashboard.

Forbidden:

- Orphan detail pages.
- Direct linking to deeply nested screens without context.
- Hidden entry points.

---

## 7. Visual Consistency Rules

Every page must:

- Include header
- Include footer
- Use Tailwind styling
- Use consistent spacing and layout structure

No raw fragment rendering for full-page routes.

---

## 8. Future Expansion Zones

Reserved navigation areas:

- Inventory expansion
- Projection dashboards
- QA module
- Reporting module

These must plug into the Dashboard and follow the same structure.

---

End of 04_UI_NAVIGATION Document.
