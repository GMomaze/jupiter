# Phase 17.5B - Customer Schema Multi-Owner Correction

## Status

DEFINE ONLY

This phase defines the schema correction required to replace the one-current-customer-per-aircraft rule with a role-based multi-owner customer-aircraft relationship model.

This phase does not implement code, does not change schema yet, does not create migrations yet, does not change UI, does not perform portal work, and does not proceed to Phase 17.6.

## Purpose

The purpose of this phase is to correct the customer-aircraft schema assumptions so Jupiter supports multiple simultaneous current customer relationships per aircraft.

The earlier one-current-customer-per-aircraft rule must be removed and replaced with a role-based current-link model.

This phase defines the corrected schema direction only.

It does not perform the migration or model change.

## Scope

This phase defines:

- removal or replacement of the one-current-customer-per-aircraft constraint
- allowed `relationship_type` values
- revised uniqueness rules
- how multiple current rows are allowed
- what remains historical
- indexes required for aircraft, customer, and role lookups
- required migration correction
- required model correction
- verification requirements
- completion criteria

## Out Of Scope

The following are out of scope for Phase 17.5B:

- code changes
- schema implementation
- migration implementation
- UI changes
- controller changes
- service changes
- portal work
- permissions work
- authentication work
- Phase 17.6 work

This phase defines schema correction only.

## Schema Correction Summary

The earlier assumption:

- one current customer per aircraft

must be removed.

The corrected rule is:

- an aircraft may have multiple current customer-aircraft relationship rows at the same time
- each row represents one active customer role on that aircraft
- uniqueness must be role-aware rather than aircraft-wide single-current

## Constraint Removal / Replacement

The one-current-customer-per-aircraft constraint must be removed or replaced.

### Constraint To Remove

Any existing uniqueness rule or filtered unique index equivalent to:

- only one row per `aircraft_id` where `is_current = true`

must be removed.

This rule is incompatible with the corrected multi-owner model.

### Replacement Direction

The replacement schema must allow multiple current rows per aircraft while still preventing invalid duplicate role rows.

The new constraint direction must be relationship-role aware.

## Allowed `relationship_type` Values

The schema must define controlled allowed values for `relationship_type`.

Required values are:

- `OWNER`
- `CO_OWNER`
- `OPERATOR`
- `BILLING_CUSTOMER`
- `MANAGEMENT_COMPANY`
- `CONTACT_ONLY`

### Controlled Role Set

`relationship_type` must no longer be treated as an unconstrained free-form label.

The schema correction must treat it as a controlled business-role field.

### Role Meaning

These values represent distinct business relationships and must remain separately queryable and enforceable.

## Revised Uniqueness Rules

Uniqueness must be revised to support multiple current rows safely.

### Rule To Eliminate

The system must no longer enforce:

- only one current row per aircraft

### Revised Role-Based Direction

The schema should prevent duplicate active rows for the same exact customer-role combination on the same aircraft.

The corrected uniqueness direction should be based on:

- `aircraft_id`
- `customer_id`
- `relationship_type`
- current-state applicability

### Recommended Current-Row Uniqueness Rule

The recommended uniqueness direction is:

- only one current row for the same `aircraft_id + customer_id + relationship_type`

This allows:

- multiple different current roles on the same aircraft
- multiple current customers on the same aircraft
- the same customer to hold multiple different current roles if later allowed by business rules

This prevents:

- duplicate current rows representing the exact same relationship role for the same customer on the same aircraft

### Historical Rows Must Still Be Allowed

Historical rows with the same customer and role must remain allowed once older current rows are closed.

## How Multiple Current Rows Are Allowed

The corrected model must explicitly allow multiple current rows.

### Multiple Current Rows Per Aircraft

Multiple rows where `is_current = true` may exist for the same `aircraft_id` as long as they represent valid distinct active relationships.

### Examples Of Allowed Current Combinations

The schema must allow combinations such as:

- one `OWNER` and one `BILLING_CUSTOMER`
- one `OWNER` and one `MANAGEMENT_COMPANY`
- one `OWNER` and multiple `CO_OWNER`
- one `OPERATOR` and one `CONTACT_ONLY`

### No Aircraft-Wide Single Current Gate

Current-state enforcement must operate at the relationship-row level, not as an aircraft-wide exclusivity rule.

## Historical Relationship Retention

Historical relationship retention remains required.

### What Must Remain Historical

When a current relationship row ends, the row must remain stored as historical rather than being deleted.

Historical state should continue to be represented by:

- `is_current = false`
- `end_date` populated where applicable

### Historical Retention Applies Per Role Row

History is retained per customer-aircraft-role relationship row.

Ending one role must not affect unrelated current roles on the same aircraft.

### No Destructive Overwrite

A new current role row must not erase prior historical relationship rows.

## Index Requirements

The corrected schema needs indexes that support role-aware lookup patterns.

### Required Core Indexes

Recommended indexes must include:

- primary key on `id`
- index on `customer_id`
- index on `aircraft_id`
- index on `relationship_type`
- index on `is_current`

### Recommended Composite Indexes

Recommended composite indexes should include:

- `aircraft_id`, `is_current`
- `customer_id`, `is_current`
- `aircraft_id`, `relationship_type`, `is_current`
- `customer_id`, `relationship_type`, `is_current`
- `aircraft_id`, `customer_id`, `relationship_type`
- `start_date`
- `end_date`

### Recommended Uniqueness Index Direction

A current-row uniqueness rule should be enforced on a role-aware basis, typically equivalent to:

- unique current relationship for `aircraft_id + customer_id + relationship_type`

This phase defines the rule, not the exact migration syntax.

## Required Migration Correction

Phase 17.3 migration assumptions must be corrected in a later implementation phase.

### Migration Change Required

The migration must later be corrected to remove any uniqueness enforcement that limits an aircraft to one current customer row.

### Replace With Role-Aware Uniqueness

The migration must later add role-aware uniqueness consistent with the corrected multi-owner model.

### Relationship Type Constraint Required

The migration correction must also enforce the allowed `relationship_type` set as a controlled schema value or equivalent constrained rule.

### Preserve Existing Historical Logic

Historical support fields must remain:

- `is_current`
- `start_date`
- `end_date`

The correction changes current-role logic, not the requirement for historical retention.

## Model Correction Requirements

The model layer must be corrected in a later implementation phase.

### CustomerAircraftLink Model Correction

The `CustomerAircraftLink` model must treat `relationship_type` as a controlled allowed business-role value.

### Remove Singular Current-Customer Assumption

The model layer must not imply a single current customer for an aircraft.

### Preserve Historical Support

Model behavior must still support:

- current rows
- historical rows
- role-aware relationship lookups

### Validation Direction

Model validation should later ensure:

- valid `relationship_type`
- valid date ordering
- compatibility with the corrected uniqueness rules

## Schema Behavior Summary

The corrected schema behavior must preserve all of the following:

- multiple current customer-aircraft rows per aircraft are allowed
- relationship roles are controlled values
- duplicate current rows for the same exact customer-role-aircraft combination are prevented
- historical rows remain retained
- aircraft-wide single-current exclusivity is removed

## Verification Requirements

Phase 17.5B is correctly defined only if all of the following are true:

- the one-current-customer-per-aircraft rule is explicitly removed or replaced
- allowed `relationship_type` values are explicitly defined
- revised uniqueness rules are defined
- multiple current rows are explicitly allowed
- historical relationship retention remains defined
- required indexes are defined
- required migration correction is defined
- required model correction is defined
- verification and completion criteria are defined

## Completion Criteria

Phase 17.5B is complete only when all of the following are true:

- the schema correction purpose is defined
- the constraint removal or replacement is defined
- allowed `relationship_type` values are defined
- revised uniqueness rules are defined
- multiple-current-row behavior is defined
- historical-retention behavior is defined
- required indexes are defined
- migration correction requirements are defined
- model correction requirements are defined
- verification requirements are defined
- completion criteria are defined
- no code changes were made
- no schema changes were made
- no migrations were changed
- no UI changes were made
- no portal work was performed
- Phase 17.6 was not started

## Final Statement

Phase 17.5B defines the schema correction needed to replace Jupiter’s earlier one-current-customer-per-aircraft rule with a role-based multi-owner model in which multiple current customer-aircraft relationship rows may coexist for the same aircraft, `relationship_type` becomes a controlled business-role field, uniqueness becomes role-aware instead of aircraft-wide singular, historical relationship retention remains mandatory, and the required migration and model corrections are identified for later implementation.
