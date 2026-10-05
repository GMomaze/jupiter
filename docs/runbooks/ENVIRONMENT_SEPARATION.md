# Jupiter Environment Separation Runbook

## Purpose

Prevent development, test, staging/non-production, and production from sharing
database targets, persistent files, secrets, SERVICE authority, or scheduler
execution. This runbook selects no production topology.

## Environment contract

| Environment | Current repository behavior | Required separation |
| --- | --- | --- |
| Development | `NODE_ENV=development`; normal runtime loads `.env`. | Development-only database, users/secrets, file roots, and disabled scheduler unless explicitly required. Never use `jupiter_test` as a development migration target. |
| Test | `NODE_ENV=test`; database keys are cleared then loaded from `.env.test`. Server safety requires exact database/user `jupiter_test`; destructive preparation requires explicit approval. | Test-only database, user, secrets, files, and SERVICE fixtures. Never point at development/staging/production. |
| Staging/non-production | No dedicated repository profile or `.env.staging` loader exists. It is non-test runtime unless external infrastructure supplies stricter isolation. | Dedicated non-production database, file roots, secrets and SERVICE principal; never reuse production. Treat missing staging validation as an operational gap. |
| Production | Exact `NODE_ENV=production` activates MP2-R2 startup refusal. | Production-only database, secrets, absolute file roots, authority and scheduler configuration. Test modes and test-named database are forbidden. |

## Preconditions

- Record the intended environment, release commit/artifact, host/process
  identity, database host/port/name/user, all configured file roots, and
  scheduler state without recording secret values.
- Confirm the environment has its own credentials, session/tenant-switch/event
  keys, database, upload/quarantine roots, and SERVICE authority.
- Keep `SB_SYNC_CRON_ENABLED=false` and `SB_SYNC_RUN_ON_BOOT=false` unless the
  exact environment has an approved active `SB_SYNC_SCHEDULER` principal and
  scheduled execution is authorized.

## Authority required

Environment creation, configuration, startup, or production access requires
target-specific Project Owner and infrastructure authority. Repository commands
do not provide that authorization.

## Procedure

1. Identify `NODE_ENV` explicitly; do not rely on a shell default.
2. Compare the redacted target manifest with every other environment. Stop on
   reused database, persistent root, secret identifier, or SERVICE principal.
3. For test, confirm `.env.test`, exact `jupiter_test` database/user, and that no
   live target is reachable.
4. For production, confirm all MP2-R2-required values: `DB_HOST`, `DB_PORT`,
   `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `SESSION_SECRET`, `TRUST_PROXY`,
   `OPERATIONAL_EVENT_HMAC_KEY`, and the five absolute file roots. Confirm test
   modes are absent and scheduler/IP allowlist values are valid.
5. Confirm `TENANT_SWITCH_TOKEN_SECRET` is non-placeholder and at least 32 UTF-8
   bytes. If scheduler is enabled, require exact
   `SB_SYNC_SERVICE_CODE=SB_SYNC_SCHEDULER` and positive
   `SB_SYNC_INTERVAL_MINUTES`.
6. Start only through the approved environment process. `npm start` is the
   repository package entry, not a hosting or deployment procedure.

## Expected result

The intended environment starts only against its isolated database and roots;
production refuses missing/weak/relative/test-crossed configuration; test
refuses non-`jupiter_test` identity; scheduler authority remains environment-
local and disabled unless explicitly ready.

## Refusal / stop conditions

Stop on unidentified `NODE_ENV`, shared target/root/secret, test-production
crossover, missing production value, test-named production database, weak
session/event/tenant-switch key, relative production root, invalid proxy/IP or
scheduler configuration, or unverified SERVICE authority. Never weaken a guard
to obtain startup.

## Verification

Before startup, retain only a redacted manifest and independent target
comparison. After authorized startup, require bounded `GET /health/live` and
`GET /health/ready`; these prove process/readiness status, not tenant isolation
or release acceptance.

## Recovery / failure handling

Leave the environment closed, preserve refusal evidence, correct configuration
only through the approved secret/configuration channel, and repeat preflight.
Do not substitute another environment's values.

## Operational gap

**OPERATIONAL GAP — IMPLEMENTATION REQUIRED:** no repository-defined staging
profile, environment manifest validator, hosting topology, or cross-environment
uniqueness checker exists. Resolve before MP2-R4 non-production readiness.
