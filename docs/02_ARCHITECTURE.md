# JUPITER – Aircraft Maintenance Management System  
## 02 – Architecture

---

## 1. Architectural Philosophy

Jupiter follows a modular monolith architecture.

It is:

- Modular at domain level
- Unified at deployment level
- Strictly separated between backend logic and UI rendering

The system is intentionally structured to remain readable and maintainable as it grows.

---

## 2. Project Structure

### Root

/docs
/migrations
/seeds
/scripts
/src
/tests


The root must remain clean.
No experimental files in root.

---

## 3. Source Structure (`src/`)

src/
app.ts
server.ts

config/
modules/
routes/
services/
public/
views/


---

## 4. Backend Module Pattern

Each domain module follows this structure:

modules/<domain>/
<domain>.routes.ts
<domain>.controller.ts
<domain>.service.ts


Rules:

- Routes define endpoints only.
- Controllers handle HTTP layer.
- Services handle business logic.
- Database access occurs in services (preferred) or controlled areas.
- No `.ejs` files allowed in `modules/`.

---

## 5. View Structure

All UI files live in:

src/views/


Structure:

views/
dashboard/
aircraft/
workpacks/
library/
inventory/
reference/
audit/
partials/
layout.ejs (optional future)


Rules:

- Every major domain has its own view folder.
- Shared UI components live in `views/partials/`.
- Header and footer are included explicitly.
- No nested `views/modules/` directory allowed.

---

## 6. Routing Strategy

All domain routes are mounted in:

src/app.ts


Example:

```ts
app.use('/aircraft', aircraftRoutes);
app.use('/workpacks', workpackRoutes);

src/routes/index.ts is reserved for:

    Dashboard

    Root-level navigation

    Non-domain routes

No duplicate mounting of domain routes.
7. Route Ordering Rules

Inside each route file:

    Static routes must come first.

    Parameterized routes must come after static routes.

    Catch-all dynamic routes (e.g. /:registration) must come last.

Failure to follow this causes route shadowing bugs.
8. UI Navigation Spine

The root path / renders the Dashboard.

Primary navigation:

    / → Dashboard

    /aircraft → Fleet

    /workpacks → Workpacks

    /library → Master Data

Every detail page must include:

    Back navigation link

    Header

    Footer

No UI dead-ends.
9. State & Lifecycle Philosophy

Entities such as:

    Aircraft

    Workpacks

Follow controlled status transitions.

State changes must:

    Be validated

    Be auditable

    Never be free-form string changes

10. Testing Philosophy

Testing levels:

    Integration tests for lifecycle integrity

    E2E tests for navigation flow

    Avoid over-fragmented unit testing early

Tests must reflect business lifecycle, not internal function details.
11. Refactor Protection Rules

When continuing development:

    Do not rename folders casually.

    Do not restructure modules without updating docs.

    Do not mix UI and backend layers.

    Do not introduce new architectural patterns mid-build.

Architecture stability is more important than rapid feature growth.

END OF ARCHITECTURE