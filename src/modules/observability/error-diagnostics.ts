// Extracts only demonstrably-safe diagnostic fields from an arbitrary Error / unknown.
//
// Privacy contract: no raw message, stack text, SQL, parameter values, credentials,
// tokens or request bodies are ever included. Only an allowlisted stable error code,
// an allowlisted exception type/name, a 5-character SQLSTATE, and source-file paths
// (our own `src/`/`dist/` frames) are surfaced.

const STABLE_CODE = /^[A-Z][A-Z0-9_]{2,63}$/;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$.]*$/;
const SQLSTATE = /^[0-9A-Z]{5}$/;
const SOURCE_FRAME = /(?:src|dist)[/\\][^\s:)]+/;
const MAX_FIELD = 96;
const MAX_FRAMES = 6;

export interface ErrorDiagnostic {
  readonly errorCode?: string;
  readonly errorName?: string;
  readonly sqlState?: string;
  readonly component?: string;
  readonly trace?: readonly string[];
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string") return value;
  }
  return undefined;
}

function errorNameOf(error: unknown): string | undefined {
  const obj = asObject(error);
  if (!obj) return undefined;
  const name = firstString(
    obj.name,
    (obj.constructor as { name?: unknown } | undefined)?.name,
  );
  return name && IDENTIFIER.test(name) ? name.slice(0, MAX_FIELD) : undefined;
}

function sqlStateOf(error: unknown): string | undefined {
  const obj = asObject(error);
  const code = firstString(
    obj?.code,
    asObject(obj?.parent)?.code,
    asObject(obj?.original)?.code,
  );
  return code && SQLSTATE.test(code) ? code : undefined;
}

function sourceFiles(stack: string | undefined): string[] {
  if (typeof stack !== "string") return [];
  const files: string[] = [];
  for (const line of stack.split("\n")) {
    const match = SOURCE_FRAME.exec(line);
    if (match) {
      const relative = match[0].replace(/\\/g, "/");
      if (!files.includes(relative)) files.push(relative);
      if (files.length >= MAX_FRAMES) break;
    }
  }
  return files;
}

export function sanitizeErrorDiagnostic(error: unknown): ErrorDiagnostic {
  const obj = asObject(error);
  const errorCode =
    error instanceof Error && STABLE_CODE.test(error.message)
      ? error.message
      : undefined;
  const errorName = errorNameOf(error);
  const sqlState = sqlStateOf(error);
  const trace = sourceFiles(
    typeof obj?.stack === "string" ? obj.stack : undefined,
  );
  const component = trace[0];
  return Object.freeze({
    ...(errorCode ? { errorCode } : {}),
    ...(errorName ? { errorName } : {}),
    ...(sqlState ? { sqlState } : {}),
    ...(component ? { component } : {}),
    ...(trace.length ? { trace: Object.freeze(trace) } : {}),
  });
}
