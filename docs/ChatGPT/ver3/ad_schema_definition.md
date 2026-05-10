# AD Schema Definition

**Status:** Final Authoritative Definition  
**Date:** 2026-05-01  
**Purpose:** Define the final approved Airworthiness Directive schema for Jupiter implementation.

---

## 1. Scope

This document is the single final authority for AD schema implementation.

Approved tables:

- `airworthiness_directives`
- `ad_relationships`

Explicitly excluded:

- `ad_applicability`

---

## 2. Core Table

### `airworthiness_directives`

Purpose:

- store Airworthiness Directives as compliance source data
- preserve directive metadata and inline applicability
- remain separate from task and workpack storage

#### Fields

- `id`
- `ad_number`
- `revision`
- `subject_heading`
- `subject`
- `summary`
- `comments`
- `status`
- `cfr_part_reference`
- `effective_date`
- `authority`
- `service_office`
- `primary_responsibility_office`
- `docket_number`
- `citation`
- `citation_publish_date`
- `make`
- `model`
- `product_type`
- `product_subtype`
- `is_recurring`
- `interval_hours`
- `interval_months`
- `is_active`
- `created_at`
- `updated_at`

#### Field Notes

- `id`: UUID primary key
- `ad_number`: directive identifier, required
- `revision`: directive revision identifier, optional
- `subject_heading`: short heading text
- `subject`: directive subject text
- `summary`: directive summary text
- `comments`: freeform notes/comments
- `status`: directive status
- `cfr_part_reference`: CFR part reference
- `effective_date`: directive effective date
- `authority`: issuing authority
- `service_office`: service/office source field
- `primary_responsibility_office`: office of primary responsibility
- `docket_number`: docket reference
- `citation`: citation reference
- `citation_publish_date`: citation publication date
- `make`: applicability stored inline
- `model`: applicability stored inline
- `product_type`: applicability stored inline
- `product_subtype`: applicability stored inline
- `is_recurring`: recurring indicator
- `interval_hours`: recurring interval in hours
- `interval_months`: recurring interval in months
- `is_active`: active flag, default `true`
- `created_at`: audit timestamp
- `updated_at`: audit timestamp

---

## 3. Relationship Table

### `ad_relationships`

Purpose:

- store normalized AD-to-AD links
- support supersedure and impact chains separately from the core AD row

#### Fields

- `id`
- `ad_id`
- `related_ad_number`
- `relationship_type`

#### Field Notes

- `id`: UUID primary key
- `ad_id`: foreign key to `airworthiness_directives.id`
- `related_ad_number`: referenced AD number
- `relationship_type`: normalized relationship type

---

## 4. Explicit Exclusion

### `ad_applicability`

`ad_applicability` is explicitly excluded from the approved schema at this stage.

Rule:

- do not create an `ad_applicability` table
- applicability remains inline on `airworthiness_directives`
- future normalization may be considered later, but it is not part of the approved schema now

---

## 5. Constraints

### `airworthiness_directives`

- `ad_number` is required
- unique constraint on:
  - `ad_number`
  - `revision`

Interpretation:

- uniqueness must be enforced on the AD identity combination of `ad_number` and `revision`

### `ad_relationships`

- foreign key:
  - `ad_relationships.ad_id -> airworthiness_directives.id`

---

## 6. Indexes

### `airworthiness_directives`

- `ad_number`
- `status`
- `effective_date`
- `make`
- `model`
- `product_type`

### `ad_relationships`

- `ad_id`

---

## 7. Relationship Types

Approved normalized relationship types:

- `SUPERSEDES`
- `SUPERSEDED_BY`
- `AFFECTS`
- `AFFECTED_BY`

---

## 8. Design Rules

- ADs are NOT tasks
- ADs are NOT stored in `task_templates`
- ADs are NOT stored in `task_cards`
- ADs are NOT stored in `workpacks`
- ADs are compliance source data
- applicability is inline
- relationships are normalized
- no `ad_applicability` table at this stage

---

## 9. Future Integration Notes

- `AD -> compliance_items` later
- `AD -> aircraft applicability resolution` later
- `AD -> workpack generation` later

These integrations are intentionally deferred and are not part of this definition phase.

---

## 10. Implementation Boundary

This document defines schema only.

Not included in this phase:

- migrations
- model creation
- import logic
- compliance logic
- UI changes
- controller/service changes

---

**END OF DOCUMENT**
