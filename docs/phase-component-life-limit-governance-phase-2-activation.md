# Component Life-Limit Governance — Phase 2 Controlled Activation Contract

## Status, authority, and classification

**Mode:** DEFINE. This document is the implementation-ready contract for a later explicitly authorized IMPLEMENT slice. It does not itself authorize production implementation or data activation.

**Authoritative baseline:**

- `docs/phase-component-life-limit-governance-phase-1.md`
- Phase 1A commit `61d3194ce4d35b395db1f0975be8635f64ef48a7`
- Phase 1B commit `2b5b0b6`
- Phase 1B HTTP regression commit `cbc3103`

**Existing-functionality classification: `PARTIAL_MATCH`.**

Phase 1 already creates an approved `LIFE_LIMITED` proposal, an immutable projected `component_life_limits` row with `is_active = false`, a one-to-one `DORMANT` publication, and immutable history. The persistence codes already reserve publication state `ACTIVE` and event `PUBLICATION_ACTIVATED`. Both existing evaluator paths already consume the same `ComponentLifeLimit` association and ignore rows whose `is_active` is false. Phase 2 therefore adds only the governed activation transition and exposes that existing row to the existing evaluators by atomically changing the two existing activation fields. It does not create, consolidate, replace, or modify an evaluator.

## Locked boundaries

- Do not modify `LibraryService.evaluateSerializedComponentLifeLimits()`.
- Do not modify `ComponentLimitMonitoringService` or `ComponentLifeCalculationService`.
- Do not create a third evaluator, adapter evaluator, activation evaluator, or parallel due authority.
- Approval continues to create only a `DORMANT` publication and an inactive operational row. Approval never activates.
- Do not activate a legacy row: a `component_life_limits` row without exactly one governed publication link is ineligible.
- Do not auto-activate existing or future dormant publications through migrations, seeders, startup code, jobs, imports, or approval.
- Do not convert planning defaults into operational limits.
- Do not change proposal applicability, determination, type/basis combinations, revision rules, approval rules, or proposer/approver separation from Phase 1.
- Do not change serialized life state, installation/removal, tracking basis, baseline capture, life adjustment, overhaul, maintenance events, aircraft utilisation, compliance, workpack lifecycle, or generic audit behavior.
- Do not deactivate, replace, edit, or reinterpret any legacy limit.
- Do not add broad `LIBRARY_EDIT`, Audit, or other unrelated authority.
- Activation makes an approved projection eligible for evaluation; it does not invent missing component life state or baselines. Existing `UNKNOWN` results caused by missing or unsupported operational inputs remain `UNKNOWN`.

## No-rewrite audit findings

### Existing evaluator path 1 — Library and workpack

`LibraryService.evaluateSerializedComponentLifeLimits(lifeLimits, lifeState)` filters out only rows where `is_active === false`. With no active row it returns `UNKNOWN` and `No active life limits defined.` It evaluates the existing controlled `SINCE_NEW`, `SINCE_OVERHAUL`, and `CALENDAR` projections and aggregates the existing states `UNKNOWN`, `NOT_DUE`, `DUE_SOON`, `DUE`, and `OVERDUE`.

`WorkpackComponentIntegrationService` eagerly loads the existing `ComponentModel.LifeLimits` association and calls that same Library evaluator. It maps the result without creating a separate calculation. Consequently, atomically setting the governed projection to active makes it visible to workpack evaluation without a workpack-service or evaluator edit.

### Existing evaluator path 2 — aircraft/component monitoring and calendar visibility

`ComponentLimitMonitoringService` loads the same `ComponentModel.LifeLimits` association, filters out rows where `is_active === false`, and delegates current-life derivation to `ComponentLifeCalculationService`. It preserves existing `UNKNOWN`, `NOT_APPLICABLE`, `NOT_DUE`, `DUE_SOON`, `DUE`, and `OVERDUE` behavior. `CalendarDueMonitorService` consumes its results; no calendar query or calculation change is required.

### Operational input authorities

Serialized component life state, installation tracking basis and baselines, aircraft utilisation, life adjustments, overhauls, and maintenance events remain the only existing authorities for current-life values. Activation changes none of them. A valid active limit with complete authoritative inputs becomes calculable; a missing life state, reference date, install baseline, aircraft meter, or unsupported tracking basis continues to produce the existing safe `UNKNOWN` outcome.

### Phase 1 persistence overlap

The publication check constraint already permits `ACTIVE`; the history check already permits `PUBLICATION_ACTIVATED`; and the governed operational-row trigger already rejects `is_active = true` unless its publication is `ACTIVE`. The current publication immutability trigger permits only terminal transitions from `DORMANT`/`ACTIVE`, so a formal additive migration must extend that trigger narrowly for `DORMANT -> ACTIVE`. No Phase 1 row or identifier is replaced.

## Exact activation authority

### Permission definition

Create exactly one permission definition:

| Code | Name | Description | Module | Active | System |
|---|---|---|---|---:|---:|
| `COMPONENT_LIFE_LIMIT_ACTIVATE` | Component Life Limit Activate | Independently activate an approved dormant governed component life-limit publication | `COMPONENT_LIFE_LIMIT` | true | true |

Create it through a formal idempotent permission migration. Metadata must fail closed on a conflicting existing definition. Its `down` is a documented non-destructive no-op.

### Exact mappings

- QA → `COMPONENT_LIFE_LIMIT_ACTIVATE`
- ADMIN → `COMPONENT_LIFE_LIMIT_ACTIVATE`
- ENGINEER, SUPERVISOR, PLANNER, MECHANIC, VIEWER, and every Reference role receive no activation mapping.

Extend `seeders/025_rbac_permission_mappings.ts` additively with only those two mappings. Preserve all prior 45 required mappings, every custom/additional mapping, and all IDs. The new guarded required total is **47**. ADMIN's runtime bypass remains unchanged, but ADMIN receives the explicit mapping for rebuild completeness.

### Required two-person separation

Activation uses two-person control. The exact activation separation rule is:

`activated_by <> proposal.proposed_by`

The activation actor must differ from the original proposer. The approval actor may also activate the same publication when that actor has `COMPONENT_LIFE_LIMIT_ACTIVATE`. This applies to every role and to ADMIN despite ADMIN's middleware bypass. ADMIN may never activate their own proposal. The service and database transition function must both enforce the proposer/activator inequality.

This rule preserves the Phase 1 proposer/approver separation while permitting the independent approver to perform the separate publication-release action. No permission or ADMIN bypass can override proposer/activator separation. If no eligible QA or ADMIN user other than the proposer is available, the publication remains safely `DORMANT`.

Valid actor sequences include:

- ENGINEER proposes → QA approves → the same QA activates.
- ENGINEER proposes → QA approves → ADMIN activates.
- ENGINEER proposes → ADMIN approves → the same ADMIN activates.
- ADMIN A proposes → QA approves → the same QA activates.
- ADMIN A proposes → QA approves → ADMIN B activates.

Invalid actor sequences include:

- ENGINEER proposes → the same ENGINEER attempts activation.
- ADMIN A proposes → the same ADMIN A attempts activation.
- any actor without `COMPONENT_LIFE_LIMIT_ACTIVATE` attempts activation.

## Additive persistence changes

Add these nullable fields to `component_life_limit_publications` through the Phase 2 schema migration:

| Column | PostgreSQL type | Null | Default | FK / behavior |
|---|---|---:|---|---|
| `activated_by` | `uuid` | yes | `NULL` | `users(id) ON UPDATE RESTRICT ON DELETE RESTRICT` |
| `activated_at` | `timestamptz` | yes | `NULL` | database transition time only |
| `activation_reason` | `text` | yes | `NULL` | nonblank when present |

Replace the publication state/terminal check with an exact lifecycle check:

- `DORMANT`: all activation and terminal fields are null.
- `ACTIVE`: all three activation fields are non-null, `btrim(activation_reason) <> ''`, and all terminal fields are null.
- `WITHDRAWN` or `SUPERSEDED`: all terminal fields are non-null with nonblank terminal reason; activation fields are either all null (publication terminated while dormant) or all non-null with nonblank activation reason (publication was active before termination).

Existing dormant and terminal Phase 1 rows remain valid and unchanged. Do not backfill activation fields. Add an index on `activated_by` and an index on `activated_at`. Add Sequelize attributes and the central association `ComponentLifeLimitPublication.belongsTo(User, { foreignKey: 'activated_by', as: 'ActivationActor' })`; do not rename or remove existing associations.

No new activation table is required. The publication stores the current activation facts, while immutable `component_life_limit_governance_history` remains the transition authority.

## Exact controlled transition

The only new state transition is:

| Source | Target | Command | Permission | Required input | Separation | Atomic effects |
|---|---|---|---|---|---|---|
| `DORMANT` | `ACTIVE` | activate publication | `COMPONENT_LIFE_LIMIT_ACTIVATE` | publication ID, nonblank activation reason, explicit activation confirmation | actor differs from original proposer; approval actor may activate | publication activation fields/state + linked operational `is_active=true` + one immutable activation history row |

No other new transition is permitted. `ACTIVE` cannot return to `DORMANT`. Correction continues through Phase 1 replacement or withdrawal. Repeated activation, activation of a terminal publication, activation of a non-approved proposal, or activation of a determination-only proposal fails without change.

An eligible publication must satisfy all of the following under row locks:

- publication exists and is `DORMANT`;
- linked proposal exists, is `APPROVED`, has determination `LIFE_LIMITED`, and purpose is `ESTABLISH` or `REPLACEMENT`;
- linked operational limit exists and is currently inactive;
- one-to-one proposal/publication/operational-limit links are intact;
- operational model, type, basis, single value, and governed description remain the immutable Phase 1 projection;
- proposal applicability is exactly `ALL_SERIALS_OF_MODEL` with `narrower_effectivity_absent = true`;
- activation actor has the dedicated permission and differs from `proposal.proposed_by`; no inequality against `proposal.decision_by` is required;
- activation reason is nonblank and explicit confirmation is true.

Legacy limits are not candidates because they have no publication link. `NOT_LIFE_LIMITED`, `LIMIT_STATUS_UNKNOWN`, rejected proposals, withdrawal proposals, and approved determination-only proposals have no activatable publication.

## Transaction and database enforcement

Add `ComponentLifeLimitGovernanceService.activate(actorId, publicationId, activationReason, activationConfirmed, suppliedTransaction?)`. It is the sole application write authority for activation.

- Require a `SERIALIZABLE` transaction. A supplied transaction must be verified as serializable using the existing Phase 1 rule.
- Check the dedicated permission inside the transaction.
- Lock the publication, proposal, and operational row before validating eligibility.
- Invoke one narrowly named database transition function, not a generic state setter.
- Commit publication activation, operational activation, and immutable history as one unit.
- Any validation, permission, constraint, concurrency, operational-row, or history failure rolls back every effect.
- Concurrent activation attempts produce exactly one winner; the loser receives a controlled stale-transition error.

Create a narrowly scoped function such as:

`public.fn_cllg_activate_publication(p_publication_id uuid, p_actor_id uuid, p_reason text)`

The function must:

- be `SECURITY DEFINER` only if required by the established Phase 1 privilege boundary;
- use fixed `SET search_path = pg_catalog, public` and schema-qualify every referenced object;
- be revoked from `PUBLIC` and granted only to the intended Jupiter application database role resolved by the same guarded deployment convention as Phase 1;
- validate permission, state, linkage, proposal eligibility, reason, and `p_actor_id <> proposal.proposed_by` itself; it must not reject the actor merely because `p_actor_id = proposal.decision_by`;
- authorize only `DORMANT -> ACTIVE` for the supplied publication;
- use the existing private backend/transaction-scoped transition gate, extended so the gate records the intended publication ID and transition code; callers cannot forge it with `SET`, `set_config`, a custom GUC, temp object, or caller flag;
- clear its gate row on success and exception; transaction rollback must also make leakage impossible through pooled connections;
- update the publication to `ACTIVE` with activation facts first, update only its linked governed operational row to `is_active = true`, append one `PUBLICATION_ACTIVATED` history row, and return the activated publication ID;
- expose no arbitrary status, table, row, or transition interface.

The publication immutability trigger must be changed only enough to allow the current gated publication's `DORMANT -> ACTIVE` transition with complete activation facts. Direct SQL must still be unable to activate the publication, toggle the operational row, forge activation identity, update activation facts, return `ACTIVE` to `DORMANT`, or bypass history.

The activation history row is exact:

- `event_code = 'PUBLICATION_ACTIVATED'`
- `proposal_id` and `publication_id` identify the governed chain
- `actor_id = activated_by`
- `reason = activation_reason`
- `evidence_confirmed = true`
- `from_status = 'DORMANT'`
- `to_status = 'ACTIVE'`
- `before_snapshot` contains the complete proposal, dormant publication, and inactive operational row
- `after_snapshot` contains the unchanged proposal, active publication with activation facts, and the same operational row with only `is_active` and `updated_at` changed

Snapshots contain no credentials, session data, document bytes, or secrets.

## Evaluator integration and legacy coexistence

There is no evaluator integration code change. Integration is the existing `is_active` contract:

1. Phase 1 approval creates the exact immutable projection with `is_active = false`.
2. Phase 2 activation atomically makes its publication `ACTIVE` and its linked row `is_active = true`.
3. Both existing evaluators already include that row through the existing `LifeLimits` association and active-row filter.
4. Workpack and calendar/aircraft consumers continue consuming their existing evaluator outputs.

Do not add a publication join to either evaluator. The database trigger and atomic activation function keep publication state and operational active state consistent. Evaluators remain deliberately unaware of governance persistence.

Existing active legacy limits remain active and coexist with active governed rows. Activation must not deactivate or rewrite them. Existing aggregate/worst-status behavior applies across all active rows. Phase 2 does not deduplicate semantically similar legacy and governed limits; resolving legacy authority requires a separate owner-approved contract.

Activation changes `UNKNOWN` caused solely by absence of an active limit only when current-life inputs are sufficient. Exact examples:

- complete SINCE_NEW hours state + active governed hour limit → existing `NOT_DUE`, `DUE_SOON`, `DUE`, or `OVERDUE` calculation;
- no active limit before activation → existing no-active-limit `UNKNOWN`;
- same component after valid activation with complete inputs → evaluated existing status;
- missing life state, required baseline, aircraft meter, or calendar reference after activation → existing `UNKNOWN` remains;
- an unknown alongside a computable active limit retains the existing partial/aggregate semantics.

## Routes, controller, and UI

Extend only the existing Phase 1B governance detail workflow.

### Route

Add exactly:

`POST /library/life-limit-governance/publications/:id/activate`

Middleware order is the existing router-wide `ensureAuthenticated`, then `requirePermission('COMPONENT_LIFE_LIMIT_ACTIVATE')`, then CSRF protection, then the activation controller. The POST is independently protected; hidden UI is not the security boundary.

### Controller

The controller validates a strict publication UUID, nonblank activation reason, and explicit confirmation, then delegates to `ComponentLifeLimitGovernanceService.activate`. It performs no direct governance write. It uses an allowlist of controlled domain errors and a generic fallback; raw Sequelize, SQLSTATE, constraint, function, or database messages never reach rendered UI or flash messages. Malformed or absent publications return a safe 404. Stale/ineligible/independence failures produce safe actionable messages without exposing internals.

### View

The detail query/view adds activation actor, timestamp, and reason. Show the activation form only when all are true:

- publication is `DORMANT`;
- proposal is `APPROVED` and `LIFE_LIMITED`;
- current user has `COMPONENT_LIFE_LIMIT_ACTIVATE` or unchanged ADMIN bypass;
- current user ID differs from the original proposer. The decision maker remains eligible when otherwise authorized.

The form requires CSRF, explicit confirmation, and an activation reason. It warns that activation immediately exposes the immutable operational limit to existing aircraft, calendar, Library, and workpack due evaluation, and that proposers cannot activate their own proposals. An ineligible proposer sees the two-person-control explanation but no usable activation control. An authorized approval actor may see and use the control. Active publication detail shows activation facts and immutable activation history. Do not add activation to general Library edit pages or navigation authority.

## Migration and deployment order

Use two formal migrations and the existing guarded mapping seeder:

1. permission-definition migration for `COMPONENT_LIFE_LIMIT_ACTIVATE`;
2. schema/transition migration adding activation facts, constraints, association-supporting FKs/indexes, trigger change, and the narrow activation function;
3. additive `025` mapping reconciliation for the two approved mappings;
4. application service/controller/route/view deployment;
5. no data activation during deployment.

The migrations are idempotent only in the repository's normal migration sense; seed reconciliation remains rerunnable and idempotent. Deployment leaves every existing publication and operational row in its prior state. Operational activation occurs only through an authenticated, authorized, CSRF-protected user action after deployment.

### Guarded rollback

Permission-definition and mapping downs are non-destructive no-ops.

The schema migration `down` must refuse before changing any object if any of these exists:

- an `ACTIVE` publication;
- any non-null activation field;
- any `PUBLICATION_ACTIVATED` history row.

On refusal it drops no function, trigger, constraint, index, FK, or column. When no activation history/facts exist, rollback may restore the exact Phase 1 publication trigger/check and remove only Phase 2 objects in dependency-safe order. It must not remove a Phase 1 proposal, publication, operational row, history row, permission, or mapping. Once activation regulatory history exists, reversal requires a separately approved preservation migration.

## Exact acceptance tests

All database tests run only with `NODE_ENV=test` against guarded `jupiter_test`; destructive migration tests use isolated/rollback-controlled fixtures.

### Permission and rebuild safety

1. Exact permission metadata exists for `COMPONENT_LIFE_LIMIT_ACTIVATE`.
2. Exactly QA and ADMIN receive the two new required mappings; no other role receives activation authority.
3. All prior 45 mappings remain required and unchanged; total required mapping contract is 47.
4. Repeated guarded seeding creates no duplicate and restores one removed activation mapping.
5. Custom roles, permissions, mappings, and additional existing-role mappings survive unchanged.
6. Missing required role or permission fails the complete mapping transaction without partial insertion.

### Eligibility and actor separation

7. Approval alone leaves publication `DORMANT` and operational row inactive.
8. ENGINEER proposes, QA approves, and that same QA successfully activates.
9. ENGINEER proposes, ADMIN approves, and that same ADMIN successfully activates.
10. ENGINEER proposes, QA approves, and a different ADMIN successfully activates.
11. ADMIN A proposes, QA approves, and that same QA successfully activates; ADMIN A remains ineligible.
12. ADMIN A proposes, QA approves, and ADMIN B successfully activates.
13. Proposer activation fails for every actor, including ADMIN, and ADMIN bypass cannot override `activated_by <> proposed_by`.
14. The approval actor is not rejected merely for being `decision_by`; no third actor is required.
15. ENGINEER, SUPERVISOR, PLANNER, MECHANIC, VIEWER, and Reference roles receive HTTP 403 on direct activation POST.
16. Missing confirmation or blank reason fails without state, row, or history change.

### Transition, immutability, and atomicity

17. Valid activation atomically changes exactly one publication `DORMANT -> ACTIVE`, records activation facts, changes exactly its linked operational row `false -> true`, and appends exactly one activation history event.
18. Repeated, stale, concurrent, terminal, rejected, non-approved, determination-only, withdrawal, broken-link, and nonexistent activation attempts fail safely.
19. Concurrent attempts yield one winner and one controlled loser, with one history row, whether the winner is the approver or another eligible activator.
20. Forced publication, operational-row, or history failure leaves publication dormant, operational row inactive, and no activation facts/history.
21. Direct SQL cannot activate a publication, toggle the governed row active, forge actor/reason, impersonate an eligible non-proposer, or bypass the required history write.
22. Activation facts and history cannot be updated or deleted; hard deletion remains blocked.
23. Existing proposal, approval, replacement, withdrawal, rejection, and terminal rules remain unchanged.

### Evaluator and operational regression

24. Golden fixtures prove both existing evaluators return exactly their pre-activation `UNKNOWN` result while the governed row is dormant.
25. With complete authoritative life inputs, activation makes the same immutable row visible to both evaluators and produces the exact existing `NOT_DUE`, `DUE_SOON`, `DUE`, and `OVERDUE` calculations at their established thresholds.
26. Workpack component integration changes from no-active-limit `UNKNOWN` to the same Library-evaluator result after activation, without creating or mutating a workpack record.
27. Aircraft/component monitoring and calendar visibility consume the same activated row without new calculation logic.
28. Missing life state/baselines/reference dates remain `UNKNOWN` after activation; no values are guessed.
29. Dormant governed rows remain excluded and active legacy rows remain byte-for-byte/value-for-value unchanged.
30. Legacy-only behavior and coexistence aggregation remain unchanged; no legacy row is activated, linked, deactivated, or deduplicated.
31. No installation, removal, tracking basis, baseline, life adjustment, overhaul, maintenance event, aircraft utilisation, compliance, workpack lifecycle, generic audit, FAA AD, Reference, Library RBAC, or Audit behavior changes.
32. Source-diff tests prove neither evaluator implementation file nor workpack evaluator logic is modified and no third evaluator exists.

### HTTP/UI safety

33. Real Express tests prove authentication, exact activation permission, CSRF, proposer/activator separation, approver activation, valid activation, and direct crafted-request rejection.
34. Activation control is shown to an eligible QA or ADMIN non-proposer on a dormant approved LIFE_LIMITED publication, including the approval actor.
35. The proposer and unauthorized roles cannot see a usable control; an authorized non-proposer approver can; direct POST remains protected independently.
36. Malformed/missing publication IDs return safe 404; unknown database errors are replaced by the generic safe message.
37. Detail/history renders activation actor, timestamp, reason, before/after snapshots, active publication, and active operational row safely.

### Rollback and deployment

38. Deployment creates no activation and changes no existing publication, operational limit, life state, evaluator output, or workpack result.
39. Empty-activation rollback restores the Phase 1 schema objects and removes only Phase 2 schema additions.
40. Rollback with activation facts/history refuses before dropping anything and preserves all governed regulatory history.

## Implementation scope

The approved Phase 2 implementation slice may add only:

- one permission-definition migration;
- one additive activation schema/transition migration;
- the two guarded mappings;
- publication model fields and one central actor association;
- the activation method in the existing governance service;
- one controller action and one POST route in the existing governance UI;
- the minimal existing detail-query/view activation control and activation facts;
- focused persistence, security, HTTP, evaluator, workpack, RBAC, and rollback tests.

It must not modify either evaluator, create an evaluator, alter operational input authorities, auto-activate data, or broaden any adjacent workflow.

## Resolved decisions and implementation readiness

Activation permission is `COMPONENT_LIFE_LIMIT_ACTIVATE`, mapped only to QA and ADMIN. Activation uses two-person control: `activated_by <> proposal.proposed_by`. The approval actor may activate and no inequality against `proposal.decision_by` is required. ADMIN is subject to proposer/activator separation despite runtime bypass and cannot activate their own proposal. Approval remains dormant. Activation is explicit, confirmed, reasoned, atomic, immutable, and audited. Legacy rows remain outside governance activation. Both existing evaluators consume the activated projection unchanged.

No owner decision remains unresolved for the controlled activation slice defined here. Support for self-activation by the original proposer, automatic activation, activation by ENGINEER or other roles, legacy conversion/deactivation, semantic limit deduplication, evaluator redesign, new due thresholds, or baseline inference is expressly outside this contract and requires a new owner decision.
