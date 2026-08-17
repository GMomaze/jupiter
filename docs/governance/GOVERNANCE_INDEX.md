# Jupiter Governance Index

**Document ID:** JUPITER-GOVERNANCE-INDEX

**Revision:** 1.0

**Status:** Canonical

**Effective date:** 2026-08-17

## Mandatory authority chain

A fresh session reads these documents in order:

1. [`/AGENTS.md`](../../AGENTS.md) — repository entry and non-negotiable rules.
2. [`JUPITER_AI_DEVELOPMENT_CONSTITUTION.md`](JUPITER_AI_DEVELOPMENT_CONSTITUTION.md) — stable engineering and safety principles.
3. [`SESSION_BOOT.md`](SESSION_BOOT.md) — deterministic session startup.
4. [`MASTER_EXECUTION_PLAN.md`](MASTER_EXECUTION_PLAN.md) — programme execution discipline.
5. [`CURRENT_SYSTEM_ROADMAP.md`](CURRENT_SYSTEM_ROADMAP.md) — evidence-based implementation state.
6. [`ACTIVE_WORK.md`](ACTIVE_WORK.md) — the single active/paused work registry.
7. The exact approved feature or phase plan named by `ACTIVE_WORK.md` or the Project Owner.
8. Applicable implementation evidence: source, migrations, tests, database catalog, and runtime state.

Database work must additionally follow
[`DATABASE_AND_MIGRATION_SAFETY.md`](DATABASE_AND_MIGRATION_SAFETY.md). Verification,
staging, commit, release, and deployment work must follow
[`VERIFICATION_AND_RELEASE_POLICY.md`](VERIFICATION_AND_RELEASE_POLICY.md).

## Authority hierarchy

From highest to lowest:

1. Platform and safety constraints that cannot be overridden by repository text.
2. Explicit current Project Owner instruction.
3. This canonical governance set.
4. The active approved feature/phase plan.
5. Approved implementation specifications.
6. Current implementation and objective evidence as facts to reconcile with documentation.
7. Historical documentation and general recommendations.

An owner instruction may select or authorise work, but ambiguity never authorises
a destructive action. Conflicts must be reported before work continues.

## Document responsibilities

| Document | Responsibility |
|---|---|
| Constitution | Stable global engineering rules |
| Session Boot | Mandatory startup and authority confirmation |
| Master Execution Plan | Programme lifecycle and phase discipline |
| Current System Roadmap | Current capability, maturity, and authority evidence |
| Active Work | One concise registry of current and paused work |
| Database Safety | Test, migration, production, backup, and credential safeguards |
| Verification Policy | Verification, staging, commit, release, and recovery rules |
| Supersession Register | Classification of historical and compatibility documents |

## Historical documents

Directories named `ver2`, `ver2.1`, `ver3`, `ver5`, `ver6`, or `ver7` do not
derive authority from their version numbers. They preserve programme history,
domain decisions, and verification evidence. Their global boot and governance
instructions are superseded as recorded in
[`SUPERSESSION_REGISTER.md`](SUPERSESSION_REGISTER.md).

Historical material may be consulted for evidence, but it cannot override this
canonical set or establish the active phase.

## Feature-plan authority

A feature plan controls only its stated domain and only while explicitly
approved. Words such as “authoritative” inside a feature document mean
authoritative for that approved feature boundary, not global governance.

Untracked documents are drafts or local evidence unless the Project Owner has
explicitly approved them for inclusion. Inclusion in an eventual scoped commit
establishes repository provenance; it does not retroactively authorise work.

## Active-work and supersession mechanisms

`ACTIVE_WORK.md` is the sole canonical work-status registry. Old boots, roadmaps,
chat prompts, and feature documents must not independently declare the current
phase.

`SUPERSESSION_REGISTER.md` records replacements and historical classifications.
No document is considered superseded merely because another has a larger version
number.
