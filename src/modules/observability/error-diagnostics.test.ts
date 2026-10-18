import { describe, expect, it } from "vitest";
import { sanitizeErrorDiagnostic } from "./error-diagnostics.js";

describe("sanitizeErrorDiagnostic", () => {
  it("extracts a stable code, type name and SQLSTATE without leaking the message", () => {
    const error = Object.assign(
      new Error("duplicate key value violates unique constraint \"users_email_key\""),
      { name: "error", code: "23505", detail: "Key (email)=(secret@example.test) already exists." },
    );
    const d = sanitizeErrorDiagnostic(error);
    expect(d.errorName).toBe("error");
    expect(d.sqlState).toBe("23505");
    expect(d.errorCode).toBeUndefined();
    const serialized = JSON.stringify(d);
    expect(serialized).not.toMatch(/secret@example\.test|users_email_key|constraint|duplicate/i);
  });

  it("drops a secret-laden message entirely (no code, no value)", () => {
    const d = sanitizeErrorDiagnostic(
      new Error("password=secret connection jupiter_db SELECT * FROM tenants"),
    );
    expect(d.errorCode).toBeUndefined();
    expect(d.errorName).toBe("Error");
    expect(JSON.stringify(d)).not.toMatch(/password|secret|jupiter_db|SELECT/i);
  });

  it("retains only an allowlisted stable ALL-CAPS error code", () => {
    const d = sanitizeErrorDiagnostic(new Error("PLATFORM_CAPABILITY_REQUIRED"));
    expect(d.errorCode).toBe("PLATFORM_CAPABILITY_REQUIRED");
  });

  it("derives the failing component and bounded trace from our own source frames", () => {
    const error = new Error("boom");
    error.stack = [
      "Error: boom",
      "    at Repo.list (file:///app/src/modules/auth/staff-tenant.repository.ts:20:24)",
      "    at async Service.list (file:///app/src/modules/auth/staff-tenant.service.ts:9:12)",
      "    at pg.Client.query (file:///app/node_modules/pg/lib/client.js:1:1)",
    ].join("\n");
    const d = sanitizeErrorDiagnostic(error);
    expect(d.component).toBe("src/modules/auth/staff-tenant.repository.ts");
    expect(d.trace).toEqual([
      "src/modules/auth/staff-tenant.repository.ts",
      "src/modules/auth/staff-tenant.service.ts",
    ]);
    // node_modules frames are excluded.
    expect(JSON.stringify(d)).not.toContain("node_modules");
  });

  it("returns an empty diagnostic for non-error values", () => {
    expect(sanitizeErrorDiagnostic("a plain string")).toEqual({});
    expect(sanitizeErrorDiagnostic(undefined)).toEqual({});
    expect(sanitizeErrorDiagnostic(null)).toEqual({});
  });
});
