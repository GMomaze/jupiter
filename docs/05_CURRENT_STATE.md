# JUPITER – Aircraft Maintenance Management System  
## 05 – Current System State

---

## 1. Build Phase Status

Jupiter is currently in:

STRUCTURED CORE BUILD PHASE

The following foundations are considered stable:

- Modular backend structure
- Separation of modules and views
- Dashboard navigation spine
- Aircraft list and detail views
- Workpack list view
- Cross-module navigation
- Header/footer layout consistency

Architecture must NOT be restructured at this stage.

---

## 2. Stable Modules

The following modules are operational at a structural level:

- Aircraft
- Workpacks
- Library
- Inventory (route level)
- Reference
- Audit
- Projection
- Authentication (partially wired)

Some modules are not feature-complete but routing and structure exist.

---

## 3. Recently Completed Improvements

- Removed `.ejs` files from backend modules
- Removed duplicate route mounting
- Standardized route order (static before dynamic)
- Created dashboard root `/`
- Created proper Fleet list view
- Fixed aircraft detail styling
- Linked Workpacks → Aircraft
- Added back navigation on aircraft detail
- Established documentation spine in `/docs`

These must not be undone.

---

## 4. Roadmap Awareness (Controlled Scope)

A future Owner Portal is planned which may include:

- Read-only aircraft visibility for owners
- Maintenance request submission
- Role-based access control extensions

Important:

- This is NOT part of the current structured build phase.
- It must NOT trigger architectural redesign.
- It must NOT introduce multi-tenant complexity yet.
- It must NOT change core routing structure.

It is roadmap-level only.

---

## 5. Known Temporary Implementations

- Some lifecycle transitions may still be simplified.
- Authentication flow may not be fully enforced.
- Some modules lack complete UI refinement.
- Testing coverage is partial.
- Some UI components are minimally styled.

These are acceptable during current phase.

---

## 6. Technical Debt (Controlled)

The following may require future refinement:

- Centralized layout template (optional improvement)
- Workpack detail page UI consistency
- Aircraft → Active Workpacks linkage
- Inventory integration depth
- Role-based UI control
- Projection dashboard enhancement

These are improvement tasks, not structural changes.

---

## 7. What Must NOT Happen

AI must NOT:

- Move folders arbitrarily
- Rename modules casually
- Introduce new architectural patterns
- Merge UI and backend layers
- Remove documentation
- Replace working routing structure
- Rebuild modules from scratch
- Expand system scope without explicit instruction

Stability > speed.

---

## 8. Next Intended Direction

The next development focus should be:

- Strengthening Aircraft ↔ Workpack integration
- Enhancing lifecycle integrity
- Improving operational workflows
- Expanding projection logic
- Increasing test reliability

NOT architecture refactoring.
NOT public-facing portal development.

---

## 9. Continuity Instruction for Future AI Sessions

When starting a new session:

1. Read all files in `/docs`.
2. Confirm understanding of architecture and scope.
3. Do NOT propose restructuring unless explicitly requested.
4. Build incrementally on existing structure.
5. Treat Owner Portal as future roadmap only.

Jupiter is evolving carefully, not being rebuilt.

---

End of 05_CURRENT_STATE Document.
