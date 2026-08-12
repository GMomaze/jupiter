# Component Life-Limit Governance — Phase 1 Contract

## Status and classification

**Mode:** DEFINE. This document is the authoritative, implementation-ready Phase 1 contract. It does not itself authorize production implementation.

**Existing-functionality classification: `PARTIAL_MATCH`.**

Jupiter already has the operational `component_life_limits` table and model, model-to-limit association, serialized component life state, life adjustment and overhaul/maintenance-event workflows, and two consumers of active life limits:

1. `LibraryService.evaluateSerializedComponentLifeLimits()`, used by Library detail and workpack component integration.
2. `ComponentLimitMonitoringService`, which combines active `ComponentLifeLimit` rows with `ComponentLifeCalculationService` life-state derivation.

Those foundations match the operational destination but do not provide proposal, independent decision, governed publication linkage, regulatory evidence, immutable transition history, dedicated permissions, or a way to distinguish governed publications from legacy rows. Phase 1 therefore adds governance alongside the existing table. It does not replace or reinterpret existing behavior.

## Locked boundaries

- Do not modify either current life-limit evaluator path and do not create a third evaluator.
- Do not change the current workpack `UNKNOWN` result in Phase 1.
- Preserve `component_life_limits`, all its IDs and values, and its existing model/association semantics.
- Preserve serialized component life state, baseline capture, installation, removal, life adjustment, overhaul, maintenance events, compliance, workpack, aircraft, and audit behavior.
- `ComponentModel.default_tbo_*`, service intervals, overhaul intervals, and other planning defaults remain non-authoritative. They must never seed, propose, approve, or publish an operational limit automatically.
- Every pre-existing `component_life_limits` row without a governed publication link is classified at read time as `LEGACY_UNREVIEWED`. Do not update it, approve it, deactivate it, or backfill a governance link automatically.
- Governed rows created in Phase 1 are dormant (`component_life_limits.is_active = false`) until a separately approved evaluator-integration phase activates them.
- No UI, route, navigation, evaluator integration, Library RBAC expansion, Audit permission, or general operational workflow change belongs to Phase 1 persistence.

## Controlled codes

These are closed sets. Store the exact uppercase codes and enforce them with database checks and application validation.

### Applicability

`applicability_scope` has one Phase 1 value:

- `ALL_SERIALS_OF_MODEL`

Serial number, configuration, modification, suffix, range, batch, effectivity, or other narrower applicability is rejected. Phase 1 has no free-form field capable of becoming an effectivity selector. `applicability_statement` is an evidence snapshot only and cannot alter the scope.

### Determination

- `LIFE_LIMITED`
- `NOT_LIFE_LIMITED`
- `LIMIT_STATUS_UNKNOWN`

`ON_CONDITION` is not a determination or publishable limit in Phase 1.

### Proposal purpose

- `ESTABLISH`
- `REPLACEMENT`
- `WITHDRAWAL`

### Limit type and basis

Exactly these combinations are valid for a `LIFE_LIMITED` `ESTABLISH` or `REPLACEMENT` proposal:

| `limit_type` | `basis` | Required value | Other value columns |
|---|---|---|---|
| `TBO_HOURS` | `SINCE_OVERHAUL` | `limit_hours > 0` | null |
| `TBO_CYCLES` | `SINCE_OVERHAUL` | positive integer `limit_cycles` | null |
| `LIFE_LIMIT_HOURS` | `SINCE_NEW` | `limit_hours > 0` | null |
| `LIFE_LIMIT_CYCLES` | `SINCE_NEW` | positive integer `limit_cycles` | null |
| `CALENDAR_LIFE` | `CALENDAR` | positive integer `limit_months` | null |

One proposal/revision controls exactly one dimension. Multi-dimensional rows and all other type/basis combinations are invalid.

For `NOT_LIFE_LIMITED` and `LIMIT_STATUS_UNKNOWN`, `limit_type`, `basis`, and all three limit value columns are null. These determinations retain evidence and independent approval history but never create an operational `component_life_limits` row.

A `WITHDRAWAL` proposal carries no limit type, basis, or value; it targets one governed publication through `target_proposal_id`.

### Workflow status

- `PROPOSED`
- `APPROVED`
- `REJECTED`
- `WITHDRAWN`
- `SUPERSEDED`

### Publication state

- `DORMANT`
- `ACTIVE` — reserved for the later integration phase; Phase 1 services cannot set it
- `WITHDRAWN`
- `SUPERSEDED`

### History event

- `PROPOSAL_CREATED`
- `PROPOSAL_APPROVED`
- `PROPOSAL_REJECTED`
- `PUBLICATION_CREATED_DORMANT`
- `WITHDRAWAL_PROPOSED`
- `PUBLICATION_WITHDRAWN`
- `REPLACEMENT_PROPOSED`
- `PUBLICATION_SUPERSEDED`
- `PUBLICATION_ACTIVATED` — reserved for the later integration phase

## Minimal additive persistence model

Three companion tables are required. The dedicated history table is justified because the generic `audit_log` is not an append-only regulatory transition authority, and the existing `fn_audit_trigger()` only maintains `updated_at`. Regulatory decisions require immutable, transaction-coupled before/after snapshots.

### `component_life_limit_proposals`

| Column | Contract |
|---|---|
| `id` | UUID primary key, generated UUID |
| `component_model_id` | UUID, not null, FK `component_models.id`, update/delete `RESTRICT` |
| `lineage_id` | UUID, not null; stable identity across revisions |
| `revision_number` | positive integer, not null |
| `proposal_purpose` | controlled code, not null |
| `target_proposal_id` | nullable self-FK, update/delete `RESTRICT`; required for replacement/withdrawal and forbidden for establish |
| `determination` | controlled code, not null |
| `applicability_scope` | not null and exactly `ALL_SERIALS_OF_MODEL` |
| `applicability_statement` | nonblank text, not null; snapshot only |
| `narrower_effectivity_absent` | boolean, not null and true |
| `limit_type` | controlled nullable code governed by the compatibility checks |
| `basis` | controlled nullable code governed by the compatibility checks |
| `limit_hours` | decimal(10,2), nullable; positive only |
| `limit_cycles` | integer, nullable; positive only |
| `limit_months` | integer, nullable; positive only |
| `source_reference` | nonblank text, not null |
| `source_document_reference` | nullable text; external/document identifier only, no new document authority |
| `source_effective_date` | date, not null |
| `evidence_summary` | nonblank text, not null |
| `proposal_reason` | nonblank text, not null |
| `status` | controlled workflow code, not null, default `PROPOSED` |
| `proposed_by` | UUID, not null, FK `users.id`, update/delete `RESTRICT` |
| `proposed_at` | timestamp with time zone, not null, database current time |
| `decision_by` | nullable UUID, FK `users.id`, update/delete `RESTRICT` |
| `decision_at` | nullable timestamp with time zone |
| `decision_reason` | nullable text; nonblank and required on approve/reject |
| `evidence_confirmed` | boolean, not null, default false; must be true on approval and false on rejection |
| `created_at`, `updated_at` | timestamp with time zone, not null, database current time |

Canonical PostgreSQL definitions (these override any shorthand above):

| Column | PostgreSQL type | Null | Default | FK / delete behavior |
|---|---|---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | primary key |
| `component_model_id` | `uuid` | no | none | `component_models(id) ON UPDATE RESTRICT ON DELETE RESTRICT` |
| `lineage_id` | `uuid` | no | none | none; application supplies a generated UUID for revision 1 and copies it thereafter |
| `revision_number` | `integer` | no | none | none |
| `proposal_purpose` | `varchar(32)` | no | none | none |
| `target_proposal_id` | `uuid` | yes | `NULL` | self FK `component_life_limit_proposals(id) ON UPDATE RESTRICT ON DELETE RESTRICT` |
| `determination` | `varchar(32)` | no | none | none |
| `applicability_scope` | `varchar(32)` | no | none | none |
| `applicability_statement` | `text` | no | none | none |
| `narrower_effectivity_absent` | `boolean` | no | `false` | none; inserts succeed only when true |
| `limit_type` | `varchar(32)` | yes | `NULL` | none |
| `basis` | `varchar(32)` | yes | `NULL` | none |
| `limit_hours` | `numeric(10,2)` | yes | `NULL` | none |
| `limit_cycles` | `integer` | yes | `NULL` | none |
| `limit_months` | `integer` | yes | `NULL` | none |
| `source_reference` | `text` | no | none | none |
| `source_document_reference` | `text` | yes | `NULL` | none |
| `source_effective_date` | `date` | no | none | none |
| `evidence_summary` | `text` | no | none | none |
| `proposal_reason` | `text` | no | none | none |
| `status` | `varchar(20)` | no | `'PROPOSED'` | none |
| `proposed_by` | `uuid` | no | none | `users(id) ON UPDATE RESTRICT ON DELETE RESTRICT` |
| `proposed_at` | `timestamptz` | no | `CURRENT_TIMESTAMP` | none |
| `decision_by` | `uuid` | yes | `NULL` | `users(id) ON UPDATE RESTRICT ON DELETE RESTRICT` |
| `decision_at` | `timestamptz` | yes | `NULL` | none |
| `decision_reason` | `text` | yes | `NULL` | none |
| `evidence_confirmed` | `boolean` | no | `false` | none |
| `created_at` | `timestamptz` | no | `CURRENT_TIMESTAMP` | none |
| `updated_at` | `timestamptz` | no | `CURRENT_TIMESTAMP` | none |

Constraints and indexes:

- Unique `(lineage_id, revision_number)`.
- Check `revision_number > 0`.
- Check `decision_by IS NULL OR decision_by <> proposed_by`.
- `PROPOSED` requires all decision fields null and `evidence_confirmed = false`.
- `APPROVED` requires all decision fields, nonblank reason, and `evidence_confirmed = true`.
- `REJECTED` requires all decision fields, nonblank reason, and `evidence_confirmed = false`.
- Payload checks enforce the exact determination, purpose, dimension, type/basis, and value rules above.
- A partial unique index permits at most one open `PROPOSED` row per `target_proposal_id`.
- Index `component_model_id`, `status`, `target_proposal_id`, and `(lineage_id, revision_number)`.
- A database trigger validates that replacement/withdrawal target the same model and lineage, target a currently published non-terminal governed proposal, and use exactly `target.revision_number + 1`. `ESTABLISH` is revision 1 and has no target. A replacement carries `LIFE_LIMITED` data; a withdrawal copies the target determination for traceability but has no dimensional data.

`source_effective_date` is the authority document's effective date. Past, current, and future dates are allowed; it must be a valid date but does not activate a publication. Application services must not substitute `created_at`, approval time, planning dates, or aircraft dates.

### `component_life_limit_publications`

| Column | Contract |
|---|---|
| `id` | UUID primary key |
| `proposal_id` | UUID, not null, unique FK to proposals, update/delete `RESTRICT` |
| `component_life_limit_id` | UUID, not null, unique FK to `component_life_limits`, update/delete `RESTRICT` |
| `publication_state` | controlled code, not null; Phase 1 creates `DORMANT` only |
| `published_by` | UUID, not null, FK `users.id`, update/delete `RESTRICT` |
| `published_at` | timestamp with time zone, not null |
| `terminal_by` | nullable UUID, FK `users.id`, update/delete `RESTRICT` |
| `terminal_at` | nullable timestamp with time zone |
| `terminal_reason` | nullable text |
| `created_at`, `updated_at` | timestamp with time zone, not null |

Canonical PostgreSQL definitions:

| Column | PostgreSQL type | Null | Default | FK / delete behavior |
|---|---|---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | primary key |
| `proposal_id` | `uuid` | no | none | unique; proposals `ON UPDATE RESTRICT ON DELETE RESTRICT` |
| `component_life_limit_id` | `uuid` | no | none | unique; `component_life_limits(id) ON UPDATE RESTRICT ON DELETE RESTRICT` |
| `publication_state` | `varchar(20)` | no | `'DORMANT'` | none |
| `published_by` | `uuid` | no | none | `users(id) ON UPDATE RESTRICT ON DELETE RESTRICT` |
| `published_at` | `timestamptz` | no | `CURRENT_TIMESTAMP` | none |
| `terminal_by` | `uuid` | yes | `NULL` | `users(id) ON UPDATE RESTRICT ON DELETE RESTRICT` |
| `terminal_at` | `timestamptz` | yes | `NULL` | none |
| `terminal_reason` | `text` | yes | `NULL` | none |
| `created_at` | `timestamptz` | no | `CURRENT_TIMESTAMP` | none |
| `updated_at` | `timestamptz` | no | `CURRENT_TIMESTAMP` | none |

Checks require terminal fields all null for `DORMANT`/`ACTIVE` and all non-null with a nonblank reason for `WITHDRAWN`/`SUPERSEDED`. Add indexes on `publication_state`, `published_by`, and `component_life_limit_id`; the two unique constraints supply indexes for both one-to-one FKs.

Cardinality is exactly one approved `LIFE_LIMITED` establish/replacement proposal to one publication to one operational limit row. The unique FKs enforce the one-to-one links. Determination-only and withdrawal proposals have no publication row.

The linked operational row is an immutable projection:

- `component_model_id`, `limit_type`, `basis`, the single value, and `description` are copied from the approved proposal/evidence snapshot.
- `description` identifies the governed proposal ID, revision, source reference, and effective date without changing evaluator semantics.
- It is inserted with `is_active = false` and remains invisible to both active-limit consumers.
- It cannot be edited into a different limit. Correction is a replacement proposal and a new operational row.
- Absence of a publication link means `LEGACY_UNREVIEWED`; no new column or backfill is added to legacy rows.

### `component_life_limit_governance_history`

| Column | Contract |
|---|---|
| `id` | UUID primary key |
| `proposal_id` | UUID, not null, FK to proposals, update/delete `RESTRICT` |
| `publication_id` | nullable UUID, FK to publications, update/delete `RESTRICT` |
| `event_code` | controlled history code, not null |
| `actor_id` | UUID, not null, FK `users.id`, update/delete `RESTRICT` |
| `reason` | nonblank text, not null |
| `evidence_confirmed` | boolean, not null |
| `from_status` | nullable controlled workflow/publication code |
| `to_status` | not null controlled workflow/publication code |
| `before_snapshot` | JSONB, not null |
| `after_snapshot` | JSONB, not null |
| `created_at` | timestamp with time zone, not null, database current time |

Canonical PostgreSQL definitions:

| Column | PostgreSQL type | Null | Default | FK / delete behavior |
|---|---|---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | primary key |
| `proposal_id` | `uuid` | no | none | proposals `ON UPDATE RESTRICT ON DELETE RESTRICT` |
| `publication_id` | `uuid` | yes | `NULL` | publications `ON UPDATE RESTRICT ON DELETE RESTRICT` |
| `event_code` | `varchar(40)` | no | none | none |
| `actor_id` | `uuid` | no | none | `users(id) ON UPDATE RESTRICT ON DELETE RESTRICT` |
| `reason` | `text` | no | none | none |
| `evidence_confirmed` | `boolean` | no | `false` | none |
| `from_status` | `varchar(20)` | yes | `NULL` | none |
| `to_status` | `varchar(20)` | no | none | none |
| `before_snapshot` | `jsonb` | no | `'{}'::jsonb` | none |
| `after_snapshot` | `jsonb` | no | none | none |
| `created_at` | `timestamptz` | no | `CURRENT_TIMESTAMP` | none |

Checks require nonblank `reason`, object-valued JSON snapshots, a known event code, and status values from the union of workflow/publication codes. Add indexes on `proposal_id`, `publication_id`, `event_code`, `actor_id`, and `created_at`; add `(proposal_id, created_at, id)` for deterministic history order.

Snapshots contain the complete proposal payload and decision fields and, when applicable, complete publication and linked operational-row values. They must not contain file bytes, credentials, or secrets. The history table is append-only: database triggers reject every update and delete.

## Associations

Add Sequelize models `ComponentLifeLimitProposal`, `ComponentLifeLimitPublication`, and `ComponentLifeLimitGovernanceHistory`, export them centrally, and register all associations centrally:

- `ComponentModel.hasMany(ComponentLifeLimitProposal, as: 'LifeLimitProposals')` and inverse `belongsTo`.
- Proposal `belongsTo(User, as: 'Proposer')` and `belongsTo(User, as: 'DecisionMaker')`.
- Proposal self-associations `belongsTo(..., as: 'TargetProposal')` and `hasMany(..., as: 'RevisionRequests')`.
- Proposal `hasOne(ComponentLifeLimitPublication, as: 'Publication')`; publication inverse `belongsTo`.
- `ComponentLifeLimit.hasOne(ComponentLifeLimitPublication, as: 'GovernancePublication')`; publication inverse `belongsTo`.
- Proposal `hasMany(ComponentLifeLimitGovernanceHistory, as: 'GovernanceHistory')`; history inverse `belongsTo`.
- Publication `hasMany(ComponentLifeLimitGovernanceHistory, as: 'GovernanceHistory')`; nullable inverse `belongsTo`.
- Publication/history actor associations use distinct aliases for publisher, terminal actor, and history actor.

No existing association is renamed or removed.

## Transition matrix and service authority

All writes use a dedicated governance service. Controllers, imports, seeders, generic Library services, and model calls must not bypass it.

| Source | Target | Command / permission | Required evidence | Separation | Atomic effects | Fields immutable after transition |
|---|---|---|---|---|---|---|
| none | `PROPOSED` | establish / `COMPONENT_LIFE_LIMIT_PROPOSE` | source reference, effective date, applicability statement, evidence summary, proposal reason | n/a | proposal + creation history | all proposal payload fields immediately; correction uses revision |
| `PROPOSED` | `APPROVED` | approve LIFE_LIMITED establish / `..._APPROVE` | original evidence plus approver confirmation and decision reason | decision actor differs from proposer | decision + inactive operational row + dormant link + histories | all payload/source/evidence/decision/link/numeric fields |
| `PROPOSED` | `APPROVED` | approve determination / `..._APPROVE` | original evidence plus confirmation and reason | required | decision + history; no publication | all payload/source/evidence/decision fields |
| `PROPOSED` | `REJECTED` | reject / `..._APPROVE` | decision reason; evidence confirmation false | required | decision + history only | entire proposal and rejection facts |
| published `APPROVED` | new `PROPOSED` | replacement / `..._PROPOSE` | complete replacement source/effective-date/evidence payload and reason | decision deferred | new next revision + replacement-proposed history | new payload immediately; target unchanged |
| published `APPROVED` | new `PROPOSED` | withdrawal / `..._PROPOSE` | target identity, source/evidence supporting withdrawal, reason | decision deferred | new next revision + withdrawal-proposed history | request payload immediately; target unchanged |
| withdrawal `PROPOSED` | request `APPROVED`; target `WITHDRAWN` | approve / `..._APPROVE` | approver confirmation and reason | required against withdrawal proposer | decision + target/link terminal fields + inactive linked row + histories | request/decision and all target content; only terminal lifecycle fields changed |
| replacement `PROPOSED` | replacement `APPROVED`; target `SUPERSEDED` | approve / `..._APPROVE` | approver confirmation and reason | required against replacement proposer | new inactive row/link + target/link terminal transition + histories | both revisions, decisions, links and numeric/source/evidence fields |
| any terminal status | none | edit, re-decide, or delete / forbidden | none can authorize | n/a | complete rollback | every stored field except no field is mutable |

There is no direct `APPROVED -> REJECTED`, `REJECTED -> APPROVED`, terminal reversal, or hard-delete transition. `WITHDRAWN` and `SUPERSEDED` describe the lifecycle of previously approved authority; their approved payload and original approval facts remain immutable. Corrections always create a new revision/request.

An ADMIN is not exempt from proposer/decision separation. The application checks actor IDs before any write, and the database check/trigger rejects self-decision even if application validation is bypassed.

## Atomicity and locking

- Proposal creation is one transaction containing the proposal and its history row.
- Approval, rejection, withdrawal, and supersession each use one transaction at `SERIALIZABLE` isolation where supported.
- Lock the proposal `FOR UPDATE`; for replacement/withdrawal also lock the target proposal, publication, and linked operational limit.
- Validate permission, current state, actor separation, evidence confirmation, target state, revision, and exact payload before the first mutation.
- Approval and all audit/history writes either commit together or roll back together.
- LIFE_LIMITED approval order inside the transaction is: lock/validate; set proposal decision; insert inactive `component_life_limits`; insert publication; apply target terminal transition if any; append every history event; commit.
- Rejection inserts no publication or operational limit.
- Any missing prerequisite, FK conflict, duplicate live revision, invalid transition, history failure, or publication failure rolls back the complete transaction.

## Database immutability

Formal migration SQL must install named trigger functions and triggers that:

- reject every hard delete of proposal, publication, or governance-history rows;
- reject every update/delete of governance history;
- freeze all proposal payload, identity, proposer, source, evidence, applicability, and revision fields after insert;
- allow only matrix-approved state/decision changes and reject self-decision;
- freeze publication identifiers and linkage, allowing only the controlled state transition and matching terminal fields;
- on `component_life_limits`, apply extra protection only when a publication link exists: freeze model, type, basis, values, and description; allow `is_active` only when consistent with the linked publication state;
- never alter or block ordinary legacy-row behavior merely because no governance link exists.

Application validation is required as a clearer first boundary, but it is not a substitute for these database controls.

## Permissions and mappings

Create only these definitions, following the existing idempotent permission-definition migration pattern:

| Code | Label | Description | Module | Active | Locked |
|---|---|---|---|---|---|
| `COMPONENT_LIFE_LIMIT_PROPOSE` | Component Life Limit Propose | Propose governed model-wide component life-limit determinations and revisions | `COMPONENT_LIFE_LIMIT` | true | true |
| `COMPONENT_LIFE_LIMIT_APPROVE` | Component Life Limit Approve | Independently approve or reject governed component life-limit determinations and revisions | `COMPONENT_LIFE_LIMIT` | true | true |

Extend the non-destructive guarded `025_rbac_permission_mappings` contract with exactly four mappings:

- ADMIN → `COMPONENT_LIFE_LIMIT_PROPOSE`
- ENGINEER → `COMPONENT_LIFE_LIMIT_PROPOSE`
- ADMIN → `COMPONENT_LIFE_LIMIT_APPROVE`
- QA → `COMPONENT_LIFE_LIMIT_APPROVE`

ADMIN's existing runtime bypass remains unchanged, but explicit mappings are still required. MECHANIC and every other role receive neither permission. This changes the current required-mapping count from 41 to 45 and preserves every existing/custom role, permission, and mapping. It does not grant or modify `LIBRARY_EDIT`.

The permission-definition migration and mapping seeder must validate stable codes, fail closed, use one transaction each, insert only missing definitions/mappings, preserve IDs and metadata, use existing unique constraints with `ON CONFLICT ... DO NOTHING`, and have documented non-destructive downs.

## Migration and rollback contract

Use formal forward migrations; do not place schema creation in a seeder. Recommended ordering is:

1. permission-definition migration;
2. governance schema, constraints, functions, triggers, and indexes migration;
3. model/association registration;
4. guarded mapping seeder extension.

The schema migration is additive and performs no data migration or legacy backfill. Deployment does not change evaluator output because all new operational rows are inactive.

The schema migration `down` must first query proposals, publications, and history. If any row exists, it throws a clear refusal such as `COMPONENT_LIFE_LIMIT_GOVERNANCE_HISTORY_EXISTS`; it must not drop triggers, tables, or definitions. An empty installation may remove only the objects created by that migration in dependency-safe order. Permission-definition and mapping downs remain non-destructive no-ops. A production rollback after governed history exists requires a separately approved preservation/export migration, never an ordinary destructive down.

## Later activation boundary

Phase 1 ends with governed publications in `DORMANT` and linked `component_life_limits.is_active = false`. A later, separately approved integration slice must:

- prove both existing evaluator paths consume the same governed projection without modification or duplication;
- define how `DORMANT -> ACTIVE` is authorized and audited;
- activate publication and operational row atomically;
- preserve legacy coexistence rules;
- prove the intended workpack `UNKNOWN` replacement without changing unrelated due behavior.

Until that approval, no Phase 1 service, migration, seeder, test fixture, or administrator may activate a governed row.

## Exact acceptance tests

All database tests run only against guarded `jupiter_test`, inside rollback-controlled isolation where applicable.

### Schema and controlled values

1. Migration creates exactly the three companion tables, constraints, indexes, and scoped triggers without changing an existing `component_life_limits` row.
2. `ALL_SERIALS_OF_MODEL` is accepted; every narrower or unknown applicability code is rejected.
3. Each of the five approved limit type/basis/dimension combinations is accepted.
4. Every crossed type/basis combination, non-positive value, fractional cycle/month, zero/multiple dimensions, and `ON_CONDITION` is rejected.
5. `NOT_LIFE_LIMITED` and `LIMIT_STATUS_UNKNOWN` accept no dimensional values and create no operational row/publication.
6. Missing/nonblank evidence, source, reason, or applicability fields fail before any insert.
7. Planning defaults alone create no proposal, publication, or operational limit.

### Workflow, independence, and atomicity

8. ADMIN and ENGINEER can propose; roles without propose permission cannot.
9. ADMIN and QA can approve/reject; roles without approval permission, including ENGINEER and MECHANIC, cannot.
10. A proposer cannot approve or reject their own proposal, including ADMIN; both service and direct-database attempts fail.
11. The exact transition matrix succeeds and every unlisted transition fails.
12. Approval atomically creates one inactive operational row, one one-to-one `DORMANT` publication, decision data, and complete history.
13. A forced operational-row, publication, or history failure leaves the proposal proposed and creates no partial row/link/history.
14. Rejection creates decision/history only and no operational row/publication.
15. Concurrent decisions result in exactly one terminal decision.
16. Concurrent live replacement/withdrawal requests against one target cannot create ambiguous revisions.

### Revision, withdrawal, and immutability

17. Establish is revision 1; replacement/withdrawal is the same lineage, targets the same model/publication, and is exactly the next revision.
18. A target from another model/lineage, a legacy row, an absent publication, or a terminal publication is rejected.
19. Approved replacement creates a new inactive row/link and marks only the prior governed publication/proposal superseded; the prior operational row is inactive.
20. Approved withdrawal marks only the targeted governed publication/proposal withdrawn and leaves its linked operational row inactive.
21. Legacy operational rows are never deactivated by replacement/withdrawal.
22. Approved/rejected payloads and decision facts cannot be edited; withdrawn/superseded payloads remain unchanged.
23. Hard deletion of proposals/publications/history and update/delete of history fail at the database boundary.
24. Direct mutation of a governed operational row's model, type, basis, value, or description fails; legacy rows remain outside that new trigger restriction.

### Audit snapshots and legacy preservation

25. Each transition emits the exact controlled event(s), actor, reason, evidence flag, statuses, and complete before/after snapshots in the same transaction.
26. History contains no credential or document-byte payload.
27. Every pre-existing limit remains byte-for-byte/value-for-value unchanged, active state included, and is reported as `LEGACY_UNREVIEWED` only by governance-aware reads.
28. No existing life state, installation/removal, adjustment, overhaul, maintenance event, compliance, workpack, aircraft, or generic audit record changes.

### Evaluator and workpack non-regression

29. Golden fixtures capture both evaluator paths before migration and prove identical results after migration and after a dormant approved publication.
30. Workpack component integration returns the same `UNKNOWN` state/explanation when it did before Phase 1.
31. Dormant governed rows are excluded by both existing active-limit consumers.
32. No third evaluator, evaluator edit, installation/removal side effect, compliance side effect, workpack mutation, or aircraft mutation is introduced.

### RBAC and rebuild safety

33. Exact permission metadata exists for the two new codes without modifying conflicting existing metadata.
34. The four approved mappings exist; no other role, especially MECHANIC, receives either permission.
35. All prior 41 required mappings remain unchanged; total guarded required mappings are exactly 45.
36. Repeated permission migration and guarded seeder execution creates no duplicates and repairs one removed approved mapping.
37. Custom roles, permissions, mappings, and additional mappings on existing roles survive unchanged; no mapping is deleted/replaced.
38. Missing required role/permission fails the whole mapping transaction without partial insertion.
39. No Library, AD, Reference, Audit, life-state, workpack, aircraft, installation/removal, or unrelated permission/mapping changes beyond these four mappings.

### Rollback

40. Empty-schema rollback removes only Phase 1 schema objects in dependency order.
41. Once any governance proposal/history/publication exists, rollback refuses before dropping any object and preserves all governed regulatory history.

## Implementation slice boundary

The first implementation slice may create the permission definitions, formal persistence migration, models, associations, database enforcement, guarded mappings, service-level persistence/transition authority, and focused tests described here. It must not add routes or UI, activate publications, alter evaluators, repair workpack `UNKNOWN`, or broaden Library authority. Later route/UI and evaluator-integration work require separate explicit approval.

## Resolved owner decisions

The supplied owner direction resolves applicability, dimensions, controlled combinations, determinations, independent authority, role allocation, terminal correction, legacy treatment, dormant publication, and evaluator boundaries. No unresolved owner decision remains for Phase 1 persistence. Any request to support narrower effectivity, `ON_CONDITION`, multi-dimensional limits, automatic legacy approval, planning-default conversion, self-approval, broader permissions, direct publication activation, or evaluator changes is a new owner decision outside this contract.
