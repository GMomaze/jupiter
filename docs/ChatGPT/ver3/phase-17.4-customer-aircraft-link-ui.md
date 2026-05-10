# Phase 17.4 - Customer Aircraft Link UI

## Status

DEFINE ONLY

This phase defines the Jupiter UI flow for customer master records and customer-aircraft linking.

This phase does not implement code, does not change schema, does not change migrations, does not implement permissions, does not implement customer portal access, does not refactor existing behavior, and does not redesign aircraft workflows.

## Purpose

The purpose of this phase is to define the UI flow for:

1. creating customer master records
2. linking aircraft to customers
3. viewing current customer ownership on aircraft pages

This phase establishes the UI behavior boundary that will sit on top of the customer master-record and customer-aircraft link model already defined in earlier phases.

## Scope

This phase defines:

- customer creation workflow
- customer edit workflow
- aircraft-to-customer linking workflow
- current customer display on aircraft pages
- historical ownership behavior in the UI
- validation rules
- audit expectations
- UI boundaries
- future portal considerations

This phase covers internal operational UI only.

## Out Of Scope

The following are out of scope for Phase 17.4:

- code changes
- schema changes
- migration changes
- permissions implementation
- customer portal implementation
- customer self-service access
- invoicing workflows
- redesign of aircraft workflows
- redesign of workpack workflows
- RBAC redesign

This phase defines UI behavior only.

## Customer Creation Workflow

Customer master record creation must happen before any aircraft ownership link is created.

### Create Customer First

The UI must require creation of a customer master record before the user can assign that customer to an aircraft.

Aircraft ownership must not be entered as free text directly on the aircraft record.

### Customer Create Form

The customer create UI should present a dedicated customer form for the master record.

The form should include at minimum:

- name
- contact person
- email
- phone
- alternate phone
- billing address fields
- physical address fields
- VAT or tax number
- account reference
- status
- notes

### Create Result

After successful customer creation, the system should return the user to:

- the customer detail record

or

- a linking flow where the newly created customer may be associated to an aircraft

This phase defines the workflow intent only, not the final route structure.

## Customer Edit Workflow

Customer master records must be editable as master records.

### Edit Existing Customer

The UI must allow an existing customer master record to be opened and edited without changing aircraft logic directly.

### Edit Scope

Editable fields should include the customer master fields already defined by the customer schema.

Editing the customer master record must not silently reassign aircraft ownership unless the aircraft-link workflow is explicitly used.

### Status Editing

The customer UI must allow the customer status to be maintained as:

- `ACTIVE`
- `INACTIVE`

This phase does not define the downstream business consequences of inactive status beyond preserving the field in UI.

## Aircraft-To-Customer Linking Workflow

Aircraft must be linked to customers through an explicit link workflow.

### Link From Aircraft Context

The primary UI should allow a user to link an aircraft to a customer from aircraft-facing operational UI.

This keeps ownership visible in aircraft context without redesigning the aircraft workflow itself.

### Link Requires Existing Customer

The aircraft-link UI must use an existing customer master record.

It must not create inferred ownership from free text or ad hoc labels.

### Link Inputs

The aircraft-link UI should capture:

- selected customer
- relationship type
- current/not current state as controlled by the workflow
- start date
- optional end date where appropriate
- notes

### Current Customer Assignment

The UI must preserve the rule that an aircraft may have only one current customer at a time.

If the user assigns a new current customer to an aircraft that already has one current customer, the workflow must treat that as a reassignment event rather than allowing two current links.

### Reassignment Behavior

The UI should guide the user through reassignment by:

- closing the existing current relationship
- preserving the old relationship as historical
- creating the new current relationship

This phase defines the intended UI behavior, not the implementation mechanics.

## Current Customer Display On Aircraft Pages

Aircraft pages must show the current customer ownership clearly.

### Current Customer Section

Aircraft pages should display a current customer section when a current customer link exists.

That section should show customer master information appropriate for internal operational users, such as:

- customer name
- contact person
- email
- phone
- account reference where relevant

### No Ownership Inference

If an aircraft has no current customer link, the aircraft page must show that no current customer is assigned.

The UI must not infer ownership from older links, notes, or unrelated records.

### Internal Operational Display Only

This display is for internal operational UI only in this phase.

It does not define customer portal visibility.

## Historical Ownership Behavior

The UI must preserve historical ownership rather than overwrite it invisibly.

### History Retention

When a current customer relationship changes, the previous relationship must remain visible as historical ownership data.

### Historical Section

Aircraft UI should support a historical ownership section or equivalent view where older customer-aircraft links may be reviewed.

### Current Versus Historical Clarity

The UI must clearly separate:

- current customer
- historical customer links

The system must not blur those two concepts together.

## Validation Rules

The UI must enforce the customer and link model clearly.

### Customer Validation

Customer creation and edit UI must require the mandatory master-record fields defined in earlier phases.

At minimum, the UI must require:

- name
- contact person
- email
- phone
- status

### Link Validation

Aircraft-link UI must validate:

- customer exists
- aircraft exists
- relationship type provided
- start date provided
- no second current customer for the same aircraft
- end date not earlier than start date

### No Free-Text Ownership

Ownership entry by free text alone must not be allowed as a substitute for master customer selection.

## Audit Expectations

Customer and ownership-link UI actions must produce auditable business changes once implemented.

### Customer UI Audit

The following UI actions must be auditable:

- create customer
- edit customer
- activate customer
- deactivate customer

### Aircraft-Link UI Audit

The following UI actions must be auditable:

- assign customer to aircraft
- reassign aircraft to different customer
- close a current customer relationship
- edit a relationship record where allowed

### No Audit Redesign

This phase does not redesign audit behavior.

It only requires the UI workflow to respect that customer and ownership changes are auditable events.

## UI Boundaries

This phase must preserve the customer-ownership UI boundary without expanding into unrelated system areas.

### Customer Master Record First

The UI must always preserve customer master record creation before aircraft ownership assignment.

### One Current Customer Per Aircraft

The UI must preserve one current customer per aircraft.

### Historical Ownership Retention

The UI must preserve history rather than replace ownership silently.

### No Inferred Ownership

The UI must not infer ownership from notes, workpacks, invoice text, or aircraft labels.

### No Portal Access In This Phase

This phase does not implement customer portal behavior.

### No Permissions Enforcement In This Phase

This phase does not implement permissions logic.

It only defines the UI flow and boundaries.

## Future Portal Considerations

This phase must leave the ownership model usable by a later customer portal without implementing that portal now.

### Ownership As Portal Basis

The current customer-aircraft relationship defined here should become the later basis for customer-visible aircraft scoping.

### No Portal Logic Yet

No customer login, customer self-service, or customer document access is introduced in this phase.

### Future Compatibility

The UI design should keep customer master and ownership data structured cleanly so future portal enforcement can rely on it without reinterpreting ownership.

## Verification Requirements

Phase 17.4 is correctly defined only if all of the following are true:

- customer creation workflow is defined
- customer edit workflow is defined
- aircraft-to-customer linking workflow is defined
- current customer display on aircraft pages is defined
- historical ownership behavior is defined
- validation rules are defined
- audit expectations are defined
- UI boundaries are defined
- future portal considerations are defined
- required preserved constraints remain explicit

## Completion Criteria

Phase 17.4 is complete only when all of the following are true:

- the purpose is defined
- the scope is defined
- out-of-scope items are defined
- customer creation workflow is defined
- customer edit workflow is defined
- aircraft-link workflow is defined
- current customer display behavior is defined
- historical ownership behavior is defined
- validation rules are defined
- audit expectations are defined
- UI boundaries are defined
- future portal considerations are defined
- verification requirements are defined
- completion criteria are defined
- no code changes were made
- no schema changes were made
- no migrations were changed

## Final Statement

Phase 17.4 defines Jupiter’s internal customer-aircraft UI flow as a master-record-first workflow where customer records are created and maintained independently, aircraft are linked only through explicit customer-aircraft relationships, one current customer per aircraft is preserved, historical ownership is retained and visible, no ownership is inferred, and no portal access or permissions enforcement is introduced in this phase.
