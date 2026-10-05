import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { InferCreationAttributes } from 'sequelize';
import { describe, expect, expectTypeOf, it } from 'vitest';

import type { Aircraft } from './core/Aircraft.js';

const modelsRoot = resolve(import.meta.dirname);
const readModel = (path: string) => readFileSync(resolve(modelsRoot, path), 'utf8');

const roots = [
  { path: 'core/Aircraft.ts', field: 'tenant_id' },
  { path: 'Customer.ts', field: 'tenant_id' },
  { path: 'SerializedComponent.ts', field: 'custodian_tenant_id' },
  { path: 'PlanningSession.ts', field: 'tenant_id' },
  { path: 'core/Workpack.ts', field: 'tenant_id' },
] as const;

describe('root operational ownership model contracts', () => {
  it('requires Aircraft tenant ownership in creation attributes', () => {
    type AircraftCreationAttributes = InferCreationAttributes<Aircraft>;

    expectTypeOf<AircraftCreationAttributes['tenant_id']>().toEqualTypeOf<string>();

    const source = readModel('core/Aircraft.ts');
    expect(source).toContain("declare readonly tenant_id: ForeignKey<Tenant['id']>;");
    expect(source).not.toMatch(/tenant_id:\s*CreationOptional/);

    const attribute = source.match(/tenant_id: \{([\s\S]*?)\n    \},/)?.[1] ?? '';
    expect(attribute).toContain('allowNull: false');
    expect(attribute).toContain("references: { model: 'tenants', key: 'id' }");
    expect(attribute).not.toMatch(/defaultValue|set\s*\(|infer|fallback/i);
  });

  it('maps exactly the approved required ownership and custody attributes', () => {
    for (const { path, field } of roots) {
      const source = readModel(path);
      expect(source).toContain(`declare readonly ${field}:`);

      const attribute = source.match(
        new RegExp(`${field}: \\{([\\s\\S]*?)\\n    \\},`)
      )?.[1] ?? '';
      expect(attribute).toContain('type: DataTypes.UUID');
      expect(attribute).toContain('allowNull: false');
      expect(attribute).toContain(`field: '${field}'`);
      expect(attribute).toContain("references: { model: 'tenants', key: 'id' }");
      expect(attribute).toContain("onUpdate: 'RESTRICT'");
      expect(attribute).toContain("onDelete: 'RESTRICT'");
      expect(attribute).not.toMatch(/defaultValue|set\s*\(/);
    }
  });

  it('rejects instance and bulk ownership mutation with no transfer bypass', () => {
    for (const { path, field } of roots) {
      const source = readModel(path);
      expect(source).toContain(`instance.changed('${field}')`);
      expect(source).toContain("const attributes = 'attributes' in options");
      expect(source).toContain(`Object.prototype.hasOwnProperty.call(attributes, '${field}')`);
      expect(source).toContain(`options.fields?.includes('${field}')`);
      expect(source.match(/ROOT_OPERATIONAL_TENANT_OWNERSHIP_IMMUTABLE/g)).toHaveLength(2);
      expect(source).not.toMatch(/transfer|bypass|overrideTenant|allowTenantMutation/i);
    }
  });

  it('declares the exact explicit Tenant association aliases', () => {
    const associations = readModel('associations.ts');
    const expected = [
      "Tenant.hasMany(Aircraft, { foreignKey: 'tenant_id', as: 'OwnedAircraft' })",
      "Aircraft.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'OwningTenant' })",
      "Tenant.hasMany(Customer, { foreignKey: 'tenant_id', as: 'Customers' })",
      "Customer.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'Tenant' })",
      "as: 'CustodiedSerializedComponents'",
      "as: 'CustodianTenant'",
      "Tenant.hasMany(PlanningSession, { foreignKey: 'tenant_id', as: 'PlanningSessions' })",
      "PlanningSession.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'Tenant' })",
      "Tenant.hasMany(Workpack, { foreignKey: 'tenant_id', as: 'Workpacks' })",
      "Workpack.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'HistoricalTenant' })",
    ];
    for (const contract of expected) expect(associations).toContain(contract);

    const tenancyBlock = associations.slice(
      associations.indexOf('Tenant.hasMany(TenantMembership'),
      associations.indexOf('/* ============================================================', 1)
    );
    expect(tenancyBlock).not.toContain('belongsToMany');
  });

  it('rejects only trimmed-empty approved identifiers without rewriting them', () => {
    const contracts = [
      ['core/Aircraft.ts', 'registration', 'AIRCRAFT_REGISTRATION_BLANK'],
      ['Customer.ts', 'account_reference', 'CUSTOMER_ACCOUNT_REFERENCE_BLANK'],
      ['SerializedComponent.ts', 'serial_number', 'SERIALIZED_COMPONENT_SERIAL_NUMBER_BLANK'],
      ['core/Workpack.ts', 'work_order_number', 'WORKPACK_WORK_ORDER_NUMBER_BLANK'],
    ] as const;

    for (const [path, field, error] of contracts) {
      const source = readModel(path);
      const attribute = source.match(
        new RegExp(`${field}: \\{([\\s\\S]*?)\\n    \\},`)
      )?.[1] ?? '';
      expect(attribute).toContain("String(value).trim() === ''");
      expect(attribute).toContain(error);
      expect(source).not.toMatch(new RegExp(`(?:instance\\.)?${field}\\s*=`));
      expect(source).not.toContain('beforeValidate');
    }
  });

  it('removes only Aircraft registration global uniqueness from the model', () => {
    const source = readModel('core/Aircraft.ts');
    const registration = source.match(/registration: \{([\s\S]*?)\n    \},/)?.[1] ?? '';
    const serial = source.match(/serial_number: \{([\s\S]*?)\n    \},/)?.[1] ?? '';

    expect(registration).not.toContain('unique: true');
    expect(serial).toContain('unique: true');
  });

  it('introduces no model query scope or request-derived tenant authority', () => {
    for (const { path } of roots) {
      const source = readModel(path);
      expect(source).not.toMatch(
        /defaultScope|addScope|activeTenantContext|req\.|request\.|req\.session|express-session|ADMIN|requireRole|requirePermission/
      );
    }
  });

  it('leaves shared reference and global authority models tenant-neutral', () => {
    for (const path of [
      'Manufacturer.ts',
      'ManufacturerSourceName.ts',
      'ComponentModel.ts',
      'AirworthinessDirective.ts',
      'ServiceBulletin.ts',
      'SupplementalInspectionDocument.ts',
      'core/User.ts',
      'rbac/Role.ts',
      'rbac/Permission.ts',
    ]) {
      expect(readModel(path)).not.toMatch(/(?:custodian_)?tenant_id/);
    }
  });
});
