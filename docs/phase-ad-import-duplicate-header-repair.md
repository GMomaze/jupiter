# Phase 22 - AD Import Duplicate Header Repair

## Active Phase

Phase 22 FAA AD Import and Applicability

## Mode

DEFINE

## Audit Result

PARTIAL_MATCH

The AD import preview parser already maps recognized FAA AD headers into Jupiter preview fields, but duplicate recognized headers can map to the same Jupiter field. The current row normalization assigns values left to right, so a later duplicate column can overwrite an earlier valid value.

## Current Failure Mode

In `previewAdMatrix()`:

1. The detected header row is mapped with `FIELD_BY_NORMALIZED_HEADER`.
2. Each recognized column is processed in column order.
3. Values are assigned directly to `values[field.key]`.
4. A later duplicate mapped header can overwrite the same field.

Example:

| Column | Header | Jupiter field | Raw value |
| --- | --- | --- | --- |
| 0 | AD Number | `ad_number` | `96-01-01` |
| 1 | Status | `status` | `Historical` |
| 2 | Effective Date | `effective_date` | `01/19/1996` |
| 3 | Subject | `subject` | `Blade Taper Bore` |
| 4 | Docket Number | `docket_number` | `95-ANE-73` |
| 5 | AD Number | `ad_number` | blank |
| 6 | Status | `status` | blank |
| 7 | Effective Date | `effective_date` | blank |

Current result:

- `subject` remains populated.
- `docket_number` remains populated.
- `ad_number`, `status`, and `effective_date` become blank because later duplicate columns overwrite earlier non-empty values.

## Repair Contract

The repair shall preserve the first non-empty value for each mapped Jupiter field during preview normalization.

Rules:

- Do not overwrite an existing non-empty mapped field value with a later blank duplicate.
- If a mapped field is currently blank and a later duplicate contains a non-empty value, accept the later non-empty value.
- If a mapped field already has a non-empty value and a later duplicate also has a non-empty value:
  - preserve the first non-empty value;
  - add a warning identifying the duplicate mapped header and the ignored later value.
- If duplicate mapped headers exist, record a row-level warning so the operator can see that the source file contained duplicate columns.
- Relationship fields such as `Affected AD`, `Superseded AD`, `Affected By`, and `Superseded By` shall follow the same first-non-empty preservation rule unless implementation evidence proves they need merge semantics.
- Date fields shall preserve the first successfully normalized non-empty date value.
- Date parse errors from blank duplicate columns must not be added when an earlier valid date already populated the field.
- Date parse errors from non-empty duplicate columns must still be reported if that duplicate value is considered for an empty field.

## Boundaries

- Keep validation rules unchanged.
- Keep commit logic unchanged; commit consumes the normalized preview rows already produced by the preview parser.
- Keep database schema unchanged.
- Keep AD import routes unchanged.
- Keep AD import views unchanged unless warning display is proven insufficient.
- Do not change AD import persistence behavior.
- Do not change duplicate AD detection.
- Do not change AD applicability review.
- Do not change compliance, SB, SID, task, workpack, or due behavior.
- Do not add delimiter, file type, or broad parser redesign in this slice.

## Later Non-Empty Duplicate Handling

Later non-empty duplicates are potentially conflicting source data. The safe first slice shall not attempt to reconcile or merge them.

Required behavior:

- Preserve the first non-empty value.
- Warn that a duplicate mapped header was ignored because the field already had a value.
- Include enough context in the warning to identify the field, for example: `Duplicate AD Number column ignored; first non-empty value was preserved.`

## Expected Files

- `src/modules/library/ad-import.controller.ts`
- `src/modules/library/ad-import-preview-usability.test.ts`

No migrations, models, services, routes, or view files are expected.

## Tests

Focused tests shall cover:

- Duplicate `AD Number`, `Status`, and `Effective Date` headers with later blank duplicates remain valid.
- Duplicate `AD Number`, `Status`, and `Effective Date` headers with later non-empty duplicates preserve the first non-empty value and emit warnings.
- `Subject` and `Docket Number` continue to map correctly.
- Existing normal CSV import tests continue to pass.
- Existing preamble/header-row detection tests continue to pass.
- Existing true AD Number and docket-only behavior remains unchanged.

## Acceptance Criteria

- A row containing valid first `AD Number`, `Status`, and `Effective Date` values is not invalidated by later blank duplicate mapped columns.
- Preview warnings identify duplicate mapped headers.
- Commit behavior remains based on preview-normalized values.
- Existing AD import validation errors still appear when required fields are genuinely missing.
- No unrelated production behavior changes.

## Verification Checklist

- Run `npm.cmd run build`.
- Run `npx.cmd vitest run src/modules/library/ad-import-preview-usability.test.ts`.
- Run `git diff --check -- src/modules/library/ad-import.controller.ts src/modules/library/ad-import-preview-usability.test.ts`.
- Confirm no schema, route, view, compliance, applicability, SB, SID, task, workpack, or due changes.
