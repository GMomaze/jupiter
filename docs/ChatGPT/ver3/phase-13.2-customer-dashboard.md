# Phase 13.2 - Customer Dashboard

## Status

DEFINE ONLY

This phase defines the Jupiter customer dashboard.

This phase does not implement code, change schema, alter execution behavior, or modify any workpack, task, snag, compliance, audit, planning, or lifecycle behavior established in other phases.

## Purpose

The purpose of this phase is to define a customer-facing dashboard that provides a clear operational overview for customer-owned aircraft without exposing internal controls or internal-only data.

The customer dashboard is a visibility surface only.

## Dashboard Content

The dashboard must show:

- aircraft status
- active workpacks
- upcoming maintenance
- compliance summary

### Aircraft Status

The dashboard must show the current status of each customer-owned aircraft.

This status is informational only.

### Active Workpacks

The dashboard must show active workpacks related to the customer’s own aircraft.

This includes workpacks currently relevant to ongoing or recent maintenance visibility.

### Upcoming Maintenance

The dashboard must show upcoming maintenance relevant to the customer’s own aircraft.

This information is intended to provide forward-looking visibility only.

### Compliance Summary

The dashboard must show compliance summary information relevant to the customer’s own aircraft.

This summary is informational and read-only.

## Behavior

The dashboard behavior is defined as:

- real-time read-only view
- filtered to customer aircraft only

All dashboard data must be sourced from stored system state only with no recalculation or inferred values at display time.

### Real-Time Read-Only View

The dashboard must reflect the current stored system state as seen by the customer at the time of access.

The dashboard is read-only.

The customer must not be able to modify operational records through the dashboard.

### Filtered To Customer Aircraft Only

All dashboard data must be filtered strictly to aircraft owned by or assigned to the current customer.

No aircraft outside customer scope may appear.

## Constraints

The following constraints are mandatory:

- no execution control
- no lifecycle changes
- no internal data exposed

### No Execution Control

The dashboard must not allow the customer to:

- start work
- complete tasks
- certify work
- close workpacks
- trigger execution actions

### No Lifecycle Changes

The dashboard must not change:

- workpack lifecycle
- task lifecycle
- snag lifecycle

### No Internal Data Exposed

The dashboard must not expose internal-only operational data.

This includes any internal notes, audit data, pricing data, or other restricted internal information not intended for customer visibility.

## Boundary

This phase defines customer dashboard visibility only.

It does not define:

- execution behavior
- lifecycle redesign
- schema implementation
- audit redesign
- customer write actions

Those concerns remain outside the scope of this phase.

## Final Statement

Phase 13.2 defines the Jupiter customer dashboard as a real-time read-only view filtered to customer-owned aircraft, showing aircraft status, active workpacks, upcoming maintenance, and compliance summary, while exposing no internal data and allowing no execution control or lifecycle changes.
