JUPITER — MASTER EXECUTION PLAN (VER2)

---

# 1. SYSTEM PURPOSE

Jupiter is an aircraft maintenance execution and compliance system.

It must:

* Replace Excel and Word workflows completely
* Track workpacks, tasks, snags, and compliance
* Enforce airworthiness rules
* Generate documents (CRS, CRMA, etc.)
* Be structured for future productisation (multi-AMO)

---

# 2. CORE RULES (MANDATORY)

## 2.1 Execution Discipline

Every change MUST follow:

Define → Implement → Verify

No skipping steps.

---

## 2.2 Phase Isolation

Only ONE phase/sub-phase may be worked on at a time.

Example:

* Allowed: Phase 2.4.1 only
* Not allowed: mixing 2.4.1 + 2.5 changes

---

## 2.3 No Unrequested Changes

Do NOT:

* Refactor unrelated code
* Rename variables
* Improve structure unless explicitly asked
* Add features outside the phase

---

## 2.4 Full File Rule

ALL code responses MUST:

* Return FULL files
* Never return snippets
* Never return partial diffs

---

## 2.5 Read Before Acting

Before coding, ALWAYS read:

docs/ChatGPT/AI_CONTEXT.md
docs/workflows.md
docs/ChatGPT/database.md
docs/ChatGPT/ver2/*

---

## 2.6 Database Authority

The database design in:

docs/ChatGPT/ver2/*.md

is the source of truth.

DO NOT invent fields or tables.

---

## 2.7 No Guessing Schema

If a field is not defined:

* DO NOT create it
* DO NOT probe information_schema
* ASK or defer

---

## 2.8 Idempotency Required

All operations must be safe to run multiple times.

---

## 2.9 Transaction Safety

All write operations must:

* Use existing transactions
* Never introduce partial state

---

## 2.10 Logging vs Breaking

If a non-critical feature fails:

* Log and continue
* Do NOT break core workflow

---

# 3. SYSTEM ARCHITECTURE

Data flow:

compliance_items
→ aircraft_compliance
→ workpack_compliance
→ task_cards
→ execution
→ certification
→ documents

---

# 4. CURRENT IMPLEMENTED PHASES

## Phase 2 — Compliance Engine

### 2.1 Data Model ✅

* compliance_items
* aircraft_compliance
* workpack_compliance

### 2.2 Compliance Service ✅

* getApplicableComplianceForAircraft

### 2.3 Attach to Workpack ✅

* DUE/OVERDUE compliance auto-attached

### 2.4 Compliance Tasks ✅

* task_cards created from compliance
* compliance_item_id linked

### 2.5 Completion Flow ✅

* workpack_compliance → COMPLETED
* aircraft_compliance → COMPLIANT

### 2.6 Enforcement ✅

* Cannot close workpack with incomplete compliance

### 2.7 Summary Query ✅

* getComplianceSummaryForWorkpack

---

# 5. CURRENT LIMITATIONS (KNOWN)

* No recurrence logic yet
* No document integration yet
* No UI for compliance yet
* Compliance data currently seeded manually

---

# 6. NEXT PHASE

## Phase 2.8 — Full Compliance Test

Goal:
Validate entire compliance lifecycle end-to-end.

---

# 7. HOW TO WORK ON A PHASE

For ANY phase:

1. Create phase file:
   docs/ChatGPT/ver2/phase-X.md

2. Define:
   Defined ⬜
   Implemented ⬜
   Verified ⬜

3. Implement ONLY that phase

4. Run verification checklist

5. Only after PASS:
   move to next phase

---

# 8. VERIFICATION STANDARD

Verification MUST include:

* PASS / FAIL per check
* Clear explanation
* No code changes during verification

---

# 9. WHAT IS NOT ALLOWED

* Skipping verification
* Mixing phases
* Changing schema without design update
* Silent logic changes
* Partial file responses
* “Improving” unrelated code

---

# 10. RECOVERY RULE

If system behaves unexpectedly:

1. Stop
2. Check database state
3. Check phase implementation
4. Verify against plan
5. Do NOT patch blindly

---

# 11. FUTURE PHASES (LOCKED ORDER)

Phase 2.8 — Full compliance test
Phase 3 — Document engine
Phase 4 — Data integration cleanup
Phase 5 — UI / workflow improvements
Phase 6 — Productisation prep

---

# 12. FINAL OBJECTIVE

System is complete when:

* No Excel usage required
* No Word usage required
* Full job runs inside Jupiter
* Compliance enforced automatically
* Documents generated from system data
