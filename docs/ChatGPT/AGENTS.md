# Jupiter Codex Instructions

You are assisting on an existing production codebase.

## Project goal

Jupiter is an aircraft maintenance/workpack system for small AMO-style businesses.

The system must be stable, practical, and safe to change.

## Tech stack

- Node.js
- TypeScript
- Express
- Sequelize
- PostgreSQL
- EJS
- PDFKit
- Playwright
- Database name: jupiter_db

## Working rules

Before changing code:
- Inspect the relevant existing files first.
- Understand the current flow before editing.
- Prefer the smallest safe change.
- Do not refactor unless explicitly requested.
- Do not remove existing functionality.
- Do not rename variables, routes, tables, or files unless required.
- Preserve formatting and comments where possible.

## Code output rules

When asked to modify code:
- Return the full changed file if the user asks for code.
- Label every file with its full path.
- Do not return snippets unless specifically asked.
- If the file is too large, warn about truncation before outputting code.

## Safety rules

Do not guess database table names.
Check migrations/models/routes before changing database logic.

Do not guess view variables.
Check controller render calls before changing EJS.

Do not guess PDF coordinates.
Keep existing PDF layout unless the task is specifically about layout.

## Testing rules

After changes, recommend the smallest relevant test command, for example:

- npm run test:e2e
- npx playwright test tests/e2e/planner.spec.ts
- npm run dev
- npx tsx scripts/run-pdf.ts