import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPlatformAdministrationRouter } from "./platform-administration.routes.js";
const repo = () => ({
  resolveHuman: vi.fn(),
  authorizeCapability: vi.fn(),
  inspect: vi
    .fn()
    .mockResolvedValue({
      principals: [],
      capabilities: [],
      grants: [],
      audit: [],
    }),
  createPrincipal: vi.fn(),
  grant: vi.fn(),
  revoke: vi.fn(),
  disablePrincipal: vi.fn(),
  provisionSbSyncScheduler: vi.fn(),
  recoverSbSyncScheduler: vi.fn(),
});
const app = (repository: any, user: any = { id: "user" }) => {
  const value = express();
  value.use(express.json());
  value.use(express.urlencoded({ extended: true }));
  value.use((req: any, _res, next) => {
    req.user = user;
    req.flash = () => ({});
    next();
  });
  value.use("/platform", createPlatformAdministrationRouter(repository));
  value.response.render = function (_view: string, data: unknown) {
    return this.status(200).json(data);
  };
  return value;
};
describe("MP2-R2 HUMAN platform administration", () => {
  beforeEach(() => vi.restoreAllMocks());
  it("requires repository-resolved HUMAN audit authority for reads", async () => {
    const r = repo();
    r.resolveHuman.mockResolvedValue({
      principalType: "HUMAN",
      capabilities: new Set(["PLATFORM_AUDIT_VIEW"]),
    });
    expect((await request(app(r)).get("/platform")).status).toBe(200);
    expect(r.authorizeCapability).toHaveBeenCalledWith(
      expect.anything(),
      "PLATFORM_AUDIT_VIEW",
      ["HUMAN"],
    );
    expect(r.inspect).toHaveBeenCalled();
  });
  it("denies tenant/legacy identity and SERVICE authority without discovery", async () => {
    for (const resolved of [null, { principalType: "SERVICE" }]) {
      const r = repo();
      r.resolveHuman.mockResolvedValue(resolved);
      const response = await request(app(r)).get("/platform");
      expect(response.status).toBe(403);
      expect(response.text).toBe("Platform authority required.");
      expect(r.inspect).not.toHaveBeenCalled();
    }
  });
  it("delegates mutations only after fresh HUMAN manage authorization and explicit reason", async () => {
    const r = repo();
    r.resolveHuman.mockResolvedValue({ principalType: "HUMAN" });
    expect(
      (
        await request(app(r))
          .post("/platform/grants")
          .send({ principalId: "p", capabilityCode: "C", reason: "approved" })
      ).status,
    ).toBe(303);
    expect(r.authorizeCapability).toHaveBeenCalledWith(
      expect.anything(),
      "PLATFORM_AUTHORITY_MANAGE",
      ["HUMAN"],
    );
    expect(r.grant).toHaveBeenCalledWith(
      expect.anything(),
      "p",
      "C",
      "approved",
    );
    expect(
      (
        await request(app(r))
          .post("/platform/scheduler/provision")
          .send({ reason: "once" })
      ).status,
    ).toBe(303);
    expect(r.provisionSbSyncScheduler).toHaveBeenCalled();
    expect(
      (
        await request(app(r))
          .post("/platform/scheduler/recover")
          .send({ reason: "recover" })
      ).status,
    ).toBe(303);
    expect(r.recoverSbSyncScheduler).toHaveBeenCalledWith(
      expect.anything(),
      "recover",
    );
  });
  it("returns generic conflict for duplicate/refused operations and never assigns arbitrary SERVICE authority", async () => {
    const r = repo();
    r.resolveHuman.mockResolvedValue({ principalType: "HUMAN" });
    r.provisionSbSyncScheduler.mockRejectedValue(
      new Error("SB_SYNC_SCHEDULER_ALREADY_PROVISIONED"),
    );
    expect(
      (
        await request(app(r))
          .post("/platform/scheduler/provision")
          .send({ reason: "once" })
      ).status,
    ).toBe(303);
    expect(
      (
        await request(app(r))
          .post("/platform/principals")
          .send({
            principalType: "SERVICE",
            serviceCode: "EVIL",
            userId: "human",
            displayName: "x",
            reason: "x",
          })
      ).status,
    ).toBe(303);
    expect(r.createPrincipal).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ principalType: "HUMAN", userId: "human" }),
    );
  });
  it("is mounted behind global CSRF and authentication in app source", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync("src/app.ts", "utf8");
    expect(source.indexOf("const csrfProtection = csrf()")).toBeLessThan(
      source.indexOf("app.use('/platform'"),
    );
    expect(source).toContain("app.use('/platform', ensureAuthenticated");
  });

  it("lists tenants and exposes tenant lifecycle capability flags for a platform human", async () => {
    const r = repo();
    r.resolveHuman.mockResolvedValue({
      principalType: "HUMAN",
      capabilities: new Set([
        "PLATFORM_AUDIT_VIEW",
        "PLATFORM_AUTHORITY_MANAGE",
        "TENANT_PROVISION",
        "TENANT_ACTIVATE",
        "TENANT_SUSPEND",
        "TENANT_REINSTATE",
      ]),
    });
    const mockPool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("FROM tenants")) {
          return { rows: [{ id: "t1", public_id: "p1", code: "ACME", display_name: "Acme", status: "ACTIVE" }] };
        }
        if (sql.includes("FROM users")) {
          return { rows: [{ id: "u1", email: "admin@example.test", full_name: "Admin" }] };
        }
        return { rows: [] };
      }),
    };
    const value = express();
    value.use(express.urlencoded({ extended: true }));
    value.use((req: any, _res, next) => { req.user = { id: "user" }; next(); });
    let rendered: any;
    value.response.render = function (_view: string, data: any) { rendered = data; return this.status(200).json(data); };
    value.use("/platform", createPlatformAdministrationRouter(r as any, mockPool as any));
    const response = await request(value).get("/platform");
    expect(response.status).toBe(200);
    expect(rendered.tenants).toEqual([{ id: "t1", public_id: "p1", code: "ACME", display_name: "Acme", status: "ACTIVE" }]);
    expect(rendered.users).toEqual([{ id: "u1", email: "admin@example.test", full_name: "Admin" }]);
    expect(rendered.canManage).toBe(true);
    expect(rendered.canProvisionTenants).toBe(true);
    expect(rendered.canActivateTenants).toBe(true);
    expect(rendered.canSuspendTenants).toBe(true);
    expect(rendered.canReinstateTenants).toBe(true);
  });

  it("derives ready-for-activation for a PROVISIONING tenant via tenant-scoped context", async () => {
    const r = repo();
    r.resolveHuman.mockResolvedValue({ principalType: "HUMAN", capabilities: new Set(["PLATFORM_AUDIT_VIEW", "TENANT_ACTIVATE"]) });
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("set_config")) return { rows: [] };
        if (sql.includes("staff_invitations")) return { rows: [{ admin_onboarded: true }] };
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const mockPool = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("FROM tenants")) {
          return { rows: [{ id: "t1", public_id: "p1", code: "ACME", display_name: "Acme", status: "PROVISIONING" }] };
        }
        if (sql.includes("FROM users")) return { rows: [] };
        return { rows: [] };
      }),
      connect: vi.fn(async () => client),
    };
    const value = express();
    value.use(express.urlencoded({ extended: true }));
    value.use((req: any, _res, next) => { req.user = { id: "user" }; next(); });
    let rendered: any;
    value.response.render = function (_view: string, data: any) { rendered = data; return this.status(200).json(data); };
    value.use("/platform", createPlatformAdministrationRouter(r as any, mockPool as any));
    const response = await request(value).get("/platform");
    expect(response.status).toBe(200);
    expect(rendered.tenants[0].admin_onboarded).toBe(true);
    expect(mockPool.connect).toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("COMMIT");
  });
});
