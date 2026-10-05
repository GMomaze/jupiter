import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Transaction } from 'sequelize';
import {
  Aircraft,
  AircraftCategory,
  AircraftComponent,
  AircraftComponentInstallation,
  AssetType,
  ComponentModel,
  Manufacturer,
  Tenant,
  User,
  TaskCard,
  Workpack,
  WorkpackStatus,
  WorkpackSnag,
  WorkpackTask,
  sequelize,
} from '../../src/models/index.js';
import { WorkpackComponentIntegrationService } from '../../src/modules/workpacks/services/workpack-component-integration.service.js';
import { createTenantQueryAuthority } from '../../src/modules/tenancy/tenant-query-authority.js';
import { workpackTenantRepository } from '../../src/modules/workpacks/workpack-tenant.repository.js';
import { aircraftComponentInstallationTenantRepository } from '../../src/modules/aircraft/aircraft-component-installation-tenant.repository.live.js';
import { aircraftComponentTenantRepository } from '../../src/modules/aircraft/aircraft-component-tenant.repository.live.js';

function authorityFor(tenantId: string, userId = randomUUID()) {
  return createTenantQueryAuthority({
    state: 'VALID_ACTIVE_TENANT',
    tenant: { id: tenantId, publicId: randomUUID(), code: 'TEST', displayName: 'Test', status: 'ACTIVE' },
    membership: { id: randomUUID(), tenantId, userId, status: 'ACTIVE' },
    validatedAt: Date.now(),
  });
}

describe('TaskCard legacy aircraft-component association', () => {
  let transaction: Transaction | null = null;

  afterEach(async () => {
    vi.restoreAllMocks();

    if (transaction) {
      await transaction.rollback();
      transaction = null;
    }
  });

  it('registers the Component alias with the legacy model and component_id foreign key', () => {
    const association = TaskCard.associations.Component;

    expect(association).toBeDefined();
    expect(association.target).toBe(AircraftComponent);
    expect(association.foreignKey).toBe('component_id');
  });

  it('supports detail and nested execution queries with nullable and valid legacy components', async () => {
    transaction = await sequelize.transaction();
    const suffix = randomUUID();
    const user = await User.create({
      id: randomUUID(), email: `wca-${suffix}@test.local`, password_hash: 'hash',
      full_name: 'WCA tester', is_active: true,
    }, { transaction });
    const tenant = await Tenant.create({
      id: randomUUID(), public_id: randomUUID(), code: `WCA_${suffix.replace(/-/g, '').slice(0, 10).toUpperCase()}`,
      display_name: 'WCA tenant', status: 'ACTIVE', created_by_user_id: user.id,
      updated_by_user_id: user.id,
    }, { transaction });

    const manufacturer = await Manufacturer.create(
      {
        id: randomUUID(),
        code: `WCA-${suffix}`,
        name: `Workpack Component Association ${suffix}`,
        is_active: true,
      },
      { transaction }
    );
    const assetType = await AssetType.create(
      {
        id: randomUUID(),
        code: `WCA-${suffix}`,
        label: 'Workpack Component Association',
      },
      { transaction }
    );
    const componentModel = await ComponentModel.create(
      {
        id: randomUUID(),
        model_name: `Workpack Component Association ${suffix}`,
        model_code: `WCA-${suffix}`,
        manufacturer_id: manufacturer.id,
        asset_type_id: assetType.id,
        is_active: true,
      },
      { transaction }
    );
    const category = await AircraftCategory.create(
      {
        id: randomUUID(),
        code: `WCA-${suffix}`,
        label: 'Workpack Component Association',
        is_active: true,
      },
      { transaction }
    );
    const aircraft = await Aircraft.create(
      {
        id: randomUUID(),
        registration: `T-${suffix.slice(0, 8)}`,
        serial_number: `WCA-${suffix}`,
        model_id: componentModel.id,
        category_id: category.id,
        status: 'REGISTERED',
        tenant_id: tenant.id,
      },
      { transaction }
    );
    const status = await WorkpackStatus.create(
      {
        id: randomUUID(),
        code: `WCA-${suffix}`,
        label: 'Workpack Component Association',
      },
      { transaction }
    );
    const workpack = await Workpack.create(
      {
        id: randomUUID(),
        work_order_number: `WCA-${suffix}`,
        aircraft_id: aircraft.id,
        status_id: status.id,
        tenant_id: tenant.id,
      },
      { transaction }
    );
    const legacyComponent = await AircraftComponent.create(
      {
        id: randomUUID(),
        aircraft_id: aircraft.id,
        model_id: componentModel.id,
        serial_number: `LEGACY-${suffix}`,
        position_code: 'ENGINE',
      },
      { transaction }
    );
    const taskWithoutComponent = await TaskCard.create(
      {
        id: randomUUID(),
        task_card_number: `WCA-NULL-${suffix}`,
        title: 'Nullable component task',
        description: 'Task without a legacy component reference.',
        aircraft_id: aircraft.id,
        component_id: null,
      },
      { transaction }
    );
    const taskWithComponent = await TaskCard.create(
      {
        id: randomUUID(),
        task_card_number: `WCA-LEGACY-${suffix}`,
        title: 'Legacy component task',
        description: 'Task with a legacy component reference.',
        aircraft_id: aircraft.id,
        component_id: legacyComponent.id,
      },
      { transaction }
    );

    await WorkpackTask.bulkCreate(
      [
        { workpack_id: workpack.id, task_id: taskWithoutComponent.id },
        { workpack_id: workpack.id, task_id: taskWithComponent.id },
      ],
      { transaction }
    );

    const detailTasks = await TaskCard.findAll({
      include: [
        {
          model: Workpack,
          through: { attributes: [] },
          where: { id: workpack.id },
          attributes: [],
          required: true,
        },
        { model: AircraftComponent, as: 'Component', required: false },
      ],
      order: [['task_card_number', 'ASC']],
      transaction,
    });

    expect(detailTasks).toHaveLength(2);
    expect((detailTasks[0] as any).Component.id).toBe(legacyComponent.id);
    expect((detailTasks[1] as any).Component).toBeNull();

    const executionPack = await Workpack.findByPk(workpack.id, {
      include: [
        {
          model: TaskCard,
          include: [
            { model: AircraftComponent, as: 'Component', required: false },
          ],
        },
      ],
      transaction,
    });
    const executionTasks = (executionPack as any).TaskCards as TaskCard[];

    expect(executionTasks).toHaveLength(2);
    expect(
      executionTasks.find((task) => task.id === taskWithoutComponent.id)?.get('Component')
    ).toBeNull();
    expect(
      (executionTasks.find((task) => task.id === taskWithComponent.id) as any).Component.id
    ).toBe(legacyComponent.id);
  });

  it('preserves legacy-to-serialized execution-context derivation', async () => {
    const tenantId = randomUUID();
    const authority = authorityFor(tenantId);
    const workpackId = randomUUID();
    const aircraftId = randomUUID();
    const serializedComponentId = randomUUID();
    const legacyComponentId = randomUUID();
    vi.spyOn(workpackTenantRepository, 'getById').mockResolvedValue({
      id: workpackId, aircraft_id: aircraftId,
    } as any);
    vi.spyOn(WorkpackTask, 'findAll').mockResolvedValue([{ task_id: 'task-1' }] as any);
    vi.spyOn(TaskCard, 'findAll').mockResolvedValue([{
      id: 'task-1', task_card_number: 'ENGINE-TASK', component_id: legacyComponentId,
    }] as any);
    vi.spyOn(WorkpackSnag, 'findAll').mockResolvedValue([] as any);
    vi.spyOn(aircraftComponentInstallationTenantRepository, 'listActiveWorkflowForAircraft')
      .mockResolvedValue([
        {
          toJSON: () => ({
            id: randomUUID(),
            aircraft_id: randomUUID(),
            serialized_component_id: serializedComponentId,
            installed_at: '2026-08-01',
            removed_at: null,
            position: 'ENGINE',
            SerializedComponent: {
              id: serializedComponentId,
              component_model_id: randomUUID(),
              serial_number: 'SERIAL-ENGINE-1',
              status: 'INSTALLED',
              ComponentModel: {
                model_name: 'Engine Model',
                model_code: 'ENGINE-MODEL',
                AssetType: { code: 'ENGINE' },
                LifeLimits: [],
              },
            },
          }),
        },
      ] as any);
    vi.spyOn(aircraftComponentInstallationTenantRepository, 'listWorkflowHistoryForSerializedComponents')
      .mockResolvedValue([] as any);
    vi.spyOn(aircraftComponentTenantRepository, 'listForAircraft').mockResolvedValue([
      {
        id: legacyComponentId,
        serial_number: 'LEGACY-ENGINE-1',
        position_code: 'ENGINE',
        toJSON: () => ({
          id: legacyComponentId,
          serial_number: 'LEGACY-ENGINE-1',
          position_code: 'ENGINE',
        }),
      },
    ] as any);

    const context = await WorkpackComponentIntegrationService.buildForWorkpack({
      authority,
      workpackId,
    });

    expect(context.summary.installed_serialized_count).toBe(1);
    expect(context.summary.matched_reference_count).toBe(1);
    expect(context.references[0]).toEqual(
      expect.objectContaining({
        legacy_component_id: legacyComponentId,
        serialized_component_id: serializedComponentId,
        match_basis: 'POSITION',
      })
    );
  });
});
