import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Mt4c3a7LiveDependencies, Mt4c3a7RunState } from './mt4c3a7LiveScenario.js';
import { verifyRepositoryMigrationLedger } from './migrationLedgerComparison.js';

const REQUIRED_HASH = 'BD7A301AEDC28C3D6B1ACFB179D3F5048BF721399B84FBAC3D4511E361F43EDB';
function ok(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`MT4C3A7_VERIFY: ${message}`);
}

function verifyGateSource(): void {
  const appSource = readFileSync('src/app.ts', 'utf8');
  ok(!/app\.use\([^\n]*requireValidActiveTenantContext/.test(appSource), 'GLOBAL_TENANT_GATE');
}

export async function createProductionMt4c3a7Dependencies(): Promise<Mt4c3a7LiveDependencies> {
  await import('../../src/config/environment.js');
  const { Op } = await import('sequelize');
  const { resolveMigrationHost } = await import('../../src/config/migrationSafety.js');
  const { sequelize, Aircraft, Customer, AuditLog } = await import('../../src/models/index.js');
  const { createTenantQueryAuthority, assertTenantQueryAuthority } =
    await import('../../src/modules/tenancy/tenant-query-authority.js');
  const { AircraftService } = await import('../../src/modules/aircraft/aircraft.service.js');
  const { aircraftTenantRepository } =
    await import('../../src/modules/aircraft/aircraft-tenant.repository.live.js');
  const { CustomersService } = await import('../../src/modules/customers/customers.service.js');
  const { customerTenantRepository } =
    await import('../../src/modules/customers/customer-tenant.repository.live.js');

  const query = (sql: string, replacements: Record<string, unknown> = {}) =>
    sequelize.query(sql, { replacements });
  const runtime = new Map<string, any>();
  const short = (state: Mt4c3a7RunState) => state.correlationId.replaceAll('-', '').slice(0, 8).toUpperCase();
  const letters = (state: Mt4c3a7RunState) => short(state).slice(0, 3).split('').map((c) => String.fromCharCode(65 + (parseInt(c, 16) % 26))).join('');
  const customerPayload = (state: Mt4c3a7RunState, name: string) => ({
    name, contact_person: `Contact ${short(state)}`,
    email: `${name.replaceAll(' ', '-').toLowerCase()}@example.test`,
    phone: '+27000000000', status: 'ACTIVE', account_reference: ` REF-${short(state)} `,
  });

  return {
    async preflight(state) {
      const env = process.env;
      verifyGateSource();
      ok(env.DB_HOST === '127.0.0.1' && env.DB_PORT === '5432' && env.DB_NAME === 'jupiter_test' && env.DB_USER === 'jupiter_test', 'CONFIG_TARGET');
      ok(JSON.stringify(await resolveMigrationHost(env.DB_HOST)) === '["127.0.0.1"]', 'LITERAL_IP');
      const identity = (await query("SELECT current_database() database_name,current_user,session_user,host(inet_server_addr()) server_address,inet_server_port() server_port,current_setting('transaction_read_only') transaction_read_only"))[0][0] as any;
      ok(identity.database_name === 'jupiter_test' && identity.current_user === 'jupiter_test' && identity.session_user === 'jupiter_test' && identity.server_address === '127.0.0.1' && identity.server_port === 5432 && identity.transaction_read_only === 'off', 'LIVE_IDENTITY');
      const ledger = ((await query('SELECT name FROM "SequelizeMeta" ORDER BY name'))[0] as any[]).map((row) => row.name);
      const comparison = verifyRepositoryMigrationLedger(ledger);
      ok(comparison.files.length === 104 && comparison.files.filter((name) => name.startsWith('590_')).length === 1, 'LEDGER');
      const hash = createHash('sha256').update(readFileSync('migrations/590_add_root_operational_tenant_ownership.ts')).digest('hex').toUpperCase();
      ok(hash === REQUIRED_HASH && !comparison.files.some((name) => name.startsWith('591_')), 'MIGRATION_LINEAGE');
      const rls = Number(((await query("SELECT count(*)::int count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relrowsecurity AND n.nspname NOT IN ('pg_catalog','information_schema')"))[0][0] as any).count);
      ok(rls === 0, 'RLS');
      runtime.set('startedAt', new Date()); runtime.set('state', state);
    },
    async createTenantFixtures(state) {
      const user = (await query('SELECT id FROM users ORDER BY id LIMIT 1'))[0][0] as any;
      const model = (await query('SELECT id FROM component_models ORDER BY id LIMIT 1'))[0][0] as any;
      const category = (await query('SELECT id FROM rf_aircraft_category ORDER BY id LIMIT 1'))[0][0] as any;
      ok(user && model && category, 'REFERENCE_FIXTURES'); runtime.set('user', user.id); runtime.set('model', model.id); runtime.set('category', category.id);
      for (const [id, publicId, code] of [[state.tenantA, state.tenantAPublic, `MT4A_${short(state)}`], [state.tenantB, state.tenantBPublic, `MT4B_${short(state)}`]]) {
        await query("INSERT INTO tenants (id,public_id,code,display_name,status,created_by_user_id,updated_by_user_id) VALUES (:id,:publicId,:code,:code,'ACTIVE',:user,:user)", { id, publicId, code, user: user.id });
        state.createdFixtureIds.push(id);
      }
      for (const [id, tenant] of [[state.membershipA, state.tenantA], [state.membershipB, state.tenantB]]) {
        await query("INSERT INTO tenant_memberships (id,tenant_id,user_id,status,joined_at,created_by_user_id,updated_by_user_id) VALUES (:id,:tenant,:user,'ACTIVE',CURRENT_TIMESTAMP,:user,:user)", { id, tenant, user: user.id });
        state.createdFixtureIds.push(id);
      }
    },
    async verifyAuthorities(state) {
      const context = (tenantId: string, publicId: string, membershipId: string) => ({ state: 'VALID_ACTIVE_TENANT', tenant: { id: tenantId, publicId, code: `T_${short(state)}`, displayName: 'MT4', status: 'ACTIVE' }, membership: { id: membershipId, tenantId, userId: runtime.get('user'), status: 'ACTIVE' }, validatedAt: Date.now() }) as any;
      const a = createTenantQueryAuthority(context(state.tenantA, state.tenantAPublic, state.membershipA)); const b = createTenantQueryAuthority(context(state.tenantB, state.tenantBPublic, state.membershipB));
      assertTenantQueryAuthority(a); assertTenantQueryAuthority(b); ok(Object.isFrozen(a) && Object.isFrozen(b) && a !== b, 'AUTHORITY');
      for (const value of [undefined, Object.freeze({ tenantId: state.tenantA }), { tenantId: state.tenantA, roles: ['ADMIN'] }]) { let rejected = false; try { assertTenantQueryAuthority(value); } catch (error: any) { rejected = error.message === 'TENANT_AUTHORITY_REQUIRED'; } ok(rejected, 'FORGED_AUTHORITY'); }
      for (const repository of [aircraftTenantRepository, customerTenantRepository]) { let rejected = false; try { await repository.getById(Object.freeze({ tenantId: state.tenantA }) as any, state.nonexistentAircraft); } catch (error: any) { rejected = error.message === 'TENANT_AUTHORITY_REQUIRED'; } ok(rejected, 'REPOSITORY_FORGED_AUTHORITY'); }
      runtime.set('authorityA', a); runtime.set('authorityB', b);
    },
    async verifyAircraftScenario(state) {
      const a = runtime.get('authorityA'), b = runtime.get('authorityB'), suffix = letters(state); const regA = `ZS-${suffix}`, regB = `ZU-${suffix}`;
      const acA = await AircraftService.create(a, { registration: regA, serial_number: `SN-A-${short(state)}`, model_id: runtime.get('model'), category_id: runtime.get('category') }); const acB = await AircraftService.create(b, { registration: regB, serial_number: `SN-B-${short(state)}`, model_id: runtime.get('model'), category_id: runtime.get('category') });
      state.aircraftA = acA.id; state.aircraftB = acB.id; runtime.set('aircraftA', acA); runtime.set('aircraftB', acB); runtime.set('regA', regA); runtime.set('regB', regB);
      ok(acA.tenant_id === state.tenantA && acB.tenant_id === state.tenantB, 'AIRCRAFT_OWNERSHIP');
      ok((await AircraftService.getById(a, acA.id))?.id === acA.id && (await AircraftService.getById(b, acB.id))?.id === acB.id, 'AIRCRAFT_OWN_READ');
      ok(await AircraftService.getById(a, acB.id) === undefined && await AircraftService.getById(a, state.nonexistentAircraft) === undefined, 'AIRCRAFT_FOREIGN');
      ok((await AircraftService.getByRegistration(a, regA))?.id === acA.id && await AircraftService.getByRegistration(a, regB) === undefined, 'REGISTRATION');
      const listA = await aircraftTenantRepository.list(a), listB = await aircraftTenantRepository.list(b); ok(listA.some((x) => x.id === acA.id) && !listA.some((x) => x.id === acB.id) && listB.some((x) => x.id === acB.id) && !listB.some((x) => x.id === acA.id), 'AIRCRAFT_LIST');
      runtime.set('counts', { a: await aircraftTenantRepository.count(a), b: await aircraftTenantRepository.count(b) });
    },
    async verifyCustomerScenario(state) {
      const a = runtime.get('authorityA'), b = runtime.get('authorityB'); const cuA = await CustomersService.createCustomer(a, customerPayload(state, `Customer A ${short(state)}`)); const cuB = await CustomersService.createCustomer(b, { ...customerPayload(state, `Customer B ${short(state)}`), account_reference: `ref-${short(state)}` }); state.customerA = cuA.id; state.customerB = cuB.id;
      ok(cuA.tenant_id === state.tenantA && cuB.tenant_id === state.tenantB, 'CUSTOMER_OWNERSHIP'); ok((await customerTenantRepository.getById(a, cuA.id))?.id === cuA.id && await customerTenantRepository.getById(a, cuB.id) === undefined && await customerTenantRepository.getById(a, state.nonexistentCustomer) === undefined, 'CUSTOMER_READS');
      const la = await CustomersService.listCustomers(a), lb = await CustomersService.listCustomers(b), aa = await CustomersService.getActiveCustomers(a), ab = await CustomersService.getActiveCustomers(b); ok(la.some((x: any) => x.id === cuA.id) && !la.some((x: any) => x.id === cuB.id) && lb.some((x: any) => x.id === cuB.id) && aa.some((x: any) => x.id === cuA.id) && ab.some((x: any) => x.id === cuB.id), 'CUSTOMER_LIST');
      let duplicate = false; try { await CustomersService.createCustomer(a, { ...customerPayload(state, 'Duplicate'), account_reference: `ref-${short(state)}` }); } catch { duplicate = true; } ok(duplicate, 'CUSTOMER_DUPLICATE');
    },
    async verifyRelationshipScenario(state) {
      const a = runtime.get('authorityA'), b = runtime.get('authorityB'); const link = await CustomersService.assignAircraftToCustomer(a, { customer_id: state.customerA!, aircraft_id: state.aircraftA!, relationship_type: 'OWNER', start_date: new Date().toISOString().slice(0, 10), notes: state.correlationId }); state.relationship = link.id;
      for (const [authority, customer, aircraft] of [[a, state.customerA, state.aircraftB], [b, state.customerB, state.aircraftA]]) { let message = ''; try { await CustomersService.assignAircraftToCustomer(authority, { customer_id: customer!, aircraft_id: aircraft!, relationship_type: 'OWNER', start_date: '2026-09-01' }); } catch (error: any) { message = error.message; } ok(message === 'TENANT_RESOURCE_UNAVAILABLE', 'CROSS_RELATIONSHIP'); }
      const projection = await CustomersService.getCustomerOrThrow(a, state.customerA!); ok(projection.links.some((item: any) => item.id === link.id) && projection.links.every((item: any) => item.aircraft_id === state.aircraftA), 'RELATIONSHIP_PROJECTION');
    },
    async verifyUpdateScenario(state) {
      const a = runtime.get('authorityA'); const updatedCustomer = await CustomersService.updateCustomer(a, state.customerA!, { ...customerPayload(state, `Customer A Updated ${short(state)}`), notes: state.correlationId }); ok(updatedCustomer.tenant_id === state.tenantA, 'CUSTOMER_UPDATE');
      for (const id of [state.customerB!, state.nonexistentCustomer]) { let message = ''; try { await CustomersService.updateCustomer(a, id, customerPayload(state, 'Unavailable')); } catch (error: any) { message = error.message; } ok(message === 'CUSTOMER_NOT_FOUND', 'CUSTOMER_UPDATE_NEUTRAL'); }
      const acA = runtime.get('aircraftA'); const updated = await AircraftService.updateDetails(a, state.aircraftA!, { registration: runtime.get('regA'), serial_number: `SN-AU-${short(state)}`, model_id: runtime.get('model'), category_id: runtime.get('category'), total_time_hours: 0, total_time_cycles: 0, version: acA.version, tcds_number: `TCDS-${short(state)}` }); ok(updated.tenant_id === state.tenantA, 'AIRCRAFT_UPDATE'); runtime.set('updatedAircraft', updated);
      for (const id of [state.aircraftB!, state.nonexistentAircraft]) { let message = ''; try { await AircraftService.updateDetails(a, id, { registration: runtime.get('regB'), serial_number: `NO-${short(state)}`, model_id: runtime.get('model'), category_id: runtime.get('category'), version: 0 }); } catch (error: any) { message = error.message; } ok(message === 'AIRCRAFT_NOT_FOUND', 'AIRCRAFT_UPDATE_NEUTRAL'); }
    },
    async verifyLifecycleScenario(state) {
      const a = runtime.get('authorityA'), before = runtime.get('updatedAircraft'), reason = `MT-4C3A7 ${state.correlationId}`; const active = await AircraftService.activate(a, state.aircraftA!, reason); ok(active.status === 'ACTIVE' && active.tenant_id === state.tenantA && active.version === before.version + 1, 'LIFECYCLE');
      for (const id of [state.aircraftB!, state.nonexistentAircraft]) { let message = ''; try { await AircraftService.activate(a, id, reason); } catch (error: any) { message = error.message; } ok(message === 'AIRCRAFT_NOT_FOUND', 'LIFECYCLE_NEUTRAL'); } runtime.set('reason', reason);
    },
    async verifyOwnershipAndAdmin(state) {
      const a = runtime.get('authorityA'); let aircraftRejected = false, customerRejected = false; try { await aircraftTenantRepository.create(a, { tenant_id: state.tenantB, registration: `ZT-${letters(state)}`, serial_number: `OV-${short(state)}`, model_id: runtime.get('model'), category_id: runtime.get('category') } as any); } catch (error: any) { aircraftRejected = error.message === 'TENANT_QUERY_FAILED'; } try { await customerTenantRepository.create(a, { tenant_id: state.tenantB, ...customerPayload(state, 'Override') } as any); } catch (error: any) { customerRejected = error.message === 'TENANT_QUERY_FAILED'; } ok(aircraftRejected && customerRejected, 'APPLICATION_OWNERSHIP');
      let trigger = ''; try { await sequelize.transaction(async (transaction) => { await sequelize.query('UPDATE aircraft SET tenant_id=:tenant WHERE id=:id', { replacements: { tenant: state.tenantB, id: state.aircraftA }, transaction }); }); } catch (error: any) { trigger = error.parent?.message ?? error.message; } ok(trigger.includes('ROOT_OPERATIONAL_TENANT_OWNERSHIP_IMMUTABLE'), 'DB_TRIGGER'); ok((await Aircraft.findByPk(state.aircraftA!))?.tenant_id === state.tenantA, 'DB_TRIGGER_PRESERVED');
    },
    async verifyAuditAccounting(state) {
      const rows = await AuditLog.findAll({ where: { row_id: [state.aircraftA, state.aircraftB, state.customerA, state.customerB, state.relationship], created_at: { [Op.gte]: runtime.get('startedAt') } }, order: [['created_at', 'ASC']] });
      const actual = rows.map((row: any) => `${row.table_name}:${row.row_id}:${row.action}`).sort();
      const expected = [`aircraft:${state.aircraftA}:CREATE`, `aircraft:${state.aircraftB}:CREATE`, `customers:${state.customerA}:CREATE`, `customers:${state.customerB}:CREATE`, `customer_aircraft_links:${state.relationship}:CREATE`, `customers:${state.customerA}:UPDATE`, `aircraft:${state.aircraftA}:UPDATE`, `aircraft:${state.aircraftA}:STATUS_CHANGE`].sort();
      ok(JSON.stringify(actual) === JSON.stringify(expected), `AUDIT_CLASSIFICATION_${rows.length}`); state.immutableAuditIds.push(...rows.map((row: any) => row.id)); const lifecycle = rows.find((row: any) => row.action === 'STATUS_CHANGE' && row.row_id === state.aircraftA); ok(lifecycle?.reason === runtime.get('reason') && lifecycle.old_values?.status === 'REGISTERED' && lifecycle.new_values?.status === 'ACTIVE', 'LIFECYCLE_AUDIT');
    },
    async cleanupExactMutableFixtures(state) {
      if (state.relationship) await query('DELETE FROM customer_aircraft_links WHERE id=:id', { id: state.relationship });
      if (state.aircraftA) await query('DELETE FROM aircraft WHERE id=:id', { id: state.aircraftA }); if (state.aircraftB) await query('DELETE FROM aircraft WHERE id=:id', { id: state.aircraftB });
      if (state.customerA) await query('DELETE FROM customers WHERE id=:id', { id: state.customerA }); if (state.customerB) await query('DELETE FROM customers WHERE id=:id', { id: state.customerB });
      for (const id of [state.membershipA, state.membershipB]) if (state.createdFixtureIds.includes(id)) await query('DELETE FROM tenant_memberships WHERE id=:id', { id });
      for (const id of [state.tenantA, state.tenantB]) if (state.createdFixtureIds.includes(id)) await query('DELETE FROM tenants WHERE id=:id', { id });
    },
    async verifyFinalState(state) {
      for (const [table, ids] of [['customer_aircraft_links', [state.relationship]], ['aircraft', [state.aircraftA, state.aircraftB]], ['customers', [state.customerA, state.customerB]], ['tenant_memberships', [state.membershipA, state.membershipB]], ['tenants', [state.tenantA, state.tenantB]]] as const) { for (const id of ids.filter(Boolean)) { const count = Number(((await query(`SELECT count(*) count FROM ${table} WHERE id=:id`, { id }))[0][0] as any).count); ok(count === 0, `RESIDUE_${table}`); } }
      verifyGateSource();
      const identity = (await query('SELECT current_database() database_name,current_user'))[0][0] as any; ok(identity.database_name === 'jupiter_test' && identity.current_user === 'jupiter_test', 'FINAL_IDENTITY');
      const ledger = ((await query('SELECT name FROM "SequelizeMeta" ORDER BY name'))[0] as any[]).map((row) => row.name); const comparison = verifyRepositoryMigrationLedger(ledger); ok(comparison.files.length === 104 && comparison.files.filter((name) => name.startsWith('590_')).length === 1 && !comparison.files.some((name) => name.startsWith('591_')), 'FINAL_LEDGER');
      const hash = createHash('sha256').update(readFileSync('migrations/590_add_root_operational_tenant_ownership.ts')).digest('hex').toUpperCase(); ok(hash === REQUIRED_HASH, 'FINAL_MIGRATION_HASH');
      const rls = Number(((await query("SELECT count(*)::int count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relrowsecurity AND n.nspname NOT IN ('pg_catalog','information_schema')"))[0][0] as any).count); ok(rls === 0, 'FINAL_RLS'); await sequelize.close();
    },
  };
}
