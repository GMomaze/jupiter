Phase 2.7 — Compliance summary for documents

Phase 2.7.1 — Build compliance summary query

Defined ✅
Implemented ✅
Verified ✅

Result:
- getComplianceSummaryForWorkpack(workpackId) exists
- Read-only confirmed
- Returns completed compliance only
- Groups AD and SB separately
- Does not guess recurrence
- Output contains required document fields
- No unrelated logic changed

Goal:
Create a read-only method that returns compliance completed in a workpack, grouped for future CRS / CRMA / logbook output.

Method:
getComplianceSummaryForWorkpack(workpackId)

Output groups:
- recurring ADs
- one-time ADs
- recurring SBs
- one-time SBs

For now:
- Use compliance_items.item_type
- Use workpack_compliance.status = COMPLETED
- If recurrence is not yet available, put items into general AD/SB groups and mark recurrence as UNKNOWN

Rules:
- Read-only
- Do not change document PDFs yet
- Do not change close rules
- Do not change task/compliance completion logic