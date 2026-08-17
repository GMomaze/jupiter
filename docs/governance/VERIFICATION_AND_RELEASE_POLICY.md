# Jupiter Verification and Release Policy

**Document ID:** JUPITER-VERIFICATION-RELEASE-POLICY

**Revision:** 1.0

**Status:** Canonical

**Evidence review:** 2026-08-17

## Verification order

Verification must be proportionate to risk and normally proceeds from narrow to
broad:

1. Inspect the complete scoped diff and affected authority paths.
2. Run focused unit/static tests.
3. Run focused guarded integration tests where authorized.
4. Run typecheck and production build where applicable.
5. Run broader regression and E2E only through the approved isolated test path.
6. Run `git diff --check`.
7. Review changed files for secrets, credentials, generated artifacts, scope
   creep, and accidental user-owned changes.
8. Verify migrations, database state, permissions, and runtime behavior where
   applicable.

Never run a destructive test against development or production. Database-backed
tests must satisfy `DATABASE_AND_MIGRATION_SAFETY.md`.

## Evidence and outcomes

Report exact commands and results, separating pre-existing failures from new
regressions. Allowed outcomes are:

- `PASS` — all approved assertions pass and no material limitation remains.
- `PASS WITH LIMITATIONS` — the approved objective passes, with explicit
  non-material limitations that do not make the result unsafe.
- `FAIL` — an assertion or requirement fails.
- `BLOCKED` — required authority, environment, evidence, or external state is
  unavailable.
- `NOT SAFE TO COMMIT` — work exists but verification, scope, security, data, or
  repository integrity does not support commit preparation.

A material unresolved limitation, regression, permission gap, data-integrity
risk, or unverified destructive boundary cannot be hidden in `PASS`.

## Working-tree and staging policy

- Inventory the baseline and preserve unrelated user-owned changes.
- A dirty worktree is not itself failure.
- Stop before modifying a colliding user-owned file unless approval exists.
- Stage only explicitly reviewed paths or hunks.
- Never use `git add .` or an equivalent broad staging command.
- Never enable automatic commits.
- Confirm `git diff --cached --name-only` contains only approved work.
- Do not delete unrelated untracked artifacts to make status look clean.

## Commit and release authorization

Verification does not authorize a commit. Commit, push, release, deployment,
rollback, or restore each requires explicit authority appropriate to its impact.

Before commit readiness:

- verification outcome is acceptable;
- no unrelated paths are staged;
- documentation and roadmap obligations are satisfied;
- migrations and recovery are verified where relevant;
- commit description does not exaggerate delivered behavior;
- no credential, environment file, dump, checksum, generated report, or local
  tool configuration is unintentionally included.

## Deployment and post-deployment verification

Where deployment is approved:

- verify target, revision, configuration, process, listener, and database before
  mutation;
- follow the canonical database safety policy for schema work;
- stop the exact verified process only when authorized;
- perform only approved non-mutating smoke checks after restart;
- verify expected health, authentication/landing behavior, listener ownership,
  runtime errors, Git state, and migration/audit evidence;
- do not repair a failed production deployment without new authority.

Rollback and restore decisions belong to the Project Owner or the explicitly
designated release authority. A failed deployment must preserve evidence and the
approved safe application state.

## Current CI/release engineering debt

As of the evidence review date:

- CI uses `npm install` rather than reproducible `npm ci`.
- CI runs only `npm run test` and does not provision the documented PostgreSQL
  test environment.
- CI does not run build, lint, E2E, migration, or governance checks.
- The test safety guard should fail closed, but the workflow is incomplete.
- The release workflow runs semantic release on pushes to `main` without an
  explicit dependency on a successful full verification job.
- No canonical automated production deployment/recovery workflow exists.

These are future engineering requirements. This policy does not authorize edits
to CI, release, or deployment workflows.
