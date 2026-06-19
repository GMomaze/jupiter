# Phase 12 - Audit / Explainability Review

## Mode

DEFINE only.

No implementation, code changes, migrations, services, route changes, RBAC changes, due-engine changes, workpack changes, or refactors are part of this phase definition.

## Goal

Define a unified auditability and explainability model across the Phase 1-11 utilisation and due-tracking authorities.

Authorities reviewed:

- `UtilisationService`
- `UtilisationPropagationPreviewService`
- `ComponentLifeCalculationService`
- `DueStatusService`
- `ComponentLimitMonitoringService`
- `ComplianceDueRecalculationService`
- `ScheduledTaskDueRecalculationService`
- `CalendarDueMonitorService`

The goal is not to make every calculated result an audit event. The goal is to make it possible for QA, planners, engineers, and auditors to answer:

- Why is this due?
- Why is this overdue?
- Why is this UNKNOWN?
- Why did this value change?
- Which source record caused the change?

## Current Implementation Status

Status: PARTIAL.

Jupiter has strong mutation audit structures and increasingly strong calculation explanation contracts, but the explanation shape is not yet unified across services.

Existing strengths:

- immutable generic audit log;
- immutable hash-chained workpack audit logs;
- immutable utilisation events;
- explicit utilisation audit records for event creation and aircraft snapshot update;
- backend due explanation fields in `DueStatusService`;
- backend component-life explanation fields in `ComponentLifeCalculationService`;
- backend due recalculation result contracts for component limits, compliance, scheduled tasks, and calendar monitoring.

Current gaps:

- no single shared `ExplainabilityResult` contract used by all authorities;
- calculated results are not consistently linked to source record identifiers in a normalized way;
- preview-only explanations and persisted audit events are not documented together;
- compliance SB update flow still has mutable status records without obvious `AuditService.log()` use in `AircraftService.updateServiceBulletinCompliance()`;
- recalculation services return explainability but do not persist audit evidence for manual recalculation requests;
- UNKNOWN reasons exist in most calculation services, but naming and nesting differ by service;
- governing-limit explanations exist in due services, but not all upstream services expose the same top-level field names.

## Files Inspected

Audit structures:

- `src/models/audit/AuditLog.ts`
- `src/modules/audit/audit.service.ts`
- `src/modules/audit/audit.routes.ts`
- `migrations/180_create_audit_log.ts`
- `src/models/audit/WorkpackAuditLog.ts`
- `src/models/audit/WorkpackSnagAuditLog.ts`
- `src/modules/workpacks/services/workpack-audit.service.ts`
- `migrations/350_create-workpack-audit-log.ts`
- `migrations/420_create_workpack_snag_audit_log.ts`
- `src/models/UtilisationEvent.ts`
- `src/modules/utilisation/utilisation.service.ts`

Authorities:

- `src/modules/utilisation/utilisation.service.ts`
- `src/modules/utilisation/utilisation-propagation-preview.service.ts`
- `src/modules/aircraft/component-life-calculation.service.ts`
- `src/modules/due-status/due-status.service.ts`
- `src/modules/aircraft/component-limit-monitoring.service.ts`
- `src/modules/compliance/compliance-due-recalculation.service.ts`
- `src/modules/tasks/scheduled-task-due-recalculation.service.ts`
- `src/modules/calendar-due/calendar-due-monitor.service.ts`

Related existing audit consumers:

- `src/modules/aircraft/aircraft.service.ts`
- `src/modules/workpacks/services/task-execution.service.ts`
- `src/modules/workpacks/services/snag.service.ts`
- `src/modules/workpacks/services/workpack-lifecycle.service.ts`
- `src/modules/workpacks/services/workpack-planning.service.ts`
- `src/modules/workpacks/services/workpack-service-bulletin.service.ts`

## Existing Audit Structures

### Generic Audit Log

Model:

- `src/models/audit/AuditLog.ts`

Fields verified:

- `id`
- `table_name`
- `row_id`
- `action`
- `actor_id`
- `old_values`
- `new_values`
- `reason`
- `created_at`

Protection:

- update and delete hooks throw `AUDIT_LOG_IMMUTABLE`.

Service:

- `src/modules/audit/audit.service.ts`

Behavior:

- `AuditService.log()` requires `row_id`;
- validates actor id exists before storing it;
- stores old/new values as JSON;
- `getLogs()` supports filtering by table and actor.

Routes:

- `src/modules/audit/audit.routes.ts`
- mounted under `/audit` in `src/app.ts`.

Migration:

- `migrations/180_create_audit_log.ts`
- creates indexes on `table_name`, `row_id`, `actor_id`, and `created_at`.

### Workpack Audit Logs

Models:

- `src/models/audit/WorkpackAuditLog.ts`
- `src/models/audit/WorkpackSnagAuditLog.ts`

Fields verified:

- workpack/task or snag references;
- `user_id`;
- `action`;
- `field`;
- `old_value`;
- `new_value`;
- `metadata`;
- `previous_hash`;
- `hash`;
- `sequence`;
- `created_at`.

Protection:

- update and delete hooks throw `AUDIT_LOG_IMMUTABLE`.

Service:

- `src/modules/workpacks/services/workpack-audit.service.ts`

Behavior:

- appends execution and snag audit entries;
- locks latest entry, increments sequence, computes SHA-256 hash over normalized payload;
- preserves previous hash chain.

Migrations:

- `migrations/350_create-workpack-audit-log.ts`
- `migrations/420_create_workpack_snag_audit_log.ts`

### Utilisation Events

Model:

- `src/models/UtilisationEvent.ts`

Fields verified:

- `aircraft_id`
- `source_type`
- `source_reference`
- `effective_date`
- `previous_total_time_hours`
- `new_total_time_hours`
- `delta_hours`
- `previous_total_time_cycles`
- `new_total_time_cycles`
- `delta_cycles`
- `reason`
- `correction_of_event_id`
- `metadata`
- `created_by`
- `created_at`

Protection:

- update and delete hooks throw `UTILISATION_EVENT_IMMUTABLE`.

Mutation authority:

- `UtilisationService.recordUtilisation()`.

Audit behavior:

- writes `UTILISATION_EVENT_CREATED` to `audit_log`;
- writes `UTILISATION_SNAPSHOT_UPDATED` to `audit_log`;
- temporary legacy TBO compatibility can write `AIRCRAFT_GROUNDED_TBO_EXCEEDED`.

### Compliance Audit Records

Current status: PARTIAL.

Found examples:

- Workpack service bulletin integration uses `AuditService.log()`.
- Workpack task/snags/lifecycle services use generic audit and workpack hash-chain audit.

Gap:

- `AircraftService.updateServiceBulletinCompliance()` updates or creates `AircraftSbCompliance` records but no direct `AuditService.log()` call was found in that method.
- `ComplianceDueRecalculationService` returns explainability but does not persist audit entries for recalculation results.

### Existing Explainability Structures

Existing calculation services already return explanatory fields:

- `ComponentLifeCalculationService`
  - dimension status;
  - value;
  - tracking basis;
  - baseline used;
  - current meter value;
  - delta applied;
  - missing reason;
  - explanation.
- `DueStatusService`
  - item type;
  - tracking basis;
  - current value;
  - due value;
  - remaining value;
  - threshold used;
  - governing limit;
  - status;
  - unknown reason(s);
  - explanation.
- `ComponentLimitMonitoringService`
  - component identity;
  - limit type;
  - tracking basis;
  - current value;
  - limit value;
  - remaining value;
  - due status;
  - severity;
  - source baseline;
  - unknown reason;
  - due-status detail;
  - explanation.
- `ComplianceDueRecalculationService`
  - compliance type;
  - reference;
  - applicability;
  - current aircraft values;
  - last compliance basis;
  - next due basis;
  - recurrence;
  - due status;
  - governing limit;
  - remaining value;
  - unknown reason;
  - explanation.
- `ScheduledTaskDueRecalculationService`
  - task identity;
  - source program;
  - applicability;
  - interval;
  - current aircraft values;
  - last compliance;
  - next due;
  - due status;
  - governing limit;
  - remaining value;
  - unknown reason;
  - due detail;
  - explanation.
- `CalendarDueMonitorService`
  - item type;
  - reference;
  - current date;
  - due date;
  - remaining days;
  - status;
  - governing limit;
  - unknown reason;
  - source service;
  - source domain;
  - explanation.

## Explainability Inventory By Authority

### UtilisationService

Current explainability output:

- immutable utilisation event records previous/new hours and cycles, deltas, source, effective date, reason, actor, correction linkage, and metadata;
- audit entries record event creation and aircraft snapshot update;
- correction events force `source_type = CORRECTION`.

Missing or weak output:

- no separate reusable explainability object returned for UI/API beyond `{ aircraft, event }`;
- legacy TBO compatibility audit is behavior-specific and not yet linked into the unified due-status explanation model;
- no standardized `authority` or `source_records` wrapper around the returned event.

Required Phase 12 definition:

- utilisation events are the source record for "why did aircraft hours/cycles change?";
- audit entries prove the event and snapshot mutation occurred;
- future UI/API should wrap the event in the unified explainability contract when presenting it outside the raw event model.

### UtilisationPropagationPreviewService

Current explainability output:

- current/proposed aircraft hours and cycles;
- deltas;
- classification `NORMAL` or `CORRECTION`;
- validation warnings;
- correction warning with downstream warning;
- affected component current/projected life;
- component warnings;
- due placeholders marked `NOT_CALCULATED_IN_PHASE_5`;
- boundary notice that preview is read-only.

Missing or weak output:

- no persisted preview id;
- no audit record, by design;
- no unified `source_records` list;
- due/compliance impact remains placeholder unless later backend services are integrated.

Required Phase 12 definition:

- preview is explainability-only and must not be audited as if it changed data;
- preview may be logged in application telemetry later, but not in immutable audit unless it becomes a regulated workflow action;
- confirmed utilisation event is the audit source, not the preview.

### ComponentLifeCalculationService

Current explainability output:

- status `CALCULATED` or `UNKNOWN`;
- values for TSN/TSO/CSN/CSO;
- tracking basis;
- baseline used;
- current meter value;
- delta applied;
- missing reason;
- explanation text.

Missing or weak output:

- no top-level `source_records` array;
- source record ids are implicit in installation/life-state inputs, not normalized in output;
- no direct audit relationship because calculations are live-derived.

Required Phase 12 definition:

- component life calculations should explain from:
  - installation id;
  - serialized component id;
  - aircraft id;
  - tracking basis;
  - install baselines;
  - current aircraft snapshot;
  - life-state/manual source where used.

### DueStatusService

Current explainability output:

- shared due states;
- current value, due value, remaining value;
- threshold;
- governing limit;
- governing limits;
- unknown reason(s);
- explanation;
- deterministic most-restrictive selection.

Missing or weak output:

- no source records because the service is intentionally generic;
- no audit because it is a pure calculation helper.

Required Phase 12 definition:

- `DueStatusService` remains the status explanation authority, but callers must attach domain source records.

### ComponentLimitMonitoringService

Current explainability output:

- component identity;
- limit type;
- tracking basis;
- current value;
- limit value;
- remaining value;
- due status;
- severity;
- source baseline;
- unknown reason;
- due-status detail;
- explanation.

Missing or weak output:

- no normalized source records for `ComponentLifeLimit`, installation, component model, and life-state;
- no audit for monitor execution;
- no persisted snapshot.

Required Phase 12 definition:

- monitoring results are calculated, not audited, unless persisted later;
- source records must include component, installation, life limit, and life calculation source.

### ComplianceDueRecalculationService

Current explainability output:

- compliance type;
- reference and title;
- applicability source/reason;
- current aircraft hours/cycles/date;
- last compliance basis;
- next due basis;
- recurrence;
- due status;
- governing limit;
- remaining value;
- unknown reason;
- explanation.

Missing or weak output:

- no persisted recalculation audit;
- no normalized source records array;
- AD/SB/SID source record identifiers are spread through item fields and compliance status rows.

Required Phase 12 definition:

- compliance due result must identify:
  - AD/SB/SID source record;
  - aircraft compliance or SID status row;
  - applicability source;
  - utilisation event or manual trigger when relevant.

### ScheduledTaskDueRecalculationService

Current explainability output:

- task identity;
- source program/template;
- applicability;
- interval type and values;
- current aircraft values;
- last compliance basis;
- next due basis;
- due status;
- governing limit;
- remaining value;
- unknown reason;
- due detail;
- explanation.

Missing or weak output:

- no persisted recalculation audit;
- source records are structured but not in a unified contract;
- imported baselines are caller-supplied and not inherently auditable unless stored elsewhere.

Required Phase 12 definition:

- scheduled task explanation must identify:
  - task/template/program source;
  - workpack/task completion evidence where used;
  - imported baseline source where used;
  - governing interval.

### CalendarDueMonitorService

Current explainability output:

- item type;
- reference;
- current date;
- due date;
- remaining days;
- status;
- governing limit;
- unknown reason;
- source service;
- source domain;
- explanation.

Missing or weak output:

- manual recalculation requests are not audited;
- no persisted result snapshot;
- source record identifiers are mostly inherited from underlying service results, not normalized.

Required Phase 12 definition:

- calendar monitor results remain calculated unless persisted later;
- manual recalculation requests should later be auditable as "requested/report generated" events without auditing every read-only row as a mutation.

## Unified Explainability Contract

Define a common backend result shape for future services and presentation layers.

```ts
type ExplainabilityResult = {
  authority:
    | 'UtilisationService'
    | 'UtilisationPropagationPreviewService'
    | 'ComponentLifeCalculationService'
    | 'DueStatusService'
    | 'ComponentLimitMonitoringService'
    | 'ComplianceDueRecalculationService'
    | 'ScheduledTaskDueRecalculationService'
    | 'CalendarDueMonitorService';
  mode: 'MUTATION' | 'PREVIEW' | 'LIVE_CALCULATION' | 'READ_ONLY_RECALCULATION';
  item_type: string;
  item_reference: string | null;
  item_id: string | null;
  aircraft_id: string | null;
  component_id: string | null;
  calculation_basis: {
    tracking_basis: string | null;
    basis_type: string | null;
    baseline: Record<string, unknown>;
    current_value_source: string | null;
  };
  governing_limit: unknown;
  current_value: number | string | null;
  target_value: number | string | null;
  remaining_value: number | string | null;
  status: string | null;
  severity: string | null;
  explanation_text: string;
  unknown_reason: string | null;
  source_records: Array<{
    table_name: string;
    row_id: string | null;
    role:
      | 'AUTHORITY_EVENT'
      | 'SNAPSHOT'
      | 'BASELINE'
      | 'LIMIT'
      | 'COMPLIANCE_RECORD'
      | 'APPLICABILITY_RECORD'
      | 'TASK_RECORD'
      | 'WORKPACK_RECORD'
      | 'MANUAL_INPUT'
      | 'DERIVED_INPUT';
    description: string;
  }>;
  audit_records: Array<{
    table_name: string;
    row_id: string;
    action: string;
  }>;
  calculated_at: string;
};
```

Rules:

- mutation authorities must include relevant audit record references where available;
- preview authorities must declare `mode = PREVIEW` and usually have empty `audit_records`;
- live calculations must declare `mode = LIVE_CALCULATION`;
- manual read-only recalculation reports must declare `mode = READ_ONLY_RECALCULATION`;
- `source_records` must identify the records used to produce the result;
- `unknown_reason` must be non-null when status is `UNKNOWN`;
- `governing_limit` must be non-null when a due/limit status is not `UNKNOWN` or `NOT_APPLICABLE`, unless the domain has no limit concept.

## Audit Relationship Rules

### What Is Audited

Audit these as authoritative mutations:

- utilisation event creation;
- aircraft utilisation snapshot update;
- correction event creation;
- aircraft status changes;
- component install/removal mutations;
- compliance status entry/correction/terminating action;
- task/workpack execution actions;
- workpack lifecycle state transitions;
- workpack task add/remove/template-add actions;
- workpack snag create/start/resolve/close actions;
- future persisted due-status snapshot creation/update, if approved.

### What Is Calculated

These should generally not create audit rows simply because they were calculated:

- component current life;
- due status from `DueStatusService`;
- component limit monitoring result;
- AD/SB/SID due recalculation result;
- scheduled task due recalculation result;
- calendar due monitor result.

If these are persisted as snapshots later, the snapshot write is auditable. The calculation itself remains explainable through source records.

### What Is Preview Only

These must remain read-only and not be audited as mutations:

- utilisation propagation preview;
- projected component life before confirmation;
- due/compliance placeholders or projected impact shown before confirmation;
- workpack preview/planning calculations unless a later phase explicitly persists a planning decision.

Preview may be displayed, exported, or logged as non-authoritative telemetry later, but it must not be confused with immutable operational audit.

### What Must Never Be Audited As A Business Mutation

Do not create business audit rows for:

- simple page views;
- hover/tooltips;
- frontend-only formatting;
- failed client-side validation;
- recalculating read-only due status without persistence;
- rendering UNKNOWN explanations;
- preview requests that do not save anything.

Security logging may be separate, but that is outside this phase.

## Human Explainability Rules

Every authority result that is shown to QA or operational users must support these questions.

### Why Is This Due?

Required fields:

- authority;
- item type/reference;
- tracking basis or due basis;
- current value;
- target/due value;
- remaining value;
- threshold used;
- governing limit;
- source records;
- explanation text.

### Why Is This Overdue?

Required fields:

- all "Why is this due?" fields;
- negative remaining value or due date before current date;
- current aircraft value/date;
- due aircraft value/date;
- most restrictive limit if mixed.

### Why Is This UNKNOWN?

Required fields:

- status `UNKNOWN`;
- non-null `unknown_reason`;
- missing data list where practical;
- source records checked;
- authority responsible for the UNKNOWN result;
- next human action where appropriate, for example "capture install baseline" or "import last-complied basis".

### Why Did This Value Change?

Required fields:

- mutation authority;
- event id or audit row id;
- previous value;
- new value;
- delta;
- actor where available;
- reason;
- source reference;
- created/effective date.

For aircraft hours/cycles, the answer must come from `utilisation_events` and related `audit_log` entries.

### Which Record Caused The Change?

Required fields:

- source event row, usually `utilisation_events.id` for aircraft utilisation;
- audit record row where a mutation occurred;
- source domain row for compliance/task/component changes;
- workpack audit row for execution changes;
- correction linkage where applicable.

## Required Phase 12 Implementation Scope

Future IMPLEMENT should be limited to:

- add shared TypeScript types or helper mappers for `ExplainabilityResult`;
- adapt service outputs where safe to include `authority`, `mode`, and `source_records`;
- add non-invasive presentation helpers to show existing explanations consistently;
- add audit references to returned mutation summaries where available;
- add tests proving UNKNOWN, governing limit, source records, and audit references are present in the unified shape.

Future IMPLEMENT may define wrappers rather than changing core calculation algorithms.

## Out Of Scope

Do not implement in Phase 12 DEFINE:

- migrations;
- persisted due snapshots;
- new audit tables;
- audit redesign;
- workpack lifecycle changes;
- due-engine logic changes;
- utilisation calculation changes;
- notification engine;
- scheduler jobs;
- frontend-only calculation.

## Risks

- Over-auditing read-only calculations could make the audit trail noisy and misleading.
- Under-linking source records could make correct calculations hard to defend in QA review.
- Compliance status mutation audit coverage appears uneven and needs care before any enforcement claim.
- Preview results must stay clearly separate from persisted mutation audit.
- Some services already have strong explanations but use different field names; unification should avoid breaking existing tests and consumers.
- Manual recalculation reports may need audit of the request itself later, but not of every calculated row unless persisted.

## Summary

Jupiter already has immutable audit foundations and several backend explainability contracts. Phase 12 should unify how those explanations are shaped and displayed, without converting every calculation into an audit event and without weakening existing immutable audit structures.
