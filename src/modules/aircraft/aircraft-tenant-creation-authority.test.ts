import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) =>
  readFileSync(resolve(import.meta.dirname, path), 'utf8');

describe('Aircraft tenant creation authority', () => {
  const controller = readSource('aircraft.controller.ts');
  const service = readSource('aircraft.service.ts');

  it('derives authority only from the validated request tenant context', () => {
    expect(controller).toContain('const authority = AircraftController.requireTenantAuthority(req);');
    expect(controller).toContain('assertTenantQueryAuthority(req.tenantAuthority);');
    expect(controller).toContain('AircraftService.create(\n        authority,');
    expect(controller).not.toContain('authoritativeTenantId');
    expect(controller).not.toMatch(/\{\s*tenantId:/);
    expect(controller).not.toMatch(/req\.(?:body|query|params|headers|cookies).*tenant/i);
    expect(controller).not.toMatch(/ADMIN|customer_aircraft_links|customerUser/);
  });

  it('passes tenant authority separately from the business payload', () => {
    expect(service).toContain('static async create(authority: TenantQueryAuthority, data:');
    expect(service).toContain('this.tenantRepository.create(authority, {');
    expect(service).not.toContain('AircraftCreationTenantAuthority');
    expect(service).not.toMatch(/tenant_id:\s*(?:data\.|authority\.)/);
  });

  it('does not add a default, inference, bypass, or transfer path', () => {
    expect(service).not.toContain('AircraftCreationTenantAuthority');
    expect(service).not.toMatch(/authority\?:\s*TenantQueryAuthority|tenantIdOrAuthority/);
    expect(service).not.toMatch(/tenant_id:\s*(?:data\.|req\.|user|customer|aircraft)/);
    expect(service).not.toMatch(/transferTenant|overrideTenant|allowTenantMutation/);
  });

  it('preserves the existing Aircraft business payload mapping', () => {
    for (const mapping of [
      'registration: this.normalizeRegistration(data.registration)',
      'serial_number: data.serial_number',
      'model_id: data.model_id',
      'category_id: data.category_id',
      "status: 'REGISTERED'",
      'loaded_into_system_at: data.loaded_into_system_at || null',
      'manufacture_date: data.manufacture_date || null',
      "tcds_number: data.tcds_number?.trim() || null",
      "tcds_url: data.tcds_url?.trim() || null",
      "photo_url: data.photo_url?.trim() || null",
    ]) {
      expect(service).toContain(mapping);
    }
  });
});
