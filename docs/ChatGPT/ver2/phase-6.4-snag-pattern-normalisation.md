# Phase 6.4 — Snag Pattern Normalisation Hardening

Defined ⬜
Implemented ⬜
Verified ⬜

---

# 1. GOAL

Ensure snag descriptions are normalised consistently so that semantically identical issues are grouped into the same pattern.

This prevents:
- missed recurring patterns (false negatives)
- incorrect grouping (false positives)

---

# 2. NORMALISATION RULES

## 2.1 Case normalisation

- Convert all text to lowercase

Example:
- "RH Tyre Worn" → "rh tyre worn"

---

## 2.2 Trim whitespace

- Remove leading/trailing spaces
- Collapse multiple spaces into a single space

Example:
- "  rh   tyre worn  " → "rh tyre worn"

---

## 2.3 Remove punctuation

- Remove non-alphanumeric characters:
  - /
  - -
  - .
  - ,
  - etc.

Example:
- "r/h tyre worn" → "rh tyre worn"

---

## 2.4 Standardise abbreviations

Map common variations to a single form:

- r/h → rh
- l/h → lh
- right → rh
- left → lh

Example:
- "right tyre worn" → "rh tyre worn"

---

## 2.5 Remove duplicate tokens

- Remove repeated words

Example:
- "tyre tyre worn" → "tyre worn"

---

## 2.6 Preserve semantic meaning

- Do NOT remove critical words
- Do NOT stem or shorten words aggressively
- Do NOT change domain meaning

---

# 3. OUTPUT

The system must produce:

- normalised_description

This is used for:
- grouping patterns
- counting occurrences

---

# 4. RULES

- No schema changes
- No UI changes
- No lifecycle changes
- No compliance changes

---

# 5. EXCLUSIONS

Do NOT:
- introduce NLP libraries
- add fuzzy matching
- add similarity scoring
- change grouping logic beyond normalisation

---

# 6. SUCCESS CRITERIA

Phase is PASS if:

- "RH Tyre Worn", "R/H tyre worn", and "right tyre worn"
  all produce the same normalised_description

- Patterns are grouped consistently

- No existing functionality is broken

---

# 7. STATUS

Defined ⬜
Implemented ⬜
Verified ⬜