# AI_CONTEXT.md — Jupiter Maintenance System

## 1. Project Overview

Jupiter is an aircraft maintenance workflow system designed for a **small AMO (Aircraft Maintenance Organisation)**.

Primary objective:

* Fix internal operational inefficiencies
* Stop losing customers due to poor visibility and workflow gaps
* Build a structured, traceable maintenance process

Jupiter is NOT:

* An airline system
* A large enterprise MRO platform

Jupiter IS:

* A practical tool to run a real maintenance business efficiently
* A system that must work in the hangar first before becoming a product

---

## 2. Core Domain Concepts

### Workpack

* A grouped set of maintenance tasks for a specific aircraft
* Represents a maintenance event (inspection, service, overhaul)
* Contains multiple tasks

### Task

* A single maintenance action
* Examples:

  * AD (Airworthiness Directive)
  * SB (Service Bulletin)
  * Inspection
  * Component replacement
* Tasks belong to a workpack

### Workpack Execution

* A record of a task being performed
* Supports multiple attempts (attempt_no)
* Tracks progress and completion

### Measurement

* Data captured during execution
* Examples:

  * Hours (A/F, Engine, Prop)
  * Limits
  * Clearances
* Stored per task execution

### Snag (CRITICAL — NOT FULLY IMPLEMENTED)

* A defect or issue found during maintenance or operation
* Must support:

  * Logging
  * Tracking
  * Resolution
  * Recurrence detection (important future feature)

---

## 3. Current Business Problems (REAL)

* No structured workflow → engineers improvise work
* No clear visibility of:

  * What is due
  * What is overdue
* Customers lose trust due to lack of transparency
* Snags are not tracked in a structured way
* No system to detect recurring defects
* Information is fragmented and not reusable

---

## 4. System Goals (SHORT TERM)

1. Build a reliable **workpack system**
2. Ensure all tasks are:

   * Visible
   * Trackable
   * Executed consistently
3. Capture structured data (measurements)
4. Introduce a working snag system
5. Create a foundation for customer visibility

---

## 5. System Goals (LONG TERM)

* Detect recurring snags automatically
* Provide customer portal (aircraft-specific visibility only)
* Improve trust through transparency
* Expand Jupiter to other small AMOs
* Eventually position as a product (after internal success)

---

## 6. Current Tech Stack

Backend:

* Node.js
* TypeScript

Database:

* PostgreSQL

ORM / Query Layer:

* Mixed usage (Knex + Sequelize — needs consistency)

Frontend:

* EJS (server-rendered)
* Tailwind CSS
* HTMX

PDF Generation:

* PDFKit (currently has layout issues)

---

## 7. Current System State

* Workpack module exists but is incomplete
* Task execution system exists but has instability
* Measurement system implemented but still evolving
* PDF generation working but has:

  * Overflow issues
  * Layout inconsistencies
* Snag system not properly implemented yet
* No proper recurring issue detection
* UI baseline exists (dark card-based style)

---

## 8. Known Technical Issues

* PDFKit:

  * Text overflow beyond page width
  * Row height miscalculations
* Session issues:

  * `req.session.regenerate` undefined errors
* Migration inconsistencies:

  * Missing tables (e.g. aircraft_categories errors)
* Mixed ORM usage introduces confusion

---

## 9. Database (TO BE FILLED WITH REAL DATA)

IMPORTANT:
This section must be updated from actual DB output.

Minimum required tables:

* aircraft
* workpacks
* tasks
* workpack_executions
* measurements
* (future) snags

Recommended action:

* Run schema dump:

  * `pg_dump --schema-only > schema.sql`
* Paste relevant structure here or attach schema.sql when asking for help

---

## 10. Development Rules (AI CONTRACT — STRICT)

When modifying code:

* ALWAYS return FULL FILES
* NEVER return partial snippets or diffs
* DO NOT remove existing logic unless required to fix a bug
* DO NOT refactor unless explicitly requested
* PRESERVE naming, structure, and formatting
* ASK for missing files instead of guessing
* ASSUME this is a production codebase

A response that violates these rules is considered incorrect.

---

## 11. Workflow Philosophy

* System must work for engineers in real conditions
* Speed and clarity > complexity
* Data capture must be:

  * Minimal friction
  * Structured
* Every feature must support:
  → better decision-making
  → better customer trust

---

## 12. Priority Order (DO NOT BREAK THIS)

1. Workpack reliability
2. Task execution stability
3. Measurement accuracy
4. Snag system implementation
5. Reporting / PDF fixes
6. Customer visibility

---

## 13. How to Use This Context

When asking for help:

Provide:

* This AI_CONTEXT.md
* The FULL file to be modified
* Any related files (if needed)
* Error messages (if applicable)

Then specify clearly:

* What must be fixed
* What must NOT be changed

---

END OF FILE
