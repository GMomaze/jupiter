import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import migration from '../../../migrations/590_add_root_operational_tenant_ownership.js';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const migrationPath = resolve(
  repositoryRoot,
  'migrations/590_add_root_operational_tenant_ownership.ts'
);
const source = readFileSync(migrationPath, 'utf8');

describe('migration 590 root operational ownership contract', () => {
  it('is the sole migration 590 and follows migration 589', () => {
    const migrations = readdirSync(resolve(repositoryRoot, 'migrations'))
      .filter(name => /^\d+_/.test(name))
      .sort();

    expect(migrations.filter(name => name.startsWith('590_'))).toEqual([
      '590_add_root_operational_tenant_ownership.ts',
    ]);
    expect(migrations.at(-2)).toBe('589_create_tenant_context_switch_attempts.ts');
    expect(migrations.at(-1)).toBe('590_add_root_operational_tenant_ownership.ts');
  });

  it('adds exactly the five required non-null tenant ownership columns', () => {
    expect(source.match(/addColumn\(/g)).toHaveLength(2);
    expect(source).toContain("['aircraft', 'customers', 'planning_sessions', 'workpacks']");
    expect(source).toContain("'serialized_components',\n        'custodian_tenant_id'");
    expect(source.match(/allowNull: false/g)).toHaveLength(2);
    expect(source.match(/references: \{ model: 'tenants', key: 'id' \}/g)).toHaveLength(2);
    expect(source.match(/onUpdate: 'RESTRICT'/g)).toHaveLength(2);
    expect(source.match(/onDelete: 'RESTRICT'/g)).toHaveLength(2);
    expect(source).not.toMatch(/defaultValue|backfill|sentinel/i);
  });

  it('locks and proves every root empty before adding ownership', () => {
    expect(source).toContain('IN ACCESS EXCLUSIVE MODE');
    expect(source).toContain('SELECT EXISTS (SELECT 1 FROM public.${table} LIMIT 1)');
    expect(source).toContain('ROOT_OPERATIONAL_OWNERSHIP_REQUIRES_EMPTY_');
    expect(source.indexOf('await assertEmptyRoot')).toBeLessThan(
      source.indexOf("await queryInterface.addColumn")
    );
    for (const table of [
      'aircraft',
      'customers',
      'serialized_components',
      'planning_sessions',
      'workpacks',
    ]) {
      expect(source).toContain(`'${table}'`);
    }
  });

  it('creates the exact normalized tenant-scoped uniqueness and nonblank checks', () => {
    expect(source).toContain(
      'ON public.aircraft (tenant_id, upper(btrim(registration)))'
    );
    expect(source).toContain(
      'ON public.customers (tenant_id, upper(btrim(account_reference)))'
    );
    expect(source).toContain(
      "WHERE account_reference IS NOT NULL AND btrim(account_reference) <> ''"
    );
    expect(source).toContain(
      'ON public.workpacks (tenant_id, upper(btrim(work_order_number)))'
    );
    expect(source).toContain(
      '(custodian_tenant_id, component_model_id, upper(btrim(serial_number)))'
    );
    expect(source).toContain('aircraft_registration_nonblank_check');
    expect(source).toContain('customers_account_reference_nonblank_check');
    expect(source).toContain('workpacks_work_order_number_nonblank_check');
    expect(source).toContain('serialized_components_serial_number_nonblank_check');
  });

  it('intentionally replaces and safely restores the legacy global uniqueness', () => {
    expect(source).toContain("removeConstraint('aircraft', 'aircraft_registration_key'");
    expect(source).toContain("removeIndex('customers', 'customers_account_reference_unique'");
    expect(source).toContain(
      "removeConstraint('workpacks', 'workpacks_work_order_number_key'"
    );
    expect(source).toContain('ROOT_OPERATIONAL_OWNERSHIP_DOWN_GLOBAL_UNIQUENESS_CONFLICT_');
    expect(source).toContain("name: 'aircraft_registration_key'");
    expect(source).toContain('CREATE UNIQUE INDEX customers_account_reference_unique');
    expect(source).toContain("name: 'workpacks_work_order_number_key'");
  });

  it('guards every DOWN root before uniqueness checks or destructive DDL', () => {
    const downSource = source.slice(source.indexOf('async down(queryInterface'));
    const guard = downSource.indexOf('await assertEmptyRootForDown');

    expect(downSource).toContain('for (const table of ROOT_TABLES)');
    expect(source).toContain('ROOT_OPERATIONAL_OWNERSHIP_DOWN_REQUIRES_EMPTY_');
    expect(guard).toBeGreaterThan(downSource.indexOf('IN ACCESS EXCLUSIVE MODE'));
    expect(guard).toBeLessThan(downSource.indexOf('const duplicateChecks'));
    expect(guard).toBeLessThan(downSource.indexOf('DROP TRIGGER IF EXISTS'));
    expect(guard).toBeLessThan(downSource.indexOf("removeColumn('aircraft'"));
  });

  it('fails a non-empty DOWN without removing any migration object', async () => {
    const transaction = {};
    const query = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ has_rows: true }]);
    const queryInterface = {
      sequelize: {
        query,
        transaction: vi.fn(async callback => callback(transaction)),
      },
      removeColumn: vi.fn(),
      addConstraint: vi.fn(),
    };

    await expect(migration.down(queryInterface as never)).rejects.toThrow(
      'ROOT_OPERATIONAL_OWNERSHIP_DOWN_REQUIRES_EMPTY_AIRCRAFT'
    );
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls.flat().join('\n')).not.toMatch(
      /DROP TRIGGER|DROP FUNCTION|DROP INDEX|ALTER TABLE|CREATE UNIQUE INDEX/
    );
    expect(queryInterface.removeColumn).not.toHaveBeenCalled();
    expect(queryInterface.addConstraint).not.toHaveBeenCalled();
  });

  it('prevents mutation of every ownership field', () => {
    expect(source).toContain('ROOT_OPERATIONAL_TENANT_OWNERSHIP_IMMUTABLE');
    expect(source).toContain("['aircraft', 'tr_aircraft_tenant_immutable', 'tenant_id']");
    expect(source).toContain("['customers', 'tr_customers_tenant_immutable', 'tenant_id']");
    expect(source).toContain('tr_serialized_components_custodian_tenant_immutable');
    expect(source).toContain("['planning_sessions', 'tr_planning_sessions_tenant_immutable'");
    expect(source).toContain("['workpacks', 'tr_workpacks_tenant_immutable', 'tenant_id']");
    expect(source).toContain('BEFORE UPDATE ON public.${table}');
  });

  it('reverses only migration-590 objects and excludes shared authorities', () => {
    for (const table of [
      'manufacturers',
      'manufacturer_source_names',
      'component_models',
      'airworthiness_directives',
      'service_bulletins',
      'supplemental_inspection_documents',
      'users',
      'rf_role',
      'rf_permission',
    ]) {
      expect(source).not.toContain(`addColumn('${table}'`);
      expect(source).not.toContain(`removeColumn('${table}'`);
    }
    expect(source.match(/removeColumn\(/g)).toHaveLength(5);
    expect(source).not.toMatch(/SequelizeMeta|bulkInsert|INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM/i);
  });
});
