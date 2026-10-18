import { createHmac, randomUUID } from "node:crypto";
import { sanitizeErrorDiagnostic } from "./error-diagnostics.js";

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
  httpMethod?: string;
  httpPath?: string;
  httpStatus?: number;
}>;
const code = /^[A-Z][A-Z0-9_]{2,63}$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const method = /^[A-Z]{3,8}$/;
const pathUuid = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
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
const safeMethod = (value: string | undefined) =>
  typeof value === "string" && method.test(value) ? value : undefined;
const safeStatus = (value: number | undefined) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 100 &&
  value <= 599
    ? value
    : undefined;
const safePath = (value: string | undefined) => {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const pathOnly = value.split(/[?#]/)[0] || "";
  const normalized = pathOnly.replace(pathUuid, ":id").slice(0, 200);
  return normalized || undefined;
};
export function toOperationalEvent(
  input: OperationalEventInput,
  now = () => new Date(),
  id = () => randomUUID(),
) {
  const diagnostic =
    input.error !== undefined ? sanitizeErrorDiagnostic(input.error) : {};
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
    ...(diagnostic.errorCode ? { errorCode: diagnostic.errorCode } : {}),
    ...(diagnostic.errorName ? { errorName: diagnostic.errorName } : {}),
    ...(diagnostic.sqlState ? { sqlState: diagnostic.sqlState } : {}),
    ...(diagnostic.component ? { component: diagnostic.component } : {}),
    ...(diagnostic.trace?.length ? { trace: diagnostic.trace } : {}),
    ...(safeMethod(input.httpMethod)
      ? { httpMethod: safeMethod(input.httpMethod) }
      : {}),
    ...(safePath(input.httpPath) ? { httpPath: safePath(input.httpPath) } : {}),
    ...(safeStatus(input.httpStatus) !== undefined
      ? { httpStatus: safeStatus(input.httpStatus) }
      : {}),
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
