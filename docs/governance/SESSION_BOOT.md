# Jupiter Mandatory Session Boot

**Document ID:** JUPITER-SESSION-BOOT

**Revision:** 1.1

**Status:** Canonical

**Effective date:** 2026-08-18

Complete the minimum canonical boot before performing project work.

## Mandatory boot

1. Read repository-root [`AGENTS.md`](../../AGENTS.md).
2. Read [`GOVERNANCE_INDEX.md`](GOVERNANCE_INDEX.md).
3. Read [`JUPITER_AI_DEVELOPMENT_CONSTITUTION.md`](JUPITER_AI_DEVELOPMENT_CONSTITUTION.md).
4. Record repository path, branch, HEAD, staged state, modified files, and
   untracked files.
5. Identify pre-existing/user-owned work and any overlap with the requested task.
6. Read [`ACTIVE_WORK.md`](ACTIVE_WORK.md).
7. Read only the exact active approved programme/phase/slice plan required for
   the task and the current Project Owner instruction.
8. Establish the authorized phase/slice, mode, scope, expected files, protected
   overlaps, and verification boundary.
9. Stop if authority, scope, target, or safe execution cannot be established.

## Conditional context

Do not load additional governance, historical, domain, database, source, or test
material by default.

Read additional material only when it is necessary for the authorized task.

Read [`MASTER_EXECUTION_PLAN.md`](MASTER_EXECUTION_PLAN.md) only when the task
requires programme sequencing, master-plan authority, or resolution of an
authority ambiguity.

Read [`CURRENT_SYSTEM_ROADMAP.md`](CURRENT_SYSTEM_ROADMAP.md) only when the task
requires system maturity/status evidence, roadmap reconciliation, programme
transition, or historical capability context.

Read [`DATABASE_AND_MIGRATION_SAFETY.md`](DATABASE_AND_MIGRATION_SAFETY.md)
before database mutation, migration, seeding, reset, restore, or other
database-sensitive work.

Read [`VERIFICATION_AND_RELEASE_POLICY.md`](VERIFICATION_AND_RELEASE_POLICY.md)
when the authorized task involves formal verification, staging, commit, push,
release, deployment, rollback, or restore.

Inspect source, models, migrations, tests, database catalog, runtime evidence,
or domain documentation only to the extent required to establish evidence for
the authorized task.

## Context-efficiency rule

Use the smallest evidence set sufficient to perform the authorized task safely.

Do not:

- read the entire documentation tree;
- recursively inspect historical `docs/ChatGPT/ver*` directories;
- load unrelated feature plans;
- load unrelated source domains;
- repeat canonical governance text in reports;
- reopen evidence already established in the active approved phase unless the
  task requires re-verification or the evidence may have changed.

Historical documents are evidence only and are read only when explicitly
required by the active task or canonical governance.

## Destructive-operation gate

Before any potentially destructive command, confirm:

- explicit authority;
- exact target;
- safe command;
- applicable environment/database safeguards;
- backup or recovery requirement;
- stop conditions.

Apply the canonical database and verification policies when relevant.

## Before implementation

Before changing code, establish:

- active phase/slice;
- authorized mode;
- existing-functionality classification;
- expected files;
- user-owned/pre-existing overlaps;
- verification boundary.

Existing working Jupiter functionality must be preserved unless a specific
change to that behaviour has been separately investigated, defined, approved,
and authorized.

Stop if the requested change would unexpectedly damage or alter existing
functionality.