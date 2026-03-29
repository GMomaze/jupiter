# JUPITER – Aircraft Maintenance Management System  
## 06 – Security & Role-Based Access Control (RBAC)

---

## 1. Security Philosophy

Jupiter is an operational aviation system.

Security principles:

- Authentication is mandatory.
- Authorization is enforced at controller level.
- UI visibility does NOT equal permission.
- All critical actions must be role-validated.
- Owner access (future) must be read-only.

RBAC is not optional.
It is foundational to system integrity.

---

## 2. Core Role Definitions

The system currently defines (or will define) the following roles:

### 2.1 ADMIN
Full system authority.

Permissions:
- Manage users
- Manage reference data
- Manage library data
- Override system-level settings
- View audit logs

---

### 2.2 PLANNER
Maintenance planning authority.

Permissions:
- Create workpacks
- Edit draft workpacks
- Issue workpacks
- View aircraft
- View tasks

Cannot:
- Close workpacks
- Modify audit history
- Manage users

---

### 2.3 ENGINEER
Execution authority.

Permissions:
- Execute assigned workpacks
- Update task status
- Install/remove components
- Update aircraft runtime metrics (controlled)

Cannot:
- Issue workpacks
- Close workpacks
- Modify reference data

---

### 2.4 QA (Quality Assurance)
Approval authority.

Permissions:
- Review completed workpacks
- Approve and close workpacks
- View audit history
- View all aircraft and tasks

Cannot:
- Modify draft planning data
- Change reference tables

---

### 2.5 CONTROLLER
Operational oversight role.

Permissions:
- View all aircraft
- View all workpacks
- View projections
- Monitor fleet health

Primarily read-heavy with limited modification authority.

---

### 2.6 OWNER (Future Role)

Planned future role.

Permissions:
- Read-only visibility of own aircraft
- View maintenance history
- Submit maintenance requests (future phase)

Cannot:
- Modify aircraft data
- Modify workpacks
- Access internal planning tools

This role is roadmap-level only.

---

## 3. Enforcement Strategy

Authorization must be enforced:

- At controller level
- Before performing business logic
- Before executing state transitions

It must NOT rely solely on:

- Hidden buttons in UI
- Client-side checks
- Conditional rendering alone

Server-side validation is mandatory.

---

## 4. Status Transition Protection

The following actions require strict role validation:

- Issuing a workpack → Planner
- Executing tasks → Engineer
- Closing a workpack → QA
- Installing components → Engineer
- Editing reference data → Admin

Unauthorized attempts must:

- Return proper HTTP status
- Be auditable
- Not partially execute logic

---

## 5. Future Owner Portal Security

When implemented:

- Must use role-based filtering
- Must restrict data scope to owned aircraft
- Must never expose internal operational routes
- Must not share planner/engineer views

Owner access must be segregated cleanly.

---

## 6. AI Development Rules for RBAC

When modifying Jupiter:

- Do not add hardcoded string role checks randomly.
- Centralize permission logic.
- Keep role definitions consistent.
- Do not mix UI logic with authorization logic.
- Update this document if roles evolve.

---

## 7. Current Implementation Status

RBAC foundations exist via:

- Authentication module
- Passport configuration
- Ability/permission scaffolding

Full enforcement may not yet be applied across all modules.

Future work should expand role enforcement gradually,
without restructuring architecture.

---

End of 06_SECURITY_AND_RBAC Document.
