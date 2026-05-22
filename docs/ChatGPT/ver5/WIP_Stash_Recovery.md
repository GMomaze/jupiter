WIP / STASH RECOVERY RULES

If stash recovery is required:

git switch -c recover/<scope>
git stash apply stash@{0}

Never recover WIP directly onto main.

Recovery order:

aircraft/component
library
workpack/print
middleware/header only if required
deleted seeders last

Always classify:

scoped files
unrelated files
risky files
accidental files

before committing.

VERIFY PHASE RULES

VERIFY means:

inspect only
no fixes
no redesign
no hidden implementation

Required verification style:

PASS / FAIL only
explicit scope validation
unrelated-change detection
operational-boundary validation

If unrelated files exist:
report them explicitly.

IMPLEMENT RULES

IMPLEMENT phases must:

preserve source-of-truth boundaries
preserve lifecycle protections
preserve auditability
preserve operational explainability
preserve existing verified workflows

Do NOT:

widen scope
opportunistically refactor
redesign unrelated systems
silently change schema
silently change lifecycle semantics
DEFINE RULES

DEFINE phases may:

define workflows
define architecture
define lifecycle rules
define operational boundaries
define validation requirements

DEFINE phases may NOT:

implement code
modify schema
refactor systems
redesign locked architecture
RESPONSE RULES

When returning implementation work:

return full modified files only if code requested
otherwise return scoped investigation/verification only

When verifying:

always include:
exact files changed
unrelated files
whether unrelated files were pre-existing dirty worktree files
minimal correction required
CURRENT VERIFIED ARCHITECTURE AREAS

Verified and operational:

Phase 10 lifecycle lock
Phase 14 stabilization boundaries
Phase 17 customer subsystem architecture
Phase 18 compile stabilization
Printed Workpack maturity
Aircraft Technical Dashboard maturity
Installed Component Operational UX
Serialized component foundation
Component maintenance events
Component document architecture
Aircraft screen split
Aircraft technical screen tabs
Baseline capture architecture

These areas are considered operationally protected.

OPERATIONAL PHILOSOPHY

Jupiter is an operational AMO system first.

Priority order:

operational truth
auditability
lifecycle integrity
technical explainability
maintenance authority integrity
usability
aesthetics

Never sacrifice operational truth for UI convenience.

CURRENT DEVELOPMENT DISCIPLINE

The assistant must:

continue from the current active phase
not restart architecture work
not redesign locked systems
not widen stabilization scope
investigate before redefining
preserve verified operational behavior

When a phase completes successfully:

propose the next logical phase
generate the Codex instruction block automatically
unless the user explicitly redirects work
SESSION START REQUIREMENT

At the beginning of every new session:

Load this file first.
Confirm understanding.
Wait for:
Active Phase
Mode

Do not assume the active phase.
Do not continue old work without explicit phase confirmation.