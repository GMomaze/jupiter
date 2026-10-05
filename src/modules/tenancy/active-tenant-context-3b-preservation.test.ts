import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relative: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relative), "utf8");
const app = read("src/app.ts");
const middleware = read(
  "src/modules/tenancy/active-tenant-context.middleware.ts",
);
const repository = read(
  "src/modules/tenancy/active-tenant-context.repository.ts",
);
const sessionTypes = read("src/types/express-session.d.ts");
const requestTypes = read("src/types/express.d.ts");

describe("MT-3 3B dormant preservation contract", () => {
  it("keeps the operational gate dormant and existing RBAC authoritative", () => {
    expect(app).toMatch(/resolveTenantContext/);
    expect(app).not.toMatch(
      /app\.use\([^\n]*requireValidActiveTenantContext/,
    );
    expect(middleware).not.toMatch(
      /requireRole|requirePermission|\bADMIN\b|user_roles/,
    );
  });

  it("never loads tenant roles or customer session authority", () => {
    expect(repository).not.toMatch(
      /TenantMembershipRole|tenant_membership_roles|\bRole\b|permission/i,
    );
    expect(middleware).not.toMatch(
      /customerUser|customer-auth|customer-portal/,
    );
  });

  it("stores no authorization or tenant snapshot data in the session contract", () => {
    const activeContext = sessionTypes.match(
      /activeTenantContext\?:\s*([^;]+);/,
    )?.[1];
    expect(activeContext).toBe("ActiveTenantSessionContext");
    expect(sessionTypes).not.toMatch(
      /activeTenant(Role|Permission|Status|DisplayName|Code)/i,
    );
  });

  it("declares optional readonly request context and uses one-time attachment", () => {
    expect(requestTypes).toMatch(
      /readonly tenantContext\?: ValidActiveTenantContext;/,
    );
    expect(requestTypes).toMatch(
      /readonly tenant\?: ValidActiveTenantContext\[['"]tenant['"]\];/,
    );
    expect(requestTypes).toMatch(
      /readonly membership\?: ValidActiveTenantContext\[['"]membership['"]\];/,
    );
    expect(requestTypes).toMatch(
      /readonly tenantAuthority\?: TenantQueryAuthority;/,
    );
    expect(requestTypes).not.toMatch(
      /^\s*(tenantContext|tenant|membership|tenantAuthority)\?:/m,
    );
    expect(middleware).toContain("Object.defineProperties(req");
    expect(middleware).not.toMatch(
      /req\.(tenantContext|tenant|membership|tenantAuthority)\s*=/,
    );
    expect(middleware).toContain("writable: false");
    expect(middleware).toContain("configurable: false");
  });

  it("ignores all request-supplied tenant selectors and never auto-selects", () => {
    expect(middleware).not.toMatch(/req\.(params|query|body|headers).*tenant/i);
    expect(middleware).not.toMatch(
      /resolveTenantSelection|listEligibleMemberships/,
    );
  });
});
