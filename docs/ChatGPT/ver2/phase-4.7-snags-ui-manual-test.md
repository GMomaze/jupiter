Phase 4.7 — Snag Workflow Manual UI Test

Defined ✅
Implemented ✅
Verified ✅

Goal:
Validate the full snag workflow including visibility, grouping, and blocking behavior from the UI.

Test flow:

1. Open a workpack execution page.

2. Verify summary:
   - total snags
   - open/active snags
   - resolved snags
   - closed snags

3. Create a new snag:
   - enter description
   - submit

Expected:
   - snag appears in OPEN group
   - summary updates

4. Start the snag:
Expected:
   - moves to IN_PROGRESS group
   - summary updates

5. Resolve the snag:
Expected:
   - moves to RESOLVED group
   - summary updates

6. Attempt to close workpack while snag != CLOSED:
Expected:
   - blocked
   - UI shows blocking message

7. Close the snag:
Expected:
   - moves to CLOSED group
   - summary updates

8. Close workpack:
Expected:
   - allowed

Rules:
- No code changes during test
- Record PASS / FAIL per step
- Capture any UI inconsistencies
