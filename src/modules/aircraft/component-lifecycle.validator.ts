import { AircraftComponent, ComponentModel } from '../../models/index.js';

export class ComponentLifecycleValidator {

  static validateHardLifeLimit(
    record: AircraftComponent,
    aircraftTotalHours: number
  ) {

    const model = record.ComponentModel as ComponentModel;

    if (!model?.default_tbo_hours) return;

    const installHours = Number(record.install_af_hours || 0);
    const tsnAtInstall = Number(record.tsn_at_install || 0);

    const hoursSinceInstall = aircraftTotalHours - installHours;
    const componentTotalTime = tsnAtInstall + hoursSinceInstall;

    if (componentTotalTime >= Number(model.default_tbo_hours)) {
      throw new Error(
        `TBO_EXCEEDED: ${model.model_name} (Serial: ${record.serial_number})`
      );
    }
  }
}
