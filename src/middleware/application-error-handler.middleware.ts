import type { NextFunction, Request, Response } from "express";
import { emitOperationalEvent } from "../modules/observability/operational-event.js";

// Global terminal error handler. Emits one structured, privacy-safe diagnostic
// event for unexpected failures, preserving the request correlation id, HTTP
// context, and sanitised exception evidence. The browser response remains
// generic — no stack, SQL, or internal detail is ever returned to the client.
export function createApplicationErrorHandler() {
  return (error: unknown, req: Request, res: Response, _next: NextFunction) => {
    const csrfFailure =
      error instanceof Error &&
      (error as Error & { code?: string }).code === "EBADCSRFTOKEN";
    emitOperationalEvent({
      code: csrfFailure ? "CSRF_REFUSED" : "APPLICATION_FAILURE",
      severity: csrfFailure ? "WARN" : "ERROR",
      outcome: csrfFailure ? "DENIED" : "FAILED",
      operation: csrfFailure ? "CSRF" : "HTTP_REQUEST",
      correlationId: res.locals.correlationId,
      httpMethod: req.method,
      httpPath: `${req.baseUrl}${req.path}`,
      httpStatus: csrfFailure ? 403 : 500,
      error,
    });
    return csrfFailure
      ? res.status(403).send("Request unavailable.")
      : res.status(500).send("Internal server error.");
  };
}
