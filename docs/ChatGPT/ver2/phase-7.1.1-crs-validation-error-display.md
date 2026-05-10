Jupiter system — strict execution.

Active Phase: 7.1.1 — CRS Validation Error Display
Mode: DEFINE

Create:
docs/ChatGPT/ver2/phase-7.1.1-crs-validation-error-display.md

Goal:
Define how CRS validation errors must be shown to the user when CRS generation is blocked.

Problem:
The backend correctly blocks invalid CRS generation, but the UI only shows MUTATION_BLOCKED at the top right of the screen. This is not informative enough.

Required behaviour:
When CRS generation is blocked, display a clear user-facing message explaining why CRS cannot be generated.

Scope:
- Error display only
- No validation rule changes
- No schema changes
- No PDF layout changes
- No CRS generation logic changes except returning/displaying clear validation messages

Return ONLY the markdown phase file content.
No code.