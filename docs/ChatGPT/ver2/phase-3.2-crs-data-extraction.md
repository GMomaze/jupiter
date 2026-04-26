Phase 3.2 — CRS Data Extraction

Defined ✅
Implemented ✅
Verified ✅

Result:
- CrsDataService created
- getCrsDataForWorkpack(workpackId) exists
- Read-only confirmed
- Uses certified/locked tasks only
- Uses ComplianceService summary
- No PDF generation yet
- No workflow logic changed

---

# 1. GOAL

Create a read-only service that returns ALL data required to generate a CRS document.

This service must:

* Aggregate data from multiple sources
* Return a clean structured object
* Be the ONLY data source for CRS generation

---

# 2. METHOD

getCrsDataForWorkpack(workpackId)

---

# 3. OUTPUT STRUCTURE

Must return:

{
aircraft: {
registration,
serial_number,
model
},

workpack: {
work_order_number,
opened_at,
closed_at
},

work_summary: [
{
task_card_number,
title,
work_performed
}
],

compliance: {
ad_items: [],
sb_items: []
},

certification: {
engineer_name,
licence_number,
certified_at,
organisation
}
}

---

# 4. DATA SOURCES

---

## Aircraft

* aircraft

---

## Workpack

* workpacks

---

## Work Summary

* task_cards
* workpack_tasks
* executions
* measurements

Only:

* certified tasks- task status = CERTIFIED_BY_ENGINEER OR LOCKED

---

## Compliance

* Use existing:
  getComplianceSummaryForWorkpack(workpackId)

---

## Certification

* execution signatures
* certification step

---

# 5. RULES

---

## 5.1 READ-ONLY

* NO inserts
* NO updates
* NO deletes

---

## 5.2 SINGLE SOURCE

* This method must be used by CRS generator later

---

## 5.3 NO BUSINESS LOGIC

* No validation
* No status changes
* Only data aggregation

---

## 5.4 NULL SAFETY

* Missing optional data must not crash

---

# 6. EXCLUSIONS

Do NOT:

* generate PDF
* format text
* design layout

---

# 7. STATUS

Defined ⬜
Implemented ⬜
Verified ⬜
