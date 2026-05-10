# Phase 18.2 - Compile Failure Inventory

## Status

CAPTURE ONLY

This phase records the exact current TypeScript compile failures.

This phase does not apply fixes, does not change code behavior, does not change schema, does not change migrations, and does not refactor.

All locked Phase 10, 14, and 17 boundaries are preserved.

## Compile Process Run

- Command: `cmd /c npm run build`
- Script resolved: `tsc`
- Result: `FAIL`

## Capture Notes

- The TypeScript failures below are true compile blockers emitted by `tsc`.
- PowerShell execution-policy messages related to `Microsoft.PowerShell_profile.ps1` and `npm.ps1` are environment shell noise and are not TypeScript compile errors.
- Failures are grouped by file.
- Repeated occurrences of the same type pattern in the same file are marked as downstream duplicates where appropriate.

## True Compile Blockers By File

### `src/modules/customers/customers.service.ts`

#### Primary blocker pattern

- Type mismatch caused by `actor_id` being passed as `string | null | undefined` into a target type that accepts `string | null` under `exactOptionalPropertyTypes: true`.

#### Errors

- Line `144`
  - Error code: `TS2379`
  - Failing symbol: `AuditService.log(...)` payload `actor_id`
  - Message: `Argument of type '{ table_name: string; row_id: string; action: string; actor_id: string | null | undefined; reason: string; new_values: CustomerPayload; }' is not assignable to parameter of type '{ table_name: string; row_id: string; action: string; actor_id?: string | null; old_values?: any; new_values?: any; reason?: string | null; }' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.`

- Line `174`
  - Error code: `TS2379`
  - Failing symbol: `AuditService.log(...)` payload `actor_id`
  - Message: `Argument of type '{ table_name: string; row_id: string; action: string; actor_id: string | null | undefined; reason: string; old_values: any; new_values: any; }' is not assignable to parameter of type '{ table_name: string; row_id: string; action: string; actor_id?: string | null; old_values?: any; new_values?: any; reason?: string | null; }' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.`

- Line `240`
  - Error code: `TS2379`
  - Failing symbol: `AuditService.log(...)` payload `actor_id`
  - Message: `Argument of type '{ table_name: string; row_id: string; action: string; actor_id: string | null | undefined; reason: string; new_values: any; }' is not assignable to parameter of type '{ table_name: string; row_id: string; action: string; actor_id?: string | null; old_values?: any; new_values?: any; reason?: string | null; }' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.`

#### Downstream duplicate assessment

- Lines `174` and `240` are downstream duplicates of the same primary type incompatibility pattern already shown at line `144`.

### `src/modules/library/ad-import.controller.ts`

#### Primary blocker patterns

- Unsafe possibly-undefined object access
- Passing `string | undefined` where `string` is required
- Possibly-undefined local variables (`attributes`, `cellBody`)

#### Errors

- Line `470`
  - Error code: `TS2532`
  - Failing symbol: object access
  - Message: `Object is possibly 'undefined'.`

- Line `471`
  - Error code: `TS2345`
  - Failing symbol: string argument
  - Message: `Argument of type 'string | undefined' is not assignable to parameter of type 'string'.`

- Line `505`
  - Error code: `TS2532`
  - Failing symbol: object access
  - Message: `Object is possibly 'undefined'.`

- Line `516`
  - Error code: `TS2532`
  - Failing symbol: object access
  - Message: `Object is possibly 'undefined'.`

- Line `520`
  - Error code: `TS18048`
  - Failing symbol: `attributes`
  - Message: `'attributes' is possibly 'undefined'.`

- Line `525`
  - Error code: `TS2345`
  - Failing symbol: string argument
  - Message: `Argument of type 'string | undefined' is not assignable to parameter of type 'string'.`

- Line `526`
  - Error code: `TS18048`
  - Failing symbol: `attributes`
  - Message: `'attributes' is possibly 'undefined'.`

- Line `531`
  - Error code: `TS18048`
  - Failing symbol: `cellBody`
  - Message: `'cellBody' is possibly 'undefined'.`

- Line `535`
  - Error code: `TS18048`
  - Failing symbol: `cellBody`
  - Message: `'cellBody' is possibly 'undefined'.`

- Line `536`
  - Error code: `TS2345`
  - Failing symbol: string argument
  - Message: `Argument of type 'string | undefined' is not assignable to parameter of type 'string'.`

- Line `539`
  - Error code: `TS18048`
  - Failing symbol: `cellBody`
  - Message: `'cellBody' is possibly 'undefined'.`

- Line `540`
  - Error code: `TS2345`
  - Failing symbol: string argument
  - Message: `Argument of type 'string | undefined' is not assignable to parameter of type 'string'.`

#### Downstream duplicate assessment

- Lines `505` and `516` are downstream duplicates of the same possibly-undefined object-access pattern shown at line `470`.
- Lines `525`, `536`, and `540` are downstream duplicates of the same `string | undefined` to `string` argument pattern shown at line `471`.
- Line `526` is a downstream duplicate of the same `attributes` nullability issue shown at line `520`.
- Lines `535` and `539` are downstream duplicates of the same `cellBody` nullability issue shown at line `531`.

### `src/modules/library/sb-import.adapters.ts`

#### Primary blocker patterns

- Unsafe possibly-undefined object access
- Passing `string | undefined` where `string` is required

#### Errors

- Line `154`
  - Error code: `TS2532`
  - Failing symbol: object access
  - Message: `Object is possibly 'undefined'.`

- Line `295`
  - Error code: `TS2345`
  - Failing symbol: string argument
  - Message: `Argument of type 'string | undefined' is not assignable to parameter of type 'string'.`

#### Downstream duplicate assessment

- No duplicate downstream errors captured in this file; both blockers appear as primary.

### `src/modules/workpacks/services/snag.service.ts`

#### Primary blocker pattern

- Accessing `.transaction` on a value typed as `{}`.

#### Errors

- Line `535`
  - Error code: `TS2339`
  - Failing symbol: `transaction`
  - Message: `Property 'transaction' does not exist on type '{}'.`

- Line `614`
  - Error code: `TS2339`
  - Failing symbol: `transaction`
  - Message: `Property 'transaction' does not exist on type '{}'.`

- Line `677`
  - Error code: `TS2339`
  - Failing symbol: `transaction`
  - Message: `Property 'transaction' does not exist on type '{}'.`

#### Downstream duplicate assessment

- Lines `614` and `677` are downstream duplicates of the same primary `.transaction` typing problem shown at line `535`.

### `src/modules/workpacks/services/TaskImportService.ts`

#### Primary blocker pattern

- `record` is possibly `undefined`.

#### Errors

- Line `97`
  - Error code: `TS18048`
  - Failing symbol: `record`
  - Message: `'record' is possibly 'undefined'.`

- Line `98`
  - Error code: `TS18048`
  - Failing symbol: `record`
  - Message: `'record' is possibly 'undefined'.`

- Line `99`
  - Error code: `TS18048`
  - Failing symbol: `record`
  - Message: `'record' is possibly 'undefined'.`

- Line `100`
  - Error code: `TS18048`
  - Failing symbol: `record`
  - Message: `'record' is possibly 'undefined'.`

- Line `121`
  - Error code: `TS18048`
  - Failing symbol: `record`
  - Message: `'record' is possibly 'undefined'.`

- Line `122`
  - Error code: `TS18048`
  - Failing symbol: `record`
  - Message: `'record' is possibly 'undefined'.`

- Line `123`
  - Error code: `TS18048`
  - Failing symbol: `record`
  - Message: `'record' is possibly 'undefined'.`

- Line `124`
  - Error code: `TS18048`
  - Failing symbol: `record`
  - Message: `'record' is possibly 'undefined'.`

#### Downstream duplicate assessment

- Lines `98`, `99`, `100`, `121`, `122`, `123`, and `124` are downstream duplicates of the same primary `record` nullability issue shown at line `97`.

## Summary By File

- `src/modules/customers/customers.service.ts`
  - True blocker patterns: `1`
  - Reported errors: `3`
  - Downstream duplicates: `2`

- `src/modules/library/ad-import.controller.ts`
  - True blocker patterns: `5`
  - Reported errors: `12`
  - Downstream duplicates: `7`

- `src/modules/library/sb-import.adapters.ts`
  - True blocker patterns: `2`
  - Reported errors: `2`
  - Downstream duplicates: `0`

- `src/modules/workpacks/services/snag.service.ts`
  - True blocker patterns: `1`
  - Reported errors: `3`
  - Downstream duplicates: `2`

- `src/modules/workpacks/services/TaskImportService.ts`
  - True blocker patterns: `1`
  - Reported errors: `8`
  - Downstream duplicates: `7`

## Overall Compile Inventory

- Files with true compile blockers: `5`
- Total reported TypeScript errors: `28`
- Estimated primary blocker patterns: `10`
- Estimated downstream duplicate errors: `18`

## Locked Boundary Confirmation

This capture phase made no fixes and introduced no behavior changes.

The inventory was recorded without altering:

- Phase 10 boundaries
- Phase 14 boundaries
- Phase 17 customer behavior
- lifecycle rules
- audit rules
- planning rules
