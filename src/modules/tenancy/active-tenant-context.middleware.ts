import type { Request, RequestHandler } from "express";
import type { ActiveTenantContextService } from "./active-tenant-context.service.js";
import type {
  ActiveTenantSessionContext,
  TenantContextDecision,
  ValidActiveTenantContext,
} from "./active-tenant-context.types.js";
import { createTenantQueryAuthority } from "./tenant-query-authority.js";
import type { TenantAccessLease, TenantSuspensionAccessCoordinator } from './tenant-suspension-access-coordinator.js';
import { emitOperationalEvent } from '../observability/operational-event.js';

const noContext: TenantContextDecision = Object.freeze({
  state: "NO_TENANT_CONTEXT",
});

function sameStoredContext(
  current: ActiveTenantSessionContext | undefined,
  snapshot: ActiveTenantSessionContext,
): boolean {
  return Boolean(
    current &&
    current.tenantId === snapshot.tenantId &&
    current.membershipId === snapshot.membershipId &&
    current.contextVersion === snapshot.contextVersion &&
    current.selectedAt === snapshot.selectedAt &&
    current.validatedAt === snapshot.validatedAt,
  );
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

function isHtmx(req: Request): boolean {
  return req.get("HX-Request")?.toLowerCase() === "true";
}

function wantsJson(req: Request): boolean {
  return Boolean(req.accepts("json") && !req.accepts("html"));
}

function attachValidContext(
  req: Request,
  context: ValidActiveTenantContext,
): void {
  if ("tenantContext" in req || "tenant" in req || "membership" in req) {
    throw new Error("ACTIVE_TENANT_CONTEXT_ALREADY_ATTACHED");
  }
  Object.defineProperties(req, {
    tenantContext: {
      value: context,
      enumerable: true,
      writable: false,
      configurable: false,
    },
    tenant: {
      value: context.tenant,
      enumerable: true,
      writable: false,
      configurable: false,
    },
    membership: {
      value: context.membership,
      enumerable: true,
      writable: false,
      configurable: false,
    },
  });
}

function attachTenantAuthority(req: Request, context: ValidActiveTenantContext): void {
  if ("tenantAuthority" in req) {
    throw new Error("TENANT_QUERY_AUTHORITY_ALREADY_ATTACHED");
  }
  const authority = createTenantQueryAuthority(context);
  Object.defineProperty(req, "tenantAuthority", {
    value: authority,
    enumerable: true,
    writable: false,
    configurable: false,
  });
}

export function createActiveTenantContextMiddleware(
  service: ActiveTenantContextService,
  accessCoordinator?: TenantSuspensionAccessCoordinator,
): {
  resolveTenantContext: RequestHandler;
  requireValidActiveTenantContext: RequestHandler;
} {
  const decisions = new WeakMap<Request, TenantContextDecision>();

  const resolveTenantContext: RequestHandler = async (req, _res, next) => {
    try {
      decisions.set(req, noContext);
      const authenticatedUserId = (req.user as { id?: unknown } | undefined)
        ?.id;
      if (!req.isAuthenticated() || typeof authenticatedUserId !== "string")
        return next();

      const stored = req.session.activeTenantContext;
      if (!stored) return next();

      const decision = await service.revalidateStoredContext(
        authenticatedUserId,
        stored,
      );
      decisions.set(req, decision);

      if (decision.state === "VALID_ACTIVE_TENANT") {
        attachValidContext(req, decision);
        return next();
      }

      if (sameStoredContext(req.session.activeTenantContext, stored)) {
        delete req.session.activeTenantContext;
        await saveSession(req);
      }
      emitOperationalEvent({code:'TENANT_CONTEXT_REFUSED',severity:'WARN',outcome:'DENIED',operation:'TENANT_CONTEXT',tenantId:stored.tenantId});
      return next();
    } catch (error) {
      emitOperationalEvent({code:'TENANT_CONTEXT_FAILURE',severity:'ERROR',outcome:'FAILED',operation:'TENANT_CONTEXT',error});
      return next(error);
    }
  };

  const deny = (req: Request, res: Parameters<RequestHandler>[1]) => {
    if (isHtmx(req)) {
      res.set("HX-Redirect", "/organisation/unavailable");
      return res.status(409).send();
    }
    if (wantsJson(req)) return res.status(403).json({ error: "Organisation unavailable" });
    return res.redirect(303, "/organisation/unavailable");
  };

  const holdUntilResponseEnds = (res: Parameters<RequestHandler>[1], lease: TenantAccessLease) => {
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      void lease.release().catch(() => undefined);
    };
    res.once('finish', release);
    res.once('close', release);
  };

  const requireValidActiveTenantContext: RequestHandler = async (req, res, next) => {
    if (
      decisions.get(req)?.state === "VALID_ACTIVE_TENANT" &&
      req.tenantContext
    ) {
      let lease: TenantAccessLease | undefined;
      try {
        let context = req.tenantContext;
        if (accessCoordinator) {
          lease = await accessCoordinator.acquire(context.tenant.id);
          const userId = (req.user as { id?: unknown } | undefined)?.id;
          const stored = req.session.activeTenantContext;
          if (typeof userId !== 'string' || !stored) throw new Error('TENANT_ACCESS_REVALIDATION_REQUIRED');
          const revalidated = await service.revalidateStoredContext(userId, stored);
          decisions.set(req, revalidated);
          if (revalidated.state !== 'VALID_ACTIVE_TENANT' ||
              revalidated.tenant.id !== context.tenant.id ||
              revalidated.membership.id !== context.membership.id) {
            if (sameStoredContext(req.session.activeTenantContext, stored)) {
              delete req.session.activeTenantContext;
              await saveSession(req);
            }
            await lease.release();
            return deny(req, res);
          }
          context = revalidated;
          holdUntilResponseEnds(res, lease);
          lease = undefined;
        }
        attachTenantAuthority(req, context);
        return next();
      } catch (error) {
        if (lease) await lease.release().catch(() => undefined);
        return next(error);
      }
    }
    emitOperationalEvent({code:'TENANT_ACCESS_REFUSED',severity:'WARN',outcome:'DENIED',operation:'TENANT_ACCESS'});
    return deny(req, res);
  };

  return Object.freeze({
    resolveTenantContext,
    requireValidActiveTenantContext,
  });
}
