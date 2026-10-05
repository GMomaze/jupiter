import { describe, expect, it } from "vitest";
import fs from "node:fs";
const read = (p: string) => fs.readFileSync(p, "utf8");
describe("L2-1 foundation contracts", () => {
  it("defines additive isolated persistence and immutable audit", () => {
    const s = read("migrations/598_create_platform_authority_foundation.ts");
    for (const name of [
      "platform_principals",
      "platform_capabilities",
      "platform_capability_grants",
      "platform_global_audit_log",
    ])
      expect(s).toContain(name);
    expect(s).toContain("PLATFORM_GLOBAL_AUDIT_IMMUTABLE");
    expect(s).toContain("MIGRATION_598_DOWN_REFUSES_POPULATED_AUTHORITY");
    expect(s).not.toMatch(
      /tenant_membership_roles|INSERT INTO public\.user_roles/,
    );
  });
  it("revalidates and serializes last-owner changes", () => {
    const s = read(
      "src/modules/platform-authority/platform-authority.repository.ts",
    );
    expect(s).toContain("pg_advisory_xact_lock");
    expect(s).toContain("LAST_SYSTEM_OWNER_REQUIRED");
    expect(s).toMatch(/revalidate\(q,\s*authority/);
  });
  it("does not mount bootstrap routes", () => {
    const app = read("src/app.ts");
    expect(app).not.toMatch(/app\.(use|post)\([^\n]*bootstrap/);
  });
  it("exposes only explicit guarded bootstrap package commands", () => {
    const s = read("src/scripts/bootstrapInitialSystemOwner.ts");
    expect(s).toContain("ALLOW_INITIAL_SYSTEM_OWNER_BOOTSTRAP!=='YES'");
    const pkg = read("package.json");
    expect(pkg).toContain("platform:bootstrap:preflight");
    expect(pkg).toContain("platform:bootstrap:execute");
    expect(pkg).not.toMatch(/"(start|dev)"[^\n]*bootstrapInitialSystemOwner/);
  });
});
