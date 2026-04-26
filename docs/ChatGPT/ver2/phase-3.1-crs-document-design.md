Phase 3.1 — CRS Document Design

Defined ⬜
Implemented ⬜
Verified ⬜

---

# 1. PURPOSE

The CRS (Certificate of Release to Service) is a legally binding airworthiness certification.

It must:

* Certify maintenance has been performed
* Reflect ONLY verified system data
* Be tied directly to executed and certified work
* Be immutable once generated

This is NOT a report — it is a regulatory release document.

---

# 2. GENERATION TRIGGER (LOCKED)

CRS may ONLY be generated when:

* workpack.status = CERTIFIED
* All linked tasks:

  * status = CERTIFIED_BY_ENGINEER OR LOCKED
* All workpack_compliance rows:

  * status = COMPLETED
* All snags:

  * status = CLOSED

No overrides allowed.

---

# 3. DATA SOURCES (STRICTLY READ-ONLY)

CRS pulls ONLY from existing system data.

---

## 3.1 Aircraft

Source: aircraft

Fields:

* registration
* serial_number
* model_id → resolved to aircraft model

---

## 3.2 Workpack

Source: workpacks

Fields:

* work_order_number
* opened_at
* closed_at (or certified_at if present)

---

## 3.3 Task Execution (Derived Work)

Source:

* task_cards
* workpack_tasks
* workpack_executions
* measurements

Derived:

* Completed tasks only
* Work performed notes (cleaned)
* Measurement summaries (if required)

NO manual input allowed.

---

## 3.4 Compliance

Source:

* workpack_compliance
* compliance_items

Include ONLY:

* status = COMPLETED

Fields:

* item_type (AD / SB)
* code
* title
* description

---

## 3.5 Certification

Source:

* execution signatures / certification step

Fields:

* certifying engineer name
* licence number
* certification timestamp
* organisation (AMO)

---

# 4. DOCUMENT STRUCTURE (FIXED)

---

## SECTION A — HEADER

* AMO Name
* AMO Approval Number
* Document Title:
  CERTIFICATE OF RELEASE TO SERVICE
* Work Order Number

---

## SECTION B — AIRCRAFT IDENTIFICATION

* Aircraft Registration
* Aircraft Type / Model
* Serial Number

---

## SECTION C — MAINTENANCE STATEMENT (STATIC)

The following text MUST be exact and NOT editable:

"The work specified except as otherwise stated was carried out in accordance with applicable regulations and in respect to that work the aircraft is considered ready for release to service."

---

## SECTION D — WORK SUMMARY

Derived automatically:

* List or summarised set of:

  * Tasks performed
  * Maintenance actions

No free-text entry allowed.

---

## SECTION E — COMPLIANCE STATEMENT

If compliance exists:

* List:

  * AD / SB code
  * Title

If none:

"All applicable Airworthiness Directives and Service Bulletins have been complied with."

---

## SECTION F — LIMITATIONS / DEFECTS

If system has no deferred defect tracking:

Display:

"No known defects affecting airworthiness."

---

## SECTION G — CERTIFICATION BLOCK

* Engineer Name
* Licence Number
* Signature (future: digital)
* Date
* Place (optional, if available)

---

# 5. SYSTEM RULES

---

## 5.1 READ-ONLY GENERATION

CRS:

* MUST NOT accept manual edits
* MUST NOT allow overrides
* MUST be fully system-derived

---

## 5.2 IMMUTABILITY

Once generated:

* CRS must be stored
* CRS must NOT change even if data later changes

---

## 5.3 SINGLE CRS PER WORKPACK

* One CRS per workpack
* Regeneration must NOT create duplicates

---

## 5.4 TRACEABILITY

CRS must link to:

* workpack_id
* certification record / signature

---

# 6. OUTPUT FORMAT

Initial:

* PDF via existing PDF service

Future:

* Template engine

---

# 7. EXCLUSIONS

Not included in this phase:

* CRMA
* Logbook entries
* Digital signatures
* Recurrence handling
* UI

---

# 8. STATUS

Defined ⬜
Implemented ⬜
Verified ⬜
