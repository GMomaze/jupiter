import { Request, Response, NextFunction } from "express";
import { emitOperationalEvent } from "../modules/observability/operational-event.js";

/**
 * UI Authentication Check
 * Redirects to login if session is missing.
 */
export const ensureAuthenticated = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.isAuthenticated()) {
    return next();
  }
  emitOperationalEvent({code:"AUTHENTICATION_REFUSED",severity:"INFO",outcome:"DENIED",operation:"AUTHENTICATED_ROUTE"});

  if (req.headers.accept?.includes("application/json")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.redirect("/auth/login");
};

/**
 * API Authentication Check
 * Returns 401 instead of redirecting.
 */
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.isAuthenticated()) {
    return next();
  }
  emitOperationalEvent({code:"AUTHENTICATION_REFUSED",severity:"INFO",outcome:"DENIED",operation:"API_ROUTE"});
  res.status(401).json({ error: "Authentication required" });
};

export default {
  ensureAuthenticated,
  requireAuth,
};
