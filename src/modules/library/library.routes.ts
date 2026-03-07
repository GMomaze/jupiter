import { Router } from 'express';
import { LibraryService } from './library.service.js';
import { ensureAuthenticated } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';

const router = Router();

// Apply authentication to all library routes
router.use(ensureAuthenticated);

/**
 * GET /library
 * Main library page – shows asset types
 */
router.get('/', async (req, res, next) => {
  try {

    const assetTypes = await LibraryService.getAssetTypes();

    res.render('library/dashboard', {
      assetTypes
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /library/asset-type/:id/manufacturers
 */
router.get('/asset-type/:id/manufacturers', async (req, res, next) => {
  try {

    const { id } = req.params;

    const manufacturers =
      await LibraryService.getManufacturersByAssetType(id);

    res.render('library/partials/manufacturer_list', {
      manufacturers,
      assetTypeId: id,
      layout: false
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /library/asset-type/:assetTypeId/manufacturer/new
 */
router.get('/asset-type/:assetTypeId/manufacturer/new', async (req, res, next) => {
  try {

    const { assetTypeId } = req.params;

    res.render('library/partials/manufacturer_form', {
      assetTypeId,
      layout: false
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST /library/manufacturer
 */
router.post('/manufacturer', requirePermission('LIBRARY_EDIT'), async (req, res, next) => {
  try {

    const { assetTypeId, name } = req.body;

    await LibraryService.createManufacturer(assetTypeId, name);

    const manufacturers =
      await LibraryService.getManufacturersByAssetType(assetTypeId);

    res.render('library/partials/manufacturer_list', {
      manufacturers,
      assetTypeId,
      layout: false
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET MODELS
 */
router.get(
  '/manufacturer/:manufacturerId/asset-type/:assetTypeId/models',
  async (req, res, next) => {

    try {

      const { manufacturerId, assetTypeId } = req.params;

      const models =
        await LibraryService.getModelsByManufacturerAndAssetType(
          manufacturerId,
          assetTypeId
        );

      res.render('library/partials/model_list', {
        models,
        manufacturerId,
        assetTypeId,
        layout: false
      });

    } catch (error) {
      next(error);
    }

  }
);

/**
 * GET MODEL RULES
 */
router.get('/model/:id', async (req, res, next) => {

  try {

    const { id } = req.params;

    const model = await LibraryService.getModelById(id);
    const requirements = await LibraryService.getModelRequirements(id);

    res.render('library/partials/requirement_list', {
      model,
      modelId: model.id,
      requirements,
      layout: false
    });

  } catch (error) {
    next(error);
  }

});

/**
 * GET MODEL EDIT FORM
 */
router.get('/model/:id/edit', async (req, res, next) => {

  try {

    const { id } = req.params;

    const model = await LibraryService.getModelById(id);

    res.render('library/partials/model_edit_form', {
      model,
      layout: false
    });

  } catch (error) {
    next(error);
  }

});

/**
 * CREATE MODEL
 */
router.post('/model', requirePermission('LIBRARY_EDIT'), async (req, res, next) => {

  try {

    const {
      manufacturer_id,
      asset_type_id,
      model_name,
      default_tbo_hours,
      default_tbo_months,
      is_life_limited,
    } = req.body;

    await LibraryService.createModel({
      manufacturer_id,
      asset_type_id,
      model_name,
      default_tbo_hours: default_tbo_hours ? Number(default_tbo_hours) : undefined,
      default_tbo_months: default_tbo_months ? Number(default_tbo_months) : undefined,
      is_life_limited: is_life_limited === 'true' || is_life_limited === 'on'
    });

    res.redirect('/library');

  } catch (error) {
    next(error);
  }

});

/**
 * UPDATE MODEL
 */
router.post('/model/:id/update', requirePermission('LIBRARY_EDIT'), async (req, res, next) => {

  try {

    const { id } = req.params;

    const {
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

    const model = await LibraryService.getModelById(id);

    res.render('library/partials/model_edit_form', {
      model,
      layout: false
    });

  } catch (error) {
    next(error);
  }

});

/**
 * GET REQUIREMENT EDIT FORM
 */
router.get('/requirement/:id/edit', async (req, res, next) => {

  try {

    const { id } = req.params;

    const requirement =
      await LibraryService.getRequirementById(id);

    res.render('library/partials/requirement_edit_form', {
      requirement,
      layout: false
    });

  } catch (error) {
    next(error);
  }

});

/**
 * CREATE REQUIREMENT
 */
router.post('/requirement', requirePermission('LIBRARY_EDIT'), async (req, res, next) => {

  try {

    const {
      model_id,
      title,
      interval_hours,
      interval_months,
      description
    } = req.body;

    await LibraryService.createRequirement({
      model_id,
      title,
      interval_hours: interval_hours ? Number(interval_hours) : undefined,
      interval_months: interval_months ? Number(interval_months) : undefined,
      description
    });

    const model = await LibraryService.getModelById(model_id);
    const requirements = await LibraryService.getModelRequirements(model_id);

    res.render('library/partials/requirement_list', {
      model,
      modelId: model_id,
      requirements,
      layout: false
    });

  } catch (error) {
    next(error);
  }

});

/**
 * UPDATE REQUIREMENT
 */
router.post('/requirement/:id/update', requirePermission('LIBRARY_EDIT'), async (req, res, next) => {

  try {

    const { id } = req.params;

    const {
      title,
      interval_hours,
      interval_months,
      description,
      model_id
    } = req.body;

    await LibraryService.updateRequirement(id, {
      title,
      interval_hours: interval_hours ? Number(interval_hours) : undefined,
      interval_months: interval_months ? Number(interval_months) : undefined,
      description
    });

    const model = await LibraryService.getModelById(model_id);
    const requirements = await LibraryService.getModelRequirements(model_id);

    res.render('library/partials/requirement_list', {
      model,
      modelId: model_id,
      requirements,
      layout: false
    });

  } catch (error) {
    next(error);
  }

});

/**
 * DELETE REQUIREMENT
 */
router.post('/requirement/:id/delete', requirePermission('LIBRARY_EDIT'), async (req, res, next) => {

  try {

    const { id } = req.params;
    const { model_id } = req.body;

    await LibraryService.deleteRequirement(id);

    const model = await LibraryService.getModelById(model_id);
    const requirements = await LibraryService.getModelRequirements(model_id);

    res.render('library/partials/requirement_list', {
      model,
      modelId: model_id,
      requirements,
      layout: false
    });

  } catch (error) {
    next(error);
  }

});

export default router;