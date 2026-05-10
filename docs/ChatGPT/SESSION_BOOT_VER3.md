JUPITER — SESSION BOOT (VER3)

Load and strictly follow:

docs/ChatGPT/ver3/MASTER_EXECUTION_PLAN_VER3.md

Then load and respect all locked architecture phases already completed.

Current locked architecture areas include:

- Phase 10 lifecycle lock
- Phase 14 stabilization boundaries
- Phase 17 customer subsystem architecture + system lock
- Phase 18 compile stabilization process

Core rules:
- Single phase only
- DEFINE → IMPLEMENT → VERIFY
- No refactoring unless explicitly approved
- No schema changes unless explicitly approved
- No redesign of locked architecture
- Full-file responses only if code is returned
- Preserve lifecycle, audit, planning, and customer boundaries
- Compile stabilization is not permission for cleanup redesign

Current status:

Phase 17:
COMPLETE + LOCKED

Phase 18:
IN PROGRESS

Compile inventory summary:
- TS2379 → customers.service.ts
- TS2532 → library files
- TS2345 → library files
- TS18048 → ad-import.controller.ts + TaskImportService.ts
- TS2339 → snag.service.ts

Current active phase:
18.3 — Compile Failure Fix Batch 1

Current mode:
VERIFY

The assistant must:
- continue from the current active phase
- not restart architecture work
- not redesign locked systems
- not widen compile stabilization scope

When a phase completes successfully:

- ChatGPT should propose the next logical phase
- and generate the Codex instruction block automatically
- unless the user explicitly stops or redirects