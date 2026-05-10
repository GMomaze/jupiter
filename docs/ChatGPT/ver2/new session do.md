🔹 STEP 1 — Start with your snippet

In VS Code:

jstart + TAB

Fill it like:

Jupiter system — strict execution.

Follow SESSION_START_PROTOCOL.

Rules:
- Single phase only
- Define → Implement → Verify
- FULL file responses only if code is ever returned
- No refactoring
- No schema changes unless explicitly approved
- Schema is locked
- Idempotent + transaction-safe
- Verify with PASS/FAIL only

Important:
ChatGPT must NOT write implementation code directly.
Codex must be used for implementation.

Active Phase: X.X — <phase name>
Mode: DEFINE
🔹 STEP 2 — Add THIS line (you already do this right)
Follow SESSION_START_PROTOCOL and use Codex for implementation (no direct code).

👉 This is critical. Keep it.

🔹 STEP 3 — Send it

That’s your entire start.

❗ WHAT YOU DO NEXT (THIS IS WHAT YOU WERE MISSING)

After ChatGPT responds:

👉 You must immediately give it the phase doc

Example:

Use docs/ChatGPT/ver2/phase-6.2-snag-suggestion-ui.md

Verify ONLY:
Phase 6.2 — Snag Suggestion UI (Read-Only)

OR for DEFINE:

Create phase-6.2-snag-suggestion-ui.md
🧠 KEY CLARIFICATION

You said:

“You don’t give files anymore”

That’s not fully correct.

✅ You DO give:
Phase instruction (short)
+ reference to the phase .md
❌ You do NOT give:
❌ full database.md
❌ full workflows.md
❌ full master plan
🔥 SIMPLE RULE
New session =
1 prompt (control)
+ 1 instruction (phase)
⚠️ When things go wrong

If ChatGPT:

writes code in DEFINE ❌
skips docs ❌
mixes phases ❌

You reply:

Invalid. Follow SESSION_START_PROTOCOL.
Mode violation.
🚀 IMPLEMENT MODE (important)

When switching:

Active Phase: X.X — <phase>
Mode: IMPLEMENT

Use Codex only. Do not write code.
👍 Bottom line

Your understanding is 90% correct.

Final correction:

You don't paste multiple files
BUT you DO reference the phase .md