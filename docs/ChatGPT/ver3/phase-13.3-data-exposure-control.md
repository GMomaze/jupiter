# Phase 13.3 - Data Exposure Control

## Status

DEFINE ONLY

This phase defines customer-facing data exposure control for Jupiter.

This phase does not implement code, change schema, alter execution behavior, or modify any workpack, task, snag, compliance, audit, planning, or lifecycle behavior established in other phases.

## Purpose

The purpose of this phase is to define exactly what customer-visible data may be exposed and what data must remain restricted.

This phase also defines how exposure control must be enforced so customer isolation is guaranteed by the system, not by presentation alone.

## Allowed Exposure

The following data exposure is allowed:

- operational status
- compliance summary
- workpack progress

### Operational Status

Customers may view operational status information relevant to their own aircraft and related maintenance activity.

This status visibility is informational only.

### Compliance Summary

Customers may view compliance summary information relevant to their own aircraft.

This exposure is limited to customer-appropriate compliance visibility and does not include internal compliance control data beyond that scope.

### Workpack Progress

Customers may view workpack progress for workpacks related to their own aircraft.

This progress visibility is read-only and informational.

## Restricted Data

The following data must remain restricted:

- pricing
- internal notes
- audit logs
- internal identifiers

### Pricing

Pricing, internal cost data, commercial calculations, billing internals, and similar financial data must not be exposed unless explicitly defined by a separate future phase.

### Internal Notes

Internal notes, engineering notes, maintenance notes not intended for customer visibility, and internal operational commentary must not be exposed.

### Audit Logs

Audit logs, audit internals, audit event streams, and audit control data must not be exposed to customers.

### Internal Identifiers

Internal identifiers not intended for customer use must not be exposed.

This includes internal-only record identifiers, internal linkage identifiers, and technical implementation identifiers that are not part of the approved customer-visible scope.

## Enforcement

Data exposure control must be enforced as follows:

- server-side filtering
- strict customer scope isolation

All access must be validated against the customer–aircraft relationship at query level, not by trusting request parameters.

### Server-Side Filtering

Exposure control must be enforced on the server side.

UI-only hiding is not sufficient.

Restricted data must not be returned to customer-facing responses in the first place.

### Strict Customer Scope Isolation

All customer-visible responses must be strictly filtered to the current customer scope.

The system must ensure that one customer cannot access data belonging to another customer through direct navigation, altered requests, guessed identifiers, or other access paths.

## Invariants

The following invariants are locked:

- no cross-customer data leakage
- no internal data leakage

### No Cross-Customer Data Leakage

The system must prevent any exposure of aircraft, workpacks, task status, snag data, compliance summary, or other customer-visible records across customer boundaries.

### No Internal Data Leakage

The system must prevent exposure of restricted internal data through customer-facing APIs, pages, exports, or documents unless explicitly allowed by a separate future phase.

## Boundary

This phase defines customer-facing data exposure control only.

It does not define:

- schema changes
- lifecycle changes
- execution behavior
- audit redesign
- pricing workflows

Those concerns remain outside the scope of this phase.

## Final Statement

Phase 13.3 defines Jupiter data exposure control as a strict customer-scope boundary where only approved operational status, compliance summary, and workpack progress may be exposed, while pricing, internal notes, audit logs, and internal identifiers remain restricted, with server-side filtering and strict customer isolation required to prevent cross-customer or internal data leakage.
