# JUPITER – Aircraft Maintenance Management System  
## 07 – Testing Strategy

---

## 1. Testing Philosophy

Jupiter is a lifecycle-driven aviation system.

Testing must validate:

- Business integrity
- State transitions
- Cross-module behavior
- Security enforcement

Testing must NOT focus primarily on:
- Internal function implementation
- Styling
- Minor UI structure changes

Behavior > implementation.

---

## 2. Testing Levels

Jupiter uses 3 controlled levels of testing:

### 2.1 Integration Tests (Primary)

These validate:

- Aircraft lifecycle
- Workpack lifecycle
- Task immutability
- Component installation integrity
- Projection updates

Integration tests must:

- Use real database (test schema)
- Validate business rules
- Validate state transitions

This is the most important layer.

---

### 2.2 E2E Tests (Navigation + Flow)

Using Playwright.

These validate:

- Dashboard loads
- Navigation between modules
- Workpack creation flow
- Aircraft detail rendering
- No broken routes

E2E tests validate user journey.
They must not deeply inspect styling.

---

### 2.3 Unit Tests (Limited)

Unit tests are allowed for:

- Pure calculation logic (projection engine)
- Utility functions
- Permission logic functions

Avoid heavy mocking of controllers.

Unit tests are secondary to integration tests.

---

## 3. Mandatory Lifecycle Tests

The following flows must always have test coverage:

### Aircraft
- Create aircraft
- Enforce unique registration
- Controlled status transitions

### Workpacks
- Create draft
- Prevent duplicate draft per aircraft
- Issue workpack
- Execute tasks
- Close workpack
- Verify projection updates

### Components
- Install component
- Validate TSN anchoring
- Prevent illegal install conditions

---

## 4. RBAC Testing

RBAC must be tested at integration level.

Examples:

- Planner cannot close workpack
- Engineer cannot issue workpack
- QA can close workpack
- Owner (future) cannot modify data

Authorization failures must return correct HTTP status.

---

## 5. What Tests Must NOT Do

Tests must not:

- Depend on UI styling
- Depend on Tailwind classes
- Break if layout changes
- Hardcode database IDs without setup
- Bypass lifecycle validation

Tests validate system rules, not HTML structure.

---

## 6. Test Data Discipline

Each test must:

- Seed only what it needs
- Clean up after execution
- Avoid cross-test dependency
- Use deterministic values

Test stability is mandatory.

---

## 7. Test Failure Policy

When a lifecycle test fails:

- Do not silence it.
- Do not delete it.
- Investigate the business logic first.

If architecture change is required,
update documentation before updating tests.

---

## 8. Future Expansion

As Jupiter grows:

- Add RBAC coverage gradually
- Add Owner portal tests when implemented
- Add projection stress tests
- Avoid over-fragmented test explosion

Testing growth must remain disciplined.

---

END OF 07_TESTING_STRATEGY DOCUMENT
