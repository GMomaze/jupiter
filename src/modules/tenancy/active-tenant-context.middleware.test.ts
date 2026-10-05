import { describe, expect, it, vi } from "vitest";
import { createActiveTenantContextMiddleware } from "./active-tenant-context.middleware.js";
import {
  assertTenantQueryAuthority,
  type TenantQueryAuthority,
} from "./tenant-query-authority.js";
import type { ActiveTenantContextService } from "./active-tenant-context.service.js";
import type {
  ActiveTenantSessionContext,
  TenantContextDecision,
} from "./active-tenant-context.types.js";

const stored: ActiveTenantSessionContext = Object.freeze({
  tenantId: "tenant-1",
  membershipId: "membership-1",
  contextVersion: 1,
  selectedAt: 10,
  validatedAt: 11,
});

const valid: TenantContextDecision = Object.freeze({
  state: "VALID_ACTIVE_TENANT",
  tenant: Object.freeze({
    id: "tenant-1",
    publicId: "public-1",
    code: "ORG_ONE",
    displayName: "Organisation One",
    status: "ACTIVE",
  }),
  membership: Object.freeze({
    id: "membership-1",
    tenantId: "tenant-1",
    userId: "user-1",
    status: "ACTIVE",
  }),
  validatedAt: 99,
});

function harness(
  decision: TenantContextDecision = valid,
  options: {
    storedContext?: ActiveTenantSessionContext | null;
    authenticated?: boolean;
    user?: unknown;
    headers?: Record<string, string>;
    accepts?: string | false;
    save?: (callback: (error?: unknown) => void) => void;
  } = {},
) {
  const revalidateStoredContext = vi.fn().mockResolvedValue(decision);
  const service = {
    revalidateStoredContext,
  } as unknown as ActiveTenantContextService;
  const middleware = createActiveTenantContextMiddleware(service);
  const session: Record<string, unknown> & {
    save: (callback: (error?: unknown) => void) => void;
  } = {
    ...(options.storedContext === undefined
      ? { activeTenantContext: stored }
      : options.storedContext
        ? { activeTenantContext: options.storedContext }
        : {}),
    customerUser: { id: "customer-1" },
    save: options.save ?? ((callback) => callback()),
  };
  const req: any = {
    session,
    user: options.user ?? { id: "user-1", roles: [{ code: "ADMIN" }] },
    isAuthenticated: () => options.authenticated ?? true,
    get: (name: string) => options.headers?.[name],
    accepts: (kind: string) => (options.accepts === kind ? kind : false),
    params: { tenantId: "foreign-path" },
    query: { tenantId: "foreign-query" },
    body: { tenantId: "foreign-body" },
    headers: { "x-tenant-id": "foreign-header" },
  };
  const res: any = {
    set: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
  };
  return { ...middleware, revalidateStoredContext, req, res, session };
}

async function run(handler: any, req: any, res: any) {
  const next = vi.fn();
  await handler(req, res, next);
  return next;
}

describe("active tenant context middleware", () => {
  it("does not infer or auto-select a tenant when no context is stored", async () => {
    const h = harness(valid, { storedContext: null });
    const next = await run(h.resolveTenantContext, h.req, h.res);
    expect(next).toHaveBeenCalledOnce();
    expect(h.revalidateStoredContext).not.toHaveBeenCalled();
    expect(h.req.tenantContext).toBeUndefined();
    expect(h.session.activeTenantContext).toBeUndefined();
    expect(h.req.tenantAuthority).toBeUndefined();
  });

  it("attaches the readonly valid context and leaves the cached timestamps unchanged", async () => {
    const h = harness();
    await run(h.resolveTenantContext, h.req, h.res);
    expect(h.revalidateStoredContext).toHaveBeenCalledWith("user-1", stored);
    expect(h.req.tenantContext).toBe(valid);
    expect(h.req.tenant).toBe(
      valid.state === "VALID_ACTIVE_TENANT" && valid.tenant,
    );
    expect(h.req.membership).toBe(
      valid.state === "VALID_ACTIVE_TENANT" && valid.membership,
    );
    for (const property of ["tenantContext", "tenant", "membership"]) {
      expect(Object.getOwnPropertyDescriptor(h.req, property)).toMatchObject({
        enumerable: true,
        writable: false,
        configurable: false,
      });
    }
    expect(h.session.activeTenantContext).toBe(stored);
  });

  it("fails closed instead of overwriting an already attached context", async () => {
    const h = harness();
    await run(h.resolveTenantContext, h.req, h.res);
    const originallyAttached = h.req.tenantContext;
    const next = await run(h.resolveTenantContext, h.req, h.res);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "ACTIVE_TENANT_CONTEXT_ALREADY_ATTACHED",
      }),
    );
    expect(h.req.tenantContext).toBe(originallyAttached);
  });

  it("clears and saves only the matching invalid cached context while preserving customer state", async () => {
    const save = vi.fn((callback: (error?: unknown) => void) => callback());
    const h = harness({ state: "SUSPENDED_MEMBERSHIP" }, { save });
    await run(h.resolveTenantContext, h.req, h.res);
    expect(h.session.activeTenantContext).toBeUndefined();
    expect(h.session.customerUser).toEqual({ id: "customer-1" });
    expect(h.req).not.toHaveProperty("tenantContext");
    expect(h.req).not.toHaveProperty("tenant");
    expect(h.req).not.toHaveProperty("membership");
    expect(save).toHaveBeenCalledOnce();
  });

  it.each([
    "STALE_MEMBERSHIP",
    "DISABLED_MEMBERSHIP",
    "PROVISIONING_TENANT",
    "SUSPENDED_TENANT",
    "ARCHIVED_TENANT",
  ] as const)(
    "attaches no tenant authority after the %s resolver and gate path",
    async (state) => {
      const h = harness({ state });

      const resolverNext = await run(h.resolveTenantContext, h.req, h.res);
      expect(resolverNext).toHaveBeenCalledOnce();

      const gateNext = await run(
        h.requireValidActiveTenantContext,
        h.req,
        h.res,
      );
      expect(gateNext).not.toHaveBeenCalled();
      expect(h.res.redirect).toHaveBeenCalledWith(
        303,
        "/organisation/unavailable",
      );
      expect(h.req).not.toHaveProperty("tenantAuthority");
      expect(h.req).not.toHaveProperty("tenantContext");
      expect(h.req).not.toHaveProperty("tenant");
      expect(h.req).not.toHaveProperty("membership");
    },
  );

  it("does not clear a concurrently replaced selection", async () => {
    const h = harness({ state: "STALE_MEMBERSHIP" });
    h.revalidateStoredContext.mockImplementation(async () => {
      h.session.activeTenantContext = {
        ...stored,
        membershipId: "membership-2",
      };
      return { state: "STALE_MEMBERSHIP" };
    });
    await run(h.resolveTenantContext, h.req, h.res);
    expect(h.session.activeTenantContext).toEqual(
      expect.objectContaining({ membershipId: "membership-2" }),
    );
  });

  it("fails closed when invalidation cannot be saved", async () => {
    const failure = new Error("session persistence failed");
    const h = harness(
      { state: "DISABLED_MEMBERSHIP" },
      {
        save: (callback) => callback(failure),
      },
    );
    const next = await run(h.resolveTenantContext, h.req, h.res);
    expect(next).toHaveBeenCalledWith(failure);
  });

  it("does not grant ADMIN a missing-context bypass", async () => {
    const h = harness(valid, { storedContext: null });
    await run(h.resolveTenantContext, h.req, h.res);
    const next = await run(h.requireValidActiveTenantContext, h.req, h.res);
    expect(next).not.toHaveBeenCalled();
    expect(h.res.redirect).toHaveBeenCalledWith(
      303,
      "/organisation/unavailable",
    );
  });

  it("permits the gate only after a valid resolution", async () => {
    const h = harness();
    await run(h.resolveTenantContext, h.req, h.res);
    const next = await run(h.requireValidActiveTenantContext, h.req, h.res);
    expect(next).toHaveBeenCalledOnce();
    expect(Object.keys(h.req.tenantAuthority)).toEqual(["tenantId"]);
    expect(h.req.tenantAuthority.tenantId).toBe("tenant-1");
    expect(Object.isFrozen(h.req.tenantAuthority)).toBe(true);
    expect(Object.getOwnPropertyDescriptor(h.req, "tenantAuthority")).toMatchObject({
      enumerable: true,
      writable: false,
      configurable: false,
    });
    expect(() => assertTenantQueryAuthority(h.req.tenantAuthority)).not.toThrow();
  });

  it("rejects missing and structurally forged request authorities", () => {
    const candidates: unknown[] = [
      undefined,
      { tenantId: "tenant-1" },
      Object.freeze({ tenantId: "tenant-1" }),
      { tenantId: "tenant-1", roles: ["ADMIN"] },
      { tenantId: "tenant-1" } as TenantQueryAuthority,
    ];

    for (const candidate of candidates) {
      expect(() => assertTenantQueryAuthority(candidate)).toThrow(
        "TENANT_AUTHORITY_REQUIRED",
      );
    }
  });

  it("preserves exact authority identity and rejects its clone", async () => {
    const h = harness();
    await run(h.resolveTenantContext, h.req, h.res);
    await run(h.requireValidActiveTenantContext, h.req, h.res);
    const authentic = h.req.tenantAuthority;

    expect(() => assertTenantQueryAuthority(authentic)).not.toThrow();
    expect(() => assertTenantQueryAuthority({ ...authentic })).toThrow(
      "TENANT_AUTHORITY_REQUIRED",
    );
    expect(h.req.tenantAuthority).toBe(authentic);
    expect(Object.getOwnPropertyDescriptor(h.req, "tenantAuthority")).toMatchObject({
      writable: false,
      configurable: false,
    });
  });

  it("fails closed instead of overwriting existing or partial authority attachment", async () => {
    const h = harness();
    await run(h.resolveTenantContext, h.req, h.res);
    Object.defineProperty(h.req, "tenantAuthority", {
      value: { tenantId: "foreign-tenant" },
      configurable: true,
    });
    const next = await run(h.requireValidActiveTenantContext, h.req, h.res);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: "TENANT_QUERY_AUTHORITY_ALREADY_ATTACHED" }),
    );
    expect(h.req.tenantAuthority).toEqual({ tenantId: "foreign-tenant" });
  });

  it("returns a neutral HTMX redirect", async () => {
    const h = harness(valid, {
      storedContext: null,
      headers: { "HX-Request": "true" },
    });
    const next = await run(h.requireValidActiveTenantContext, h.req, h.res);
    expect(next).not.toHaveBeenCalled();
    expect(h.res.set).toHaveBeenCalledWith(
      "HX-Redirect",
      "/organisation/unavailable",
    );
    expect(h.res.status).toHaveBeenCalledWith(409);
  });

  it("returns a neutral JSON rejection", async () => {
    const h = harness(valid, { storedContext: null, accepts: "json" });
    await run(h.requireValidActiveTenantContext, h.req, h.res);
    expect(h.res.status).toHaveBeenCalledWith(403);
    expect(h.res.json).toHaveBeenCalledWith({
      error: "Organisation unavailable",
    });
  });
});
