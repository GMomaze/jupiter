# Jupiter Governance Index

**Document ID:** JUPITER-GOVERNANCE-INDEX

**Revision:** 1.1

**Status:** Canonical

**Effective date:** 2026-08-18

## Minimum mandatory authority chain

A fresh session reads only the minimum canonical context required to establish
authority and current work:

1. [`/AGENTS.md`](../../AGENTS.md) — repository entry and non-negotiable rules.
2. [`JUPITER_AI_DEVELOPMENT_CONSTITUTION.md`](JUPITER_AI_DEVELOPMENT_CONSTITUTION.md)
   — stable engineering and safety principles.
3. [`SESSION_BOOT.md`](SESSION_BOOT.md) — minimum session startup and worktree
   safety checks.
4. [`ACTIVE_WORK.md`](ACTIVE_WORK.md) — the single current/paused work registry.
5. The exact approved programme, feature, phase, or slice plan required for the
   current task.

Do not load unrelated governance, programme, feature, domain, or historical
documents by default.

## Conditional authority documents

The following documents remain canonical but are loaded only when relevant to
the authorized task.

### Master Execution Plan

Read [`MASTER_EXECUTION_PLAN.md`](MASTER_EXECUTION_PLAN.md) when the task
requires:

- programme lifecycle or sequencing;
- phase-transition authority;
- execution-discipline interpretation;
- resolution of an authority ambiguity.

### Current System Roadmap

Read [`CURRENT_SYSTEM_ROADMAP.md`](CURRENT_SYSTEM_ROADMAP.md) when the task
requires:

- current capability or maturity evidence;
- roadmap reconciliation;
- programme transition;
- historical implementation-state context.

### Database and Migration Safety

Read
[`DATABASE_AND_MIGRATION_SAFETY.md`](DATABASE_AND_MIGRATION_SAFETY.md)
before database mutation, migration, seeding, reset, restore, or other
database-sensitive work.

### Verification and Release Policy

Read
[`VERIFICATION_AND_RELEASE_POLICY.md`](VERIFICATION_AND_RELEASE_POLICY.md)
when the authorized task involves formal verification, staging, commit, push,
release, deployment, rollback, or restore.

### Supersession Register

Read [`SUPERSESSION_REGISTER.md`](SUPERSESSION_REGISTER.md) when historical
authority, supersession, compatibility documentation, or conflicting legacy
instructions must be resolved.

## Implementation evidence

Source, models, migrations, tests, database catalog, runtime state, and domain
documentation are evidence, not mandatory boot material.

Inspect only the evidence required for the authorized task.

Do not inspect unrelated application domains merely to complete session boot.

## Authority hierarchy

From highest to lowest:

1. Platform and safety constraints that cannot be overridden by repository text.
2. Explicit current Project Owner instruction.
3. This canonical governance set.
4. The active approved programme/feature/phase/slice plan.
5. Approved implementation specifications.
6. Current implementation and objective evidence as facts to reconcile with
   documentation.
7. Historical documentation and general recommendations.

An owner instruction may select or authorize work, but ambiguity never
authorizes a destructive action.

Conflicts must be reported before work continues.

## Document responsibilities

| Document | Responsibility | Default loading |
|---|---|---|
| Constitution | Stable global engineering and safety rules | Mandatory |
| Session Boot | Minimum startup and authority confirmation | Mandatory |
| Active Work | Concise registry of current and paused work | Mandatory |
| Active Plan | Exact approved task/programme boundary | Mandatory when applicable |
| Master Execution Plan | Programme lifecycle and phase discipline | Conditional |
| Current System Roadmap | Capability, maturity, and implementation-state evidence | Conditional |
| Database Safety | Database, migration, backup, and credential safeguards | Conditional |
| Verification Policy | Verification, staging, commit, release, and recovery rules | Conditional |
| Supersession Register | Historical and compatibility classification | Conditional |

## Context-efficiency rule

Use the smallest authoritative and evidentiary context sufficient to perform
the approved task safely.

Do not by default:

- read the entire documentation tree;
- recursively inspect `docs/ChatGPT/ver*`;
- load unrelated feature plans;
- load unrelated application domains;
- load the Master Execution Plan when programme sequencing is irrelevant;
- load the Current System Roadmap when maturity/history is irrelevant;
- load database policy for work with no database effect;
- load release policy for work with no verification/staging/release operation;
- reopen historical evidence already resolved by an approved active plan unless
  re-verification is required.

Do not repeat canonical governance text in task reports. Report decisions,
evidence, changes, verification results, blockers, and next gate only.

## Historical documents

Directories named `ver2`, `ver2.1`, `ver3`, `ver5`, `ver6`, or `ver7` do not
derive authority from their version numbers.

They preserve programme history, domain decisions, and verification evidence.

Historical material is not part of the default boot.

Read it only when the active task or canonical governance explicitly requires
historical evidence.

Historical material cannot override the canonical governance set or establish
the active phase.

## Feature-plan authority

A feature plan controls only its stated domain and only while explicitly
approved.

Words such as `authoritative` inside a feature document mean authoritative for
that approved feature boundary, not global governance.

Untracked documents are drafts or local evidence unless the Project Owner has
explicitly approved them.

Repository provenance does not independently authorize work.

## Active-work and supersession mechanisms

`ACTIVE_WORK.md` is the sole canonical work-status registry.

Old boots, roadmaps, chat prompts, and feature documents must not independently
declare the current phase.

`SUPERSESSION_REGISTER.md` records replacements and historical classifications.

No document is considered superseded merely because another has a larger
version number.