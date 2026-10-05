import type { NextFunction, Request, Response } from "express";
import type {
  TenantSuspensionAccessCoordinator,
  TenantAccessLease,
} from "../tenancy/tenant-suspension-access-coordinator.js";
import { customerPortalRepository } from "./customer-portal.repository.live.js";
import type { CustomerPortalRepository } from "./customer-portal.repository.js";
import { emitOperationalEvent } from "../observability/operational-event.js";

function unavailable(req: Request, res: Response) {
  if (req.headers.accept?.includes("application/json"))
    return res.status(401).json({ error: "Customer authentication required" });
  return res.redirect("/customer-auth/login");
}

function hold(res: Response, lease: TenantAccessLease) {
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    void lease.release().catch(() => undefined);
  };
  res.once("finish", release);
  res.once("close", release);
}

export function createCustomerPortalSuspensionMiddleware(
  coordinator: TenantSuspensionAccessCoordinator,
  repository: Pick<
    CustomerPortalRepository,
    "resolveIdentity"
  > = customerPortalRepository,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    let lease: TenantAccessLease | undefined;
    try {
      const customerUserId = req.session?.customerUser?.id;
      if (typeof customerUserId !== "string") return unavailable(req, res);
      const initial = await repository.resolveIdentity(customerUserId);
      if (!initial) return unavailable(req, res);
      lease = await coordinator.acquire(initial.tenantId);
      const current = await repository.resolveIdentity(customerUserId);
      if (!current || current.tenantId !== initial.tenantId) {
        await lease.release();
        emitOperationalEvent({code:"SUSPENDED_TENANT_REFUSED",severity:"WARN",outcome:"DENIED",operation:"CUSTOMER_PORTAL_ACCESS",tenantId:initial.tenantId});
        return unavailable(req, res);
      }
      hold(res, lease);
      lease = undefined;
      return next();
    } catch (error) {
      if (lease) await lease.release().catch(() => undefined);
      return next(error);
    }
  };
}
