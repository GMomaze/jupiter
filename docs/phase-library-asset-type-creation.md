# Phase - Library Asset Type Creation

## Mode

DEFINE only.

No implementation, migrations, production code changes, refactors, or generic reference-module changes are part of this phase.

## Current Status

Status: NOT IMPLEMENTED.

Current findings:

- The Library dashboard lists existing asset types and uses them as the first selection level.
- The dashboard does not provide an asset-type creation form.
- No `POST /library/asset-types` route exists.
- No `GET /library/asset-types/new` route exists.
- `LibraryService.getAssetTypes()` exists for reads.
- `LibraryService.createAssetType()` does not exist.
- `rf_asset_type` already exists and has the fields needed for this workflow.
- The generic `/reference` path is incomplete and must not be used as the primary Library asset-type workflow.

## Goal

Allow authorized Library users to create asset types from the Library area through a clear, governed workflow.

The workflow must support operational asset modeling without changing existing asset types, manufacturers, models, imports, component install/remove behavior, utilisation, due tracking, workpacks, or compliance logic.

## User Workflow

1. User opens the Library dashboard.
2. User chooses an "Add Asset Type" action.
3. System opens `GET /library/asset-types/new`.
4. User enters the asset type details.
5. User submits the form to `POST /library/asset-types`.
6. System validates the request.
7. On success, system creates the asset type and flashes a success message.
8. User returns to the Library dashboard or an asset type list with the new type visible.
9. On validation failure, system re-renders the form with field-level or clear summary errors and preserves submitted values.

## Required Fields

The create form must capture:

- `code`
- `label`
- `description`
- `is_installable_on_aircraft`
- `is_required_for_aircraft`
- `required_quantity`
- `is_active`

## Validation Rules

Input normalization:

- `code` is trimmed and normalized to uppercase before validation and persistence.
- `label` is trimmed before validation and persistence.
- `description` is trimmed; blank values become `null`.
- checkbox fields are interpreted from HTML checkbox values such as `on`, `true`, or absence.
- `required_quantity` is parsed as an integer.

Required rules:

- `code` is required.
- `label` is required.
- `required_quantity` must be a non-negative integer.

Business rules:

- Duplicate `code` is blocked with a clear message.
- If `is_required_for_aircraft = true`, then `required_quantity` must be greater than `0`.
- If `is_installable_on_aircraft = false`, then `is_required_for_aircraft` must be forced or rejected as `false`.
- `is_active` defaults to `true` if omitted.

Recommended error messages:

- `Asset type code is required.`
- `Asset type label is required.`
- `Asset type code already exists.`
- `Required quantity must be a non-negative whole number.`
- `Required aircraft asset types must have a required quantity greater than 0.`
- `Only installable asset types can be required on aircraft.`

## Route Design

Add Library routes:

```text
GET  /library/asset-types/new
POST /library/asset-types
```

### GET `/library/asset-types/new`

Responsibilities:

- require authentication through existing Library route mounting;
- require Library edit permission;
- render a dedicated asset-type creation form;
- include CSRF token;
- provide an empty form model;
- provide empty validation errors.

### POST `/library/asset-types`

Responsibilities:

- require authentication through existing Library route mounting;
- require Library edit permission;
- enforce CSRF;
- call `LibraryService.createAssetType()`;
- on success, flash a success message and redirect to `/library` or `/library/asset-types`;
- on validation failure, render the form with HTTP 400 and clear errors;
- on duplicate code, render the form with HTTP 400 and a clear duplicate-code message;
- do not swallow database or validation errors as generic permission failures.

## Service Design

Add:

```ts
LibraryService.createAssetType(data)
```

Suggested input shape:

```ts
{
  code: string;
  label: string;
  description?: string | null;
  is_installable_on_aircraft?: boolean;
  is_required_for_aircraft?: boolean;
  required_quantity?: number;
  is_active?: boolean;
}
```

Responsibilities:

- normalize `code`;
- trim `label` and `description`;
- validate all rules before persistence;
- check duplicate `code` or translate unique-constraint errors into a clear domain error;
- create the `AssetType` row;
- return the created asset type.

Persistence target:

- model: `AssetType`
- table: `rf_asset_type`

No migration is required for this phase because `rf_asset_type` already has the required columns and defaults.

## UI Design

Create a dedicated form page or Library modal for new asset types.

Recommended page:

```text
src/views/library/asset-type-create.ejs
```

Form requirements:

- method: `POST`
- action: `/library/asset-types`
- hidden `_csrf` field;
- inputs for all required fields;
- checkbox controls for boolean fields;
- numeric input for `required_quantity` with `min="0"` and `step="1"`;
- visible validation error area;
- preserve submitted values after validation failure;
- clear cancel/back link to `/library`;
- success flash after creation.

The Library dashboard should expose an "Add Asset Type" link or button for users with the correct permission.

## Permission Rule

Use the existing Library edit permission:

```text
LIBRARY_EDIT
```

If `LIBRARY_EDIT` is not available in a deployment, the fallback should be ADMIN-only using the current permission behavior where ADMIN bypasses permission checks.

Do not rely on the generic `/reference` module for this workflow.

## Error Handling

The controller should distinguish:

- validation errors;
- duplicate-code errors;
- unexpected persistence errors;
- permission failures;
- CSRF failures.

Validation and duplicate errors should return the form with HTTP 400.

Permission failures should remain HTTP 403 through existing middleware.

Unexpected errors may be passed to the global error handler after preserving useful logs.

## Boundaries

This phase must not:

- change existing asset type rows;
- alter manufacturers;
- alter component models;
- alter import behavior;
- alter component install/remove logic;
- alter aircraft lifecycle logic;
- alter utilisation event logic;
- alter due tracking or compliance calculations;
- alter workpack lifecycle logic;
- alter RBAC schema;
- alter migrations;
- alter the generic `/reference` module.

## Risks

- Adding asset types without clear installability flags can affect downstream model/component selection semantics.
- Required aircraft asset types with incorrect quantity can distort technical-dashboard unknown/missing-component indicators.
- Duplicate-code handling must be user-friendly because database unique errors are not suitable UI messages.
- Generic `/reference` code appears incomplete and should not be expanded casually inside this phase.
- Existing views may display `description` in places where the `AssetType` model currently exposes `label`; implementation should verify display fields before changing UI copy.

## Acceptance Criteria For Future Implement

- `GET /library/asset-types/new` renders for users with Library edit authority.
- `POST /library/asset-types` creates a valid asset type.
- duplicate `code` is rejected with a clear message.
- missing `code` or `label` is rejected.
- invalid `required_quantity` is rejected.
- `is_required_for_aircraft` cannot be true unless installable and quantity is greater than zero.
- CSRF is enforced.
- success and error messages are visible.
- existing Library dashboard continues to list asset types.
- no unrelated modules are modified.
