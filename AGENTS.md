# Jupiter Repository Instructions

Before working in this repository, follow the canonical governance chain in
[`docs/governance/GOVERNANCE_INDEX.md`](docs/governance/GOVERNANCE_INDEX.md).
Complete the mandatory boot in [`docs/governance/SESSION_BOOT.md`](docs/governance/SESSION_BOOT.md)
before investigating, defining, implementing, or verifying work.

Non-negotiable rules:

- Work only within the explicitly authorised phase or slice.
- Establish evidence before changing unfamiliar functionality.
- Preserve unrelated and pre-existing user-owned changes. Never clean, revert,
  overwrite, stage, or absorb them without explicit authority.
- Do not infer current authority from `docs/ChatGPT/ver*` or other historical
  version directories.
- Do not read historical or unrelated programme documentation by default.
  Read it only when the active task or canonical governance explicitly requires it.
- Do not invent architecture, schema, permissions, ownership, or operational
  facts.
- Do not perform destructive filesystem or database actions without explicit,
  target-specific authority and the required safeguards.
- Never stage broadly, use `git add .`, or enable automatic commits.
- Scoped staging, commit, push, release, deployment, rollback, and restore require
  explicit Project Owner authorization and the applicable verification gate.
- Stop and report if canonical documents conflict or scope cannot be proven.