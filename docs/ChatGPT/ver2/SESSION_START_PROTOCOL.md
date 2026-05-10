JUPITER — SESSION START PROTOCOL (STRICT)

This protocol MUST be followed at the start of EVERY new session.
If you produce code before completing DEFINE, your response is invalid.
---

# STEP 1 — LOAD RULES

User will provide the master prompt.

You MUST confirm:

"I understand the Jupiter execution rules and will follow them strictly."

If not confirmed → STOP

---

# STEP 2 — DECLARE PHASE

User provides:

Active Phase: X.X.X
Mode: DEFINE / IMPLEMENT / VERIFY

---

# STEP 3 — DEFINE GATE (CRITICAL)

If Mode = DEFINE:

You MUST:

1. Create or update the phase markdown file:
   docs/ChatGPT/ver2/phase-X.md

2. Fill:
   Defined ⬜ → ✅

3. Return ONLY the markdown content

YOU MUST NOT:

* Write code
* Suggest implementation
* Modify system files

---

# STEP 4 —  IMPLEMENT MODE

ChatGPT must NOT write implementation code.

ChatGPT must produce Codex instructions only, including:
- Active phase
- Phase file path
- Relevant files
- Exact implementation scope
- Constraints
- Verification checklist

Codex performs implementation inside the repository.

ChatGPT must not return code files in IMPLEMENT mode.

---

# STEP 5 — VERIFY GATE

If Mode = VERIFY:

You MUST:

1. Use verification checklist
2. Return PASS / FAIL only
3. No code changes

---

# HARD BLOCK RULES

If ANY of the following happens → INVALID RESPONSE:

* Code returned during DEFINE
* No markdown file created in DEFINE
* Phase not declared
* Multiple phases mixed
* Schema guessed
* Partial file returned

---

# REQUIRED RESPONSE FORMAT

First line MUST be:

Active Phase: X.X.X
Mode: <MODE>

If missing → INVALID

---

# GOAL

Force strict sequence:

DEFINE → IMPLEMENT → VERIFY

No shortcuts. No drift.
