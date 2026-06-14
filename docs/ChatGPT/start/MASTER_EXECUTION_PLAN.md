# MASTER_EXECUTION_PLAN.md

## 1. SYSTEM PURPOSE

Jupiter is an aircraft maintenance execution, compliance, planning and traceability system.

Objectives:

* Replace Excel workflows.
* Replace Word workflows.
* Manage aircraft, components, workpacks, tasks and compliance.
* Track SBs, ADs, SIDs and maintenance requirements.
* Enforce lifecycle and airworthiness rules.
* Preserve auditability and traceability.
* Support future multi-tenant productisation.

---

## 2. EXECUTION DISCIPLINE

All work follows:

DEFINE → IMPLEMENT → VERIFY

No skipping phases.

Only one active phase may be worked on at a time.

---

## 3. LOCKED ARCHITECTURE RULES

* Database is source of truth.
* Backend owns truth.
* Frontend displays backend truth.
* No hidden workflow mutation.
* No hidden lifecycle mutation.
* No hidden compliance mutation.
* No hidden audit mutation.
* No schema changes without approval.
* No architecture redesign without approval.
* No unrelated refactoring.

---

## 4. CURRENT LOCKED AREAS

Maintain the list of completed and locked phases here.

Examples:

* Lifecycle architecture
* Customer architecture
* SB allocation workflow
* Component model identity architecture
* Compile stabilization phases

---

## 5. CURRENT ACTIVE PHASE

Active Phase:
[user supplied]

Mode:
DEFINE / IMPLEMENT / VERIFY

Goal:
[user supplied]

---

## 6. VERIFICATION STANDARD

Every VERIFY must return:

* PASS / FAIL
* Modified file list
* Verification commands run
* Verification results
* Remaining limitations

No phase is complete without PASS.

---

## 7. RECOVERY RULE

If unexpected behaviour occurs:

1. Stop.
2. Check current phase.
3. Check database state.
4. Check architecture rules.
5. Verify before patching.

---

## 8. FUTURE PHASES

Maintain the approved future phase list here.

---

## 9. FINAL OBJECTIVE

Jupiter is complete when:

* Aircraft maintenance workflows run entirely inside Jupiter.
* Compliance is automatically managed.
* Traceability is complete.
* Auditability is complete.
* Documents are generated from system data.
* External spreadsheets are no longer required.
