# CODEX_EXECUTION_RULES.md

## MANDATORY FIRST STEP

Before making any change:

Inspect the existing implementation.

Classify the request as:

* ALREADY_IMPLEMENTED
* PARTIALLY_IMPLEMENTED
* NOT_IMPLEMENTED

You must inspect existing:

* services
* routes
* controllers
* views
* models
* migrations
* helpers
* reports
* utilities
* workflows

before proposing a change.

---

## ALREADY_IMPLEMENTED

If the requested behaviour already exists:

* Do not modify files.
* Do not rewrite code.
* Do not refactor.
* Return evidence.
* Return ALREADY_IMPLEMENTED.

---

## SAFE IMPLEMENTATION BOUNDARY

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
3. Determine whether a partial implementation already exists.
4. Reuse existing logic before creating new logic.
5. Reuse existing helpers before creating helpers.
6. Reuse existing services before creating services.
7. Reuse existing reports before creating reports.
8. Extend existing workflows before introducing replacements.
9. Verify no regression to existing functionality.

If a requested change would affect an existing workflow:

STOP

and identify:

* affected files
* affected routes
* affected services
* affected lifecycle behaviour
* affected reports
* affected compliance behaviour
* affected workpack behaviour

before implementation proceeds.

---

## PARTIALLY_IMPLEMENTED

If part of the behaviour exists:

* Identify the exact missing behaviour.
* Extend the existing implementation only.
* Do not duplicate functionality.
* Do not create parallel implementations.
* Do not replace existing working logic.
* Explain why the existing implementation is insufficient.
* Implement only the missing gap.

---

## NOT_IMPLEMENTED

If the behaviour does not exist:

* Implement the smallest safe change.
* Preserve architecture.
* Preserve database contracts.
* Preserve lifecycle behaviour.
* Preserve audit behaviour.
* Prefer extension points that align with existing architecture.

---

## CHANGE MINIMISATION RULES

* Never rewrite working code.
* Never duplicate routes.
* Never duplicate services.
* Never duplicate models.
* Never duplicate helpers.
* Never duplicate migrations.
* Never duplicate views.
* Never duplicate reports.
* Never duplicate utilities.
* Prefer extension over replacement.
* Prefer smallest safe change.

If an existing implementation can be safely extended:

DO NOT create a new implementation.

---

## DATABASE RULES

* Do not create migrations unless required.
* Do not change schema unless approved.
* Do not invent tables.
* Do not invent fields.
* Respect existing foreign keys.
* Respect existing unique constraints.
* Respect existing audit behaviour.

---

## REGRESSION PREVENTION RULES

Before implementing:

Identify:

* existing functionality being reused
* existing functionality potentially affected
* existing reports affected
* existing lifecycle behaviour affected

After implementing:

Verify:

* existing functionality still works
* existing routes still work
* existing views still render
* existing lifecycle behaviour is unchanged
* existing compliance behaviour is unchanged
* existing workpack behaviour is unchanged

unless the active phase explicitly changes those areas.

---

## REQUIRED PRE-IMPLEMENTATION OUTPUT

Before coding return:

1. Files inspected
2. Existing behaviour found
3. Classification
4. Minimal change plan
5. Expected files to change
6. Existing implementation being reused
7. Existing implementation being extended
8. Regression risks identified

Only then implement.

---

## REQUIRED POST-IMPLEMENTATION OUTPUT

After implementation return:

1. Modified file list
2. Exact behaviour changed
3. Existing behaviour preserved
4. Verification commands run
5. PASS / FAIL results
6. Remaining limitations
7. Known unaffected systems

---

## STOP CONDITIONS

Stop and report instead of coding if:

* Requested behaviour already exists.
* Existing implementation is safer.
* Requirements conflict with architecture.
* Required files are missing.
* The request would duplicate existing functionality.
* The request would create a parallel implementation.
* The request would replace an existing safe implementation without approval.
* The request would widen lifecycle behaviour outside the active phase.
