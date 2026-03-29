📄 08_CONCURRENCY_AND_TRANSACTION_POLICY.md
JUPITER – Concurrency & Transaction Policy
08 – Atomic Integrity & Multi-User Safety
1. Purpose

This document defines how Jupiter protects:

Lifecycle integrity

Multi-user safety

Atomic state transitions

Audit consistency

Jupiter is a multi-user operational aviation system.

Concurrency safety is not optional.

2. Core Principle

Every lifecycle-changing operation must be:

Atomic

Transactional

Conflict-safe

Fully auditable

No partial state writes are allowed.

If a lifecycle action fails at any step, the entire operation must roll back.

3. Transaction Policy
3.1 Mandatory Transaction Scope

The following operations must execute inside an explicit database transaction:

Aircraft

Status transitions

Runtime metric updates affecting projections

Components

INSTALL

REMOVE

QUARANTINE

TSN adjustments

Tasks

SIGN

LOCK

Snapshot generation

Workpacks

Create DRAFT

Add/remove tasks

ISSUE

START (IN_PROGRESS)

CLOSE

If an operation:

Mutates lifecycle state

Updates related entities

Triggers projection recalculation

Writes audit-relevant changes

It must be wrapped in a transaction.

3.2 Transaction Behavior Requirements

Transactions must guarantee:

No partial entity update

No audit entry without domain change

No domain change without audit entry

No intermediate invalid state exposure

Failure anywhere inside lifecycle logic must:

Roll back the transaction

Return controlled error

Leave system unchanged

4. Optimistic Locking Policy
4.1 Purpose

To prevent lost updates when multiple users modify the same entity.

Example:
Two engineers open the same task.
Both attempt to sign it.

Only one may succeed.

4.2 Version Column Requirement

The following tables must include a version column:

aircraft

component

task

workpack

Requirements:

Default value: 0

Incremented automatically on successful update

Checked before update execution

4.3 Conflict Handling

If version mismatch occurs:

Operation must fail safely

No silent overwrite allowed

No automatic merge

User must be informed record was modified elsewhere

HTMX responses must return a clear conflict message.

5. Concurrency Guards

Beyond optimistic locking, certain actions require additional protection.

5.1 Workpack

Prevent two users starting the same workpack simultaneously.

Prevent duplicate DRAFT creation per aircraft under race condition.

5.2 Task

Prevent double sign-off.

Prevent signing if already LOCKED.

Prevent modification after LOCK.

5.3 Component

Prevent double removal.

Prevent installation if component state changed mid-request.

Prevent illegal lifecycle transitions under race condition.

6. Row-Level Locking

Row-level locking may be used when:

State check and update must occur atomically.

High-risk lifecycle transitions occur.

It must:

Be minimal in scope.

Avoid table-wide locking.

Avoid deadlock risk.

Row locking must not replace optimistic locking,
but complement it where required.

7. Audit Integrity Under Concurrency

Audit system rules remain:

Audit triggers fire inside transaction.

Failed transaction must not persist audit entry.

Concurrent attempts must not create duplicate misleading audit rows.

Audit log must reflect actual committed state only.

8. Testing Requirements

Concurrency and transaction protection must be validated via integration tests.

Mandatory test scenarios:

Parallel task sign-off → only one succeeds.

Parallel workpack start → only one succeeds.

Forced failure mid-transaction → no partial writes.

Version mismatch → update rejected.

Tests must use real database behavior.
No mocking of transaction logic.

9. Non-Negotiable Rules

The following must never occur:

Silent overwrites.

Partial lifecycle transitions.

Audit entries without real state change.

Manual version manipulation.

Lifecycle mutation outside service layer.

All lifecycle transitions must pass through:

Service → Transaction → Audit → Commit

10. Relationship to Existing Documentation

This document extends:

02_ARCHITECTURE.md

03_DATABASE_SCHEMA.md

06_SECURITY_AND_RBAC.md

07_TESTING_STRATEGY.md

It does not alter structure.

It strengthens lifecycle safety within the existing modular architecture.

11. Development Rule

When modifying lifecycle logic:

Confirm transaction coverage.

Confirm version enforcement.

Confirm audit integrity.

Confirm rollback behavior.

Add or update integration tests.

No lifecycle change may bypass this policy.

12. Final Principle

Jupiter must behave predictably under:

Multi-user interaction

Network latency

Simultaneous submissions

Edge-case timing collisions

Concurrency must never corrupt engineering truth.

The database is the authority.
Transactions preserve truth.
Versioning protects intent.

END OF 08_CONCURRENCY_AND_TRANSACTION_POLICY DOCUMENT