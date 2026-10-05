import { Request, Response } from 'express';
import { InventoryService } from './inventory.service.js';
import { assertTenantQueryAuthority } from '../tenancy/tenant-query-authority.js';

export class InventoryController {
  private static getParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] || '' : value || '';
  }

  private static authorityAndActor(req: Request) {
    assertTenantQueryAuthority(req.tenantAuthority);
    const actorId = String((req.user as { id?: unknown } | undefined)?.id || '').trim();
    if (!actorId) throw new Error('AUTHENTICATED_ACTOR_REQUIRED');
    return { authority: req.tenantAuthority, actorId };
  }

  /**
   * POST /inventory/remove/:componentId
   */
  static async handleRemoval(req: Request, res: Response) {
    const componentId = InventoryController.getParam(req.params.componentId);
    const { remarks } = req.body;

    try {
      const { authority, actorId } = InventoryController.authorityAndActor(req);
      await InventoryService.removeComponent(authority, componentId, actorId, remarks);
      
      if (req.headers['hx-request']) {
        res.setHeader('HX-Refresh', 'true');
        return res.status(200).send();
      }
      res.redirect('back');
    } catch (error: any) {
      console.error('Removal Error:', error.message);
      res.status(400).send(`<div class="p-2 text-red-600 bg-red-100 border border-red-400 rounded">${error.message}</div>`);
    }
  }

  /**
   * POST /inventory/install/:componentId
   */
  static async handleInstallation(req: Request, res: Response) {
    const componentId = InventoryController.getParam(req.params.componentId);
    const { aircraft_id, remarks } = req.body;

    try {
      if (!aircraft_id) throw new Error('Aircraft ID is required for installation.');
      const { authority, actorId } = InventoryController.authorityAndActor(req);
      await InventoryService.installComponent(authority, componentId, aircraft_id, actorId, remarks);
      
      if (req.headers['hx-request']) {
        res.setHeader('HX-Refresh', 'true');
        return res.status(200).send();
      }
      res.redirect('back');
    } catch (error: any) {
      console.error('Installation Error:', error.message);
      res.status(400).send(`<div class="p-2 text-red-600 bg-red-100 border border-red-400 rounded">${error.message}</div>`);
    }
  }
}
