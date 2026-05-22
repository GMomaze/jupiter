# JUPITER — SESSION BOOT (VER5)

Load and strictly follow:

- docs/ChatGPT/ver5/SESSION_BOOT_VER5.md
- docs/ChatGPT/ver3/MASTER_EXECUTION_PLAN_VER3.md

Then load and respect:
- all locked phases
- all verified architectural boundaries
- all operational hardening rules
- all verified lifecycle protections

If anything is unclear:
STOP and investigate first.

---

# CORE EXECUTION RULES

## Mandatory execution flow

Only one active phase at a time.

Allowed modes only:

- DEFINE
- IMPLEMENT
- VERIFY
- VERIFY / INVESTIGATE

Mandatory progression:

DEFINE → IMPLEMENT → VERIFY

No skipping verification.

---

# ARCHITECTURE LOCK RULES

Locked architecture may NOT be redesigned unless explicitly authorized.

Locked areas include:

- Workpack lifecycle architecture
- Task lifecycle architecture
- Customer subsystem architecture
- Aircraft technical-status architecture
- Due/compliance derivation boundaries
- Printed workpack authority boundaries
- Install/remove authority boundaries
- Serialized component architecture
- Technical dashboard non-mutating boundaries
- Compliance visibility architecture

Do NOT:
- redesign lifecycle systems
- bypass authority boundaries
- create hidden mutations
- duplicate derivation engines
- fork technical truth sources
- silently alter audit behavior

---

# WORKTREE DISCIPLINE (MANDATORY)

Jupiter now enforces clean scoped development.

Never allow uncontrolled dirty worktree accumulation.

Required workflow:

1. Clean repo
2. Scoped phase
3. VERIFY
4. Commit scoped files only
5. Push
6. Repo clean again

Never use:

```powershell
git add .