# Phase 17.28 - Phase 17 System Lock

## Status

DEFINE ONLY

This phase formally locks the verified Phase 17 customer subsystem architecture and defines future-extension boundaries.

This phase does not implement code, does not change schema, does not change migrations, does not redesign permissions, does not redesign visibility boundaries, and does not refactor existing behavior.

This phase is system-lock definition only.

## Purpose

The purpose of this phase is to formally lock the verified Phase 17 customer subsystem architecture and define the rules that govern future customer-facing extensions.

Jupiter must preserve the verified customer identity boundary, customer-aircraft visibility derivation model, customer portal isolation boundary, and internal audit/security separation so that future work cannot implicitly weaken or bypass the Phase 17 architecture.

This phase defines the lock boundary only.

It does not extend customer visibility.

## Scope

This phase defines:

- the locked customer identity architecture
- the locked customer visibility architecture
- the locked customer portal boundary
- the locked customer audit and security boundary
- forbidden redesigns
- future-extension rules
- verification lock rules
- completion criteria

## Out Of Scope

The following are out of scope for Phase 17.28:

- code changes
- schema changes
- migration changes
- permissions redesign
- visibility redesign
- portal redesign
- authentication redesign
- audit-system redesign
- workflow redesign
- refactoring

This phase defines the system lock only.

## Locked Customer Identity Architecture

The customer identity architecture is locked as a verified boundary.

### Identity Lock Rules

The following identity rules are explicitly locked:

- `Customer` is not the login identity
- `CustomerUser` is the login identity
- customer authentication remains bound to `CustomerUser`
- customer invite behavior remains bound to `CustomerUser`
- customer password-reset behavior remains bound to `CustomerUser`
- customer session state remains bound to authenticated `CustomerUser` context

### Identity Separation Rule

The boundary between customer business identity and customer login identity must remain intact.

`Customer` remains the business/entity record.

`CustomerUser` remains the authenticated user record.

## Locked Customer Visibility Architecture

The customer visibility model is locked as a derived visibility architecture rather than a direct unrestricted access model.

### Visibility Lock Rules

The following visibility rules are explicitly locked:

- visibility derives from `customer_aircraft_links`
- historical links do not grant current visibility
- only current valid customer-aircraft relationships may grant current visibility
- customer-safe downstream visibility must derive from already approved customer visibility boundaries
- visibility may not bypass the aircraft-relationship derivation model

### Relationship Restriction Lock

The following relationship restrictions are explicitly locked:

- `OWNER` may support approved current visibility
- `CO_OWNER` may support approved current visibility
- `OPERATOR` may support approved current visibility
- `MANAGEMENT_COMPANY` may support approved current visibility
- `BILLING_CUSTOMER` restrictions are preserved
- `CONTACT_ONLY` restrictions are preserved

### Derived Visibility Rule

Customer-safe workpack, document, and compliance visibility must remain derived from approved customer visibility boundaries rather than from unrelated internal route reuse or unrestricted direct queries.

## Locked Customer Portal Boundary

The customer portal boundary is locked as a customer-only boundary.

### Portal Lock Rules

The following portal rules are explicitly locked:

- customer portal isolation is preserved
- customer portal remains customer-only
- no staff/admin route leakage is allowed
- no implicit visibility expansion is allowed through navigation or reused routes
- customer navigation must remain customer-safe
- customer UX must remain within approved customer portal boundaries

### Portal Exclusion Rule

Customer portal behavior must not expose internal systems, internal route structures, or staff-facing operational surfaces.

## Locked Customer Audit / Security Boundary

The customer audit and security boundary is locked as an internal-only operational boundary.

### Audit / Security Lock Rules

The following audit and security rules are explicitly locked:

- no audit visibility is allowed to customer users
- customer users do not see internal audit systems
- customer users do not see audit logs
- customer sessions remain isolated
- security-relevant customer access events may remain internally auditable
- internal audit handling must not create customer-facing audit exposure

### Internal-Only Rule

Audit and security traceability may exist internally, but customer users must remain excluded from audit-system visibility, audit navigation, and internal operational audit detail.

## Forbidden Redesigns

The following redesigns are explicitly forbidden unless a later explicit architecture phase authorizes them:

- collapsing `Customer` and `CustomerUser` identity boundaries
- bypassing `customer_aircraft_links` visibility derivation
- automatic historical visibility inheritance
- unrestricted document visibility
- customer access to internal workflow controls
- customer access to planning systems
- customer access to audit systems
- customer access to execution-control systems
- implicit visibility expansion through navigation
- implicit visibility expansion through reused routes
- redesign of the locked customer identity model without explicit architecture approval
- redesign of the locked customer visibility model without explicit architecture approval

## Future-Extension Rules

Future work may extend the customer subsystem only within the locked architecture boundary defined in Phase 17.

### Allowed Future Extension Direction

Future phases may:

- extend customer-safe visibility
- introduce additional customer-safe summaries
- introduce additional customer-safe documents
- introduce additional customer-safe navigation within the portal boundary
- add explicit new customer-safe features through approved architecture phases

### Forbidden Future Extension Direction

Future phases may not:

- redesign the locked core identity architecture without explicit architecture phase approval
- redesign the locked core visibility architecture without explicit architecture phase approval
- weaken customer portal isolation
- weaken relationship-based visibility derivation
- introduce planning visibility implicitly
- introduce audit visibility implicitly
- introduce execution-control visibility implicitly
- introduce internal workflow-state leakage implicitly

## Verification Lock Rules

The verified Phase 17 subsystem must remain locked unless a later explicit architecture phase re-opens a specific boundary.

### Verification Lock Checks

The system lock is correct only if all of the following remain true:

- `Customer` is not the login identity
- `CustomerUser` is the login identity
- visibility derives from `customer_aircraft_links`
- historical links do not grant current visibility
- `BILLING_CUSTOMER` and `CONTACT_ONLY` restrictions remain preserved
- customer portal isolation remains preserved
- no planning visibility is allowed
- no audit visibility is allowed
- no execution-control visibility is allowed
- no unrestricted document access is allowed
- no internal workflow-state leakage is allowed
- no staff/admin route leakage is allowed

### Re-Approval Rule

Any later proposal that changes a locked identity rule, a locked visibility rule, or a locked internal-exclusion rule must be treated as explicit architecture work rather than routine feature implementation.

## Locked System Constraints

The following constraints are explicitly preserved:

- `Customer` is not the login identity
- `CustomerUser` is the login identity
- visibility derives from `customer_aircraft_links`
- historical links do not grant current visibility
- `BILLING_CUSTOMER` and `CONTACT_ONLY` restrictions are preserved
- customer portal isolation is preserved
- no planning visibility
- no audit visibility
- no execution-control visibility
- no unrestricted document access
- no internal workflow-state leakage
- no staff/admin route leakage

## Completion Criteria

Phase 17.28 is complete only when all of the following are true:

- the purpose is defined
- the scope is defined
- out-of-scope items are defined
- the locked customer identity architecture is defined
- the locked customer visibility architecture is defined
- the locked customer portal boundary is defined
- the locked customer audit and security boundary is defined
- forbidden redesigns are defined
- future-extension rules are defined
- verification lock rules are defined
- the required locked constraints are explicitly preserved
- the required forbidden redesigns are explicitly preserved
- completion criteria are defined
- no code changes were made
- no schema changes were made
- no migration changes were made
- no permissions redesign was performed
- no visibility redesign was performed
- no refactoring was performed

## Final Statement

Phase 17.28 formally locks Jupiter’s verified Phase 17 customer subsystem architecture as a `CustomerUser`-based identity model, a `customer_aircraft_links`-derived visibility model, a customer-only portal boundary, and an internal-only audit/security boundary in which historical links do not grant current visibility, `BILLING_CUSTOMER` and `CONTACT_ONLY` restrictions remain preserved, unrestricted document access is forbidden, planning/audit/execution-control visibility is excluded, internal workflow-state leakage is excluded, staff/admin route leakage is excluded, and future phases may extend customer-safe visibility only without redesigning the locked core identity or visibility architecture unless an explicit architecture phase authorizes that change.
