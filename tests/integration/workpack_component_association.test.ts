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
  TaskCard,
  Workpack,
  WorkpackStatus,
  WorkpackTask,
  sequelize,
} from '../../src/models/index.js';
import { WorkpackComponentIntegrationService } from '../../src/modules/workpacks/services/workpack-component-integration.service.js';

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
    const serializedComponentId = randomUUID();
    const legacyComponentId = randomUUID();
    vi.spyOn(AircraftComponentInstallation, 'findAll')
      .mockResolvedValueOnce([
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
      ] as any)
      .mockResolvedValueOnce([] as any);
    vi.spyOn(AircraftComponent, 'findAll').mockResolvedValue([
      {
        toJSON: () => ({
          id: legacyComponentId,
          serial_number: 'LEGACY-ENGINE-1',
          position_code: 'ENGINE',
        }),
      },
    ] as any);

    const context = await WorkpackComponentIntegrationService.buildForWorkpack({
      aircraftId: randomUUID(),
      tasks: [
        {
          id: randomUUID(),
          task_card_number: 'ENGINE-TASK',
          component_id: legacyComponentId,
        },
      ],
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
