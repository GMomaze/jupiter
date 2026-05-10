# PHASE 8.9 — ADD SIDs TO TEMPLATE

Status: Defined ✅

---

## 1. PURPOSE

Define how users add **Supplemental Inspection Documents (SIDs)** to a maintenance template.

Templates reference SID source/library records directly because SIDs may not yet be projected into `compliance_items`.

---

## 2. CORE PRINCIPLE

SID template items reference:

- `supplemental_inspection_documents.id`

They must NOT reference:

- AD records
- SB records
- workpacks
- task cards

---

## 3. REQUIRED OUTPUT

Create:

`docs/ChatGPT/ver3/phase-8.9-add-sids-to-template.md`

---

## 4. USER FLOW

### A. Select Template

User selects:

- `maintenance_templates.id`

### B. Search / Browse SIDs

User searches/browses:

- `supplemental_inspection_documents`

Display:

- SID reference
- title
- category
- interval hours/months
- model applicability if available

### C. Add to Template

System creates:

`maintenance_template_items` record:

- `template_id`
- `item_type = SID`
- `item_id = supplemental_inspection_documents.id`
- `sequence_no`
- `is_required`
- `notes`

### D. Remove from Template

System deletes only the corresponding:

- `maintenance_template_items` record

Must NOT affect:

- `supplemental_inspection_documents`
- `sid_model_applicability`

---

## 5. VALIDATION RULES

- `supplemental_inspection_documents.id` must exist
- `template_id` must exist
- `item_type = SID`

---

## 6. DUPLICATE RULE

Prevent duplicate entries:

- same `template_id`
- same `item_type = SID`
- same `item_id`

---

## 7. ORDERING RULE

- `sequence_no` defines order
- if not provided:
  - append to end

Templates must support:

- manual ordering via `sequence_no`
- user-driven reorder capability in a future UI phase

---

## 8. MODEL APPLICABILITY NOTE

- template `model_id` should align with SID model applicability
- SID applicability comes from `sid_model_applicability`
- strict enforcement happens in a later phase

---

## 9. SOURCE RULE

Templates may reference:

- `supplemental_inspection_documents`

Templates must NOT modify:

- `supplemental_inspection_documents`
- `sid_model_applicability`

---

## 10. BOUNDARIES

Must NOT:

- create compliance_items
- trigger projection
- create workpacks
- create task cards
- modify SID source records
- modify SID applicability records

---

## 11. RULES

- DEFINE only
- NO implementation
- NO schema changes
- NO migrations
- NO model changes
- NO services/controllers/routes/UI changes
- NO workpack/task execution logic

---

## 12. SUCCESS CRITERIA

PASS if:

- SID selection flow is defined
- SID source usage is clear
- validation rules are defined
- duplicate prevention is defined
- remove flow is safe
- ordering rule is defined
- boundaries are enforced

---

## 13. FAILURE CONDITIONS

FAIL if:

- SIDs are treated as AD/SB compliance_items in this phase
- SID source/applicability records are modified
- duplicate rules are missing
- validation rules are unclear
- remove flow affects source records
- implementation is attempted

---

## 14. HANDOFF TO IMPLEMENT

Codex must:

1. Define SID selection flow
2. Define insert/remove rules into template items
3. Define validation and duplicate rules
4. Enforce SID source reference usage
5. Create document only

Return:

- Files checked
- Files created
- Design summary
- PASS/FAIL