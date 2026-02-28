// src/modules/assets/asset.service.ts

export class AssetService {
  async installComponent(data: {
    aircraftId: string;
    modelId: string;
    serialNumber: string;
    tsnAtInstall: number;
    tsoAtInstall: number;
  }) {
    return await db.transaction(async (tx) => {
      // 1. Get current Airframe Hours (The Anchor)
      const aircraft = await tx.aircraft.findUnique({
        where: { id: data.aircraftId },
        select: { total_time_hours: true }
      });

      if (!aircraft) throw new Error("Aircraft not found");

      // 2. Create the Installation Record
      return await tx.aircraft_components.create({
        data: {
          aircraft_id: data.aircraftId,
          model_id: data.modelId,
          serial_number: data.serialNumber,
          tsn_at_install: data.tsnAtInstall,
          tso_at_install: data.tsoAtInstall,
          install_af_hours: aircraft.total_time_hours, // Crucial for Phase 3 math
          current_status: 'INSTALLED'
        }
      });
    });
  }
}