import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Establishes a single request correlation id (from the client-provided
// `x-correlation-id` header when it is a valid UUID, otherwise a fresh UUID),
// makes it available to the rest of the request/error pipeline via
// `res.locals.correlationId`, and echoes it back to the client.
export const correlationId: RequestHandler = (req, res, next) => {
  const raw = req.headers["x-correlation-id"];
  const provided = Array.isArray(raw) ? raw[0] : raw;
  const effective =
    typeof provided === "string" && UUID.test(provided) ? provided : randomUUID();
  res.locals.correlationId = effective;
  res.setHeader("x-correlation-id", effective);
  next();
};
