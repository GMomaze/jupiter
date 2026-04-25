# JUPITER – Aircraft Maintenance Management System  
## 03 – Database Schema Overview

---

## 1. Database Philosophy

Jupiter uses PostgreSQL as its source of truth.

Database principles:

- UUID primary keys
- Explicit foreign key constraints
- Strict uniqueness enforcement
- Auditable state transitions
- No implicit relationships

The database enforces integrity.
The application enforces lifecycle logic.

---

## 2. Core Domain Entities

### 2.1 Aircraft

Represents a physical aircraft in the fleet.

Key fields:

- id (UUID, primary key)
- registration (unique)
- serial_number (unique)
- model
- category_id (FK → aircraft category)
- status (default: REGISTERED)
- total_time_hours
- total_time_cycles
- created_at
- updated_at

Rules:

- Registration must be unique.
- Serial number must be unique.
- Status transitions must be controlled.
- Aircraft cannot be deleted casually.

---

### 2.2 Workpacks

Represents a maintenance work order.

Core concepts:

- Linked to one aircraft
- Has lifecycle status
- Contains tasks
- Can transition through controlled states (DRAFT → ISSUED → IN_PROGRESS → CLOSED)

Rules:

- One aircraft may have multiple workpacks.
- Only one DRAFT workpack per aircraft at a time (business rule).
- Closing a workpack may trigger projection updates.

---

### 2.3 Tasks

Represents maintenance actions inside a workpack.

Tasks:

- Belong to a workpack
- May be derived from library requirements
- May become immutable once locked
- Support snapshot behavior

---

### 2.4 Aircraft Components

Represents installed components on an aircraft.

Concept:

- Aircraft has many installed components.
- Each installed component references a component model.
- Installation records include TSN / TSO at install.
- Removal logic must preserve history.

---

### 2.5 Library / Reference Tables

Library tables define master data:

reference tables nameing convention starts with rf_*

- Manufacturers
- Component models
- Maintenance requirements
- Aircraft categories
- Workpack statuses

These are controlled data sets.
They should not be modified casually in production.

---

## 3. Relationship Overview

High-level structure:

Aircraft
  ├── Workpacks
  │     └── Tasks
  └── Installed Components
        └── Component Models

Library data feeds:
  - Tasks
  - Components
  - Categories

---

## 4. Auditing

Critical tables have database triggers:

Example:
- aircraft table has audit trigger

Auditing rules:

- INSERT and UPDATE operations must be recorded.
- Status transitions must be traceable.
- Business-critical state changes must never be silent.

---

## 5. Integrity Rules

The following are mandatory:

1. No orphaned records.
2. No silent cascading deletes.
3. No direct state string manipulation.
4. Foreign keys must exist for all domain relationships.
5. Unique constraints must reflect real-world uniqueness.

---

## 6. Projection & Calculation Layer

Projection module uses:

- Aircraft total hours
- Installed component baselines
- Workpack closure events

It must not directly mutate historical data.
It must compute derived values deterministically.

---

## 7. Migration Discipline

All schema changes must:

- Be done via migrations.
- Never edited manually in production.
- Be backward-safe when possible.

---

End of Database SChema Document.
