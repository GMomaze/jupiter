Phase 2.6 — Enforce compliance rules

Phase 2.6.1 — Block workpack close if compliance incomplete

Defined ✅
Implemented ✅
Verified ✅

Result:
- Workpack close checks workpack_compliance
- Incomplete compliance blocks close
- Workpacks without compliance still close as before
- Snag blocking still works
- No task/execution/certification logic changed

Goal:
Prevent closing a workpack if any compliance item is not completed.

Rule:
- If any workpack_compliance.status != COMPLETED
  → block close

Scope:
- Applies only to workpacks that have compliance items
- Does not affect workpacks without compliance

Do not:
- Change task lifecycle
- Change certification logic
- Modify existing snag blocking logic