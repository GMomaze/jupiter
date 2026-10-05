import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { pool } from '../../config/database.js';
import { assertTestDatabaseSafety } from '../../config/testDatabaseSafety.js';
import {
  Aircraft,
  AircraftCategory,
  AircraftComponent,
  AircraftComponentMovementHistory,
  AssetType,
  ComponentModel,
  Manufacturer,
  Tenant,
  User,
  sequelize,
} from '../../models/index.js';

let user: User;
let tenantA: Tenant;
let tenantB: Tenant;
let aircraftA: Aircraft;
let aircraftB: Aircraft;
let component: AircraftComponent;
let movement: AircraftComponentMovementHistory;
let nonVerificationHistoryCount = -1;

beforeAll(async () => {
  await assertTestDatabaseSafety(pool);
  nonVerificationHistoryCount = Number((await pool.query(
    `SELECT COUNT(*) AS count FROM aircraft_component_movement_history
      WHERE remarks IS DISTINCT FROM 'C6B1 verification'`,
  )).rows[0]?.count ?? -1);
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  user = await User.create({ email: `c6b1-${suffix}@example.test`, password_hash: 'test', full_name: 'C6B1', is_active: true });
  tenantA = await Tenant.create({ code: `C6A_${suffix}`, display_name: 'C6 A', status: 'ACTIVE', created_by_user_id: user.id, updated_by_user_id: user.id });
  tenantB = await Tenant.create({ code: `C6B_${suffix}`, display_name: 'C6 B', status: 'ACTIVE', created_by_user_id: user.id, updated_by_user_id: user.id });
  const manufacturer = await Manufacturer.create({ code: `C6M_${suffix}`, name: `C6 Manufacturer ${suffix}`, is_active: true });
  const assetType = await AssetType.create({ code: `C6T_${suffix}`, label: 'C6 type', is_active: true });
  const category = await AircraftCategory.create({ code: `C6C_${suffix}`, label: 'C6 category', is_active: true });
  const model = await ComponentModel.create({ model_name: 'C6 model', model_code: `C6MOD_${suffix}`, manufacturer_id: manufacturer.id, asset_type_id: assetType.id, is_active: true });
  aircraftA = await Aircraft.create({ tenant_id: tenantA.id, registration: `C6-A-${suffix}`, serial_number: `C6-A-${suffix}`, model_id: model.id, category_id: category.id, status: 'ACTIVE' });
  aircraftB = await Aircraft.create({ tenant_id: tenantB.id, registration: `C6-B-${suffix}`, serial_number: `C6-B-${suffix}`, model_id: model.id, category_id: category.id, status: 'ACTIVE' });
  component = await AircraftComponent.create({ custodian_tenant_id: tenantA.id, aircraft_id: aircraftA.id, model_id: model.id, serial_number: `C6-${suffix}`, installation_date: '2026-09-06', install_af_hours: 0, tso_at_install: 0, tsn_at_install: 0, current_status: 'INSTALLED', version: 0 });
  movement = await AircraftComponentMovementHistory.create({ aircraft_component_id: component.id, tenant_id: tenantA.id, action_type: 'INSTALLATION', source_aircraft_id: null, target_aircraft_id: aircraftA.id, actor_id: user.id, occurred_at: new Date(), aircraft_hours: 0, remarks: 'C6B1 verification' });
});

describe('MT-4C6B1 guarded custody and immutable history foundation', () => {
  it('has a complete deterministic backfill and no fabricated retrospective movement rows', async () => {
    const unresolved = await pool.query(`SELECT COUNT(*) AS count
      FROM aircraft_components component
      JOIN aircraft ON aircraft.id = component.aircraft_id
      WHERE component.custodian_tenant_id IS NULL
         OR component.custodian_tenant_id <> aircraft.tenant_id`);
    expect(Number(unresolved.rows[0]?.count)).toBe(0);
    expect(nonVerificationHistoryCount).toBe(0);
  });

  it('has the required NOT NULL, FK, indexes, triggers, and migration head', async () => {
    const column = await pool.query(`SELECT is_nullable, udt_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='aircraft_components' AND column_name='custodian_tenant_id'`);
    expect(column.rows[0]).toMatchObject({ is_nullable: 'NO', udt_name: 'uuid' });
    const objects = await pool.query(`SELECT
      to_regclass('public.aircraft_components_custodian_tenant_id_index') IS NOT NULL AS custody_index,
      to_regclass('public.aircraft_components_tenant_model_serial_normalized_unique') IS NOT NULL AS identity_index,
      to_regclass('public.aircraft_component_movement_history') IS NOT NULL AS history_table,
      EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='tr_aircraft_component_custody' AND NOT tgisinternal) AS custody_trigger,
      EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='tr_aircraft_component_movement_immutable' AND NOT tgisinternal) AS history_trigger,
      EXISTS (SELECT 1 FROM "SequelizeMeta" WHERE name LIKE '595_add_legacy_component_custody_and_movement_history%') AS migration_head`);
    expect(objects.rows[0]).toEqual({ custody_index: true, identity_index: true, history_table: true, custody_trigger: true, history_trigger: true, migration_head: true });
  });

  it('rejects custody mutation and a mismatched Aircraft/custody root', async () => {
    const mutation = await sequelize.transaction();
    await expect(AircraftComponent.update(
      { custodian_tenant_id: tenantB.id },
      { where: { id: component.id }, transaction: mutation },
    )).rejects.toThrow();
    await mutation.rollback();
    await expect(AircraftComponent.create({ custodian_tenant_id: tenantA.id, aircraft_id: aircraftB.id, model_id: component.model_id, serial_number: randomUUID(), installation_date: '2026-09-06', install_af_hours: 0, tso_at_install: 0, tsn_at_install: 0, current_status: 'INSTALLED', version: 0 })).rejects.toThrow();
  });

  it('enforces movement action/direction checks and immutable history', async () => {
    await expect(AircraftComponentMovementHistory.create({ aircraft_component_id: component.id, tenant_id: tenantA.id, action_type: 'REMOVAL', source_aircraft_id: null, target_aircraft_id: aircraftA.id, actor_id: user.id, occurred_at: new Date() })).rejects.toThrow();
    await expect(AircraftComponentMovementHistory.create({ aircraft_component_id: component.id, tenant_id: tenantA.id, action_type: 'TRANSFER' as never, source_aircraft_id: aircraftA.id, target_aircraft_id: aircraftB.id, actor_id: user.id, occurred_at: new Date() })).rejects.toThrow();
    await expect(AircraftComponentMovementHistory.update({ remarks: 'changed' }, { where: { id: movement.id } })).rejects.toThrow();
    expect((await movement.reload()).remarks).toBe('C6B1 verification');
  });

  it('grants jupiter_app only SELECT and INSERT on movement history', async () => {
    const privileges = await pool.query(`SELECT
      has_table_privilege('jupiter_app','public.aircraft_component_movement_history','SELECT') AS can_select,
      has_table_privilege('jupiter_app','public.aircraft_component_movement_history','INSERT') AS can_insert,
      has_table_privilege('jupiter_app','public.aircraft_component_movement_history','UPDATE') AS can_update,
      has_table_privilege('jupiter_app','public.aircraft_component_movement_history','DELETE') AS can_delete`);
    expect(privileges.rows[0]).toEqual({ can_select: true, can_insert: true, can_update: false, can_delete: false });
  });
});
