# Phase 17.12 - Customer Portal Shell

## Status

DEFINE ONLY

This phase defines the first authenticated customer portal landing shell after customer login.

This phase does not implement code, does not change schema, does not change migrations, does not implement workpack visibility, does not implement document visibility, does not implement compliance visibility, does not implement permissions, and does not refactor existing behavior.

This phase preserves customer session isolation.

## Purpose

The purpose of this phase is to define the initial authenticated customer portal shell that appears after successful customer login.

Jupiter must provide a customer-only landing shell that is:

- reachable only through authenticated customer session state
- isolated from staff, admin, and internal operational areas
- limited to safe customer identity and session information
- intentionally empty of aircraft, workpack, document, and compliance visibility at this stage

This phase defines the portal-shell boundary only.

It does not implement customer operational visibility.

## Scope

This phase defines:

- the customer portal route boundary
- the customer session requirement
- what the portal shell may display
- what must remain internal-only
- the exclusion of aircraft, workpack, document, and compliance visibility
- logout and basic navigation expectations
- audit and security expectations
- verification requirements
- completion criteria

## Out Of Scope

The following are out of scope for Phase 17.12:

- code changes
- schema changes
- migration changes
- aircraft visibility implementation
- workpack visibility implementation
- document visibility implementation
- compliance visibility implementation
- permissions implementation
- customer portal authorization expansion
- staff/admin UI redesign
- internal dashboard redesign
- planning visibility
- audit visibility
- execution-control visibility

This phase defines only the customer portal shell boundary.

## Customer Portal Route Boundary

The customer portal shell must exist within a dedicated customer-facing route boundary.

### Customer-Only Route Direction

The customer portal shell should later live under a customer-specific route namespace rather than staff or admin route space.

### Separation From Staff Areas

The customer portal shell must not reuse internal staff landing pages, admin pages, operational dashboards, or internal route assumptions as if they were customer-safe.

### No Cross-Area Blending

Customer portal routes must remain isolated from:

- staff operational routes
- admin routes
- planning routes
- audit routes
- execution-control routes

## Customer Session Requirement

The customer portal shell must require an authenticated customer session.

### Required Identity

`CustomerUser` is the logged-in identity for customer access.

### Session Requirement

The portal shell must only be reachable when a valid authenticated customer session exists.

### Customer Is Not Login Identity

`Customer` remains the business entity.

`Customer` is not the login identity.

### No Staff Session Access

A staff session must not automatically be treated as a customer session for this shell.

Customer access must remain customer-session based.

## Portal Shell Display Content

The first portal shell must display only safe, minimal customer identity and session information.

### Allowed Display Direction

The portal shell may later display only limited safe content such as:

- customer-user display name
- customer-user email
- high-level signed-in state
- linked customer business-entity name where customer-safe
- logout access
- minimal customer-safe navigation placeholders

### Shell-Only Direction

The page should behave as a shell or landing frame rather than as a data-rich customer dashboard.

### Minimal Safe Content Rule

Displayed content must remain limited to identity-confirmation and session-confirmation information only.

## Internal-Only Exclusions

The portal shell must exclude all internal-only operational information.

### Internal Information Excluded

The portal shell must not expose:

- internal staff identities beyond customer-safe needs
- internal role structure
- internal admin controls
- internal notes
- internal audit records
- planning sessions
- execution-control mechanics
- workflow lock-state internals
- hidden operational metadata

### No Internal Leakage

The shell must not become a shortcut into internal operational areas.

## No Aircraft / Workpack / Document Visibility Yet

This phase must explicitly exclude customer operational visibility.

### No Aircraft Visibility Yet

The customer portal shell must not yet expose aircraft lists, aircraft details, or aircraft ownership views.

### No Workpack Visibility Yet

The customer portal shell must not yet expose workpack lists, workpack status, workpack summaries, or workpack detail views.

### No Document Visibility Yet

The customer portal shell must not yet expose customer documents, releases, CRS outputs, or downloadable maintenance records.

### No Compliance Visibility Yet

The customer portal shell must not yet expose compliance summaries, AD status, SB status, or maintenance compliance views.

### Visibility Boundary Still Preserved

Customer visibility still derives from customer-aircraft relationships and later explicit visibility rules, but this phase does not implement those views.

## Logout / Navigation Expectations

The portal shell must support only safe, minimal navigation behavior.

### Logout Requirement

The shell must provide a clear logout path for the authenticated customer user.

### Minimal Navigation Direction

Navigation in this phase should remain limited to:

- current shell context
- logout
- future placeholder-safe customer navigation where explicitly non-functional or non-exposing

### No Internal Navigation Leakage

Customer navigation must not reveal or link into staff/admin/internal operational areas.

## Audit / Security Expectations

The customer portal shell is security-sensitive because it is the first authenticated customer-facing page.

### Audit Expectations

Later portal-shell access should remain auditable as part of customer-session activity where appropriate.

### Session Isolation

Customer session isolation from staff sessions must remain preserved.

### No Leakage Expectations

The portal shell must not leak:

- audit data
- planning data
- execution-control data
- internal administrative data
- cross-customer identity or scope data

### Security Boundary

The shell must confirm authentication without expanding visibility beyond the minimal shell boundary defined here.

## Verification Requirements

Phase 17.12 is correctly defined only if all of the following are true:

- the customer portal route boundary is defined
- customer session requirement is defined
- `CustomerUser` is explicitly preserved as the logged-in identity
- `Customer` is explicitly preserved as a business entity, not a login identity
- safe portal-shell display content is defined
- internal-only exclusions are defined
- no aircraft visibility is introduced
- no workpack visibility is introduced
- no document visibility is introduced
- no compliance visibility is introduced
- no staff session access is allowed
- no planning visibility is allowed
- no audit visibility is allowed
- no execution-control visibility is allowed
- logout/navigation expectations are defined
- audit/security expectations are defined

## Completion Criteria

Phase 17.12 is complete only when all of the following are true:

- the purpose is defined
- the scope is defined
- out-of-scope items are defined
- the customer portal route boundary is defined
- the customer session requirement is defined
- portal shell display content is defined
- internal-only exclusions are defined
- no aircraft/workpack/document/compliance visibility is explicitly preserved
- logout/navigation expectations are defined
- audit/security expectations are defined
- verification requirements are defined
- completion criteria are defined
- no code changes were made
- no schema changes were made
- no migration changes were made
- no workpack visibility was implemented
- no document visibility was implemented
- no compliance visibility was implemented
- no permissions implementation was performed
- customer session isolation was preserved

## Final Statement

Phase 17.12 defines Jupiter’s first authenticated customer portal shell as a customer-session-only landing boundary that confirms safe customer identity and session state, remains isolated from staff and internal operational areas, and deliberately excludes aircraft, workpack, document, compliance, planning, audit, and execution-control visibility until later customer-visibility phases.
