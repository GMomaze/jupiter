# Phase 13.1 - Customer Scope

## Status

DEFINE ONLY

This phase defines customer-facing scope for Jupiter.

This phase does not implement code, change schema, alter execution behavior, or modify any workpack, task, snag, compliance, audit, planning, or lifecycle behavior established in other phases.

## Purpose

The purpose of this phase is to define what a customer may see and do in the Jupiter system while preserving strict separation from internal operational controls and data.

Customer scope is visibility and limited interaction only.

## Access

Customer access is restricted as follows:

- customer sees only own aircraft

### Own Aircraft Only

A customer must only be able to view aircraft that belong to that customer.

A customer must not be able to view:

- aircraft belonging to other customers
- shared internal fleet data outside their assigned scope

Customer access must be enforced through a defined relationship between customer and aircraft at query level.

## Visible Data

The following information may be visible to the customer:

- aircraft info
- workpacks
- task status as read-only
- snags as read-only
- compliance summary

### Aircraft Info

The customer may view aircraft identity and operational reference information relevant to their own aircraft.

### Workpacks

The customer may view workpacks related to their own aircraft.

This visibility is informational only.

### Task Status

The customer may view task status for workpack tasks related to their own aircraft.

Task visibility is read-only.

The customer must not be able to change task execution state.

### Snags

The customer may view snag information related to their own aircraft.

Snag visibility is read-only unless optional customer feedback or customer snag submission is enabled by later implementation rules.

### Compliance Summary

The customer may view compliance summary information relevant to their own aircraft and workpacks.

This summary is informational only.

## Hidden Data

The following information must be hidden from the customer:

- pricing
- internal notes
- audit data
- other customers

### Pricing

Pricing, costing, billing, or internal commercial values must not be exposed through customer scope unless explicitly defined by a separate future phase.

### Internal Notes

Internal-only notes, engineer notes, supervisor notes, or operational commentary not intended for the customer must remain hidden.

### Audit Data

Audit records, audit internals, audit history, and audit control data must not be visible to the customer under this phase.

### Other Customers

A customer must not be able to see the identity, records, aircraft, workpacks, or operational data of any other customer.

## Permissions

Customer permissions are defined as:

- read-only
- optional feedback or snags

### Read-Only

By default, customer access is read-only.

The customer must not be able to:

- start work
- complete tasks
- certify work
- close workpacks
- alter lifecycle state

### Optional Feedback Or Snags

The system may later allow limited customer-originated feedback or snag submission.

If enabled, that capability must remain separate from execution control and lifecycle control.

This phase defines the permission boundary only.

It does not define implementation details for customer feedback or snag submission.

## Constraints

The following constraints are mandatory:

- no execution control
- no lifecycle changes

### No Execution Control

Customer scope must not allow the customer to trigger or control:

- workpack execution
- task execution
- certification
- close actions

### No Lifecycle Changes

Customer scope must not modify:

- workpack lifecycle
- task lifecycle
- snag lifecycle

Customer visibility must remain separate from internal operational lifecycle control.

## Boundary

This phase defines customer visibility and permission scope only.

It does not define:

- schema changes
- execution logic
- lifecycle redesign
- audit redesign
- pricing workflows

Those concerns remain outside the scope of this phase.

## Final Statement

Phase 13.1 defines Jupiter customer scope as a restricted customer-facing view where a customer can see only their own aircraft and related read-only operational information such as aircraft details, workpacks, task status, snags, and compliance summary, while pricing, internal notes, audit data, and all other customers remain hidden, and no execution control or lifecycle changes are permitted.
