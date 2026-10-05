import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(import.meta.dirname, '../..');
const readSource = (path: string) => readFileSync(resolve(sourceRoot, path), 'utf8');

describe('Customer and SerializedComponent creation authority', () => {
  const customerController = readSource('modules/customers/customers.controller.ts');
  const customerService = readSource('modules/customers/customers.service.ts');
  const libraryRoutes = readSource('modules/library/library.routes.ts');
  const libraryService = readSource('modules/library/library.service.ts');

  it('requires validated tenant context for the sole Customer runtime create path', () => {
    expect(customerController).toContain(
      'const authoritativeTenantId = req.tenantContext?.tenant.id;'
    );
    expect(customerController).toContain("throw new Error('ACTIVE_TENANT_CONTEXT_REQUIRED')");
    expect(customerController).toContain('{ tenantId: authoritativeTenantId }');
    expect(customerService).toContain('tenantAuthority: CustomerCreationTenantAuthority');
    expect(customerService).toContain('{ ...values, tenant_id: tenantAuthority.tenantId }');
    expect(customerService.match(/Customer\.create\(/g)).toHaveLength(1);
  });

  it('prevents Customer business payload and ADMIN status from granting ownership', () => {
    const valuesBuilder = customerService.slice(
      customerService.indexOf('private static buildCustomerValues'),
      customerService.indexOf('static async listCustomers')
    );
    expect(valuesBuilder).not.toMatch(/tenant_id|tenantId|organisation|organization/);
    expect(customerController).not.toMatch(/ADMIN.*tenant|tenant.*ADMIN/i);
    expect(customerService).not.toMatch(/tenant_id:\s*(?:payload|data|user|customer|aircraft)/);
  });

  it('requires the same validated custody authority for SerializedComponent creation', () => {
    const createRoute = libraryRoutes.slice(
      libraryRoutes.indexOf("'/serialized-components',"),
      libraryRoutes.indexOf("'/serialized-components/:id/update',")
    );
    expect(createRoute).toContain(
      'const authoritativeTenantId = req.tenantContext?.tenant.id;'
    );
    expect(createRoute).toContain("throw new Error('ACTIVE_TENANT_CONTEXT_REQUIRED')");
    expect(createRoute).toContain('{ tenantId: authoritativeTenantId }');

    const createService = libraryService.slice(
      libraryService.indexOf('static async createSerializedComponent'),
      libraryService.indexOf('static async updateSerializedComponent')
    );
    expect(createService).toContain('custodyAuthority: { readonly tenantId: string }');
    expect(createService).toContain('custodian_tenant_id: custodyAuthority.tenantId');
    expect(createService).not.toMatch(
      /custodian_tenant_id:\s*(?:data|req|user|customer|aircraft|manufacturer|model)/
    );
    expect(libraryService.match(/SerializedComponent\.create\(/g)).toHaveLength(1);
  });

  it('introduces no fallback, ADMIN bypass, inference, or custody transfer', () => {
    const creationSources = [customerController, customerService, libraryRoutes, libraryService]
      .join('\n');
    expect(creationSources).not.toMatch(/ADMIN.*(?:tenant|custod)|(?:tenant|custod).*ADMIN/i);
    expect(creationSources).not.toMatch(/defaultTenant|fallbackTenant|inferTenant|transferCustody/);
    expect(creationSources).not.toMatch(
      /custodian_tenant_id:\s*(?:data\.|req\.|user|customer|aircraft|manufacturer|model)/
    );
  });
});
