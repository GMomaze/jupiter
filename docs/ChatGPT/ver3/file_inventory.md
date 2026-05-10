# File Inventory

Snapshot date: 2026-04-30

## Directory Structure

```text
jupiter/
  docs/
    ChatGPT/
      ver3/
  migrations/
  migrationOLD/
  public/
  scripts/
  seeders/
  src/
    config/
    middleware/
    models/
      audit/
      core/
      rbac/
    modules/
      aircraft/
      assets/
      audit/
      auth/
      compliance/
      components/
      inventory/
      library/
      maintenance/
      projection/
      rbac/
      reference/
      service-bulletins/
        adapters/
      tasks/
      workpacks/
        services/
    public/
    routes/
    services/
    tailwind/
    test/
    types/
    views/
      aircraft/
      audit/
      auth/
      components/
      dashboard/
      errors/
      library/
      partials/
      projection/
      reference/
      service-bulletins/
      workpacks/
  test/
  tests/
  uploads/
  _obsolete/
```

## Key Modules And Files

Application entry and infrastructure:

- `src/app.ts`: main Express composition root, middleware stack, route mounting, session, CSRF, rate limiting
- `src/server.ts`: startup, DB connectivity guardrails, session table verification, cron boot
- `src/config/database.ts`: PostgreSQL pool and Sequelize connection setup
- `src/models/associations.ts`: cross-domain Sequelize relationships

Primary domain modules:

- `src/modules/workpacks/`: largest business area; planning, execution, audit, snags, measurements, PDF/CRS generation
- `src/modules/aircraft/`: aircraft records, installed components, lifecycle validation
- `src/modules/library/`: manufacturers, models, maintenance requirements
- `src/modules/service-bulletins/`: bulletin ingestion, sync, adapters, UI
- `src/modules/reference/`: reference-table CRUD and policy checks
- `src/modules/auth/`: Passport/session login flow and staff management routes
- `src/modules/audit/`: audit log browsing and services
- `src/modules/compliance/`: compliance state logic
- `src/modules/projection/`: fleet-health and fleet-status presentation
- `src/modules/inventory/`: inventory service and routes

Supporting files:

- `migrations/`: active schema evolution chain
- `seeders/`: reference, identity, operational, library, and task-template seed data
- `tests/` and `test/`: unit, integration, lifecycle, PDF, and e2e coverage
- `docs/summary/`: historical architecture and workflow documentation

Module file counts under `src/modules`:

- `workpacks`: 17 files
- `service-bulletins`: 11 files
- `auth`: 8 files
- `reference`: 7 files
- `aircraft`: 6 files
- `tasks`: 4 files
- `audit`: 4 files
- `inventory`: 3 files
- `library`: 3 files
- `projection`: 2 files
- `compliance`: 1 file
- `maintenance`: 1 file
- `rbac`: 1 file
- `assets`: 0 files
- `components`: 0 files

## Large And Complex Files Flagged

Largest source/view files currently present under `src/`:

- `src/modules/workpacks/workpack.controller.ts` at 44,253 bytes
- `src/views/aircraft/view.ejs` at 31,786 bytes
- `src/views/service-bulletins/index.ejs` at 26,702 bytes
- `src/modules/library/library.service.ts` at 26,543 bytes
- `src/views/library/model-detail.ejs` at 21,634 bytes
- `src/modules/workpacks/pdf.service.ts` at 21,276 bytes
- `src/modules/aircraft/aircraft.service.ts` at 18,850 bytes
- `src/modules/workpacks/services/task-execution.service.ts` at 18,663 bytes
- `src/views/library/manufacturer-detail.ejs` at 18,419 bytes
- `src/modules/aircraft/aircraft.controller.ts` at 17,885 bytes

Complexity observations:

- `workpack.controller.ts` is the largest single TypeScript file and is a strong hotspot for regression risk
- Workpack behavior is spread across controllers, services, PDF builders, and EJS views, making the module broad rather than isolated
- `library.service.ts` and `aircraft.service.ts` are large enough to be considered high-context service files
- Several EJS screens are large, which increases risk when UI and business assumptions are mixed in templates

## Inventory Notes

- `src/models/` contains extensionless files that do not match the rest of the model naming convention
- `migrationOLD/` and `_obsolete/` remain in the repository and should be treated as archival, not active runtime structure
- Both `test/` and `tests/` directories are present, which suggests test assets have grown through multiple conventions
