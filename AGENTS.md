Jupiter Repository Instructions

Before project work, complete this minimal context boot:

1. Read this `/AGENTS.md`.
2. Read `docs/governance/ACTIVE_WORK.md`.
3. For Multi-Tenant SaaS work, read `docs/governance/TENANCY_STATE.md` as
   current-state evidence only.
4. Inspect the current Git HEAD and staged, modified, deleted, and untracked
   working-tree state.
5. Establish the exact current Project Owner instruction and authorized or
   defined task.

Load additional canonical governance and implementation evidence only when the
active task, a direct minimal-boot reference, an authority or safety conflict,
database/schema/migration work, applicable security/tenancy architecture, or a
specific verification boundary requires it.

Use the smallest authoritative and evidentiary context sufficient to perform the approved task safely. Canonical authority does not require all canonical documents to be loaded into every session.

Do not recursively read documents merely because another governance document
lists them. Do not reread already-established current-state evidence unless a
discrepancy or changed evidence requires it.

Non-negotiable rules:

Work only within the explicitly authorised phase or slice.

Establish evidence before changing unfamiliar functionality.

Implementation investigations inspect only files relevant to the approved
slice. Run focused tests first; use broad suites only when the approved
verification boundary or observed risk requires them.

Preserve unrelated and pre-existing user-owned changes. Never clean, revert,
overwrite, stage, or absorb them without explicit authority.

Do not infer current authority from docs/ChatGPT/ver* or other historical
version directories.

Do not read historical or unrelated programme documentation by default.
Read it only when the active task or canonical governance explicitly requires it.

Do not invent architecture, schema, permissions, ownership, or operational
facts.

Do not perform destructive filesystem or database actions without explicit,
target-specific authority and the required safeguards.

Never stage broadly, use git add ., or enable automatic commits.

Scoped staging, commit, push, release, deployment, rollback, and restore require
explicit Project Owner authorization and the applicable verification gate.

Stop and report if canonical documents conflict or scope cannot be proven.

Concise Reporting Rule

Minimize token usage in all AI-assisted work.

For successful DEFINE / IMPLEMENT / VERIFY work, report only:

outcome;

files changed;

compact test/check results;

database/migration result when applicable;

material deviations, limitations, or blockers;

required completion marker.

Do not repeat established governance, unchanged boundaries, preserved
functionality, or requirements already contained in the authorized plan.

PASS reports should normally be 150–300 words maximum.

FAIL reports may include only the additional detail needed to identify the
failure, resulting state, and required next authorization.

Brevity applies to reporting only. Never omit required safety checks,
verification, or evidence collection.
