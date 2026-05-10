Phase 6.1 — Snag-to-Task Suggestion Foundation

Defined ⬜
Implemented ⬜
Verified ⬜

Goal:
Prepare a safe foundation for suggesting maintenance tasks based on repeated snag patterns.

This phase does NOT auto-create tasks.

Requirements:
1. When a possible recurring snag pattern exists, the system may show a suggestion area.
2. Suggestion must be informational only.
3. No task is created automatically.
4. No workpack state changes.
5. No snag state changes.
6. No blocking behaviour.

Possible future output:
- Suggested action: “Consider creating an inspection task”
- Pattern reference:
  - normalised_description
  - occurrence_count
  - latest_created_at

Rules:
- Read-only only
- No schema changes
- No task creation
- No workflow changes
- No compliance changes
- No customer-facing view
- No AI/ML yet

Exclusions:
- Do not create task templates
- Do not auto-link suggestions to tasks
- Do not notify customers
- Do not block release

Status:
Defined ⬜
Implemented ⬜
Verified ⬜