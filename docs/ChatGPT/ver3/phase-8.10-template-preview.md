# PHASE 8.10 — TEMPLATE PREVIEW

Status: Defined ✅

---

## 1. PURPOSE

Define how users preview a maintenance template and all its included items before any workpack generation exists.

The preview must show what the template contains across:

- Standard Tasks
- AD compliance items
- SB compliance items
- SID source items

---

## 2. CORE PRINCIPLE

Template preview is **read-only**.

It must NOT:

- create workpacks
- create task cards
- create workpack_tasks
- create workpack_executions
- modify template items
- modify compliance state

---

## 3. REQUIRED OUTPUT

Create:

`docs/ChatGPT/ver3/phase-8.10-template-preview.md`

---

## 4. DATA SOURCES

Preview reads from:

- `maintenance_templates`
- `maintenance_template_items`

And resolves item display data from:

- `task_templates`
- `compliance_items`
- `supplemental_inspection_documents`

---

## 5. PREVIEW CONTENT

### A. Template Header

Display:

- template name
- description
- template type
- model
- interval hours
- interval months
- active status

---

### B. Template Items

Display each item with:

- sequence number
- item type
- source reference
- title
- description/summary
- required flag
- notes
- source table

---

## 6. ITEM RESOLUTION RULES

### STANDARD_TASK

- `maintenance_template_items.item_id`
- resolves to:
  - `task_templates.id`

### COMPLIANCE_ITEM

- `maintenance_template_items.item_id`
- resolves to:
  - `compliance_items.id`

Used for:

- AD
- SB

### SID

- `maintenance_template_items.item_id`
- resolves to:
  - `supplemental_inspection_documents.id`

---

## 7. ORDERING RULE

Preview must order items by:

1. `sequence_no`
2. fallback: created order

---

## 8. EMPTY STATE

If template has no items:

`No template items found.`

---

## 9. BOUNDARIES

Preview must NOT:

- add items
- remove items
- reorder items
- create workpacks
- create tasks
- trigger projection
- modify source records

---

## 10. RULES

- DEFINE only
- NO implementation
- NO schema changes
- NO migrations
- NO models
- NO services/controllers/routes/UI changes
- NO workpack/task generation

---

## 11. SUCCESS CRITERIA

PASS if:

- preview flow is defined
- item resolution rules are defined
- display fields are defined
- ordering rule is defined
- read-only boundary is enforced

---

## 12. HANDOFF TO IMPLEMENT

Codex must:

1. Define template preview flow
2. Define item resolution rules
3. Define display requirements
4. Create document only

Return:

- Files checked
- Files created
- Preview design summary
- PASS/FAIL