# JUPITER — SESSION BOOT (STRICT)

This file is the SINGLE SOURCE OF TRUTH for all new AI sessions.

If a session does NOT follow this file, it is INVALID.

---

# 1. SYSTEM PURPOSE

Jupiter is an aircraft maintenance execution and compliance system for a SMALL AMO.

It must:

- Replace Excel/Word workflows
- Manage workpacks, tasks, snags, compliance
- Enforce airworthiness rules
- Generate regulatory documents (CRS, CRMA)

This is NOT an airline system.
This is NOT an enterprise MRO system.

---

# 2. CORE EXECUTION RULES (NON-NEGOTIABLE)

1. Define → Implement → Verify (NO skipping)
2. Only ONE phase active at a time
3. NO unrequested refactoring
4. NO renaming variables or structures
5. NO adding features outside the phase
6. FULL FILE responses only (no snippets)
7. If information is missing → ASK (DO NOT GUESS)

---

# 3. CURRENT SYSTEM TRUTH (STABILISED)

## 3.1 Task Lifecycle (FINAL)

OPEN
→ IN_PROGRESS
→ COMPLETED_BY_MECHANIC
→ CERTIFIED_BY_ENGINEER
→ LOCKED

Rules:

- LOCKED is valid on task_cards.status
- LOCKED is NOT valid on workpack_executions.status
- Execution status MUST STOP at CERTIFIED_BY_ENGINEER

---

## 3.2 Workpack Completion Rule

A workpack may ONLY be closed if:

- ALL tasks are:
  - CERTIFIED_BY_ENGINEER OR
  - LOCKED

- ALL compliance items are COMPLETED
- ALL snags are CLOSED

---

## 3.3 Execution Model (CRITICAL)

- One task = ONE execution
- attempt_no = ALWAYS 1
- NO retries
- NO multiple attempts

Rules:

- All updates target the SAME execution
- Execution NEVER becomes LOCKED
- LOCKED only applies to task_cards

---

## 3.4 Measurements (SOURCE OF TRUTH)

- workpack_measurements is the ONLY source of truth
- task_cards.work_performed is TEXT ONLY

Rules:

- DO NOT rely on bracketed values
- "[Captured Values]" must be ignored in logic
- PDFs MUST use workpack_measurements

---

## 3.5 Compliance Rules

- Workpack cannot close if any compliance != COMPLETED
- Compliance summary must:
  - include ONLY completed items
  - group by AD and SB

---

## 3.6 Aircraft Integrity Rule

- A task can ONLY be added if:
  task.aircraft_id == workpack.aircraft_id

- Mismatch MUST be blocked

---

# 4. DATABASE REALITY (LOCKED)

- PostgreSQL
- Sequelize ORM (NO KNEX migrations in use)
- UUID primary keys (gen_random_uuid())

Critical tables:

- workpacks
- task_cards
- workpack_tasks
- workpack_executions
- workpack_measurements
- workpack_signatures
- workpack_snags
- workpack_compliance

---

# 5. KNOWN FAILURE MODES (DO NOT REINTRODUCE)

The AI MUST NOT:

- Reintroduce attempt_no > 1 logic
- Use LOCKED in execution status
- Treat COMPLETED as final certification
- Use task_cards.work_performed as structured data
- Ignore compliance when closing workpacks
- Mix phases

---

# 6. REQUIRED BEHAVIOUR

If ANY of the following occurs:

- Missing schema detail
- Missing file context
- Unclear workflow

YOU MUST:

→ STOP
→ REQUEST exact file / schema / clarification

DO NOT GUESS.

---

# 7. SESSION START REQUIREMENT

Every session MUST begin with:

1. Load this file
2. Confirm understanding
3. Wait for:
   Active Phase + Mode

NO WORK may begin before this.

---

# END OF FILE