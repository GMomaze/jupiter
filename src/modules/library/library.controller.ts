import { Request, Response } from 'express';
import { LibraryService } from './library.service.js';

export class LibraryController {
  /**
   * VIEW: Renders the master library dashboard
   */
  static async renderDashboard(req: Request, res: Response) {
    try {
      console.log('>>> [GET] /library - Loading Dashboard Categories');
      const categories = await LibraryService.getCategories();
      res.render('library/dashboard', { categories });
    } catch (error: any) {
      console.error('>>> Dashboard Error:', error.message);
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: API to get manufacturers for a specific category
   */
  static async getManufacturers(req: Request, res: Response) {
    try {
      const { categoryId } = req.params;
      const manufacturers = await LibraryService.getManufacturersByCategoryId(categoryId);
      res.render('library/partials/manufacturer_list', { manufacturers, categoryId, layout: false });
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
      const { categoryId } = req.params;
      res.render('library/partials/manufacturer_form', { categoryId, layout: false });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: Create a new manufacturer
   */
  static async createManufacturer(req: Request, res: Response) {
    try {
      const { category_id, name } = req.body;
      await LibraryService.createManufacturer(category_id, name);
      const manufacturers = await LibraryService.getManufacturersByCategoryId(category_id);
      res.render('library/partials/manufacturer_list', { manufacturers, categoryId: category_id, layout: false });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: Delete a manufacturer
   */
  static async deleteManufacturer(req: Request, res: Response) {
    try {
      const { manufacturerId } = req.params;
      const { category_id } = req.body;
      await LibraryService.deleteManufacturer(manufacturerId);
      const manufacturers = await LibraryService.getManufacturersByCategoryId(category_id);
      res.render('library/partials/manufacturer_list', { manufacturers, categoryId: category_id, layout: false });
    } catch (error: any) {
      res.status(500).send("Cannot delete manufacturer with active models.");
    }
  }

  /**
   * ACTION: API to get models when a manufacturer is selected
   */
  static async getModels(req: Request, res: Response) {
    try {
      const { manufacturerId } = req.params;
      const models = await LibraryService.getModelsByManufacturer(manufacturerId);
      res.render('library/partials/model_list', { models, layout: false });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: API to get requirements for a specific model
   */
  static async getRequirements(req: Request, res: Response) {
    try {
      const { modelId } = req.params;
      const requirements = await LibraryService.getModelRequirements(modelId);
      res.render('library/partials/requirement_list', { 
        requirements, 
        modelId, 
        layout: false 
      });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: Renders the form to add a new model
   */
  static async renderModelForm(req: Request, res: Response) {
    try {
      const { manufacturer_id } = req.query;
      res.render('library/partials/model_form', { 
        manufacturer_id, 
        layout: false 
      });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: Create a new model
   */
  static async createModel(req: Request, res: Response) {
    try {
      const { manufacturer_id, model_name, default_tbo_hours, default_tbo_months, is_life_limited } = req.body;
      await LibraryService.createModel({
        manufacturer_id,
        model_name,
        default_tbo_hours: default_tbo_hours ? parseFloat(default_tbo_hours) : undefined,
        default_tbo_months: default_tbo_months ? parseInt(default_tbo_months) : undefined,
        is_life_limited: is_life_limited === 'on'
      });
      const models = await LibraryService.getModelsByManufacturer(manufacturer_id);
      res.render('library/partials/model_list', { models, layout: false });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: Renders the edit form for an existing model
   */
  static async renderEditForm(req: Request, res: Response) {
    try {
      const { modelId } = req.params;
      const model = await LibraryService.getModelById(modelId);
      res.render('library/partials/model_edit_form', { model, layout: false });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: Updates an existing model
   */
  static async updateModel(req: Request, res: Response) {
    try {
      const { modelId } = req.params;
      const { manufacturer_id, model_name, default_tbo_hours, default_tbo_months, is_life_limited } = req.body;
      await LibraryService.updateModel(modelId, {
        model_name,
        default_tbo_hours: default_tbo_hours ? parseFloat(default_tbo_hours) : undefined,
        default_tbo_months: default_tbo_months ? parseInt(default_tbo_months) : undefined,
        is_life_limited: is_life_limited === 'on'
      });
      const models = await LibraryService.getModelsByManufacturer(manufacturer_id);
      res.render('library/partials/model_list', { models, layout: false });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: Renders the form to add a new requirement
   */
  static async renderRequirementForm(req: Request, res: Response) {
    try {
      const { modelId } = req.params;
      res.render('library/partials/requirement_form', { modelId, layout: false });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: Create a new maintenance requirement
   */
  static async createRequirement(req: Request, res: Response) {
    try {
      const { model_id, title, interval_hours, interval_months, description } = req.body;
      await LibraryService.createRequirement({
        model_id,
        title,
        interval_hours: interval_hours ? parseFloat(interval_hours) : undefined,
        interval_months: interval_months ? parseInt(interval_months) : undefined,
        description
      });
      const requirements = await LibraryService.getModelRequirements(model_id);
      res.render('library/partials/requirement_list', { 
        requirements, 
        modelId: model_id, 
        layout: false 
      });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: Renders the edit form for a requirement
   */
  static async renderRequirementEditForm(req: Request, res: Response) {
    try {
      const { requirementId } = req.params;
      const requirement = await LibraryService.getRequirementById(requirementId);
      res.render('library/partials/requirement_edit_form', { requirement, layout: false });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: Updates an existing requirement
   */
  static async updateRequirement(req: Request, res: Response) {
    try {
      const { requirementId } = req.params;
      const { model_id, title, interval_hours, interval_months, description } = req.body;
      await LibraryService.updateRequirement(requirementId, {
        title,
        interval_hours: interval_hours ? parseFloat(interval_hours) : undefined,
        interval_months: interval_months ? parseInt(interval_months) : undefined,
        description
      });
      const requirements = await LibraryService.getModelRequirements(model_id);
      res.render('library/partials/requirement_list', { requirements, modelId: model_id, layout: false });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  }

  /**
   * ACTION: Deletes a requirement
   */
  static async deleteRequirement(req: Request, res: Response) {
    try {
      const { requirementId } = req.params;
      const { model_id } = req.body; 
      await LibraryService.deleteRequirement(requirementId);
      const requirements = await LibraryService.getModelRequirements(model_id);
      res.render('library/partials/requirement_list', { requirements, modelId: model_id, layout: false });
    } catch (error: any) {
      res.status(500).send(error.message);
    }
  }
}