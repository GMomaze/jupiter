import {
  Aircraft,
  AircraftComponent,
  AircraftSbCompliance,
  AssetType,
  ComponentModel,
  Manufacturer,
  ServiceBulletin,
  TaskCard,
  Workpack,
  WorkpackStatus,
  WorkpackTask,
} from '../../../models/index.js';
import { AuditService } from '../../audit/audit.service.js';
import { Op } from 'sequelize';

export class WorkpackServiceBulletinService {
  static async getOpenRelevantServiceBulletinsForAircraft(
    aircraftId: string,
    transaction: any
  ) {
    const aircraft = await Aircraft.findByPk(aircraftId, {
      attributes: ['id', 'model_id'],
      include: [
        {
          model: AircraftComponent,
          as: 'installed_components',
          required: false,
          attributes: ['model_id'],
        },
      ],
      transaction,
    });

    if (!aircraft) {
      throw new Error('INVALID_AIRCRAFT');
    }

    const relevantModelIds = Array.from(
      new Set([
        aircraft.model_id,
        ...((aircraft as any).installed_components || []).map(
          (component: any) => component.model_id
        ),
      ].filter(Boolean))
    );

    const bulletins = await ServiceBulletin.findAll({
      where: {
        status: 'ACTIVE',
      },
      include: [
        {
          model: ComponentModel,
          as: 'ApplicableModels',
          attributes: ['id', 'model_name', 'manufacturer_id', 'asset_type_id'],
          where: {
            id: {
              [Op.in]: relevantModelIds,
            },
          },
          through: { attributes: [] },
          include: [
            {
              model: Manufacturer,
              attributes: ['id', 'name', 'code'],
              required: false,
            },
            {
              model: AssetType,
              attributes: ['id', 'code', 'label'],
              required: false,
            },
          ],
        },
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (bulletins.length === 0) {
      return [];
    }

    const complianceRows = await AircraftSbCompliance.findAll({
      where: {
        aircraft_id: aircraftId,
        service_bulletin_id: {
          [Op.in]: bulletins.map((bulletin) => bulletin.id),
        },
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const complianceByBulletinId = new Map(
      complianceRows.map((row: any) => [row.service_bulletin_id, row.status])
    );

    return bulletins.filter(
      (bulletin: any) => (complianceByBulletinId.get(bulletin.id) || 'OPEN') === 'OPEN'
    );
  }

  static async addServiceBulletins(
    workpackId: string,
    serviceBulletinIds: string[],
    actorId: string | undefined,
    sequelize: any,
    requireAuth: (actorId?: string) => void
  ) {
    requireAuth(actorId);

    const uniqueIds = Array.from(
      new Set((serviceBulletinIds || []).map((id) => String(id).trim()).filter(Boolean))
    );

    if (uniqueIds.length === 0) {
      throw new Error('NO_SERVICE_BULLETINS_SELECTED');
    }

    return sequelize.transaction(async (transaction: any) => {
      const pack = await Workpack.findByPk(workpackId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!pack) throw new Error('WORKPACK_NOT_FOUND');

      const status = await WorkpackStatus.findByPk(pack.status_id, { transaction });
      if (!status) throw new Error('STATUS_NOT_FOUND');

      if (status.code !== 'DRAFT') {
        throw new Error('MUTATION_BLOCKED');
      }

      const availableBulletins = await this.getOpenRelevantServiceBulletinsForAircraft(
        pack.aircraft_id,
        transaction
      );
      const availableById = new Map(
        availableBulletins.map((bulletin: any) => [bulletin.id, bulletin])
      );

      const requestedBulletins = uniqueIds.map((id) => availableById.get(id)).filter(Boolean) as any[];

      if (requestedBulletins.length !== uniqueIds.length) {
        throw new Error('INVALID_SERVICE_BULLETIN_SELECTION');
      }

      const existingLinks = await WorkpackTask.findAll({
        where: { workpack_id: workpackId },
        transaction,
      });

      const existingTasks = existingLinks.length
        ? await TaskCard.findAll({
            where: {
              id: existingLinks.map((link) => link.task_id),
              service_bulletin_id: {
                [Op.in]: uniqueIds,
              },
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
          })
        : [];

      const existingBulletinIds = new Set(
        existingTasks.map((task: any) => task.service_bulletin_id).filter(Boolean)
      );

      let createdCount = 0;

      for (const bulletin of requestedBulletins) {
        if (existingBulletinIds.has(bulletin.id)) {
          continue;
        }

        const task = await TaskCard.create(
          {
            task_card_number: `SB-${bulletin.sb_number}`,
            title: `SB ${bulletin.sb_number}: ${bulletin.title}`,
            description: [
              `Service bulletin task for ${bulletin.sb_number}.`,
              bulletin.description || 'No service bulletin description provided.',
              bulletin.document_url ? `Source: ${bulletin.document_url}` : null,
            ]
              .filter(Boolean)
              .join('\n\n'),
            status: 'OPEN',
            aircraft_id: pack.aircraft_id,
            component_id: null,
            service_bulletin_id: bulletin.id,
            version: 0,
          },
          { transaction }
        );

        await WorkpackTask.create(
          {
            workpack_id: workpackId,
            task_id: task.id,
          },
          { transaction }
        );

        await AuditService.log(
          {
            table_name: 'task_cards',
            row_id: task.id,
            action: 'CREATE_FROM_SERVICE_BULLETIN',
            actor_id: actorId ?? null,
            new_values: {
              service_bulletin_id: bulletin.id,
              sb_number: bulletin.sb_number,
              title: task.title,
            },
          },
          transaction
        );

        createdCount += 1;
      }

      await AuditService.log(
        {
          table_name: 'workpacks',
          row_id: workpackId,
          action: 'SERVICE_BULLETINS_ADDED',
          actor_id: actorId ?? null,
          new_values: {
            service_bulletin_ids: uniqueIds,
            created_count: createdCount,
          },
        },
        transaction
      );

      return { createdCount };
    });
  }
}
