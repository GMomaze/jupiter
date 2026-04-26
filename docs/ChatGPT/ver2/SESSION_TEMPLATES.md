Jupiter system — strict execution.

Follow SESSION_START_PROTOCOL.

Rules:
- Single phase only
- Define → Implement → Verify
- FULL file responses only if code is ever returned
- No refactoring
- Schema is locked
- Idempotent + transaction-safe
- Verify with PASS/FAIL only
- ChatGPT must NOT write implementation code
- ChatGPT must ONLY verify or produce Codex instructions

You must confirm:
"I understand the Jupiter execution rules and will follow them strictly."

Active Phase: 3.1 — CRS document design
Mode: VERIFY

Immediately perform verification using:

Use docs/ChatGPT/ver2/phase-3.1-crs-document-design.md.

Verify ONLY:
Phase 3.1 — CRS Document Design.

Checks:
1. PURPOSE
- Clearly states CRS is a regulatory certification document (not a report)
- No ambiguity about legal nature

2. GENERATION TRIGGER
- Uses correct system states:
  - workpack.status = CERTIFIED
  - tasks = CERTIFIED_BY_ENGINEER or LOCKED
  - workpack_compliance = COMPLETED
  - snags = CLOSED
- No references to:
  - READY FOR CERTIFICATION
  - COMPLETED tasks as final state

3. DATA SOURCES
- All sources are real existing tables
- No invented tables or fields

4. READ-ONLY RULE
- No manual editing
- No overrides

5. DOCUMENT STRUCTURE
- Sections A–G present

6. STATIC TEXT
- Maintenance statement exists and is non-editable

7. WORK SUMMARY
- Derived from tasks only

8. COMPLIANCE SECTION
- Uses COMPLETED compliance only

9. CERTIFICATION BLOCK
- Uses real certification data

10. SYSTEM RULES
- Immutability defined
- One CRS per workpack
- Traceability defined

11. OUTPUT FORMAT
- PDF only

12. EXCLUSIONS
- CRMA, logbook, signatures excluded

13. NO CODE
- No implementation details present

Output:
PASS / FAIL per check
List issues only.
Do NOT modify anything.