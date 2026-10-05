import { createHmac, randomUUID } from "node:crypto";

export type OperationalSeverity = "INFO" | "WARN" | "ERROR" | "CRITICAL";
export type OperationalEventInput = Readonly<{
  code: string;
  severity: OperationalSeverity;
  outcome: string;
  operation?: string;
  correlationId?: string;
  tenantId?: string;
  principalId?: string;
  error?: unknown;
}>;
const code = /^[A-Z][A-Z0-9_]{2,63}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const lastEmitted = new Map<string, number>();
const safe = (value: string | undefined, max = 96) =>
  value && code.test(value) ? value.slice(0, max) : undefined;
const alias = (value: string | undefined) =>
  value && process.env.OPERATIONAL_EVENT_HMAC_KEY
    ? createHmac("sha256", process.env.OPERATIONAL_EVENT_HMAC_KEY)
        .update(value)
        .digest("hex")
        .slice(0, 24)
    : undefined;
export function toOperationalEvent(
  input: OperationalEventInput,
  now = () => new Date(),
  id = () => randomUUID(),
) {
  const errorCode =
    input.error instanceof Error ? safe(input.error.message) : undefined;
  return Object.freeze({
    schemaVersion: 1,
    timestamp: now().toISOString(),
    eventCode: safe(input.code) ?? "OPERATIONAL_EVENT_INVALID",
    severity: input.severity,
    outcome: safe(input.outcome) ?? "UNKNOWN",
    environment:
      safe((process.env.NODE_ENV ?? "unknown").toUpperCase()) ?? "UNKNOWN",
    correlationId:
      input.correlationId && uuid.test(input.correlationId)
        ? input.correlationId
        : id(),
    ...(safe(input.operation) ? { operation: safe(input.operation) } : {}),
    ...(alias(input.tenantId) ? { tenantAlias: alias(input.tenantId) } : {}),
    ...(alias(input.principalId)
      ? { principalAlias: alias(input.principalId) }
      : {}),
    ...(errorCode ? { errorCode } : {}),
  });
}
export function emitOperationalEvent(input: OperationalEventInput) {
  const event = toOperationalEvent(input);
  const key = `${event.eventCode}:${event.operation ?? ""}:${event.severity}`;
  const now = Date.now();
  if (
    input.severity !== "CRITICAL" &&
    now - (lastEmitted.get(key) ?? 0) < 5_000
  )
    return;
  lastEmitted.set(key, now);
  const line = JSON.stringify(event);
  if (input.severity === "ERROR" || input.severity === "CRITICAL")
    console.error(line);
  else if (input.severity === "WARN") console.warn(line);
  else console.info(line);
}
