import { Request, Response } from 'express';
import { InventoryService } from './inventory.service.js';

export class InventoryController {
  /**
   * POST /inventory/remove/:componentId
   */
  static async handleRemoval(req: Request, res: Response) {
    const { componentId } = req.params;
    const { remarks } = req.body;
    const userId = (req as any).user?.id || '00000000-0000-0000-0000-000000000001';

    try {
      await InventoryService.removeComponent(componentId, userId, remarks || 'Routine Removal');
      
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
    const { componentId } = req.params;
    const { aircraft_id } = req.body; // Target aircraft from form
    const userId = (req as any).user?.id || '00000000-0000-0000-0000-000000000001';

    try {
      if (!aircraft_id) throw new Error('Aircraft ID is required for installation.');

      await InventoryService.installComponent(componentId, aircraft_id, userId);
      
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