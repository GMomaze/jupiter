import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('migrations/595_add_legacy_component_custody_and_movement_history.ts', 'utf8');
const privilegeRepair = readFileSync('migrations/596_restrict_legacy_component_history_runtime_privileges.ts', 'utf8');
const componentModel = readFileSync('src/models/core/AircraftComponent.ts', 'utf8');
const historyModel = readFileSync('src/models/AircraftComponentMovementHistory.ts', 'utf8');

describe('MT-4C6B1 legacy component custody and history foundation', () => {
  it('performs a fail-closed deterministic custody backfill before NOT NULL', () => {
    expect(migration).toMatch(/ADD COLUMN custodian_tenant_id UUID;[\s\S]*SET custodian_tenant_id = aircraft\.tenant_id[\s\S]*CUSTODY_BACKFILL_UNRESOLVED[\s\S]*ALTER COLUMN custodian_tenant_id SET NOT NULL/);
    expect(migration).toContain('MIGRATION_595_DUPLICATE_COMPONENT_IDENTITY');
    expect(migration).toContain('aircraft_components_tenant_model_serial_normalized_unique');
  });

  it('enforces immutable custody and an Aircraft tenant match in the database', () => {
    expect(migration).toContain('AIRCRAFT_COMPONENT_CUSTODY_IMMUTABLE');
    expect(migration).toContain('AIRCRAFT_COMPONENT_CUSTODY_AIRCRAFT_TENANT_MISMATCH');
    expect(migration).toContain('BEFORE INSERT OR UPDATE OF custodian_tenant_id, aircraft_id, current_status');
    expect(componentModel).toContain('declare readonly custodian_tenant_id: string');
    expect(componentModel).toContain("references: { model: 'tenants', key: 'id' }");
  });

  it('creates a constrained immutable event-time history authority without retrospective rows', () => {
    expect(migration).toContain('CREATE TABLE public.${HISTORY_TABLE}');
    expect(migration).toContain("action_type IN ('INSTALLATION', 'REMOVAL')");
    expect(migration).toContain('aircraft_component_movement_direction_check');
    expect(migration).toContain('AIRCRAFT_COMPONENT_MOVEMENT_HISTORY_IMMUTABLE');
    expect(migration).not.toMatch(/INSERT INTO public\.\$\{HISTORY_TABLE\}/);
    expect(historyModel).toContain("tableName: 'aircraft_component_movement_history'");
  });

  it('grants only read and append privileges to runtime roles', () => {
    expect(migration).toContain('REVOKE ALL ON TABLE public.${HISTORY_TABLE} FROM PUBLIC');
    expect(migration).toContain('GRANT SELECT, INSERT ON TABLE public.${HISTORY_TABLE} TO jupiter_app, jupiter_test');
    expect(privilegeRepair).toContain('REVOKE UPDATE, DELETE ON TABLE public.${TABLE} FROM jupiter_app, jupiter_test');
    expect(privilegeRepair).toContain('GRANT SELECT, INSERT ON TABLE public.${TABLE} TO jupiter_app, jupiter_test');
  });

  it('keeps rollback fail-closed for populated custody/history data', () => {
    expect(migration).toContain('MIGRATION_595_POPULATED_DATA_PREVENTS_ROLLBACK');
  });
});
