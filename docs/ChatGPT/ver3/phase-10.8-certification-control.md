PHASE 10.8 — CERTIFICATION CONTROL

Status: Defined ✅

1. PURPOSE

Define how the system controls and enforces task certification.

This ensures that only authorized personnel can certify tasks and that certification is properly recorded and auditable.

2. DEPENDENCIES
Phase 10.3D — Status Rules Re-Verification
Phase 10.4 — Execution Completion Rules
Phase 10.6 — Task Lock Enforcement
Phase 10.7 — Execution Integrity Guards
3. SCOPE

Define ONLY:

who may certify tasks
how certification is performed
what data must be recorded
enforcement rules

Do NOT:

implement code
modify schema
create migrations
edit models
alter services/UI
4. REQUIRED OUTPUT

Create:

docs/ChatGPT/ver3/phase-10.8-certification-control.md
5. CERTIFICATION RULE

A task may transition to:

CERTIFIED_BY_ENGINEER

ONLY if:

current status = COMPLETED_BY_MECHANIC
execution status = COMPLETED_BY_MECHANIC
6. AUTHORITY RULE

Only authorized users may certify.

Minimum requirement:

user.role = ENGINEER

System must:

verify user role before certification
block certification if user is not authorized
7. CERTIFICATION ACTION

When certification occurs:

A. TASK STATUS
task_cards.status → CERTIFIED_BY_ENGINEER
B. EXECUTION STATUS
workpack_executions.status → CERTIFIED_BY_ENGINEER
C. AUDIT FIELDS

The system must record:

task_cards.certified_by
task_cards.certified_at
8. DATA REQUIREMENTS

Certification must NOT occur if:

task is not completed by mechanic
execution is not completed
required execution data is missing
9. FORBIDDEN CONDITIONS

System must NOT allow:

certification from OPEN or IN_PROGRESS
certification from COMPLETED_BY_MECHANIC without validation
certification by unauthorized users
certification without setting:
certified_by
certified_at
10. CONSISTENCY RULE

After certification:

task_cards.status = CERTIFIED_BY_ENGINEER
workpack_executions.status = CERTIFIED_BY_ENGINEER

These must always remain aligned.

11. LOCK PREPARATION RULE

Certification is a prerequisite for locking:

CERTIFIED_BY_ENGINEER → LOCKED (Phase 10.6)

System must NOT allow:

direct transition to LOCKED without certification
12. FAILURE HANDLING

If certification conditions fail:

block the operation
return controlled error
do not partially update records
13. GUARD LOCATIONS

Certification rules must be enforced in:

task execution service
workpack execution service
any certification endpoint
any bulk certification logic

Controllers must NOT bypass service validation.

14. BOUNDARIES

Must NOT:

modify lifecycle states
introduce new statuses
allow execution status = LOCKED
bypass integrity guards (Phase 10.7)
bypass lock rules (Phase 10.6)
15. RULES
DEFINE only
NO implementation
NO schema changes
NO migrations
NO model edits
NO service/UI changes
16. SUCCESS CRITERIA

PASS if:

certification eligibility is defined
authority rule is defined
audit fields are defined
consistency rules are defined
forbidden conditions are defined
enforcement points are identified
17. HANDOFF TO IMPLEMENT

Codex must:

Enforce certification eligibility
Enforce user role validation
Set certification audit fields
Maintain status consistency
Block invalid certification attempts

Return:

Files checked
Files modified
Verification summary
PASS/FAIL