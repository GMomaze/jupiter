# PHASE 0.1 — CONFIRM TOOL ROLES

Status: Defined ✅

---

## 1. PURPOSE

Establish strict, non-negotiable role boundaries between:

- ChatGPT (Design + Verification)
- Codex (Implementation + Code Inspection)
- User (Authority + Input + Approval)

This phase prevents:

- Session drift
- Reinvention
- Uncontrolled code changes
- Conflicting implementations

---

## 2. ROLE DEFINITIONS

### 2.1 ChatGPT (THIS SYSTEM)

Responsibilities:

- [ ] Produce phase design documents
- [ ] Break work into granular, executable steps
- [ ] Define:
  - data structures
  - flow logic
  - constraints
  - validation rules
- [ ] Produce **Codex Instructions** (clear, limited scope)
- [ ] Perform VERIFY phase checks
- [ ] Enforce:
  - single phase execution
  - DEFINE → IMPLEMENT → VERIFY order

Strictly NOT allowed:

- [ ] Write implementation code during DEFINE
- [ ] Modify files directly
- [ ] Assume schema without verification
- [ ] Combine multiple phases
- [ ] Refactor outside scope
- [ ] Delete or replace files

---

### 2.2 Codex

Responsibilities:

- [ ] Inspect current codebase
- [ ] Inspect existing migrations before creating new ones
- [ ] Implement ONLY the approved phase
- [ ] Respect:
  - existing structure
  - existing naming
  - existing logic unless instructed otherwise
- [ ] Ensure:
  - idempotent migrations
  - transaction safety where required
- [ ] Report:

  For every implementation:

  - [ ] Files created
  - [ ] Files modified
  - [ ] Files deleted (must be explicitly approved)
  - [ ] Migrations added
  - [ ] Migrations reused

Strictly NOT allowed:

- [ ] Implement beyond current phase
- [ ] Refactor unrelated code
- [ ] Rename existing structures
- [ ] Delete files without explicit approval
- [ ] Create duplicate tables without checking existing schema
- [ ] Introduce new architecture patterns not defined in phase

---

### 2.3 User (YOU)

Responsibilities:

- [ ] Provide:
  - CSV formats
  - Excel structures
  - real-world workflow clarification
- [ ] Approve:
  - schema changes
  - migrations
  - file removals
  - structural decisions
- [ ] Decide:
  - aviation-specific rules
  - ambiguous applicability logic
- [ ] Trigger each phase

Authority:

- [ ] Final decision maker on:
  - system behavior
  - data structure
  - workflow logic

---

## 3. EXECUTION CONTRACT

Every phase MUST follow:

```text
DEFINE → IMPLEMENT → VERIFY