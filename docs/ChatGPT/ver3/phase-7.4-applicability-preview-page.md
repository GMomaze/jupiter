# PHASE 7.4 — APPLICABILITY PREVIEW PAGE

Status: Defined ✅

---

## 1. PURPOSE

Provide a **read-only preview page** to visualize the output of the Applicability Engine for a selected aircraft.

This allows validation of:

- AD applicability
- SB applicability
- SID applicability

before any workpack generation logic is introduced.

---

## 2. CORE RULE

READ-ONLY PREVIEW ONLY.

The page must NOT:

- create records
- modify records
- trigger projection
- create compliance_items
- create tasks
- create workpacks

---

## 3. DEPENDENCIES

- Phase 7.3 — Applicability Engine Implementation
- `getApplicabilityForAircraft(aircraftId)`

---

## 4. SCOPE

This phase covers:

- preview route
- controller action
- view rendering

This phase does NOT cover:

- editing
- saving
- workpack generation
- compliance completion
- scheduling logic

---

## 5. ROUTE

Define:

- `GET /aircraft/:id/applicability`

Must:

- accept aircraft ID
- call Applicability Engine
- render results

---

## 6. DATA SOURCE

Only:

- Applicability Engine output

Do NOT query tables directly in the view.

---

## 7. DISPLAY REQUIREMENTS

### A. HEADER

Show:

- Aircraft registration
- Aircraft model
- Aircraft manufacturer (if available)

---

### B. SUMMARY

Show counts:

- total items
- AD count
- SB count
- SID count

---

### C. TABLE / LIST

Each row must display:

- Source Type (AD / SB / SID)
- Reference
- Title
- Description (short)
- Interval (hours / months)
- Applicability Reason
- Source Table
- Projected Compliance (true/false)

---

### D. GROUPING (OPTIONAL BUT PREFERRED)

Group by:

- AD
- SB
- SID

---

### E. EMPTY STATE

If no items:

- “No applicable compliance items found.”

---

## 8. UI RULES

- match existing Jupiter styling
- use simple table or cards
- no destructive actions
- no heavy JS

---

## 9. BOUNDARIES

Must NOT:

- trigger projection
- trigger imports
- modify compliance state
- create workpacks
- create tasks
- write to DB

---

## 10. SUCCESS CRITERIA

PASS if:

- route renders
- Applicability Engine is used
- AD/SB/SID items are visible
- counts are correct
- read-only enforced
- no schema/migration/model changes

---

## 11. FAILURE CONDITIONS

FAIL if:

- page writes to DB
- projection/import triggered
- workpack/task logic added
- engine bypassed
- unrelated modules modified

---

## 12. HANDOFF TO IMPLEMENT

Codex must:

1. Use Applicability Engine
2. Create preview route/controller/view
3. Render read-only output
4. Preserve system boundaries

Return:

- Files checked
- Files created
- Files modified
- Verification results
- PASS/FAIL