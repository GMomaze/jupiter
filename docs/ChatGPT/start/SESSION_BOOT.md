# SESSION_BOOT.md

Load and strictly follow:

* docs/ChatGPT/start/MASTER_EXECUTION_PLAN.md
* docs/ChatGPT/start/CODEX_EXECUTION_RULES.md
* docs/ChatGPT/start/CURRENT_SYSTEM_ROADMAP.md
* Active phase document

Confirm:

"I understand the Jupiter execution rules and will follow them strictly."

User will provide:

* Active Phase
* Mode

Allowed modes:

* DEFINE
* IMPLEMENT
* VERIFY

# CAPABILITY CHECK (MANDATORY)

Before proposing any phase, implementation, migration, route, service, model, report, workflow, UI, or architecture change:

1. Inspect CURRENT_SYSTEM_ROADMAP.md.

2. Determine whether the capability already exists.

3. Classify:

   * ALREADY_IMPLEMENTED
   * PARTIALLY_IMPLEMENTED
   * NOT_IMPLEMENTED

4. If ALREADY_IMPLEMENTED:

   * STOP.
   * Return evidence.
   * Do not modify files.

5. If PARTIALLY_IMPLEMENTED:

   * Extend existing implementation only.
   * Do not create parallel implementations.

6. If NOT_IMPLEMENTED:

   * Follow the active phase.
   * Implement the smallest safe change.

7. Never recreate capabilities marked:

   * COMPLETE + LOCKED
   * OPERATIONAL AUTHORITY
   * DO NOT RECREATE

# SAFE IMPLEMENTATION BOUNDARY

Unless a phase explicitly states otherwise:

* Existing working functionality must not be broken.
* Existing routes must not be rewritten unnecessarily.
* Existing lifecycle behaviour must not be changed.
* Existing install/remove workflows must not be replaced.
* Existing compliance workflows must not be altered.
* Existing SB applicability workflows must not be altered.
* Existing aircraft views must continue to function.
* Existing workpack functionality must continue to function.
* Existing compatibility layers must remain intact until an approved migration phase exists.

All implementation must be additive where possible.

Before implementing any change:

1. Inspect existing implementation.
2. Determine whether the requested functionality already exists.
3. Reuse existing logic before creating new logic.
4. Extend existing workflows before introducing replacements.
5. Verify no regression to existing functionality.

If a requested change would affect an existing workflow:

STOP

and identify:

* affected files
* affected routes
* affected services
* affected lifecycle behaviour

before implementation proceeds.

# ROADMAP GOVERNANCE

Before starting a phase:

1. Verify the phase exists in:

   * MASTER_EXECUTION_PLAN.md
   * CURRENT_SYSTEM_ROADMAP.md
   * an approved phase document

2. If the phase is not documented:

   STOP

   and identify:

   * roadmap location searched
   * missing phase documentation
   * approval required before proceeding

3. Do not invent new phases without explicit approval.

4. Do not continue migration, retirement, or architectural transition work unless an approved phase exists.

# ROADMAP MAINTENANCE (MANDATORY)

CURRENT_SYSTEM_ROADMAP.md is the authoritative implementation map for Jupiter.

Whenever a phase reaches:

* PASS
* PHASE COMPLETE + LOCKED

the implementation must be reviewed against CURRENT_SYSTEM_ROADMAP.md.

If the phase introduces:

* new capabilities
* new authority boundaries
* new lifecycle rules
* new services
* new modules
* new reports
* new workflows
* new operational constraints

then CURRENT_SYSTEM_ROADMAP.md must be updated before the phase is considered fully complete.

Verification must confirm:

* capability exists in implementation
* capability is documented in CURRENT_SYSTEM_ROADMAP.md
* status is correctly marked:

  * COMPLETE + LOCKED
  * PARTIALLY_IMPLEMENTED
  * DEFINE_ONLY
  * FUTURE

A phase is not fully complete until:

1. Implementation passes.
2. Verification passes.
3. CURRENT_SYSTEM_ROADMAP.md is updated if required.
4. Roadmap verification passes.
5. Roadmap changes are committed.

Lifecycle:

DEFINE
→ IMPLEMENT
→ VERIFY
→ ROADMAP UPDATE
→ ROADMAP VERIFY
→ COMMIT
→ PHASE COMPLETE + LOCKED

# EXECUTION RULES

Rules:

* Single active phase only.
* Do not work outside the active phase.
* Follow DEFINE → IMPLEMENT → VERIFY.
* Do not bypass verification.
* Do not redesign locked architecture.
* Do not refactor unless explicitly approved.
* Do not change schema unless explicitly approved.
* Database is source of truth.
* Backend owns truth.
* Frontend displays backend truth.

# STOP CONDITIONS

STOP and report if:

* Requested functionality already exists.
* Existing implementation is safer.
* Current roadmap conflicts with the request.
* Required files are missing.
* The request duplicates existing capability.
* The request conflicts with CURRENT_SYSTEM_ROADMAP.md.
* The request attempts to replace a COMPLETE + LOCKED subsystem.

If required information is missing:

STOP and ask.
