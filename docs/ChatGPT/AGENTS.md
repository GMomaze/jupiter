# Jupiter Codex Instructions

You are assisting on an existing production codebase.

---

## SYSTEM EXECUTION RULES (CRITICAL)

You MUST follow:

- Single phase only
- Define → Implement → Verify
- FULL file responses only
- No refactoring
- No renaming
- No schema changes unless explicitly approved
- Idempotent + transaction-safe
- Do not guess missing data
- Ask for context if unsure

---

## PHASE DISCIPLINE

- Only execute the requested phase
- Do NOT move to another phase
- Do NOT combine phases
- Do NOT introduce future-phase logic

---

## IMPLEMENTATION RULES

- Only modify requested files
- Do NOT touch unrelated files
- Do NOT introduce logic outside scope
- Keep changes minimal and precise

---

## VERIFICATION RULES

- PASS / FAIL only
- No code during verification
- Report issues only

---

## PROJECT GOAL

Jupiter is an aircraft maintenance/workpack system for small AMO-style businesses.

The system must be:
- stable
- predictable
- safe to modify
- operationally useful

---

## TECH STACK

- Node.js
- TypeScript
- Express
- Sequelize
- PostgreSQL
- EJS
- PDFKit
- Playwright
- Database name: jupiter_db

---

## WORKING RULES

Before changing code:
- Inspect the relevant existing files first
- Understand the current flow before editing
- Prefer the smallest safe change
- Do NOT refactor unless explicitly requested
- Do NOT remove existing functionality
- Do NOT rename variables, routes, tables, or files unless required
- Preserve formatting and comments

---

## CODE OUTPUT RULES

When modifying code:
- Return FULL file only
- Label every file with full path
- Do NOT return snippets
- If file is too large, warn before truncation

---

## SAFETY RULES

Do NOT guess:
- database table names
- view variables
- PDF coordinates

Always check:
- migrations
- models
- routes
- controllers

---

## PDF RULES (IMPORTANT)

- Do NOT change layout unless explicitly requested
- Do NOT hardcode values unless instructed
- Do NOT mix document types (CRS vs CRMA)

---

## TESTING RULES

After changes, suggest minimal test:

- npm run dev
- npm run test:e2e
- npx playwright test
- npx tsx scripts/test-*.ts

---

## SYSTEM CONTEXT

- Workpack-driven system
- Task lifecycle enforced
- Compliance enforcement active
- Snag lifecycle being introduced
- Documents (CRS/CRMA) are separate concerns

---

## DOCUMENT SOURCE OF TRUTH

Always follow:

docs/ChatGPT/ver2/