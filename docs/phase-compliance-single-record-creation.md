# Phase - Compliance Data Single Record Creation

## Mode

DEFINE only.

Do not implement in this phase. Do not change production code. Do not create migrations yet.

## Goal

Define consistent user-facing single-record creation for:

- Airworthiness Directives.
- Service Bulletins / Service Letters / Service Instructions.
- Supplemental Inspection Documents.

The intent is to let users add one compliance or maintenance source record from the Compliance / Maintenance Data area without using bulk import and without going through model detail first.

## Current State

Users can view or import several compliance data sets, but manual creation is inconsistent:

- ADs have list and import flows under `/library/ads`, but no first-class "add one AD" workflow.
- SBs have source-data list and import flows under `/library/sbs`, plus existing manual/create behavior elsewhere, but there is no single primary "add one SB / SL / SI" workflow from the Compliance / Maintenance Data area.
- SIDs have list/detail views under `/library/sids`, but no global manual creation workflow.

This phase only defines the desired behavior and field mapping.

## Recommended First Implementation Shape

Start with text fields where the existing schema already supports them. Do not introduce relationship tables in the first implementation unless a target field cannot be stored safely without a migration.

Reason:

- A single-record create screen should behave like a controlled version of import commit for one record.
- The first implementation should not change compliance authority, due calculations, workpacks, or applicability engines.
- Text entry preserves operational source data while avoiding premature relationship modeling.

Relationship tables can be introduced later for richer model linking, AD/SB relationships, ATA normalization, and cross-source applicability dashboards.

## Airworthiness Directive Manual Create

### Navigation

Add an `Add New AD` action on the AD list page.

Recommended route names for a future implementation:

- `GET /library/ads/create`
- `POST /library/ads`

### User-Facing Fields

Required:

- AD number.
- Title / subject.
- Effective date.
- Issuing authority.
- Applicability make/model.
- Compliance requirement.
- Status.

Optional:

- Revision.
- Interval hours, if applicable.
- Interval cycles, if applicable.
- Interval months, if applicable.
- Due date or calendar date, if applicable.
- Notes/source document.

### Existing Schema Fit

Existing `airworthiness_directives` fields support most first-pass inputs:

- `ad_number` for AD number.
- `revision` for revision.
- `subject_heading` or `subject` for title / subject.
- `effective_date` for effective date.
- `authority` for issuing authority.
- `make` and `model` for applicability make/model.
- `summary` or `comments` for compliance requirement and notes/source document.
- `status` for status.
- `interval_hours` for interval hours.
- `interval_months` for interval months.
- `is_recurring` for recurring applicability.

Potential schema gaps:

- There is no AD interval cycles column visible in the current model.
- There is no dedicated AD due date/calendar-date column visible in the current model.
- There is no dedicated source document column visible in the current model.

First implementation recommendation:

- Store compliance requirement in `summary`.
- Store notes/source document in `comments`.
- Store interval hours and months only when supplied.
- Do not collect interval cycles or due date as persisted structured values until a migration is defined. If users need to capture them before migration, include them in `comments` with a clear label.

### Validation

Required validation:

- AD number must be present after trimming.
- Title / subject must be present after trimming.
- Effective date must be a valid date.
- Issuing authority must be present after trimming.
- At least one applicability value must be present: make, model, or both.
- Compliance requirement must be present after trimming.
- Status must be present and should use an approved option set.

Recommended status options:

- `ACTIVE`
- `SUPERSEDED`
- `CANCELLED`
- `DRAFT`
- `ARCHIVED`

Duplicate rule:

- Treat `ad_number + revision` as the duplicate key.
- Normalize both values for comparison by trimming whitespace and comparing case-insensitively.
- A blank revision should compare as blank/null.
- If a duplicate exists, block create and link the user to the existing AD.

## Service Bulletin / Letter / Instruction Manual Create

### Navigation

Add an `Add New SB / SL / SI` action on the SB list page.

Recommended route names for a future implementation:

- `GET /library/sbs/create`
- `POST /library/sbs`

### User-Facing Fields

Required:

- Document type: `SB`, `SL`, `SI`, `CIL`, or `OTHER`.
- Reference.
- Title.
- Manufacturer.
- Issue date.
- Applicability make/model.
- Compliance requirement.
- Source document.

Optional:

- Revision.
- ATA chapter/code.
- Related AD number, if applicable.
- Summary/notes.

### Existing Schema Fit

Existing `service_bulletins` fields support most first-pass inputs:

- `category` for document type.
- `reference` and `sb_number` for reference.
- `title` for title.
- `manufacturer` for manufacturer.
- `revision` for revision.
- `issue_date` for issue date.
- `applicability_make` and `applicability_model` for applicability make/model.
- `compliance_requirement` for compliance requirement.
- `source_file` for source document.
- `summary` for summary/notes.
- `status` for lifecycle state.

Potential schema gaps:

- There is no visible dedicated SB related AD number column.
- There is no visible dedicated SB ATA chapter/code column.

First implementation recommendation:

- Store document type in `category`.
- Store source document in `source_file`.
- Store summary/notes in `summary`.
- If related AD number is needed before migration, store it inside `summary` using a clear label such as `Related AD:`.
- If ATA chapter/code is needed before migration, store it inside `summary` or `applicability_notes` using a clear label such as `ATA:`.

Migration recommendation for a later implementation:

- Add `related_ad_number` to `service_bulletins` if users need reliable searching/filtering by AD relationship.
- Add `ata_chapter` or `ata_code` to `service_bulletins` if users need reliable searching/filtering by ATA.
- Consider a later relationship table only when the product needs multiple AD links per SB or validated links to AD records.

### Validation

Required validation:

- Document type must be one of `SB`, `SL`, `SI`, `CIL`, `OTHER`.
- Reference must be present after trimming.
- Title must be present after trimming.
- Manufacturer must be present after trimming.
- Issue date must be a valid date.
- At least one applicability value must be present: make, model, or both.
- Compliance requirement must be present after trimming.
- Source document must be present after trimming.

Duplicate rule:

- Treat `manufacturer + reference + revision` as the duplicate key.
- Normalize values by trimming whitespace and comparing case-insensitively.
- A blank revision should compare as blank/null.
- If a duplicate exists, block create and link the user to the existing SB/SL/SI.

## Supplemental Inspection Document Manual Create

### Navigation

Add an `Add New SID` action on the SID list page.

Recommended route names for a future implementation:

- `GET /library/sids/create`
- `POST /library/sids`

### User-Facing Fields

Required:

- Reference.
- Title.
- Manufacturer.
- Applicability.
- Inspection operation.

Optional:

- ATA chapter/code.
- Section reference.
- Initial interval hours.
- Initial interval months.
- Repeat interval hours.
- Repeat interval months.
- Notes/source document.

### Existing Schema Fit

Existing `supplemental_inspection_documents` fields support the requested first-pass inputs:

- `reference` for reference.
- `title` for title.
- `manufacturer` for manufacturer.
- `ata_chapter` for ATA chapter/code.
- `section_reference` for section reference.
- `initial_interval_hours` and `initial_interval_months` for initial interval.
- `repeat_interval_hours` and `repeat_interval_months` for repeat interval.
- `inspection_operation` for inspection operation.
- `notes` for notes.
- `source_document` for source document.
- `description` or `notes` for text applicability until richer applicability entry is implemented.

Potential schema gaps:

- There is no simple text `applicability` column visible on the SID model.
- SID model applicability exists through `sid_model_applicability`, but using it in the first implementation would require a deliberate relationship workflow.

First implementation recommendation:

- Store free-text applicability in `description` or `notes` with a clear label such as `Applicability:`.
- Do not write `sid_model_applicability` from the first manual create screen unless the user explicitly selects existing component models in a later implementation.

Migration recommendation for a later implementation:

- Add a simple `applicability` text column to `supplemental_inspection_documents` if free-text SID applicability needs first-class display/search.
- Alternatively, define a model-selection workflow that creates `sid_model_applicability` rows and keeps free-text notes separate.

### Validation

Required validation:

- Reference must be present after trimming.
- Title must be present after trimming.
- Manufacturer must be present after trimming.
- Applicability text must be present after trimming.
- Inspection operation must be present after trimming.
- Interval fields, when supplied, must be non-negative whole numbers.
- At least one interval field should be supplied unless the SID is explicitly marked as non-recurring or informational in a later field design.

Duplicate rule:

- Treat `manufacturer + reference` as the duplicate key.
- Normalize both values by trimming whitespace and comparing case-insensitively.
- If a duplicate exists, block create and link the user to the existing SID.

## Relationship Decision

First implementation should use text fields and existing columns only.

Do not introduce relationship tables in the first single-record creation phase.

Recommended treatment:

- AD related data: use existing AD fields and existing import relationship behavior only. Do not add new AD relationship management in the create form.
- SB related AD number: text-only in `summary` until a `related_ad_number` column or relationship table is approved.
- SB ATA code: text-only in `summary` or `applicability_notes` until an `ata_chapter` or `ata_code` column is approved.
- SID applicability: text-only in `description` or `notes` until either a simple `applicability` column or a model-selection relationship workflow is approved.

Relationship tables should be considered later when the workflow needs:

- multiple related ADs per SB;
- validated links to internal AD records;
- many-to-many model applicability assignment during create;
- ATA normalization;
- audit-grade relationship review and approval.

## Page-Level Navigation

Each list page should expose one primary add action:

- `/library/ads`: `Add New AD`.
- `/library/sbs`: `Add New SB / SL / SI`.
- `/library/sids`: `Add New SID`.

The Compliance / Maintenance Data landing page can also expose these create actions later, but the first implementation should put them on the list pages where users already review source records.

Recommended placement:

- Primary button near the existing import/list header actions.
- Import actions remain available and unchanged.
- Create actions should not replace imports.

## User Experience Rules

Creation screens should:

- Use one form per source type.
- Label fields with operational names, not database column names.
- Show which fields are required.
- Preserve entered values after validation errors.
- Show duplicate detection before writing the record.
- Redirect to the list or detail page after successful creation.
- Display a success flash message identifying the created reference.

Creation screens should not:

- Trigger due recalculation.
- Generate workpack tasks.
- Assign aircraft compliance status.
- Modify applicability engine behavior.
- Refactor import parsing or import commit flows.
- Create migrations implicitly.

## Boundaries

Explicitly out of scope:

- No due recalculation changes.
- No workpack changes.
- No applicability engine changes.
- No import refactor.
- No compliance projection changes.
- No change to compliance authority.
- No migrations in this DEFINE phase.
- No automatic model assignment from free-text applicability.
- No bulk create or import changes.

## Future Implementation Acceptance Criteria

A later IMPLEMENT phase should be considered complete when:

- AD list page has `Add New AD`.
- SB list page has `Add New SB / SL / SI`.
- SID list page has `Add New SID`.
- Each create form validates required fields.
- Each create action enforces the duplicate rules defined above.
- Each create action writes only to the appropriate source-data table and existing supported columns.
- Import flows continue to work unchanged.
- Due engines, workpacks, applicability engines, and migrations remain untouched unless explicitly included in a later phase.

