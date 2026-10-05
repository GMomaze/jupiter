import { describe, expect, it, vi } from 'vitest';
import migration from '../../../migrations/586_create_manufacturer_source_names.js';

function queryInterfaceHarness() {
  const created: { table?: string; columns?: Record<string, any> } = {};
  const sql: string[] = [];
  const queryInterface = {
    describeTable: vi.fn(async (table: string) => {
      if (table === 'manufacturers') return { id: {} };
      return null;
    }),
    createTable: vi.fn(async (table: string, columns: Record<string, any>) => {
      created.table = table;
      created.columns = columns;
    }),
    dropTable: vi.fn(async () => undefined),
    sequelize: {
      query: vi.fn(async (statement: string) => {
        sql.push(statement);
        return [];
      }),
    },
  };
  return { queryInterface, created, sql };
}

describe('migration 586 manufacturer source-name schema', () => {
  it('creates the exact generic table, FK, defaults, constraints, and indexes', async () => {
    const { queryInterface, created, sql } = queryInterfaceHarness();

    await migration.up(queryInterface as any);

    expect(created.table).toBe('manufacturer_source_names');
    expect(Object.keys(created.columns || {})).toEqual([
      'id',
      'manufacturer_id',
      'source_type',
      'source_name',
      'normalized_source_name',
      'is_active',
      'created_at',
      'updated_at',
    ]);
    expect(created.columns?.manufacturer_id).toEqual(
      expect.objectContaining({
        allowNull: false,
        references: { model: 'manufacturers', key: 'id' },
        onUpdate: 'NO ACTION',
        onDelete: 'RESTRICT',
      })
    );
    expect(created.columns?.is_active).toEqual(
      expect.objectContaining({ allowNull: false, defaultValue: true })
    );

    const definition = sql.join('\n');
    expect(definition).toContain("CHECK (source_type IN ('FAA_AD'))");
    expect(definition).toContain('CHECK (length(trim(source_name)) > 0)');
    expect(definition).toContain('CHECK (length(normalized_source_name) > 0)');
    expect(definition).toContain('manufacturer_source_names_normalization_check');
    expect(definition).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS manufacturer_source_names_source_identity_unique\s+ON public\.manufacturer_source_names \(source_type, normalized_source_name\)/
    );
    expect(definition).toMatch(
      /manufacturer_source_names_administration_index\s+ON public\.manufacturer_source_names \(manufacturer_id, source_type, is_active\)/
    );
    expect(definition).not.toMatch(/WHERE\s+is_active/i);
  });

  it('contains no data insertion or manufacturer-specific schema logic', async () => {
    const { queryInterface, sql } = queryInterfaceHarness();

    await migration.up(queryInterface as any);

    const definition = sql.join('\n');
    expect(definition).not.toMatch(/\bINSERT\b/i);
    expect(definition).not.toMatch(/CESSNA|BEECHCRAFT|PIPER|LYCOMING|HARTZELL/i);
  });

  it('permits many different source identities for one manufacturer while preventing global source ambiguity', async () => {
    const { queryInterface, sql } = queryInterfaceHarness();

    await migration.up(queryInterface as any);

    const definition = sql.join('\n');
    expect(definition).toContain('(source_type, normalized_source_name)');
    expect(definition).not.toContain('(manufacturer_id, source_type, normalized_source_name)');
  });
});
