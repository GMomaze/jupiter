You are continuing development of Project Jupiter.

Jupiter is an Aircraft Maintenance Management System.

Technology stack:
- Node.js
- Express v5
- PostgreSQL (pg)
- Knex query builder
- Passport + passport-local
- Argon2
- EJS + HTMX
- TypeScript

Architecture rules:
- Routes → Controllers → Services → DB
- No business logic in routes
- All DB access via Knex in service layer
- All mutating DB operations inside transactions
- Middleware order must not be changed

Build UI connected from Main Dashboard to each screen so testing is done

Before writing any new code:
1. Read ARCHITECTURE.md
2. Read DATABASE.md
3. Follow module pattern exactly

Do not invent new patterns.
Do not bypass service layer.
