import path from "node:path";

const required = [
  "DB_HOST",
  "DB_PORT",
  "DB_NAME",
  "DB_USER",
  "DB_PASSWORD",
  "SESSION_SECRET",
] as const;
const boolean = (value: string | undefined) =>
  value === undefined ||
  ["true", "false", "1", "0", "yes", "no"].includes(value.toLowerCase());
export function assertProductionRuntimeSafety(
  env: NodeJS.ProcessEnv = process.env,
) {
  if (env.NODE_ENV !== "production") return;
  for (const key of required)
    if (!env[key]?.trim())
      throw new Error(`PRODUCTION_CONFIGURATION_REQUIRED:${key}`);
  if (
    !/^\d+$/.test(env.DB_PORT!) ||
    Number(env.DB_PORT) < 1 ||
    Number(env.DB_PORT) > 65535
  )
    throw new Error("PRODUCTION_CONFIGURATION_INVALID:DB_PORT");
  if (/(^|[_-])(test|testing)([_-]|$)/i.test(env.DB_NAME!))
    throw new Error("PRODUCTION_TEST_DATABASE_FORBIDDEN");
  if (
    env.ALLOW_TEST_DATABASE_RESET === "YES" ||
    env.REMOTE_TEST_MODE === "true"
  )
    throw new Error("PRODUCTION_TEST_MODE_FORBIDDEN");
  if (
    env.SESSION_SECRET === "jupiter_dev_secret" ||
    env.SESSION_SECRET!.length < 32
  )
    throw new Error("PRODUCTION_SESSION_SECRET_INVALID");
  if (env.TRUST_PROXY !== "1")
    throw new Error("PRODUCTION_TRUST_PROXY_REQUIRED");
  for (const key of [
    "IP_WHITELIST_ENABLED",
    "SB_SYNC_CRON_ENABLED",
    "SB_SYNC_RUN_ON_BOOT",
  ])
    if (!boolean(env[key]))
      throw new Error(`PRODUCTION_CONFIGURATION_INVALID:${key}`);
  if (env.IP_WHITELIST_ENABLED === "true" && !env.ALLOWED_IPS?.trim())
    throw new Error("PRODUCTION_IP_ALLOWLIST_REQUIRED");
  if (env.SB_SYNC_CRON_ENABLED === "true") {
    if (env.SB_SYNC_SERVICE_CODE !== "SB_SYNC_SCHEDULER")
      throw new Error("SB_SYNC_SCHEDULER_CONFIGURATION_REQUIRED");
    if (
      !/^\d+$/.test(env.SB_SYNC_INTERVAL_MINUTES ?? "") ||
      Number(env.SB_SYNC_INTERVAL_MINUTES) <= 0
    )
      throw new Error("SB_SYNC_INTERVAL_INVALID");
  }
  for (const key of [
    "AIRCRAFT_UPLOAD_ROOT",
    "MANUFACTURER_UPLOAD_ROOT",
    "MANUFACTURER_QUARANTINE_ROOT",
    "SB_IMPORT_QUARANTINE_ROOT",
    "SB_IMPORT_EPHEMERAL_ROOT",
  ]) {
    const value = env[key];
    if (!value || !path.isAbsolute(value))
      throw new Error(`PRODUCTION_FILE_ROOT_INVALID:${key}`);
  }
  if (
    !env.OPERATIONAL_EVENT_HMAC_KEY ||
    env.OPERATIONAL_EVENT_HMAC_KEY.length < 32
  )
    throw new Error("PRODUCTION_OBSERVABILITY_KEY_INVALID");
}
