import type { TenantQueryAuthority } from '../tenancy/tenant-query-authority.js';
import { AircraftComponentService } from '../aircraft/aircraft-component.service.js';

export class InventoryService {
  /**
   * REMOVE COMPONENT (Off-Unit)
   * Detaches a part from an aircraft and places it in the Store.
   */
  static async removeComponent(authority: TenantQueryAuthority, componentId: string, actorId: string, remarks?: unknown) {
    return AircraftComponentService.removeComponent(authority, componentId, actorId, remarks);
  }

  /**
   * INSTALL COMPONENT (On-Unit)
   * Attaches a part from the Store to an aircraft.
   */
  static async installComponent(authority: TenantQueryAuthority, componentId: string, aircraftId: string, actorId: string, remarks?: unknown) {
    return AircraftComponentService.reinstallComponent(authority, componentId, aircraftId, actorId, remarks);
  }
}
