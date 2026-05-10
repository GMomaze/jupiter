# Phase 17.2 - Customer Schema

## Status

DEFINE ONLY

This phase defines the database schema required for Jupiter customer master records and customer-aircraft links.

This phase does not implement code, does not create migrations, does not alter aircraft logic, does not implement customer portal access, does not implement permissions, and does not refactor existing behavior.

## Purpose

The purpose of this phase is to define the database schema for:

- customer master records
- customer-aircraft relationship links

This phase converts the Phase 17.1 customer-master definition into a concrete schema design for later implementation.

The schema must support:

- customer master storage
- one current customer per aircraft
- customer-aircraft history retention
- auditable ownership changes

## Scope

This phase defines:

- the `customers` table
- the `customer_aircraft_links` table
- required fields
- foreign keys
- uniqueness rules
- current ownership rules
- history support
- indexes
- audit expectations

## Out Of Scope

The following are out of scope for Phase 17.2:

- schema implementation
- migration creation
- code changes
- UI changes
- aircraft-page changes
- customer portal access
- permissions implementation
- invoicing workflows
- aircraft lifecycle redesign
- customer authentication design

This phase defines schema only.

## Schema Overview

The customer model must use two tables:

1. `customers`
2. `customer_aircraft_links`

The `customers` table stores the master customer record.

The `customer_aircraft_links` table stores aircraft ownership and relationship history.

This design preserves:

- customer master identity
- explicit aircraft ownership linkage
- one current customer per aircraft
- historical ownership retention

## Table: `customers`

The `customers` table is the master customer record.

It must contain one row per customer entity.

### Required Fields

The `customers` table must include:

- `id`
- `name`
- `contact_person`
- `email`
- `phone`
- `alternate_phone`
- billing address fields
- physical address fields
- `vat_number` or `tax_number`
- `account_reference`
- `status`
- `notes`
- `created_at`
- `updated_at`

### Field Definitions

#### `id`

- primary key
- unique identifier for the customer master record

#### `name`

- required
- primary business name of the customer

#### `contact_person`

- required
- primary human contact for the customer

#### `email`

- required
- customer contact email

#### `phone`

- required
- primary customer phone number

#### `alternate_phone`

- optional
- secondary phone number

#### Billing Address Fields

The billing-address section should support:

- `billing_address_line_1`
- `billing_address_line_2`
- `billing_city`
- `billing_state_or_province`
- `billing_postal_code`
- `billing_country`

These fields may be nullable depending on operational needs, but the schema must reserve them explicitly.

#### Physical Address Fields

The physical-address section should support:

- `physical_address_line_1`
- `physical_address_line_2`
- `physical_city`
- `physical_state_or_province`
- `physical_postal_code`
- `physical_country`

These fields may be nullable depending on operational needs, but the schema must reserve them explicitly.

#### `vat_number` / `tax_number`

- optional
- tax or VAT registration identifier for the customer

The schema may use either:

- separate `vat_number` and `tax_number`

or

- a single shared tax identifier field

The later implementation must choose one clear approach without losing the business meaning.

For schema-definition purposes, tax identity support is mandatory.

#### `account_reference`

- optional
- internal business account reference for the customer

#### `status`

- required
- allowed values:
  - `ACTIVE`
  - `INACTIVE`

This field defines whether the customer master record is active in operational use.

#### `notes`

- optional
- internal customer master notes

This field is master-record support data only.

It does not imply customer portal exposure.

#### `created_at`

- required timestamp

#### `updated_at`

- required timestamp

## Table: `customer_aircraft_links`

The `customer_aircraft_links` table stores the explicit relationship between customers and aircraft.

It must support both:

- one current customer per aircraft
- historical customer-aircraft relationships

### Required Fields

The `customer_aircraft_links` table must include:

- `id`
- `customer_id`
- `aircraft_id`
- `relationship_type`
- `is_current`
- `start_date`
- `end_date`
- `notes`
- `created_at`
- `updated_at`

### Field Definitions

#### `id`

- primary key
- unique identifier for the customer-aircraft relationship row

#### `customer_id`

- required
- foreign key to `customers.id`

#### `aircraft_id`

- required
- foreign key to `aircraft.id`

#### `relationship_type`

- required
- defines the business relationship of the customer to the aircraft

Expected values may include later-defined relationship categories such as:

- owner
- operator
- lessee
- managed customer

This phase requires the field but does not finalize the enum implementation format.

#### `is_current`

- required
- boolean current-relationship flag

This field identifies the active customer relationship for the aircraft.

#### `start_date`

- required
- date the customer-aircraft relationship became effective

#### `end_date`

- optional
- date the customer-aircraft relationship ceased being effective

This field supports ownership history retention.

#### `notes`

- optional
- operational notes for the specific customer-aircraft relationship

#### `created_at`

- required timestamp

#### `updated_at`

- required timestamp

## Foreign Keys

The following foreign keys are required:

### `customer_aircraft_links.customer_id`

Must reference:

- `customers.id`

### `customer_aircraft_links.aircraft_id`

Must reference:

- `aircraft.id`

This phase does not alter the `aircraft` table itself.

It only defines the foreign-key relationship from the link table to aircraft.

## Uniqueness Rules

The schema must enforce controlled uniqueness.

### Customer Identity Uniqueness

The phase does not require customer-name uniqueness by itself because business names may collide or change.

The implementation may add carefully chosen uniqueness on internal references if justified, but this phase does not force unique `name`.

### Account Reference Uniqueness

If `account_reference` is used as a true internal account identifier, it should be unique when present.

This should be implemented as:

- unique when non-null

### One Current Customer Per Aircraft

The schema must enforce that an aircraft can have only one current customer relationship at a time.

This means:

- only one `customer_aircraft_links` row per `aircraft_id` may have `is_current = true`

### Historical Rows Allowed

The schema must allow multiple historical rows for the same aircraft, as long as only one row is current.

This preserves ownership history.

## Current Ownership Rule

Jupiter must support one current customer per aircraft.

The current customer is the row in `customer_aircraft_links` where:

- `aircraft_id` matches the aircraft
- `is_current = true`

No second current row for the same aircraft may exist at the same time.

## History Support

The schema must retain customer-aircraft history.

### Historical Relationship Retention

When a current customer relationship ends, the existing row should become historical rather than being deleted.

This means the link row should remain stored with:

- `is_current = false`
- `end_date` populated where applicable

### Reassignment Support

Aircraft reassignment to another customer must be modeled by:

- closing the previous current row
- creating a new current row

This phase defines the storage model only.

It does not define the application workflow for reassignment.

## Indexes

The schema should define indexes that support common lookups and integrity enforcement.

### `customers` Indexes

Recommended indexes:

- primary key on `id`
- index on `status`
- index on `name`
- unique index on `account_reference` when non-null if that field is implemented as a unique business key

### `customer_aircraft_links` Indexes

Recommended indexes:

- primary key on `id`
- index on `customer_id`
- index on `aircraft_id`
- composite index on `aircraft_id`, `is_current`
- composite index on `customer_id`, `is_current`
- index on `start_date`
- index on `end_date`

### Current-Customer Enforcement Index

The schema should use a uniqueness mechanism that enforces:

- only one current row per aircraft

This will typically require a filtered or equivalent uniqueness strategy around:

- `aircraft_id` where `is_current = true`

This phase defines the rule, not the migration syntax.

## Audit Expectations

Customer schema changes must be auditable when implemented.

### `customers` Audit Expectations

Audit must capture:

- customer creation
- customer updates
- status changes
- key contact or account reference changes

### `customer_aircraft_links` Audit Expectations

Audit must capture:

- initial aircraft assignment
- reassignment
- current-flag change
- start-date and end-date change
- relationship-type change

### Audit Boundary

This phase does not redesign the audit system.

It requires later implementation to treat customer master and ownership-link mutations as auditable business events.

## Ownership / Visibility Boundary

The schema must support a future ownership boundary without implementing portal access now.

The current customer-aircraft link is the data boundary that later visibility enforcement must rely on.

This phase defines storage support only.

It does not implement access control.

## Design Constraints

The following constraints are locked for this schema definition:

- customer master record first
- aircraft linked through `customer_aircraft_links`
- one current customer per aircraft
- history retained through link rows
- no aircraft-table redesign in this phase
- no portal-access implementation in this phase
- no permission implementation in this phase
- no invoicing behavior in this phase

## Out-Of-Scope Items

The following remain out of scope for this schema phase:

- customer portal login schema
- customer document access schema
- invoicing schema
- permission tables or customer RBAC design
- customer-session authentication
- aircraft UI changes
- business workflow for reassignment

## Verification Requirements

Phase 17.2 is correctly defined only if all of the following are true:

- `customers` table is defined
- `customer_aircraft_links` table is defined
- required fields are defined for both tables
- foreign keys are defined
- uniqueness rules are defined
- one current customer per aircraft is defined
- history support is defined
- indexes are defined
- audit expectations are defined
- out-of-scope items are clearly excluded
- verification and completion criteria are defined

## Completion Criteria

Phase 17.2 is complete only when all of the following are true:

- the `customers` table is defined
- the `customer_aircraft_links` table is defined
- required fields are listed
- foreign keys are listed
- uniqueness rules are listed
- current-customer rule is defined
- historical relationship support is defined
- recommended indexes are defined
- audit expectations are defined
- out-of-scope items are defined
- no code changes were made
- no schema was implemented
- no migrations were created

## Final Statement

Phase 17.2 defines Jupiter customer storage as a two-table schema consisting of `customers` for the master customer record and `customer_aircraft_links` for explicit aircraft relationship tracking, with required customer identity and address fields, tax and account-reference support, one current customer per aircraft, retained ownership history, defined foreign keys, controlled uniqueness, recommended indexes, and auditable change expectations for later implementation.
