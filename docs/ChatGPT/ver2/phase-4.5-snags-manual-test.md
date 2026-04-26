Phase 4.5 — Manual Snag Workflow Test

Defined ✅
Implemented ⚠️
Verified ❌

Failure:
Create snag fails because controller calls removed SnagService.reportSnag(...)

Goal:
Verify the full snag workflow from the UI and service flow.

Test flow:
1. Open a workpack execution page.
2. Create a snag from the execution page.
3. Confirm snag appears on execution page.
4. Confirm snag status = OPEN.
5. Start snag.
6. Confirm status = IN_PROGRESS.
7. Resolve snag.
8. Confirm status = RESOLVED.
9. Close snag.
10. Confirm status = CLOSED.
11. Confirm workpack close is blocked while snag is not CLOSED.
12. Confirm workpack close succeeds after snag is CLOSED.

Rules:
- No code changes during test.
- Record PASS / FAIL only.