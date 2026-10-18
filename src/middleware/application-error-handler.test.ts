import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { correlationId } from "./correlation-id.middleware.js";
import { createApplicationErrorHandler } from "./application-error-handler.middleware.js";

const VALID = "92fa9811-0871-468b-b381-8fd335362ec5";

function databaseError(): Error {
  const error = new Error(
    'duplicate key value violates unique constraint "users_email_key"',
  );
  error.name = "error";
  (error as Error & { code?: string }).code = "23505";
  (error as Error & { detail?: string }).detail =
    "Key (email)=(secret@example.test) already exists.";
  return error;
}

function makeApp() {
  const app = express();
  app.use(correlationId);
  app.get("/boom", () => {
    throw databaseError();
  });
  app.post("/csrf", () => {
    const error = new Error("invalid csrf token");
    (error as Error & { code?: string }).code = "EBADCSRFTOKEN";
    throw error;
  });
  app.use(createApplicationErrorHandler());
  return app;
}

describe("application error handler diagnostics", () => {
  afterEach(() => vi.restoreAllMocks());

  it("emits an actionable diagnostic with the preserved correlation id, without leaking details to the client", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => {
      lines.push(String(args[0]));
    });

    const res = await request(makeApp())
      .get("/boom")
      .set("x-correlation-id", VALID);

    // Generic browser response, no internal detail.
    expect(res.status).toBe(500);
    expect(res.text).toBe("Internal server error.");
    expect(res.text).not.toMatch(/23505|constraint|duplicate|secret|stack|email/i);

    // One structured server-side diagnostic event.
    expect(lines).toHaveLength(1);
    const event = JSON.parse(lines[0]);
    expect(event).toMatchObject({
      eventCode: "APPLICATION_FAILURE",
      severity: "ERROR",
      outcome: "FAILED",
      operation: "HTTP_REQUEST",
      correlationId: VALID,
      httpMethod: "GET",
      httpPath: "/boom",
      httpStatus: 500,
      errorName: "error",
      sqlState: "23505",
    });
    expect(event.component).toMatch(/^src\//);
    expect(Array.isArray(event.trace)).toBe(true);
    expect(event.timestamp).toEqual(expect.any(String));
    // The raw message/detail/SQL value never reaches the log.
    expect(JSON.stringify(event)).not.toMatch(
      /constraint|duplicate|secret@example|password|stack/i,
    );
  });

  it("keeps CSRF failures as a 403 warning rather than an unexpected error", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "warn").mockImplementation((...args) => {
      lines.push(String(args[0]));
    });

    const res = await request(makeApp())
      .post("/csrf")
      .set("x-correlation-id", VALID);

    expect(res.status).toBe(403);
    expect(res.text).toBe("Request unavailable.");

    expect(lines).toHaveLength(1);
    const event = JSON.parse(lines[0]);
    expect(event).toMatchObject({
      eventCode: "CSRF_REFUSED",
      severity: "WARN",
      outcome: "DENIED",
      operation: "CSRF",
      correlationId: VALID,
      httpMethod: "POST",
      httpPath: "/csrf",
      httpStatus: 403,
    });
    expect(event.errorName).toBe("Error");
  });
});
