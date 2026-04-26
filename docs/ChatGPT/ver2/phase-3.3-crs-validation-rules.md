Phase 3.3 — CRS Validation Rules

Defined ✅
Implemented ✅
Verified ✅

Result:
- validateCrsGeneration(workpackId) exists
- Read-only confirmed
- Returns valid/errors
- Checks CERTIFIED workpack
- Checks certified_by / certified_at
- Checks tasks CERTIFIED_BY_ENGINEER or LOCKED
- Checks compliance COMPLETED
- Checks snags CLOSED
- No PDF generation or workflow changes

Goal:
Create a read-only validation layer that determines whether CRS generation is allowed.

Method:
validateCrsGeneration(workpackId)

Rules:
CRS may generate only when:
- workpack status = CERTIFIED
- all linked tasks are CERTIFIED_BY_ENGINEER or LOCKED
- all workpack_compliance rows are COMPLETED
- all snags are CLOSED
- workpack.certified_by exists
- workpack.certified_at exists

Do NOT:
- generate PDF
- change workpack status
- change task status
- modify compliance
- modify snags


Phase 3.3.1 — Workpack certification metadata integrity

Defined ✅
Implemented ⬜
Verified ⬜

Goal:
When a workpack is closed/certified, workpacks.certified_by and workpacks.certified_at must be populated.

Rules:
- Do not bypass CRS validation
- Do not weaken validation
- Fix the workflow that sets workpack status to CERTIFIED
- certified_by must be the user closing/certifying the workpack
- certified_at must be current timestamp