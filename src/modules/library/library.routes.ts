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

    // Render existing dashboard view
    res.render('library/dashboard', {
      assetTypes,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /library/asset-type/:id/manufacturers
 * Returns manufacturers filtered by asset type
 */
router.get('/asset-type/:id/manufacturers', async (req, res, next) => {
  try {
    const { id } = req.params;

    const manufacturers =
      await LibraryService.getManufacturersByAssetType(id);

    res.render('library/partials/manufacturer_list', {
      manufacturers,
      assetTypeId: id,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /library/manufacturer/:manufacturerId/asset-type/:assetTypeId/models
 * Returns models filtered by manufacturer + asset type
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
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /library/model/:id
 * Model detail page
 */
router.get('/model/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const model = await LibraryService.getModelById(id);
    const requirements = await LibraryService.getModelRequirements(id);

    res.render('library/model-detail', {
      model,
      requirements,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /library/model
 * Create new model
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
      default_tbo_hours: default_tbo_hours
        ? Number(default_tbo_hours)
        : undefined,
      default_tbo_months: default_tbo_months
        ? Number(default_tbo_months)
        : undefined,
      is_life_limited: is_life_limited === 'true',
    });

    res.redirect('/library');
  } catch (error) {
    next(error);
  }
});

/**
 * POST /library/model/:id/update
 */
router.post('/model/:id/update', requirePermission('LIBRARY_EDIT'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const {
      model_name,
      default_tbo_hours,
      default_tbo_months,
      is_life_limited,
    } = req.body;

    await LibraryService.updateModel(id, {
      model_name,
      default_tbo_hours: default_tbo_hours
        ? Number(default_tbo_hours)
        : undefined,
      default_tbo_months: default_tbo_months
        ? Number(default_tbo_months)
        : undefined,
      is_life_limited: is_life_limited === 'true',
    });

    res.redirect(`/library/model/${id}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /library/requirement
 */
router.post('/requirement', requirePermission('LIBRARY_EDIT'), async (req, res, next) => {
  try {
    const {
      model_id,
      title,
      interval_hours,
      interval_months,
      description,
    } = req.body;

    await LibraryService.createRequirement({
      model_id,
      title,
      interval_hours: interval_hours
        ? Number(interval_hours)
        : undefined,
      interval_months: interval_months
        ? Number(interval_months)
        : undefined,
      description,
    });

    res.redirect(`/library/model/${model_id}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /library/requirement/:id/update
 */
router.post('/requirement/:id/update', requirePermission('LIBRARY_EDIT'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const {
      title,
      interval_hours,
      interval_months,
      description,
      model_id,
    } = req.body;

    await LibraryService.updateRequirement(id, {
      title,
      interval_hours: interval_hours
        ? Number(interval_hours)
        : undefined,
      interval_months: interval_months
        ? Number(interval_months)
        : undefined,
      description,
    });

    res.redirect(`/library/model/${model_id}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /library/requirement/:id/delete
 */
router.post('/requirement/:id/delete', requirePermission('LIBRARY_EDIT'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { model_id } = req.body;

    await LibraryService.deleteRequirement(id);

    res.redirect(`/library/model/${model_id}`);
  } catch (error) {
    next(error);
  }
});

export default router;