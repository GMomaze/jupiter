# JUPITER – Aircraft Maintenance Management System  
## 01 – System Overview

---

## 1. Purpose of Jupiter

Jupiter is a professional Aircraft Maintenance Management System (AMMS).

Its purpose is to:

- Manage aircraft lifecycle
- Manage maintenance workpacks
- Track installed components
- Enforce controlled status transitions
- Maintain audit integrity
- Ensure traceability of maintenance actions

Jupiter is not a demo project.
It is being built as a production-grade, modular aviation system.

---

## 2. Target Users

Jupiter is designed for:

- Maintenance Planners
- Licensed Aircraft Engineers
- Quality Assurance Inspectors
- Maintenance Controllers
- Administrative Staff
- Aircraft Owners (read-only visibility – planned)

The system must enforce operational discipline and data integrity.

### Future Expansion – Owner Portal

A future expansion phase may introduce:

- Owner read-only aircraft visibility
- Maintenance request submission workflow
- Controlled portal-based interaction
- Role-based access control extensions

This functionality is **not part of the current structured build phase**.
It must not alter core architecture prematurely.

---

## 3. Core Philosophy

Jupiter follows strict engineering principles:

### A. Structural Discipline
- Backend modules must never contain UI views.
- Views must live in `src/views`.
- Modules must live in `src/modules`.
- Routes are mounted in `app.ts`.

### B. Controlled Transitions
Aircraft and Workpacks must follow controlled lifecycle transitions.
State changes are never arbitrary.

### C. Data Integrity First
- UUID primary keys
- Explicit foreign key constraints
- Unique constraints where required
- Auditing triggers on critical tables

### D. Navigation Integrity
There must be no navigation dead-ends.
Every screen must have a logical return path.

### E. AI-Assisted Development Rules
When continuing development:

- Do not refactor working modules unnecessarily.
- Do not move files unless explicitly required.
- Maintain existing folder structure.
- Respect documentation before modifying architecture.
- Do not introduce architectural complexity without explicit direction.

---

## 4. Technology Stack

### Backend
- Node.js
- Express (v5)
- PostgreSQL
- Knex (migrations)
- Passport (authentication)
- Argon2 (password hashing)

### Frontend
- EJS templating
- Tailwind CSS
- HTMX (server-driven UI)

### Infrastructure
- CSRF protection
- Rate limiting
- Helmet security headers
- Audit triggers at database level

---

## 5. Current Core Modules

As of this phase, Jupiter contains:

- Aircraft Module
- Workpack Module
- Library Module
- Inventory Module
- Reference Module
- Audit Module
- Projection Module (math engine)
- Authentication Module

Not all modules are feature-complete.
Architecture stability takes priority over feature breadth.

---

## 6. Non-Negotiable Rules

The following must never be violated:

1. No `.ejs` files inside backend modules.
2. Dynamic routes must come after static routes.
3. No duplicate route mounting.
4. Dashboard must exist as navigation spine.
5. All major domain entities must be reachable in ≤ 2 clicks.
6. Working structure must not be refactored without explicit instruction.

---

## 7. System Maturity

Jupiter is currently in structured build phase.

- Core routing is stable.
- UI navigation spine is established.
- Module separation is enforced.
- Cross-module navigation is functioning.

Feature depth is being expanded incrementally.

The architecture must remain stable while features evolve.

---

End of Document.
