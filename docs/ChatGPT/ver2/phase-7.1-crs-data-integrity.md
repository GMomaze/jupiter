# Phase 7.1 — CRS Data Integrity Rules

Defined ✅
Implemented ⬜
Verified ⬜

---

# 1. GOAL

Define the data integrity rules required before a CRS can be generated.

A CRS is a regulatory certification document. It must only be generated when the workpack is complete, compliant, and legally releasable.

---

# 2. CRS GENERATION RULE

A CRS may only be generated if all required release conditions are satisfied.

---

# 3. REQUIRED CONDITIONS

## 3.1 Workpack status

The workpack must be in the correct release-ready state.

Allowed:

- CERTIFIED

Not allowed:

- DRAFT
- ISSUED
- IN_PROGRESS
- CANCELLED
- CLOSED
- RELEASED unless regenerating an existing locked CRS is explicitly defined later

---

## 3.2 Task completion

All workpack tasks must be complete.

Allowed task states:

- CERTIFIED_BY_ENGINEER
- LOCKED

Not allowed:

- OPEN
- IN_PROGRESS
- COMPLETED_BY_MECHANIC

---

## 3.3 Compliance completion

All compliance items linked to the workpack must be complete.

Allowed:

- COMPLETED

Not allowed:

- OPEN
- DUE
- OVERDUE
- NOT_APPLICABLE unless explicitly defined later

---

## 3.4 Snag closure

All snags linked to the workpack must be closed.

Allowed:

- CLOSED

Not allowed:

- OPEN
- IN_PROGRESS
- RESOLVED

---

## 3.5 Certification data

The workpack must have valid certification data.

Required:

- certified_by
- certified_at

---

## 3.6 Aircraft data

The CRS must have access to required aircraft identity data.

Required:

- registration
- aircraft type/model
- serial number where available

---

# 4. FAILURE BEHAVIOUR

If any condition fails:

- Do not generate CRS
- Return a clear validation error
- Do not partially generate a PDF
- Do not change workpack status
- Do not write certification records

---

# 5. RULES

- No schema changes
- No document layout changes
- No CRS PDF formatting changes
- Validation only
- Do not weaken existing release rules
- Do not bypass compliance checks
- Do not bypass snag checks

---

# 6. EXCLUSIONS

Do NOT implement:

- CRMA validation
- logbook insert validation
- CRS template redesign
- digital signature changes
- document numbering changes
- regeneration rules

---

# 7. SUCCESS CRITERIA

Phase is PASS if:

- CRS generation is blocked when any required condition fails
- CRS generation is allowed only when all required conditions pass
- Clear validation error is returned
- No partial CRS is generated on failure
- No unrelated workflow behaviour changes

---

# 8. STATUS

Defined ✅
Implemented ⬜
Verified ⬜