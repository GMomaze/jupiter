import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(process.cwd(), 'migrations/587_create_tenants.ts');
const source = fs.readFileSync(migrationPath, 'utf8');

describe('migration 587 tenant foundation source contract', () => {
  it('creates the exact tenant foundation with uniqueness, lifecycle, and actor restrictions', () => {
    expect(path.basename(migrationPath)).toBe('587_create_tenants.ts');
    expect(source).toContain("const TABLE = 'tenants'");
    expect(source).toContain('tenants_public_id_unique UNIQUE (public_id)');
    expect(source).toContain('tenants_code_unique UNIQUE (code)');
    expect(source).toContain('tenants_code_format_check');
    expect(source).toContain('tenants_suspension_metadata_shape_check');
    expect(source).toContain('tenants_archive_state_check');
    expect(source).toContain('tenants_suspension_date_check');
    expect(source).toContain('tenants_archive_date_check');
    expect((source.match(/onUpdate: 'RESTRICT'/g) ?? [])).toHaveLength(3);
    expect((source.match(/onDelete: 'RESTRICT'/g) ?? [])).toHaveLength(3);
  });

  it('protects id and public_id but deliberately excludes code from permanent DB identity', () => {
    const functionBody = source.match(/CREATE FUNCTION public\.fn_tenants_preserve_identity\(\)([\s\S]*?)\$function\$;/)?.[1] ?? '';
    expect(functionBody).toContain('NEW.id IS DISTINCT FROM OLD.id');
    expect(functionBody).toContain('NEW.public_id IS DISTINCT FROM OLD.public_id');
    expect(functionBody).not.toMatch(/NEW\.code|OLD\.code/);
  });

  it('contains no seed, conversion, tenant propagation, RBAC, grant, or RLS behavior', () => {
    expect(source).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(source).not.toMatch(/\btenant_id\b/i);
    expect(source).not.toMatch(/\bCREATE\s+(POLICY|ROLE)\b|\bENABLE\s+ROW\s+LEVEL\s+SECURITY\b|\bGRANT\b/i);
    expect(source).not.toMatch(/customers|aircraft|serialized_components|workpacks|compliance/i);
    expect(source).not.toMatch(/user_roles|rf_role|rf_permission|sessions/i);
  });

  it('down removes only the MT-1 table, trigger, and function', () => {
    const down = source.slice(source.indexOf('async down'));
    expect(down).toContain('tr_tenants_preserve_identity');
    expect(down).toContain('dropTable(TABLE');
    expect(down).toContain('fn_tenants_preserve_identity');
    expect(down).not.toMatch(/dropTable\(['"](?!tenants)/);
  });
});
