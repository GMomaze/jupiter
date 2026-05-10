# Phase 17.1 - Customer Master Record

## Status

DEFINE ONLY

This phase defines the Jupiter customer master-record model and the relationship boundary between customers and aircraft.

This phase does not implement code, does not change schema, does not alter aircraft logic, does not implement customer portal access, does not refactor behavior, and does not introduce permission enforcement.

## Purpose

The purpose of this phase is to define how Jupiter will store customer master records and how aircraft will be linked to customers.

The required model order is:

1. customer master record first
2. aircraft linked to customer through a customer-aircraft relationship

This phase establishes the data-design boundary only.

It does not implement customer-facing access behavior.

## Scope

This phase defines:

- the customer master record
- required customer fields
- the customer-to-aircraft relationship model
- current ownership versus ownership history expectations
- customer ownership and visibility boundaries
- audit expectations for customer master data
- future implementation sequence

## Out Of Scope

The following are out of scope for Phase 17.1:

- customer portal login
- customer document access
- invoicing
- permissions implementation
- portal authorization enforcement
- schema implementation
- UI implementation
- aircraft lifecycle redesign
- customer billing workflow logic

This phase defines structure and boundaries only.

## Customer Master Record

Jupiter must store a dedicated customer master record before customer-aircraft linkage is introduced.

The customer record is the authoritative customer identity object for ownership and visibility purposes.

Aircraft must not become the place where customer identity is improvised or duplicated.

## Required Customer Fields

The customer master record must define the following required fields at minimum:

- name
- contact person
- email
- phone
- active or inactive status

The customer master record may also define billing and address fields where operationally needed.

### Name

The customer record must store the customer name as the primary business identity label.

### Contact Person

The customer record must store a contact-person field for the primary human contact associated with the customer.

### Email

The customer record must store an email field for customer communication.

### Phone

The customer record must store a phone field for operational contact.

### Billing / Address Fields

Billing and address fields are allowed in the customer master record where needed for operational completeness.

Expected fields may include:

- billing address line 1
- billing address line 2
- city
- state or province
- postal code
- country

These fields are part of customer master data only.

They do not define invoicing behavior in this phase.

### Active / Inactive Status

The customer master record must include an active/inactive status field.

This status controls whether the customer is treated as currently active in operational association and visibility contexts.

This phase does not define deactivation workflow logic beyond the existence of the status concept.

## Customer-To-Aircraft Relationship

Aircraft must link to customers through a customer-aircraft relationship.

The customer record must exist first.

The aircraft record must then be associated to the customer through that relationship boundary.

This relationship must be explicit.

Customer ownership must not be inferred from free text, workpack notes, billing text, or aircraft display labels.

## One Current Customer Versus Ownership History

Jupiter should define aircraft ownership using one current customer with support for relationship history.

### One Current Customer

An aircraft should have one current customer relationship at a time for active ownership and operational visibility purposes.

This gives Jupiter a clear current ownership boundary.

### Ownership History

The relationship model should support historical customer-aircraft links rather than assuming ownership never changes.

This means Jupiter should be able to preserve earlier customer associations as historical records once a different current customer relationship becomes active.

### Current Recommendation

The defined model for later implementation should be:

- one current active customer per aircraft
- historical customer-aircraft relationship retention supported by the relationship design

This phase defines the design intent only.

It does not define the exact schema mechanics yet.

## Customer Ownership / Visibility Boundary

Customer ownership and visibility must remain bounded by the customer-aircraft relationship.

### Ownership Boundary

The customer linked to an aircraft through the defined relationship is the customer that owns operational visibility for that aircraft.

### Visibility Boundary

Customer visibility must later be enforced from this relationship boundary.

Customer-visible aircraft, workpacks, task status, snag summaries, compliance summaries, and related customer-safe views must be scoped from this ownership model.

### No Portal Access In This Phase

This phase does not implement customer portal access.

It only defines the ownership boundary that later portal enforcement must use.

## Audit Requirements

Customer master records and customer-aircraft links must be auditable when implemented.

### Customer Master Audit

Customer create, update, activation, deactivation, and key ownership-affecting changes must be auditable.

### Customer-Aircraft Link Audit

Changes to aircraft-customer linkage must be auditable, especially:

- initial assignment
- reassignment
- historical closure of previous ownership
- activation or deactivation of current relationship

### Audit Boundary

This phase does not redesign audit behavior.

It only requires that customer master and ownership-link changes be treated as auditable business changes in later implementation phases.

## Ownership Design Constraints

The following constraints are locked for this definition:

- customer master record first
- aircraft linked through explicit customer-aircraft relationship
- no inferred ownership
- no aircraft logic redesign in this phase
- no portal access behavior in this phase
- no permission enforcement in this phase

## Future Phases

The expected future sequence is:

1. implement customer table
2. link aircraft to customer
3. expose customer info on aircraft page
4. later customer portal enforcement

### Implement Customer Table

A later phase should implement the customer master table based on this definition.

### Link Aircraft To Customer

A later phase should implement the customer-aircraft relationship based on the defined ownership boundary.

### Expose Customer Info On Aircraft Page

A later phase may expose customer master information on aircraft-facing operational pages where appropriate.

### Later Customer Portal Enforcement

A later phase may implement customer portal access and enforcement using this ownership model as the visibility foundation.

## Verification Requirements

This phase is correctly defined only if all of the following are true:

- customer master record is defined first
- required customer fields are defined
- customer-aircraft relationship is defined explicitly
- one current customer plus history support is defined
- ownership and visibility boundary is defined
- audit requirements are defined
- out-of-scope items are explicitly excluded
- future implementation sequence is defined

## Completion Criteria

Phase 17.1 is complete only when all of the following are true:

- the customer master record is defined
- required fields are defined
- the aircraft relationship model is defined
- current ownership versus history intent is defined
- customer ownership and visibility boundary is defined
- audit requirements are defined
- out-of-scope items are defined
- future phases are listed
- no code changes were made
- no schema changes were made
- no implementation was performed

## Final Statement

Phase 17.1 defines Jupiter customer data around a dedicated customer master record first, followed by an explicit customer-aircraft relationship, with one current customer per aircraft and support for historical ownership links, a clear ownership and visibility boundary, auditable customer and linkage changes, and later implementation phases for schema, aircraft linkage, aircraft-page visibility, and customer portal enforcement.
