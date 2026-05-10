# AI_CONTEXT.md - Jupiter Maintenance System

## 1. System Overview

Jupiter is a TypeScript Express aircraft maintenance management system for a real maintenance operation.

It is a monolithic server-rendered application built around:

- authenticated operational workflows
- master maintenance source data
- applicability resolution
- template-driven workpack generation
- controlled execution
- regulated document output
- controlled planning
- bounded customer visibility

Jupiter is not a generic airline platform and is not a loose work-order tracker.

Jupiter is a controlled maintenance workflow system with locked operational rules.

## 2. Source Of Truth

Workpacks are not the source of truth.

The source of truth is:

- Standard Tasks
- ADs
- SBs
- SIDs
- Applicability
- Templates

Workpacks are generated operational outputs derived from those sources.

Execution must not redefine master maintenance truth.

## 3. Core Runtime Architecture

Current core runtime structure:

- `src/app.ts`: Express composition root, middleware stack, route mounting, session, CSRF, rate limiting
- `src/server.ts`: startup, DB connectivity checks, session table verification, cron boot
- `src/config/database.ts`: PostgreSQL pool and Sequelize connection
- `src/models/index.ts`: model export surface
- `src/models/associations.ts`: Sequelize relationship registration
- `src/views/**`: EJS server-rendered UI
- `src/modules/**`: feature modules

Active routed modules mounted in `src/app.ts`:

- `/auth`
- `/auth/staff`
- `/library`
- `/service-bulletins`
- `/sb`
- `/aircraft`
- `/projection`
- `/reference`
- `/workpacks`
- `/inventory`
- `/audit`

## 4. Current Tech Stack

Backend:

- Node.js
- TypeScript
- Express

Database:

- PostgreSQL

ORM / Data Access:

- Sequelize model layer is the active application ORM surface
- PostgreSQL pool queries are also used in parts of the codebase

Frontend:

- EJS
- Tailwind CSS
- HTMX

Authentication:

- Passport
- session-based auth
- `connect-pg-simple` session storage

Document Generation:

- PDFKit for active workpack document generation

## 5. Major Domain Boundaries

Jupiter is organized into the following functional boundaries:

- Master Library
- Applicability
- Templates
- Workpack Generation
- Execution
- Documents
- Planning
- Customer Visibility
- Cleanup and System Lock documentation control

These boundaries must remain explicit.

## 6. Workpack Domain

A workpack is a generated operational maintenance package for a specific aircraft.

A workpack:

- is not source truth
- belongs to an aircraft
- contains generated tasks
- has execution state
- has compliance state
- may have snags
- may generate regulatory documents

The workpack system is one of the largest modules in the repository and is a high-regression area.

## 7. Locked Workpack Lifecycle

The workpack lifecycle is locked.

Current verified lifecycle states:

- `DRAFT`
- `ISSUED`
- `IN_PROGRESS`
- `CERTIFIED`
- `CLOSED`

Locked rules:

- workpack close is gated
- workpack certification is gated
- `CLOSED` is terminal and immutable in practice
- close must not happen early

Workpack close requires the locked completion rules to pass.

## 8. Locked Task Lifecycle

The task lifecycle is locked.

Current verified task states:

- `OPEN`
- `IN_PROGRESS`
- `COMPLETED_BY_MECHANIC`
- `CERTIFIED_BY_ENGINEER`
- `LOCKED`

Locked rules:

- only engineers certify tasks
- `LOCKED` means immutable
- locked tasks must reject invalid edits and state changes
- execution UI must not offer illegal actions

## 9. Locked Execution Rules

Execution rules are locked.

Important execution invariants:

- no invalid state transitions
- execution data must remain consistent with task state
- close and certification gates must be enforced
- execution actions must remain role-controlled

Execution must remain separate from planning.

Planning must not automatically trigger execution.

## 10. Snag System

The snag system is implemented and locked by verified Phase 11 behavior.

Snag lifecycle:

- `OPEN`
- `IN_PROGRESS`
- `RESOLVED`
- `CLOSED`

Locked rules:

- snags are separate from tasks
- snags appear in operational workpack context
- open snags block valid workpack closure
- recurring snag behavior is a system concern, but not all future refinement is complete

Do not describe the snag system as absent or unimplemented.

## 11. Compliance Domain

Jupiter includes compliance structures for:

- AD
- SB
- SID

Relevant live schema areas include:

- `compliance_items`
- `aircraft_compliance`
- `workpack_compliance`
- `aircraft_sb_compliance`
- `cessna_sids`
- `model_sids`
- `aircraft_sid_status`

Compliance is part of workpack close and document eligibility rules.

## 12. Document System

The document system is implemented around CRS and CRMA behavior.

### CRS

CRS is:

- a regulatory certification document
- not a generic report
- generated read-only
- subject to strict eligibility rules

CRS may be generated only when:

- workpack is `CERTIFIED`
- all tasks are `CERTIFIED_BY_ENGINEER` or `LOCKED`
- compliance is complete
- snags are closed

### CRMA

CRMA is:

- separate from CRS
- a limited-scope maintenance release document
- not a replacement for full CRS

### Locked Document Rules

- document generation is read-only
- generation must not change lifecycle
- generation must not change execution
- generation must not change compliance
- generation must not change snags

## 13. Planning System

Jupiter includes a controlled planning subsystem.

Planning is separate from execution.

Planning sessions are not workpacks.

Planning supports:

- create planning session
- edit candidate maintenance content
- save
- resume
- validate
- generate workpack

### Locked Planning States

- `DRAFT`
- `IN_PROGRESS`
- `READY_FOR_GENERATION`
- `GENERATED`

### Locked Planning Rules

- planning validation is required before readiness and generation
- planning does not trigger execution
- planning does not change lifecycle
- planning does not change audit behavior
- generated workpacks are snapshots independent from later planning changes

### Planning Metadata

Planning sessions include lightweight metadata such as:

- `created_by`
- `created_at`
- `updated_at`
- `finalized_by`
- `finalized_at`

This metadata is not a replacement for audit logs.

## 14. Planning To Workpack Separation

This boundary is locked:

- planning session is not a workpack
- generated workpack is an independent snapshot
- planning session cannot mutate an already-generated workpack
- later template or library changes do not retroactively alter existing generated workpacks

Do not collapse planning and execution concepts together.

## 15. Audit Integrity

Audit integrity is locked.

Current audit-related structures include:

- `audit_log`
- `workpack_audit_log`
- `workpack_snag_audit_log`

RBAC-related reference tables also have audit-trigger coverage in schema.

Locked audit rules:

- do not weaken or bypass audit integrity
- do not treat planning metadata as audit replacement
- do not remove or redesign audit behavior unless a separate phase explicitly reopens it

## 16. RBAC And Access Control

Jupiter has an RBAC foundation in the current codebase and schema.

Evidence-backed RBAC structures include:

- `rf_role`
- `rf_permission`
- `rf_role_permissions`
- `user_roles`

Active role codes used in the system include:

- `ADMIN`
- `SUPERVISOR`
- `PLANNER`
- `ENGINEER`
- `MECHANIC`

Route and middleware enforcement exists in active modules.

Customer-specific enforcement is not a fully established active server module in the same way as staff RBAC and must not be overstated beyond verified code and docs.

## 17. Customer Visibility Boundary

Customer visibility has defined design boundaries.

Customer-facing scope is intended to be limited to customer-owned aircraft and operationally safe visibility.

Customer boundary rules must preserve:

- no internal pricing exposure
- no internal notes exposure
- no audit exposure
- no cross-customer leakage

Do not claim a full customer module exists unless verified in code.

Describe customer visibility carefully as bounded and controlled by verified design and current enforcement evidence only.

## 18. Current Database Reality

Current inspected schema includes:

- 41 public tables
- 66 foreign keys
- 47 applied Sequelize migrations in `SequelizeMeta`

Key live table groups:

- reference and identity tables
- aircraft and component tables
- task and workpack execution tables
- compliance and bulletin tables
- audit tables

The schema is not “to be filled later.”

Use `docs/ChatGPT/ver3/schema.sql`, `model_inventory.md`, and `migration_inventory.md` as the current factual schema references.

## 19. Current Repository Constraints

Known current repository constraints:

- `src/modules/workpacks/workpack.controller.ts` is a large, high-risk controller
- model/schema alignment is imperfect in several areas
- legacy migration folders exist and are archival only
- pre-existing TypeScript compile failures remain in unrelated files outside approved cleanup scope

Known compile-failure files after Phase 14.3 verification:

- `src/modules/library/ad-import.controller.ts`
- `src/modules/library/sb-import.adapters.ts`
- `src/modules/workpacks/services/snag.service.ts`
- `src/modules/workpacks/services/TaskImportService.ts`

These are repository constraints, not automatic permission to fix them outside the active phase.

## 20. Controlled Cleanup Outcome

Phase 14 cleanup was controlled and limited.

Approved and removed only:

- `src/modules/tasks/snapshot.service.ts`
- `src/modules/rbac/permission.service.ts`

Deferred or rejected candidates remain untouched.

Do not describe cleanup as broad refactoring or general dead-code removal.

## 21. Session Execution Discipline

Jupiter work must follow:

- single phase only
- `DEFINE -> IMPLEMENT -> VERIFY`

Locked discipline:

- verified phases are treated as correct unless explicitly reopened
- do not re-audit locked phases without cause
- do not mix phases
- do not delete files without approval
- do not refactor unless explicitly approved
- inspect existing migrations before adding new ones
- inspect existing files before replacing behavior

## 22. Documentation Usage Rules

Primary control document:

- `docs/ChatGPT/ver3/MASTER_EXECUTION_PLAN_VER3.md`

Supporting current-state documents:

- `docs/ChatGPT/ver3/system_snapshot.md`
- `docs/ChatGPT/ver3/file_inventory.md`
- `docs/ChatGPT/ver3/model_inventory.md`
- `docs/ChatGPT/ver3/migration_inventory.md`
- `docs/ChatGPT/ver3/schema.sql`

When answering or implementing:

- prefer verified phase truth over stale historical notes
- preserve locked lifecycle, audit, planning, and cleanup boundaries
- do not invent features not verified in code or docs

## 23. Working Style Rules For Future Sessions

When modifying code:

- preserve locked invariants
- do not change unrelated behavior
- do not fix unrelated compile issues unless the active phase requires it
- do not reopen verified phases without explicit instruction
- do not assume historical docs are still authoritative if newer verified docs exist

When describing the system:

- describe the current system, not the old intended system
- remove stale assumptions
- keep planning, execution, documents, and customer boundaries distinct

## 24. Final Context Rule

Jupiter must be treated as a controlled, phase-locked maintenance system whose current truth comes from:

- the active verified phase documents
- the current mounted runtime structure
- the current inspected schema and inventories

Do not regress to older assumptions such as:

- “snags are not really implemented”
- “planning is not part of the system”
- “database still needs to be filled in later”
- “workpacks are the source of truth”
- “cleanup removed broad parts of the system”

END OF FILE
