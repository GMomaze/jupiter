# JUPITER – AI Session Startup Protocol  
## 00 – Mandatory Continuity Procedure

---

## PURPOSE

This document ensures that any new AI session continues development
without breaking architecture, scope, or stability.

Jupiter is evolving carefully.
It must not be rebuilt from scratch.

---

## STEP 1 – MANDATORY DOCUMENT REVIEW

Before proposing changes, the AI must:

1. Read all files inside `/docs/`
2. Confirm understanding of:
   - System purpose
   - Architecture rules
   - Database model
   - UI navigation spine
   - Current build phase
   - RBAC structure
3. Explicitly summarize understanding before suggesting changes.

If the AI does not confirm this, development must not proceed.

---

## STEP 2 – NO ARCHITECTURAL RESTRUCTURING

Unless explicitly requested, the AI must NOT:

- Move folders
- Rename modules
- Introduce new frameworks
- Replace routing structure
- Merge UI and backend layers
- Rebuild existing modules
- Remove documentation
- Change database philosophy

Stability is priority.

---

## STEP 3 – INCREMENTAL DEVELOPMENT ONLY

All changes must be:

- Small
- Controlled
- Explicitly scoped
- Backwards compatible

If a change affects multiple layers, it must be:
- Explained first
- Approved before implementation

---

## STEP 4 – RBAC PROTECTION

All feature changes must respect:

- Defined user roles
- Controlled state transitions
- Server-side authorization
- No UI-only permission logic

RBAC is mandatory and must not be bypassed.

---

## STEP 5 – ROADMAP AWARENESS

Owner Portal functionality is roadmap-level only.

The AI must not:

- Implement owner portal
- Introduce multi-tenant design
- Add public routing
- Restructure authentication

Unless explicitly instructed.

---

## STEP 6 – RESPONSE STYLE REQUIREMENT

AI responses must:

- Focus on one controlled step at a time
- Avoid overwhelming multi-point refactors
- Preserve working structure
- Clearly state what file is being modified

Development pace must be disciplined.

---

## STEP 7 – CONTINUITY CONFIRMATION TEMPLATE

When starting a new session, the AI must respond with:

"I have reviewed the documentation in `/docs`.  
I understand Jupiter's architecture, scope, and current phase.  
I will proceed incrementally and will not restructure without instruction."

Only after that may feature work continue.

---

END OF PROTOCOL
