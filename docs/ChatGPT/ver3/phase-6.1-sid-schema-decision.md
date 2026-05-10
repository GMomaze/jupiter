# PHASE 6.1 — SID SCHEMA DECISION

Status: Defined ✅

---

## 1. PURPOSE

Decide how **Supplemental Inspection Documents (SIDs)** will be represented in Jupiter.

SIDs are manufacturer-defined inspection requirements (e.g. :contentReference[oaicite:0]{index=0} SID programs) and must be treated as structured compliance sources similar to ADs and SBs.

---

## 2. CORE PRINCIPLE

SIDs are:

- **source/library records**
- **model-based compliance requirements**
- not tasks
- not workpacks

They must:

- be stored separately
- integrate with compliance projection
- support model-level applicability

---

## 3. DEPENDENCIES

This phase depends on:

- existing AD schema
- existing SB schema
- compliance_items design

---

## 4. SCOPE

This phase decides ONLY:

- whether SIDs require a new table
- how SIDs relate to models
- whether existing compliance structure can support SIDs
- SID data shape

This phase does NOT:

- create migrations
- implement import
- implement projection
- create models
- create UI

---

## 5. REQUIRED OUTPUT

Create:

`docs/ChatGPT/ver3/phase-8.1-sid-schema-decision.md`

---

## 6. REQUIRED ANALYSIS

Codex must inspect:

- AD schema (`airworthiness_directives`)
- SB schema (`service_bulletins`)
- compliance_items schema
- component_models
- existing compliance projection design

---

## 7. REQUIRED DECISION

The document must answer:

1. Do SIDs fit into existing AD/SB schema?
2. Should SIDs be stored in `compliance_items` directly?
3. Do SIDs require a separate source table?
4. How are SIDs linked to aircraft models?
5. Can compliance projection support SIDs without schema changes?

---

## 8. DECISION OPTIONS

State exactly one:

- **EXTEND EXISTING SCHEMA**
- **CREATE NEW SID SOURCE TABLE**

---

## 9. RECOMMENDED DECISION

> **CREATE NEW SID SOURCE TABLE**

Reason:

- SIDs differ structurally from ADs and SBs
- SIDs are model-specific programs
- SIDs may apply across multiple models
- avoids polluting AD/SB structures

---

## 10. EXPECTED SID STRUCTURE (HIGH LEVEL)

If new table is required, define:

- reference (SID number)
- title
- description
- manufacturer
- model applicability
- interval (hours / calendar)
- category (structure, systems, etc.)
- notes

Do NOT finalize full schema here — only define concept.

---

## 11. RELATIONSHIP RULE

Define:

- SIDs relate to `component_models`
- one SID may apply to multiple models
- models may have multiple SIDs

---

## 12. COMPLIANCE INTEGRATION

Define:

SIDs will project into `compliance_items` using:

- `source_type = 'SID'`
- `source_id = sid.id`

IMPORTANT:

- Current `compliance_items.source_type` only supports:
  - `AD`
  - `SB`

- Introducing `SID` requires a future schema extension to:
  - extend allowed `source_type` values
  - update constraints safely

- This phase DOES NOT perform that schema change.

- Schema extension for SID support must be handled in a later phase before SID projection implementation.

---

## 13. RULES

- READ-ONLY decision phase
- NO schema changes
- NO migrations
- NO model edits
- NO controller/service edits
- NO UI changes
- NO implementation

---

## 14. SUCCESS CRITERIA

PASS if:

- SID schema decision document exists
- decision is explicit
- SID role in system is clear
- relationship to models is defined
- compliance integration path is defined
- no implementation is performed

---

## 15. FAILURE CONDITIONS

FAIL if:

- SIDs are merged into AD/SB incorrectly
- model applicability is ignored
- compliance integration is unclear
- schema decisions are vague
- implementation is attempted

---

## 16. HANDOFF TO IMPLEMENT

Codex must:

1. Inspect AD/SB/compliance schemas
2. Compare SID characteristics
3. Decide schema approach
4. Define SID structure concept
5. Define compliance integration path
6. Create decision document only

Return:

- Files checked
- Files created/modified
- Decision
- PASS/FAIL