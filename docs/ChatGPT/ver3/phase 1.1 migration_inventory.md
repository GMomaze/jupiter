# PHASE 1.1 — MIGRATION INVENTORY

Status: Defined ✅

---

## 1. PURPOSE

Create a **complete, accurate inventory of all migrations** in the system so that:

- The migration chain is **fully understood**
- Conflicts, duplicates, and inconsistencies are **identified**
- Future schema work is based on **facts, not assumptions**

This phase establishes **migration truth** before any schema changes are considered.

---

## 2. SCOPE

This phase covers:

### 2.1 Active Migrations
- Folder: `migrations/`
- Files currently used by Sequelize

### 2.2 Legacy Migrations
- Any old or backup folders, including:
  - `migrationOLD/`
  - `migrationOLD/TEMP/`
  - Any other migration-related directories

### 2.3 Database State
- `SequelizeMeta` table
- Tracks which migrations are applied

---

## 3. REQUIRED OUTPUT

Create:

### 3.1 Migration Inventory Report
`docs/ChatGPT/ver3/migration_inventory.md`

---

## 4. REPORT CONTENT

The report MUST include:

### A. Summary
- Total migrations in `migrations/`
- Total entries in `SequelizeMeta`
- Match status (aligned / mismatch)

---

### B. Active Migration List
For each file in `migrations/`:
- Filename
- Order index (based on timestamp/sequence)
- Whether it exists in `SequelizeMeta` (APPLIED / NOT APPLIED)

---

### C. Legacy Migration List
For each file in legacy folders:
- Filename
- Location
- Flag as:
  - DUPLICATE NAME
  - POSSIBLE CONFLICT
  - UNUSED

---

### D. Duplicate Detection
- Same filename in multiple locations
- Same purpose with different filenames
- Multiple versions of same migration

---

### E. Conflict Detection
- Schema changes that overlap
- Different definitions for same table/column
- Re-creation of already existing tables

---

### F. Gaps / Risks
- Missing migrations
- Out-of-order execution risks
- Any inconsistencies between DB and migration chain

---

## 5. RULES

- READ-ONLY phase
- NO migration changes
- NO schema changes
- NO file deletion
- NO renaming
- ONLY inspection and reporting

---

## 6. SUCCESS CRITERIA

Phase is successful when:

- migration_inventory.md exists
- Active migrations fully listed
- SequelizeMeta compared and validated
- Legacy migrations analyzed
- Duplicates and conflicts clearly identified

---

## 7. FAILURE CONDITIONS

FAIL if:

- Any migration file is modified
- Inventory is incomplete
- SequelizeMeta is not checked
- Duplicates/conflicts are missed

---

## 8. HANDOFF TO IMPLEMENT

Codex must:

1. Scan:
   - `migrations/`
   - legacy migration folders
2. Read `SequelizeMeta`
3. Compare applied vs existing migrations
4. Detect duplicates and conflicts
5. Generate `migration_inventory.md`

Return:
- Files created
- Files inspected
- PASS/FAIL