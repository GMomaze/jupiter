import type { ValidActiveTenantContext } from "../modules/tenancy/active-tenant-context.types.js";
import type { TenantQueryAuthority } from "../modules/tenancy/tenant-query-authority.js";
import type { CustomerPortalQueryAuthority } from "../modules/customer-portal/customer-portal-query-authority.js";
import type { PlatformAuthority } from "../modules/platform-authority/platform-authority.js";

declare global {
  namespace Express {
    interface Request {
      readonly tenantContext?: ValidActiveTenantContext;
      readonly tenant?: ValidActiveTenantContext["tenant"];
      readonly membership?: ValidActiveTenantContext["membership"];
      readonly tenantAuthority?: TenantQueryAuthority;
      readonly customerPortalAuthority?: CustomerPortalQueryAuthority;
      readonly platformAuthority?: PlatformAuthority;
    }
  }
}

export {};
