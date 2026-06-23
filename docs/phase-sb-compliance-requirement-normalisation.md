# Phase - SB Compliance Requirement Normalisation

## Mode

DEFINE only.

Do not implement in this phase. Do not change code. Do not run migrations.

## Goal

Normalize Service Bulletin compliance requirement values so the stored values are:

- `MANDATORY`
- `REQUIRED`
- `OPTIONAL`

User decision:

- `MANUAL` is wrong for Service Bulletin compliance requirement.
- Existing `MANUAL` Service Bulletin compliance requirement values must become `REQUIRED`.
- UI options must be uppercase: `MANDATORY`, `REQUIRED`, `OPTIONAL`.

## Current Model And Database State

### ServiceBulletin Model

The Sequelize model exposes `compliance_type`, but maps that property to the physical `compliance_requirement` column.

Evidence:

- `src/models/ServiceBulletin.ts` has `declare compliance_type: string`.
- The model getter/setter named `compliance_requirement` reads/writes `compliance_type`.
- The model field `compliance_type` has:
  - `type: DataTypes.STRING`
  - `allowNull: false`
  - `defaultValue: 'MANUAL'`
  - `field: 'compliance_requirement'`
- The `beforeValidate` hook defaults missing `compliance_type` to `MANUAL`.

Current implication:

- Application code that writes `compliance_type` through Sequelize writes to the `compliance_requirement` column.
- `MANUAL` is currently the application default.

### service_bulletins Table

Current local database columns:

```text
compliance_requirement varchar nullable default 'MANUAL'
compliance_type        varchar not null default 'MANUAL'
```

Current local values:

```text
compliance_type | compliance_requirement | count
MANUAL          | MANUAL                 | 2
MANUAL          | MANDATORY              | 1
```

There is currently no database check constraint limiting Service Bulletin compliance values.

Important nuance:

- The table has both legacy `compliance_type` and newer `compliance_requirement`.
- Current import SQL writes both columns.
- Current Sequelize model writes `compliance_requirement` through the property named `compliance_type`.
- Existing data can diverge between the two columns.

## Current UI Surfaces

### Library Add New SB / SL / SI

Current file:

- `src/views/library/sbs/new.ejs`

Current field:

- `name="compliance_type"`

Current UI has recently been adjusted to display:

- `Mandatory` with value `MANDATORY`
- `Required` with value `MANUAL`
- `Optional` with value `OPTIONAL`

This is now intentionally obsolete for the next phase. The next implementation must change the stored value for Required from `MANUAL` to `REQUIRED`.

Required future state:

```text
MANDATORY -> MANDATORY
REQUIRED  -> REQUIRED
OPTIONAL  -> OPTIONAL
```

### Standalone /service-bulletins Create UI

Current file:

- `src/views/service-bulletins/index.ejs`

Current field:

- `name="compliance_type"`

Current options:

- `Manual` with value `MANUAL`
- `Mandatory` with value `MANDATORY`
- `Optional` with value `OPTIONAL`

Required future state:

- Remove `MANUAL` from the SB compliance requirement dropdown.
- Use uppercase display labels.
- Use stored values `MANDATORY`, `REQUIRED`, `OPTIONAL`.

### Model Detail SB Create UI

Current file:

- `src/views/library/model-detail.ejs`

Current options appear in model-context SB create/attach areas:

- `Mandatory` with value `MANDATORY`
- `Recommended` with value `MANUAL`
- `Optional` with value `OPTIONAL`

Required future state:

- Replace `MANUAL` with `REQUIRED`.
- Use uppercase user-facing labels where this is a Service Bulletin compliance requirement field.

## Current Service Defaults

### LibraryService.createLibraryServiceBulletin

Current file:

- `src/modules/library/library.service.ts`

Current behavior:

- `compliance_type` defaults to `MANUAL`.
- Priority sorting treats:
  - `MANDATORY` as highest priority
  - `MANUAL` as next
  - `OPTIONAL` as next

Required future state:

- Default must become `REQUIRED`.
- Priority sorting must treat `REQUIRED` as the middle value currently occupied by `MANUAL`.
- `MANUAL` should be treated only as legacy input during transition, normalized to `REQUIRED`.

### LibraryService.createServiceBulletin / Bulk Create

Current behavior:

- Model-context creation defaults missing `compliance_type` to `MANUAL`.
- Bulk creation defaults missing `compliance_type` to `MANUAL`.

Required future state:

- Defaults must become `REQUIRED`.
- Legacy incoming `MANUAL` should be normalized to `REQUIRED`.

### ServiceBulletinService.create

Current file:

- `src/modules/service-bulletins/service-bulletin.service.ts`

Current behavior:

- Standalone `/service-bulletins` creation defaults missing `compliance_type` to `MANUAL`.
- Service-level priority sorting recognizes `MANDATORY`, `MANUAL`, `OPTIONAL`.

Required future state:

- Defaults must become `REQUIRED`.
- Priority sorting must recognize `REQUIRED`.
- Legacy `MANUAL` should normalize to `REQUIRED` for SB compliance requirement.

## Current Import Behavior

### Library SB CSV/Piper Import

Files:

- `src/modules/library/sb-import.adapters.ts`
- `src/modules/library/sb-import.controller.ts`

Current behavior:

- Import accepts compliance headers such as:
  - `compliance_requirement`
  - `compliance`
  - `compliance_type`
  - `recommendation`
  - `requirement`
- Generic CSV import stores normalized text from the file.
- If the generic value is blank, commit defaults to `MANUAL`.
- Piper classification mapping currently does:
  - `MANDATORY` -> `MANDATORY`
  - `REQUIRED` -> `MANDATORY`
  - `ALERT` / `EMERGENCY` -> `MANDATORY`
  - `OPTIONAL` -> `OPTIONAL`
  - anything else -> `MANUAL`
- Import commit writes both `compliance_type` and `compliance_requirement`.

Required future state:

- Blank SB import compliance requirement defaults to `REQUIRED`.
- Source text `REQUIRED`, `REQUIRED SERVICE`, or similar clear required classifications must normalize to `REQUIRED`.
- Source text `MANDATORY`, `ALERT`, and `EMERGENCY` should normalize to `MANDATORY`.
- Source text `OPTIONAL` should normalize to `OPTIONAL`.
- Source text `RECOMMENDED` needs a product decision:
  - Recommended option A: normalize to `REQUIRED` because the allowed value set has no `RECOMMENDED`.
  - Recommended option B: add `RECOMMENDED` as a fourth stored value in a later data-model phase.
- Import commit should keep `compliance_type` and `compliance_requirement` synchronized while both columns exist.

### Standalone Sync Adapters

Files:

- `src/modules/service-bulletins/adapters/VeryonAdapter.ts`
- `src/modules/service-bulletins/adapters/PiperPdfAdapter.ts`
- `src/modules/service-bulletins/adapters/types.ts`

Current behavior:

- Adapter type allows only `MANDATORY | OPTIONAL | MANUAL`.
- Veryon maps unknown/non-mandatory/non-optional labels to `MANUAL`.
- Piper PDF adapter currently emits `MANUAL`.

Required future state:

- Adapter type must become `MANDATORY | REQUIRED | OPTIONAL`.
- Veryon unknown required-like labels should become `REQUIRED`; only explicit mandatory labels should become `MANDATORY`.
- Piper PDF default should become `REQUIRED` unless the source explicitly identifies a mandatory or optional classification.

## Downstream Logic

### Aircraft Service Bulletin Views / Filtering

Current file:

- `src/modules/aircraft/aircraft.service.ts`

Current behavior:

- Priority map recognizes `MANDATORY`, `MANUAL`, `OPTIONAL`.
- Critical filtering checks only `compliance_type === 'MANDATORY'`.

Required future state:

- Priority map should recognize `REQUIRED` in the middle position.
- Legacy `MANUAL` should be treated as `REQUIRED` during transition.
- Critical filtering can continue to treat only `MANDATORY` as critical unless a later phase changes operational meaning.

### Library And Standalone SB Sorting

Current files:

- `src/modules/library/library.service.ts`
- `src/modules/service-bulletins/service-bulletin.service.ts`

Current behavior:

- Priority maps recognize `MANDATORY`, `MANUAL`, `OPTIONAL`.

Required future state:

- Priority maps should recognize `MANDATORY`, `REQUIRED`, `OPTIONAL`.
- Legacy `MANUAL` should sort as `REQUIRED` until migration/backfill has fully removed it.

### Compliance Projection

Current file:

- `src/modules/compliance/compliance-projection.service.ts`

Current behavior:

- `COMPLIANCE_BASIS_VALUES` currently allows:
  - `MANDATORY`
  - `RECOMMENDED`
  - `MANUAL`
- SB projection uses `normalizeComplianceBasis(bulletin.compliance_type, 'MANUAL')`.

Important issue:

- If Service Bulletin compliance requirement becomes `REQUIRED`, compliance projection must recognize `REQUIRED`.
- Otherwise `REQUIRED` may be treated as fallback or rejected depending on normalization behavior.

Required future state:

- Add `REQUIRED` as a known compliance basis for SB-derived compliance items, or explicitly map SB `REQUIRED` to the compliance basis value the business wants.
- Recommended: add `REQUIRED` as a first-class compliance basis value to avoid reintroducing ambiguous `MANUAL`.

### compliance_items Table Constraint

Current migration:

- `migrations/430_create_compliance_items.ts`

Current check constraint:

```text
compliance_basis IN ('MANDATORY', 'RECOMMENDED', 'MANUAL')
```

Required future state:

- A migration is required if compliance projection stores `REQUIRED` in `compliance_items.compliance_basis`.
- Recommended check set:

```text
MANDATORY
REQUIRED
RECOMMENDED
MANUAL
```

Transition note:

- Keep `MANUAL` in compliance item constraints if other domains still use it.
- Do not globally redefine every `MANUAL` in the system; this phase is about Service Bulletin compliance requirement.

## Required Change Summary

### Migration Needed

Yes.

Required migration actions:

1. Backfill Service Bulletin compliance values:

```sql
UPDATE service_bulletins
SET
  compliance_requirement = 'REQUIRED'
WHERE UPPER(COALESCE(compliance_requirement, '')) = 'MANUAL'
   OR compliance_requirement IS NULL
   OR BTRIM(compliance_requirement) = '';
```

2. Keep legacy `compliance_type` column synchronized while it still exists:

```sql
UPDATE service_bulletins
SET
  compliance_type = 'REQUIRED'
WHERE UPPER(COALESCE(compliance_type, '')) = 'MANUAL'
   OR compliance_type IS NULL
   OR BTRIM(compliance_type) = '';
```

3. Change defaults:

```text
service_bulletins.compliance_requirement default -> 'REQUIRED'
service_bulletins.compliance_type default        -> 'REQUIRED'
```

4. If compliance projection stores `REQUIRED`, update `compliance_items.compliance_basis` check constraint to include `REQUIRED`.

Optional but recommended migration hardening:

- Add or update a Service Bulletin compliance check constraint for both Service Bulletin columns:

```text
MANDATORY
REQUIRED
OPTIONAL
```

Only add this if imports/services are normalized first and existing unexpected values have been audited.

### Model Changes Needed

Yes.

Required:

- `ServiceBulletin` model default for `compliance_type` must become `REQUIRED`.
- `beforeValidate` fallback must become `REQUIRED`.
- Consider introducing a local normalization helper for SB compliance requirement so `MANUAL` inputs become `REQUIRED`.

### Service Changes Needed

Yes.

Required files include:

- `src/modules/library/library.service.ts`
- `src/modules/service-bulletins/service-bulletin.service.ts`
- potentially `src/modules/aircraft/aircraft.service.ts`

Required behavior:

- Defaults become `REQUIRED`.
- Priority maps become:

```text
MANDATORY -> 0
REQUIRED  -> 1
OPTIONAL  -> 2
```

- Legacy `MANUAL` input should be normalized or treated as `REQUIRED`.

### Import Changes Needed

Yes.

Required files include:

- `src/modules/library/sb-import.adapters.ts`
- `src/modules/library/sb-import.controller.ts`
- `src/modules/service-bulletins/adapters/VeryonAdapter.ts`
- `src/modules/service-bulletins/adapters/PiperPdfAdapter.ts`
- `src/modules/service-bulletins/adapters/types.ts`

Required behavior:

- Blank/default import value becomes `REQUIRED`.
- `REQUIRED`, `REQUIRED SERVICE`, and equivalent text become `REQUIRED`.
- `MANDATORY`, `ALERT`, and `EMERGENCY` become `MANDATORY`.
- `OPTIONAL` becomes `OPTIONAL`.
- Generic import should not pass through arbitrary compliance values without normalization once the canonical value set is enforced.

### UI Changes Needed

Yes.

Required files include:

- `src/views/library/sbs/new.ejs`
- `src/views/service-bulletins/index.ejs`
- `src/views/library/model-detail.ejs`

Required UI:

```text
MANDATORY
REQUIRED
OPTIONAL
```

Required stored values:

```text
MANDATORY
REQUIRED
OPTIONAL
```

Remove helper text that says `Required is stored as MANUAL`.

### Test Updates Needed

Yes.

Expected impacted tests:

- `src/views/library/compliance-single-record-create.views.test.ts`
- `src/modules/library/compliance-single-record-create.test.ts`
- `src/modules/library/library.service-bulletin.test.ts`
- `src/modules/library/sb-import.adapters.test.ts`
- `src/modules/service-bulletins/service-bulletin-sync.service.test.ts`
- any aircraft/SB sorting tests that assert `MANUAL`
- any compliance projection tests that assert `MANUAL`

Required test coverage:

- UI dropdown values are uppercase `MANDATORY`, `REQUIRED`, `OPTIONAL`.
- New manual SB creates default to `REQUIRED`.
- Standalone `/service-bulletins` creates default to `REQUIRED`.
- Model-detail bulk/manual SB creates default to `REQUIRED`.
- Generic import normalizes blank/required-like values to `REQUIRED`.
- Piper import maps `REQUIRED` to `REQUIRED`, not `MANDATORY`.
- Veryon/Piper sync adapters emit `REQUIRED` instead of `MANUAL` for non-mandatory required/default records.
- Aircraft and SB list ordering treat `REQUIRED` as the middle priority.
- Compliance projection accepts or maps `REQUIRED`.
- Migration backfills existing `MANUAL` Service Bulletin compliance values to `REQUIRED`.

## Proposed Implementation Sequence

1. Add a small SB compliance normalization helper in service/import code:

```text
MANDATORY-like -> MANDATORY
REQUIRED-like or legacy MANUAL -> REQUIRED
OPTIONAL-like -> OPTIONAL
blank -> REQUIRED
```

2. Update model defaults and service defaults from `MANUAL` to `REQUIRED`.

3. Update UI dropdowns to uppercase `MANDATORY`, `REQUIRED`, `OPTIONAL`.

4. Update import adapters/controllers to normalize into the canonical set.

5. Update downstream sorting/projection recognition of `REQUIRED`.

6. Add migration:

- backfill Service Bulletin `MANUAL` to `REQUIRED`;
- change Service Bulletin defaults;
- update compliance item constraint if storing `REQUIRED` in `compliance_items`.

7. Update tests.

8. Run focused tests plus build.

## Boundaries

In scope for a future implementation phase:

- Service Bulletin compliance requirement normalization.
- Service Bulletin model/default changes.
- Service Bulletin UI dropdowns.
- Service Bulletin import normalization.
- Service Bulletin data/default migration.
- Downstream recognition of `REQUIRED` where SB compliance requirement is consumed.

Out of scope:

- No AD logic changes.
- No SID logic changes.
- No workpack behavior changes.
- No due-engine meaning changes beyond recognizing `REQUIRED` as the middle SB compliance priority.
- No global reinterpretation of unrelated `MANUAL` values such as source type, trigger type, assignment source, utilisation source, or component tracking basis.
- No removal of legacy columns unless a separate schema cleanup phase is defined.

## Acceptance Criteria For This Define Phase

- Current Service Bulletin compliance requirement usage is mapped.
- Current DB columns and values are documented.
- Required migration need is documented.
- Required model/service/import/UI/test updates are documented.
- Boundaries are explicit.
- No code or migration was implemented in this phase.

