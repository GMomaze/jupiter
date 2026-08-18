# Jupiter Verification and Release Policy

**Document ID:** JUPITER-VERIFICATION-RELEASE-POLICY

**Revision:** 1.1

**Status:** Canonical

**Effective date:** 2026-08-18

## Scope

This policy governs formal verification, commit readiness, staging, release,
deployment, rollback, restore, and post-deployment verification.

Verification must be proportionate to the approved change and its actual risk.

Do not run unrelated tests, inspect unrelated domains, or load unrelated
historical evidence merely to complete a verification checklist.

## Verification order

Verification normally proceeds from narrow to broad:

1. Inspect the complete scoped diff and affected authority paths.
2. Run the smallest focused static/unit checks that prove the changed behavior.
3. Run focused guarded integration/database tests where the change requires
   them and execution is authorized.
4. Run typecheck and production build where materially applicable.
5. Run broader regression or E2E testing when required by the affected
   operational boundary, approved phase, or regression risk.
6. Run applicable scoped Git/whitespace checks.
7. Review changed files for secrets, credentials, generated artifacts, scope
   creep, and accidental user-owned changes.
8. Verify migrations, database state, permissions, isolation, and runtime
   behavior only where applicable.

Broader verification is required when focused evidence cannot establish that
the approved change is safe.

Never run a destructive test against development or production.

Database-backed tests must satisfy
`DATABASE_AND_MIGRATION_SAFETY.md`.

## Existing-functionality regression boundary

Existing working Jupiter functionality affected by a change must remain
operational unless its modification is explicitly approved.

Verification must test both:

- the newly approved behavior; and
- materially affected existing behavior.

A new capability is not successfully verified merely because its own tests pass
if it causes a material regression in existing Jupiter functionality.

For future SaaS / Multi-Tenant work, applicable verification must establish both:

- the approved tenant-isolation behavior; and
- preservation of the existing Jupiter operational behavior affected by the
  conversion slice.

Do not require unrelated full-system regression testing when the approved
evidence demonstrates that a domain cannot reasonably be affected.

## Evidence and outcomes

Record the commands/checks necessary to make the result reproducible and report
their material results.

Do not reproduce large unchanged command output unless needed to explain a
failure or limitation.

Separate pre-existing failures from regressions caused by the current work.

Allowed outcomes are:

- `PASS` — all approved assertions pass and no material limitation remains.
- `PASS WITH LIMITATIONS` — the approved objective passes with explicit
  non-material limitations that do not make the result unsafe.
- `FAIL` — an approved assertion or requirement fails.
- `BLOCKED` — required authority, environment, evidence, or external state is
  unavailable.
- `NOT SAFE TO COMMIT` — work exists but verification, scope, security, data, or
  repository integrity does not support commit preparation.

A material unresolved limitation, regression, permission gap, isolation failure,
data-integrity risk, or unverified destructive boundary cannot be hidden in
`PASS`.

## Working-tree and staging policy

- Inventory the applicable baseline and preserve unrelated user-owned changes.
- A dirty worktree is not itself failure.
- Stop before modifying a colliding user-owned file unless approval exists.
- Stage only explicitly reviewed paths or hunks.
- Never use `git add .` or an equivalent broad staging command.
- Never enable automatic commits.
- Confirm the staged manifest contains only explicitly approved work before
  commit.
- Do not delete unrelated untracked artifacts merely to make repository status
  appear clean.

## Commit authorization

Verification does not authorize a commit.

Commit and push each require explicit Project Owner authorization.

Before commit readiness establish, as applicable:

- acceptable verification outcome;
- approved staged manifest;
- absence of unrelated staged paths;
- required documentation/current-state reconciliation;
- migration and recovery verification where relevant;
- accurate commit description;
- absence of unintentionally included credentials, environment files, dumps,
  checksums, generated reports, or local tool configuration.

Commit preparation should inspect the scoped staged change, not unrelated
worktree content except where required to prove separation.

## Release and deployment authorization

Release, deployment, rollback, and restore require explicit authority
appropriate to their impact.

Where deployment is approved:

- verify the exact target and approved revision;
- verify applicable configuration, process, listener, and database state;
- follow the canonical database safety policy for schema work;
- stop a process only when the exact target and operation are authorized;
- perform only the required post-change smoke and operational checks;
- preserve evidence on failure;
- do not improvise production repair, rollback, or restore.

Rollback and restore decisions belong to the Project Owner or explicitly
designated release authority.

A failed deployment must preserve evidence and the approved safe application
state.

## Context-efficiency rule

Reading this policy does not require full-system verification.

Select verification from the actual affected boundaries and approved phase.

Do not by default:

- run every test suite;
- run E2E for a documentation-only change;
- inspect database state for work with no database effect;
- load historical verification reports;
- load CI/release history;
- reproduce large successful command outputs;
- repeat governance or task instructions in the verification report.

Escalate from focused to broader verification only when risk, evidence, the
approved plan, or a failed check requires it.

## CI and release engineering

Current CI/release capability and deficiencies are implementation evidence, not
permanent policy.

Investigate current CI/release configuration when an authorized CI, release, or
deployment task requires it.

Do not infer current CI/release state from historical evidence in this policy.

Changes to CI, release, or deployment workflows require their own applicable
authorization.