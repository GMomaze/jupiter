import { MaintenanceRequirement } from '../../models/index.js';
import { ComponentModel } from '../../models/index.js';
import { WorkpackAutomationService } from '../workpacks/workpack-automation.service.js';

export class MaintenanceTriggerService {

  static async evaluateComponentTBO(
    aircraft_id: string,
    aircraftHours: number,
    installedComponents: any[],
    transaction: any
  ) {

    for (const record of installedComponents) {

      const model = record.ComponentModel as ComponentModel;

      if (!model?.default_tbo_hours) continue;

      const thresholdPercent = model.warning_threshold_percent || 90;

      const installHours = Number(record.install_af_hours || 0);
      const tsnAtInstall = Number(record.tsn_at_install || 0);

      const hoursSinceInstall = aircraftHours - installHours;
      const componentTotalTime = tsnAtInstall + hoursSinceInstall;

      const warningThreshold =
        (model.default_tbo_hours * thresholdPercent) / 100;

      if (
        componentTotalTime >= warningThreshold &&
        componentTotalTime < model.default_tbo_hours
      ) {

        const title = `TBO WARNING - ${record.serial_number}`;

        const existing = await MaintenanceRequirement.findOne({
          where: {
            model_id: model.id,
            title
          },
          transaction
        });

        if (!existing) {

          const createdRequirement = await MaintenanceRequirement.create(
            {
              model_id: model.id,
              title,
              description:
                `Component ${model.model_name} (SN: ${record.serial_number}) ` +
                `has reached ${thresholdPercent}% of TBO.`,
            },
            { transaction }
          );

          // 🔥 Attach to aircraft workpack
          await WorkpackAutomationService.attachRequirementToAircraft(
            aircraft_id,
            createdRequirement,
            transaction
          );
        }
      }
    }
  }
}
