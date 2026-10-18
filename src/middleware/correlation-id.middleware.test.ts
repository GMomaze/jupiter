import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { correlationId } from "./correlation-id.middleware.js";

const VALID = "92fa9811-0871-468b-b381-8fd335362ec5";
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function harness() {
  const app = express();
  app.use(correlationId);
  app.get("/probe", (_req, res) => {
    res.json({ correlationId: res.locals.correlationId });
  });
  return app;
}

describe("correlationId middleware", () => {
  it("preserves a valid client-provided correlation id end to end", async () => {
    const res = await request(harness())
      .get("/probe")
      .set("x-correlation-id", VALID);
    expect(res.status).toBe(200);
    expect(res.body.correlationId).toBe(VALID);
    expect(res.headers["x-correlation-id"]).toBe(VALID);
  });

  it("generates a fresh UUID when none is supplied", async () => {
    const res = await request(harness()).get("/probe");
    expect(res.status).toBe(200);
    expect(res.body.correlationId).toMatch(UUID);
    expect(res.headers["x-correlation-id"]).toBe(res.body.correlationId);
  });

  it("rejects an invalid client-provided id and generates a fresh UUID", async () => {
    const res = await request(harness())
      .get("/probe")
      .set("x-correlation-id", "not-a-uuid");
    expect(res.status).toBe(200);
    expect(res.body.correlationId).not.toBe("not-a-uuid");
    expect(res.body.correlationId).toMatch(UUID);
  });
});
