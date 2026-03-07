import { Request, Response } from 'express';
import { LibraryService } from './library.service.js';

export class LibraryController {
  /**
   * VIEW: Renders the master library dashboard
   */
  static async renderDashboard(req: Request, res: Response) {
    try {
      console.log('>>> [GET] /library - Loading Dashboard');
      const assetTypes = await LibraryService.getAssetTypes();
      res.render('library/dashboard', { assetTypes });
    } catch (error: any) {
      console.error('>>> Dashboard Error:', error.message);
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: API to get manufacturers for a specific asset type
   */
  static async getManufacturers(req: Request, res: Response) {
    try {
      const { id } = req.params; // Using 'id' to match the route /asset-type/:id/manufacturers
      const manufacturers = await LibraryService.getManufacturersByAssetType(id);
      res.render('library/partials/manufacturer_list', { 
        manufacturers, 
        assetTypeId: id, 
        layout: false 
      });
    } catch (error: any) {
      console.error('>>> getManufacturers Error:', error.message);
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: Renders the form to add a new manufacturer
   */
  static async renderManufacturerForm(req: Request, res: Response) {
    try {
      const { assetTypeId } = req.params;
      res.render('library/partials/manufacturer_form', { 
        assetTypeId, 
        layout: false 
      });
    } catch (error: any) {
      console.error('>>> renderManufacturerForm Error:', error.message);
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: Create a new manufacturer
   */
  static async createManufacturer(req: Request, res: Response) {
    try {
      const { assetTypeId, name } = req.body;
      await LibraryService.createManufacturer(assetTypeId, name);
      const manufacturers = await LibraryService.getManufacturersByAssetType(assetTypeId);
      res.render('library/partials/manufacturer_list', { 
        manufacturers, 
        assetTypeId, 
        layout: false 
      });
    } catch (error: any) {
      console.error('>>> createManufacturer Error:', error.message);
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: API to get models when a manufacturer is selected
   */
  static async getModels(req: Request, res: Response) {
    try {
      const { manufacturerId, assetTypeId } = req.params;
      const models = await LibraryService.getModelsByManufacturerAndAssetType(manufacturerId, assetTypeId);
      res.render('library/partials/model_list', { 
        models, 
        manufacturerId, 
        assetTypeId, 
        layout: false 
      });
    } catch (error: any) {
      console.error('>>> getModels Error:', error.message);
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: API to get requirements for a specific model
   */
  static async getRequirements(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const requirements = await LibraryService.getModelRequirements(id);
      res.render('library/partials/requirement_list', { 
        requirements, 
        modelId: id, 
        layout: false 
      });
    } catch (error: any) {
      console.error('>>> getRequirements Error:', error.message);
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: Create a new model
   */
  static async createModel(req: Request, res: Response) {
    try {
      const { 
        manufacturer_id, 
        asset_type_id, 
        model_name, 
        default_tbo_hours, 
        default_tbo_months, 
        is_life_limited 
      } = req.body;

      await LibraryService.createModel({
        manufacturer_id,
        asset_type_id,
        model_name,
        default_tbo_hours: default_tbo_hours ? Number(default_tbo_hours) : undefined,
        default_tbo_months: default_tbo_months ? Number(default_tbo_months) : undefined,
        is_life_limited: is_life_limited === 'true' || is_life_limited === 'on'
      });

      const models = await LibraryService.getModelsByManufacturerAndAssetType(manufacturer_id, asset_type_id);
      res.render('library/partials/model_list', { models, layout: false });
    } catch (error: any) {
      console.error('>>> createModel Error:', error.message);
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: Updates an existing model
   */
  static async updateModel(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { 
        manufacturer_id, 
        asset_type_id, 
        model_name, 
        default_tbo_hours, 
        default_tbo_months, 
        is_life_limited 
      } = req.body;

      await LibraryService.updateModel(id, {
        model_name,
        default_tbo_hours: default_tbo_hours ? Number(default_tbo_hours) : undefined,
        default_tbo_months: default_tbo_months ? Number(default_tbo_months) : undefined,
        is_life_limited: is_life_limited === 'true' || is_life_limited === 'on'
      });

      const models = await LibraryService.getModelsByManufacturerAndAssetType(manufacturer_id, asset_type_id);
      res.render('library/partials/model_list', { models, layout: false });
    } catch (error: any) {
      console.error('>>> updateModel Error:', error.message);
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: Create a new requirement
   */
  static async createRequirement(req: Request, res: Response) {
    try {
      const { model_id, title, interval_hours, interval_months, description } = req.body;
      await LibraryService.createRequirement({
        model_id,
        title,
        interval_hours: interval_hours ? Number(interval_hours) : undefined,
        interval_months: interval_months ? Number(interval_months) : undefined,
        description
      });
      const requirements = await LibraryService.getModelRequirements(model_id);
      res.render('library/partials/requirement_list', { 
        requirements, 
        modelId: model_id, 
        layout: false 
      });
    } catch (error: any) {
      console.error('>>> createRequirement Error:', error.message);
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: Updates an existing requirement
   */
  static async updateRequirement(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { model_id, title, interval_hours, interval_months, description } = req.body;
      await LibraryService.updateRequirement(id, {
        title,
        interval_hours: interval_hours ? Number(interval_hours) : undefined,
        interval_months: interval_months ? Number(interval_months) : undefined,
        description
      });
      const requirements = await LibraryService.getModelRequirements(model_id);
      res.render('library/partials/requirement_list', { 
        requirements, 
        modelId: model_id, 
        layout: false 
      });
    } catch (error: any) {
      console.error('>>> updateRequirement Error:', error.message);
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: Deletes a requirement
   */
  static async deleteRequirement(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { model_id } = req.body; 
      await LibraryService.deleteRequirement(id);
      const requirements = await LibraryService.getModelRequirements(model_id);
      res.render('library/partials/requirement_list', { 
        requirements, 
        modelId: model_id, 
        layout: false 
      });
    } catch (error: any) {
      console.error('>>> deleteRequirement Error:', error.message);
      res.status(500).send(error.message);
    }
  }
}