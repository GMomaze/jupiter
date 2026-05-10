# Phase 17.25 - Customer Portal UX / Navigation Lock

## Status

DEFINE ONLY

This phase defines and locks the allowed customer portal navigation structure and UX boundaries.

This phase does not implement code, does not change schema, does not change migrations, does not redesign permissions, does not redesign visibility boundaries, and does not refactor existing behavior.

This phase preserves all verified customer visibility boundaries and preserves customer session isolation.

## Purpose

The purpose of this phase is to define and lock the customer portal navigation structure and customer-safe UX boundary.

Jupiter must keep the customer portal clearly separated from staff, admin, planning, audit, and execution-control areas while providing only customer-safe navigation to approved customer-facing sections.

This phase defines portal UX and navigation boundaries only.

It does not expand visibility scope.

## Scope

This phase defines:

- the allowed customer portal navigation structure
- customer-safe navigation and menu boundaries
- forbidden internal navigation exposure
- customer-safe UX presentation rules
- session and logout UX rules
- exclusion of internal workflow-state exposure
- exclusion of operational-control UX exposure
- exclusion of planning, audit, and execution-control navigation exposure
- verification requirements
- completion criteria

## Out Of Scope

The following are out of scope for Phase 17.25:

- code changes
- schema changes
- migration changes
- permissions redesign
- visibility redesign
- customer visibility expansion
- staff/admin UX redesign
- portal authentication redesign
- internal routing redesign
- refactoring

This phase defines UX and navigation boundaries only.

## Allowed Customer Portal Navigation Structure

The customer portal must expose only a locked customer-safe navigation structure.

### Allowed Customer Navigation Areas

The customer portal may later expose navigation only to approved customer-facing areas such as:

- portal landing shell
- aircraft
- workpack summaries
- customer-safe documents
- customer-safe compliance summaries
- logout

### Locked Navigation Direction

The customer navigation structure must remain intentionally narrow and must not grow implicitly through reused internal route sets.

### Customer-Only Route Boundary

Customer navigation must remain within customer portal route space and customer-auth route space only.

## Customer-Safe Navigation / Menu Boundaries

Customer menus and navigation controls must remain customer-safe.

### Menu Safety Rule

Customer-facing menus must show only items that are explicitly approved for customer use.

### No Internal Terminology Leakage

Navigation labels must avoid exposing internal operational wording that implies internal workflow control, staff-only review stages, or hidden system mechanics.

### No Visibility Expansion By Menu

Navigation presence must not imply visibility beyond already approved customer visibility boundaries.

## Forbidden Internal Navigation Exposure

The customer portal must not expose internal or staff/admin navigation.

### Forbidden Navigation Targets

Customer users must not be shown navigation into:

- staff routes
- admin routes
- planning routes
- audit routes
- execution-control routes
- internal workflow routes
- internal reference-management routes

### No Route Leakage

The portal must not reveal hidden internal route names, route patterns, or operational navigation structures through menus, links, breadcrumbs, or empty-state hints.

## Customer-Safe UX Presentation Rules

Customer portal presentation must remain safe, clear, and intentionally limited.

### UX Boundary Rule

Customer-facing pages must present only customer-safe navigation, customer-safe summaries, and customer-safe identity context.

### Safe Presentation Direction

Customer UX should emphasize:

- clear section identity
- minimal safe context
- understandable summary presentation
- obvious logout access
- no internal operator assumptions

### No Internal Operator UX

The portal must not present UX patterns intended for mechanics, engineers, planners, supervisors, or admins.

## Session / Logout UX Rules

Customer session behavior must remain clear and customer-safe.

### Session Identity Context

The portal may show customer-safe signed-in identity context such as customer-user display name, email, and linked customer business name where safe.

### Logout Requirement

Logout must remain clearly available from the customer portal.

### No Session Confusion

Customer UX must not imply that customer session state is the same as staff or admin session state.

## No Internal Workflow-State Exposure

The portal must not expose internal workflow-state UX.

### Forbidden Workflow-State Exposure

Customer users must not see:

- internal gate states
- internal lock states
- internal approval states
- internal routing stages
- internal reviewer progress states

### Summary-Only Direction

If status is shown anywhere in the customer portal, it must remain customer-safe and summary-oriented.

## No Operational-Control UX Exposure

The portal must not expose operational-control UX.

### Forbidden Operational Controls

Customer users must not be shown:

- execution controls
- planning controls
- certification controls
- internal edit controls
- operational assignment controls
- workflow override controls

### Read-Safe Boundary

Customer UX in this phase remains navigation-safe and summary-safe rather than operations-safe for internal teams.

## No Planning / Audit / Execution-Control Navigation Exposure

Customer navigation must exclude internal operational sections entirely.

### No Planning Navigation

Customer users must not see navigation into planning views, planning sessions, planning queues, or planning metadata areas.

### No Audit Navigation

Customer users must not see navigation into audit logs, audit history, audit payloads, or internal actor history.

### No Execution-Control Navigation

Customer users must not see navigation into execution views, task execution controls, engineer/mechanic workflow areas, or control-state pages.

## Locked UX Constraints

The following constraints are explicitly preserved:

- customer portal remains customer-only
- no staff/admin route leakage
- no planning visibility
- no audit visibility
- no execution-control visibility
- no internal workflow-state leakage
- no hidden operational navigation exposure
- no permissions redesign in this phase
- no visibility-boundary expansion in this phase

## Verification Requirements

Phase 17.25 is correctly defined only if all of the following are true:

- the allowed customer portal navigation structure is defined
- customer-safe navigation and menu boundaries are defined
- forbidden internal navigation exposure is defined
- customer-safe UX presentation rules are defined
- session and logout UX rules are defined
- no internal workflow-state exposure is allowed
- no operational-control UX exposure is allowed
- no planning navigation exposure is allowed
- no audit navigation exposure is allowed
- no execution-control navigation exposure is allowed
- customer portal is explicitly preserved as customer-only
- no staff/admin route leakage is allowed
- no permissions redesign is introduced
- no visibility-boundary expansion is introduced

## Completion Criteria

Phase 17.25 is complete only when all of the following are true:

- the purpose is defined
- the scope is defined
- out-of-scope items are defined
- the allowed customer portal navigation structure is defined
- customer-safe navigation and menu boundaries are defined
- forbidden internal navigation exposure is defined
- customer-safe UX presentation rules are defined
- session and logout UX rules are defined
- no internal workflow-state exposure is explicitly preserved
- no operational-control UX exposure is explicitly preserved
- no planning/audit/execution-control navigation exposure is explicitly preserved
- verification requirements are defined
- completion criteria are defined
- no code changes were made
- no schema changes were made
- no migration changes were made
- no permissions redesign was performed
- no visibility redesign was performed
- no refactoring was performed
- verified customer visibility boundaries were preserved
- customer session isolation was preserved

## Final Statement

Phase 17.25 defines and locks Jupiter’s customer portal UX and navigation boundary as a customer-only structure limited to approved customer-facing sections, with customer-safe menus, customer-safe presentation, clear session and logout behavior, and explicit exclusion of staff/admin routes, planning, audit, execution-control, internal workflow states, hidden operational navigation, permissions redesign, and visibility-boundary expansion in this phase.
