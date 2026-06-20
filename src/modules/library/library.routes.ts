import { Router } from 'express';
import multer from 'multer';
import csrf from 'csurf';
import { LibraryService } from './library.service.js';
import { LibraryController } from './library.controller.js';
import { StandardTaskImportController } from './standard-task-import.controller.js';
import { AdImportController } from './ad-import.controller.js';
import { SbImportController } from './sb-import.controller.js';
import { PiperModelMasterImportController } from './piper-model-master-import.controller.js';
import { ensureAuthenticated } from '../../middleware/auth.middleware.js';
import { requirePermission } from '../../middleware/rbac.middleware.js';
import { manufacturerLogoUpload } from '../../middleware/upload.middleware.js';

const router = Router();
const sidCsvUpload = multer({ storage: multer.memoryStorage() });
const standardTaskCsvUpload = multer({ storage: multer.memoryStorage() });
const adImportUpload = multer({ storage: multer.memoryStorage() });
const sbImportUpload = multer({ storage: multer.memoryStorage() });
const piperModelMasterImportUpload = multer({ storage: multer.memoryStorage() });
const csrfProtection = csrf();

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

// Apply authentication to all library routes
router.use(ensureAuthenticated);

function getFriendlyLibraryErrorMessage(error: any) {
  const message = error?.original?.message || error?.message || '';

  if (
    message.includes('column') &&
    message.includes('manufacturers') &&
    message.includes('does not exist')
  ) {
    return 'The database schema is behind the app code for manufacturers. Run the latest migrations and try again.';
  }

  if (
    error?.name === 'SequelizeUniqueConstraintError' &&
    String(message).toLowerCase().includes('code')
  ) {
    return 'That manufacturer code is already in use.';
  }

  return message || 'Unable to save manufacturer.';
}

function getAssetTypeFormModel(source: Record<string, any> = {}) {
  return {
    code: String(source.code || ''),
    label: String(source.label || ''),
    description: String(source.description || ''),
    is_installable_on_aircraft:
      source.is_installable_on_aircraft === true ||
      source.is_installable_on_aircraft === 'true' ||
      source.is_installable_on_aircraft === 'on',
    is_required_for_aircraft:
      source.is_required_for_aircraft === true ||
      source.is_required_for_aircraft === 'true' ||
      source.is_required_for_aircraft === 'on',
    required_quantity: String(source.required_quantity ?? '0'),
    is_active:
      source.is_active === undefined ||
      source.is_active === null ||
      source.is_active === true ||
      source.is_active === 'true' ||
      source.is_active === 'on',
  };
}

function renderAssetTypeCreateForm(
  res: any,
  status: number,
  options: {
    form?: Record<string, any>;
    errors?: string[];
  } = {}
) {
  return res.status(status).render('library/asset-type-create', {
    title: 'Create Asset Type',
    form: getAssetTypeFormModel(options.form),
    errors: options.errors || [],
  });
}

/**
 * GET /library
 * Main library page – shows placeholder sections for ADs, SBs, SIDs, Task Templates
 */
router.get('/', LibraryController.renderLibrary);

router.get(
  '/tasks/import',
  requirePermission('LIBRARY_EDIT'),
  StandardTaskImportController.renderImportForm
);

router.get(
  '/ads/import',
  requirePermission('LIBRARY_EDIT'),
  AdImportController.renderImportForm
);

router.get(
  '/sbs/import',
  requirePermission('LIBRARY_EDIT'),
  SbImportController.renderImportForm
);

router.get(
  '/models/import',
  requirePermission('LIBRARY_EDIT'),
  PiperModelMasterImportController.renderImportForm
);

router.get(
  '/models/import/template',
  requirePermission('LIBRARY_EDIT'),
  PiperModelMasterImportController.downloadTemplate
);

router.get(
  '/ads',
  requirePermission('LIBRARY_EDIT'),
  LibraryController.renderAdList
);

router.get(
  '/sbs',
  requirePermission('LIBRARY_EDIT'),
  LibraryController.renderSbList
);

router.get(
  '/sbs/import-issues/unallocated-models',
  requirePermission('LIBRARY_EDIT'),
  LibraryController.renderSbModelAllocationIssues
);

router.post(
  '/sbs/import-issues/recheck-exact-model-codes',
  requirePermission('LIBRARY_EDIT'),
  csrfProtection,
  LibraryController.recheckExactSbModelAllocations
);

router.post(
  '/sbs/import-issues/expand-safe-shorthand',
  requirePermission('LIBRARY_EDIT'),
  csrfProtection,
  LibraryController.expandSafeSbShorthandAllocations
);

router.post(
  '/sbs/import-issues/allocations/:id/link-models',
  requirePermission('LIBRARY_EDIT'),
  csrfProtection,
  LibraryController.linkSbModelAllocation
);

router.post(
  '/sbs/import-issues/allocations/:id/ignore',
  requirePermission('LIBRARY_EDIT'),
  csrfProtection,
  LibraryController.ignoreSbModelAllocation
);

router.post(
  '/sbs/import-issues/allocations/:id/create-incomplete-model',
  requirePermission('LIBRARY_EDIT'),
  csrfProtection,
  LibraryController.createIncompleteModelFromSbAllocation
);

router.get(
  '/sids',
  requirePermission('LIBRARY_EDIT'),
  LibraryController.renderSidList
);

router.get(
  '/sids/:id',
  requirePermission('LIBRARY_EDIT'),
  LibraryController.renderSidDetail
);

router.get(
  '/compliance',
  requirePermission('LIBRARY_EDIT'),
  LibraryController.renderComplianceList
);

router.get(
  '/templates',
  requirePermission('LIBRARY_EDIT'),
  LibraryController.renderTemplateList
);

router.get(
  '/templates/:id',
  requirePermission('LIBRARY_EDIT'),
  LibraryController.renderTemplateDetail
);

router.get(
  '/tasks',
  requirePermission('LIBRARY_EDIT'),
  LibraryController.renderStandardTaskList
);

router.get(
  '/serialized-components',
  requirePermission('LIBRARY_EDIT'),
  async (_req, res, next) => {
    try {
      const serializedComponents = await LibraryService.getSerializedComponents();

      res.render('library/serialized-components', {
        serializedComponents,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/serialized-components/reconciliation',
  requirePermission('LIBRARY_EDIT'),
  LibraryController.renderSerializedReconciliationReport
);

router.get(
  '/serialized-components/migration-dry-run',
  requirePermission('LIBRARY_EDIT'),
  LibraryController.renderSerializedMigrationDryRunReport
);

router.post(
  '/serialized-components/migration-dry-run/save',
  requirePermission('LIBRARY_EDIT'),
  csrfProtection,
  LibraryController.saveSerializedMigrationDryRunReport
);

router.get(
  '/serialized-components/migration-dry-run/batches/:batchId',
  requirePermission('LIBRARY_EDIT'),
  LibraryController.renderSavedSerializedMigrationDryRunReport
);

router.get(
  '/serialized-components/create',
  requirePermission('LIBRARY_EDIT'),
  async (_req, res, next) => {
    try {
      const [assetTypes, manufacturers] = await Promise.all([
        LibraryService.getAssetTypes(),
        LibraryService.getManufacturersWithModels(),
      ]);

      res.render('library/serialized-component-create', {
        assetTypes,
        manufacturers,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/serialized-components/create/asset-types/:assetTypeId/manufacturer-options',
  requirePermission('LIBRARY_EDIT'),
  async (req, res, next) => {
    try {
      const assetTypeId = getParam(req.params.assetTypeId);
      const manufacturers = assetTypeId
        ? await LibraryService.getManufacturersByAssetType(assetTypeId)
        : [];

      res.render('library/partials/serialized-component-manufacturer-options', {
        manufacturers,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/serialized-components/create/asset-types/:assetTypeId/manufacturers/:manufacturerId/model-options',
  requirePermission('LIBRARY_EDIT'),
  async (req, res, next) => {
    try {
      const assetTypeId = getParam(req.params.assetTypeId);
      const manufacturerId = getParam(req.params.manufacturerId);
      const models = assetTypeId && manufacturerId
        ? await LibraryService.getModelsByManufacturerAndAssetType(manufacturerId, assetTypeId)
        : [];

      res.render('library/partials/serialized-component-model-options', {
        models,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/serialized-components/:id/edit',
  requirePermission('LIBRARY_EDIT'),
  async (req, res, next) => {
    try {
      const serializedComponent = await LibraryService.getSerializedComponentById(
        getParam(req.params.id)
      );

      if (!serializedComponent) {
        res.status(404).send('Serialized component not found.');
        return;
      }

      const manufacturers = await LibraryService.getManufacturersWithModels();
      const activeInstallation = Array.isArray((serializedComponent as any).Installations)
        ? (serializedComponent as any).Installations[0] || null
        : null;

      res.render('library/serialized-component-edit', {
        serializedComponent,
        manufacturers,
        activeInstallation,
        safeEditableStatuses: ['AVAILABLE', 'QUARANTINED'],
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/serialized-components/:id/life',
  requirePermission('LIBRARY_EDIT'),
  async (req, res, next) => {
    try {
      const dashboard = await LibraryService.getSerializedComponentLifeDashboard(
        getParam(req.params.id)
      );

      if (!dashboard) {
        res.status(404).send('Serialized component not found.');
        return;
      }

      res.render('library/serialized-component-life', dashboard);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/tasks/import/map',
  requirePermission('LIBRARY_EDIT'),
  standardTaskCsvUpload.single('task_csv'),
  csrfProtection,
  StandardTaskImportController.renderMappingPage
);

router.post(
  '/tasks/import/preview',
  requirePermission('LIBRARY_EDIT'),
  StandardTaskImportController.previewImport
);

router.post(
  '/ads/import/preview',
  requirePermission('LIBRARY_EDIT'),
  adImportUpload.single('ad_file'),
  csrfProtection,
  AdImportController.previewImport
);

router.post(
  '/sbs/import/preview',
  requirePermission('LIBRARY_EDIT'),
  sbImportUpload.single('sb_file'),
  csrfProtection,
  SbImportController.previewImport
);

router.post(
  '/models/import/preview',
  requirePermission('LIBRARY_EDIT'),
  piperModelMasterImportUpload.single('model_master_file'),
  csrfProtection,
  PiperModelMasterImportController.previewImport
);

router.post(
  '/models/import/commit',
  requirePermission('LIBRARY_EDIT'),
  PiperModelMasterImportController.commitImport
);

router.post(
  '/sbs/import/commit',
  requirePermission('LIBRARY_EDIT'),
  SbImportController.commitImport
);

router.post(
  '/ads/import/commit',
  requirePermission('LIBRARY_EDIT'),
  AdImportController.commitImport
);

router.post(
  '/tasks/import/commit',
  requirePermission('LIBRARY_EDIT'),
  StandardTaskImportController.commitImport
);

router.post(
  '/serialized-components',
  requirePermission('LIBRARY_EDIT'),
  csrfProtection,
  async (req, res, next) => {
    try {
      const {
        component_model_id,
        serial_number,
        part_number,
        status,
        condition,
        notes,
      } = req.body;

      if (!component_model_id || !String(component_model_id).trim()) {
        throw new Error('Component model is required.');
      }

      if (!serial_number || !String(serial_number).trim()) {
        throw new Error('Serial number is required.');
      }

      await LibraryService.createSerializedComponent({
        component_model_id: String(component_model_id),
        serial_number: String(serial_number),
        part_number,
        status,
        condition,
        notes,
      });

      res.redirect('/library/serialized-components');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/serialized-components/:id/update',
  requirePermission('LIBRARY_EDIT'),
  csrfProtection,
  async (req, res, next) => {
    try {
      await LibraryService.updateSerializedComponent(getParam(req.params.id), {
        component_model_id: req.body.component_model_id,
        serial_number: req.body.serial_number,
        part_number: req.body.part_number,
        status: req.body.status,
        condition: req.body.condition,
        notes: req.body.notes,
      });

      res.redirect('/library/serialized-components');
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/serialized-components/:id/life-adjustment',
  requirePermission('LIBRARY_EDIT'),
  csrfProtection,
  async (req, res) => {
    const serializedComponentId = getParam(req.params.id);

    try {
      await LibraryService.adjustSerializedComponentLifeState(serializedComponentId, {
        tsn_hours: req.body.tsn_hours,
        tso_hours: req.body.tso_hours,
        csn_cycles: req.body.csn_cycles,
        cso_cycles: req.body.cso_cycles,
        overhaul_reference_date: req.body.overhaul_reference_date,
        calendar_reference_date: req.body.calendar_reference_date,
        reason: req.body.reason,
        source_reference: req.body.source_reference,
        occurred_at: req.body.occurred_at,
        allow_tso_exceeds_tsn: req.body.allow_tso_exceeds_tsn,
        allow_cso_exceeds_csn: req.body.allow_cso_exceeds_csn,
        recorded_by: (req.user as any)?.id || null,
      });

      req.flash('success', 'Serialized component life adjustment recorded.');
    } catch (error: any) {
      req.flash('error', error?.message || 'Unable to record life adjustment.');
    }

    res.redirect(`/library/serialized-components/${serializedComponentId}/edit`);
  }
);

router.post(
  '/serialized-components/:id/overhaul',
  requirePermission('LIBRARY_EDIT'),
  csrfProtection,
  async (req, res) => {
    const serializedComponentId = getParam(req.params.id);

    try {
      await LibraryService.recordSerializedComponentOverhaul(serializedComponentId, {
        overhaul_date: req.body.overhaul_date,
        overhaul_provider: req.body.overhaul_provider,
        overhaul_reference: req.body.overhaul_reference,
        notes: req.body.notes,
        tsn_hours: req.body.tsn_hours,
        tso_hours: req.body.tso_hours,
        csn_cycles: req.body.csn_cycles,
        cso_cycles: req.body.cso_cycles,
        overhaul_reference_date: req.body.overhaul_reference_date,
        calendar_reference_date: req.body.calendar_reference_date,
        recorded_by: (req.user as any)?.id || null,
      });

      req.flash('success', 'Serialized component overhaul recorded.');
    } catch (error: any) {
      req.flash('error', error?.message || 'Unable to record overhaul.');
    }

    res.redirect(`/library/serialized-components/${serializedComponentId}/edit`);
  }
);

router.post(
  '/serialized-components/:id/maintenance-events',
  requirePermission('LIBRARY_EDIT'),
  csrfProtection,
  async (req, res) => {
    const serializedComponentId = getParam(req.params.id);

    try {
      await LibraryService.recordSerializedComponentGenericMaintenanceEvent(
        serializedComponentId,
        {
          event_type: req.body.event_type,
          occurred_at: req.body.occurred_at,
          provider: req.body.provider,
          reference: req.body.reference,
          notes: req.body.notes,
          recorded_by: (req.user as any)?.id || null,
        }
      );

      req.flash('success', 'Serialized component maintenance event recorded.');
    } catch (error: any) {
      req.flash('error', error?.message || 'Unable to record maintenance event.');
    }

    res.redirect(`/library/serialized-components/${serializedComponentId}/edit`);
  }
);

router.get('/asset-types/new', requirePermission('LIBRARY_EDIT'), async (_req, res) => {
  return renderAssetTypeCreateForm(res, 200);
});

router.post('/asset-types', requirePermission('LIBRARY_EDIT'), async (req, res) => {
  try {
    const assetType = await LibraryService.createAssetType({
      code: req.body.code,
      label: req.body.label,
      description: req.body.description,
      is_installable_on_aircraft: req.body.is_installable_on_aircraft,
      is_required_for_aircraft: req.body.is_required_for_aircraft,
      required_quantity: req.body.required_quantity,
      is_active: req.body.is_active,
    });

    req.flash('success', `Asset type ${assetType.code} created successfully.`);
    return res.redirect('/library');
  } catch (error: any) {
    return renderAssetTypeCreateForm(res, 400, {
      form: req.body,
      errors: [error?.message || 'Unable to create asset type.'],
    });
  }
});

router.get('/manufacturers', async (_req, res, next) => {
  try {
    const manufacturers = await LibraryService.getManufacturers();

    res.render('library/manufacturers', {
      manufacturers,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/manufacturers/:id', async (req, res, next) => {
  try {
    const manufacturerId = getParam(req.params.id);
    const manufacturer = await LibraryService.getManufacturerById(manufacturerId);
    const assetTypes = await LibraryService.getAssetTypes();

    if (!manufacturer) {
      return res.status(404).send('Manufacturer not found.');
    }

    res.render('library/manufacturer-detail', {
      manufacturer,
      assetTypes,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/manufacturers', requirePermission('LIBRARY_EDIT'), manufacturerLogoUpload.single('logo_file'), csrfProtection, async (req, res, next) => {
  try {
    const {
      name,
      code,
      description,
      website,
      logo_url,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      postal_code,
      current_owner,
      is_active,
      is_operational,
      support_email,
      support_phone,
      notes,
    } = req.body;
    const uploadedLogoPath = req.file ? `/uploads/manufacturers/${req.file.filename}` : undefined;

    if (!name || !String(name).trim()) {
      throw new Error('Manufacturer name is required.');
    }

    await LibraryService.createManufacturer({
      name,
      code,
      description,
      website,
      logo_url: uploadedLogoPath || logo_url,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      postal_code,
      current_owner,
      is_active: is_active === 'true' || is_active === 'on',
      is_operational: is_operational === 'true' || is_operational === 'on',
      support_email,
      support_phone,
      notes,
    });

    req.flash('success', `Manufacturer ${String(name).trim()} created successfully.`);
    res.redirect('/library/manufacturers');
  } catch (error) {
    const message = getFriendlyLibraryErrorMessage(error);

    try {
      const manufacturers = await LibraryService.getManufacturers();

      res.status(400).render('library/manufacturers', {
        manufacturers,
        messages: {
          ...(res.locals.messages || {}),
          error: [message],
        },
      });
    } catch (renderError) {
      next(renderError);
    }
  }
});

router.post('/manufacturers/:id/update', requirePermission('LIBRARY_EDIT'), manufacturerLogoUpload.single('logo_file'), csrfProtection, async (req, res, next) => {
  const manufacturerId = getParam(req.params.id);

  try {
    const {
      name,
      code,
      description,
      website,
      logo_url,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      postal_code,
      current_owner,
      is_active,
      is_operational,
      support_email,
      support_phone,
      notes,
    } = req.body;
    const uploadedLogoPath = req.file ? `/uploads/manufacturers/${req.file.filename}` : undefined;

    if (!name || !String(name).trim()) {
      throw new Error('Manufacturer name is required.');
    }

    await LibraryService.updateManufacturer(manufacturerId, {
      name,
      code,
      description,
      website,
      logo_url: uploadedLogoPath || logo_url,
      address_line_1,
      address_line_2,
      city,
      state,
      country,
      postal_code,
      current_owner,
      is_active: is_active === 'true' || is_active === 'on',
      is_operational: is_operational === 'true' || is_operational === 'on',
      support_email,
      support_phone,
      notes,
    });

    res.redirect(`/library/manufacturers/${manufacturerId}`);
  } catch (error) {
    const message = getFriendlyLibraryErrorMessage(error);

    try {
      const manufacturer = await LibraryService.getManufacturerById(manufacturerId);
      const assetTypes = await LibraryService.getAssetTypes();

      if (!manufacturer) {
        return res.status(404).send('Manufacturer not found.');
      }

      res.status(400).render('library/manufacturer-detail', {
        manufacturer,
        assetTypes,
        messages: {
          ...(res.locals.messages || {}),
          error: [message],
        },
      });
    } catch (renderError) {
      next(renderError);
    }
  }
});

/**
 * GET /library/asset-type/:id/manufacturers
 * Returns manufacturers filtered by asset type
 */
router.get('/asset-type/:id/manufacturers', async (req, res, next) => {
  try {
    const id = getParam(req.params.id);

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
      const manufacturerId = getParam(req.params.manufacturerId);
      const assetTypeId = getParam(req.params.assetTypeId);

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
    const id = getParam(req.params.id);

    const model = await LibraryService.getModelById(id);
    const requirements = await LibraryService.getModelRequirements(id);
    const serviceBulletins = await LibraryService.getModelServiceBulletins(id);
    const attachableServiceBulletins = await LibraryService.getAttachableServiceBulletins(id);
    const sids = await LibraryService.getModelSids(id);
    const applicabilityAssignments = await LibraryService.getModelApplicabilityAssignments(id);

    res.render('library/model-detail', {
      model,
      requirements,
      serviceBulletins,
      attachableServiceBulletins,
      sids,
      applicabilityAssignments,
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/model/:id/sids/import',
  requirePermission('LIBRARY_EDIT'),
  sidCsvUpload.single('sid_csv'),
  csrfProtection,
  async (req: any, res, next) => {
    try {
      const modelId = getParam(req.params.id);
      if (!req.file) {
        throw new Error('No SID CSV file uploaded.');
      }

      const result = await LibraryService.importModelSidsFromCsv(
        modelId,
        req.file.buffer
      );

      const parts = [
        `${result.attached} attached`,
        `${result.created} created`,
      ];

      if (result.skippedDuplicates > 0) {
        parts.push(`${result.skippedDuplicates} duplicate summaries skipped`);
      }

      if (result.skippedInvalid > 0) {
        parts.push(`${result.skippedInvalid} invalid rows skipped`);
      }

      req.flash('success', `SID import complete: ${parts.join(', ')}.`);
      res.redirect(`/library/model/${modelId}`);
    } catch (error: any) {
      req.flash('error', error?.message || 'Unable to import SID CSV.');
      res.redirect(`/library/model/${getParam(req.params.id)}`);
    }
  }
);

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
      model_code,
      default_tbo_hours,
      default_tbo_months,
      service_interval_hours,
      service_interval_months,
      overhaul_interval_hours,
      overhaul_interval_months,
      maintenance_notes,
      is_life_limited,
    } = req.body;

    await LibraryService.createModel({
      manufacturer_id,
      asset_type_id,
      model_name,
      model_code,
      default_tbo_hours: default_tbo_hours
        ? Number(default_tbo_hours)
        : undefined,
      default_tbo_months: default_tbo_months
        ? Number(default_tbo_months)
        : undefined,
      service_interval_hours: service_interval_hours
        ? Number(service_interval_hours)
        : undefined,
      service_interval_months: service_interval_months
        ? Number(service_interval_months)
        : undefined,
      overhaul_interval_hours: overhaul_interval_hours
        ? Number(overhaul_interval_hours)
        : undefined,
      overhaul_interval_months: overhaul_interval_months
        ? Number(overhaul_interval_months)
        : undefined,
      maintenance_notes,
      is_life_limited: is_life_limited === 'true' || is_life_limited === 'on',
    });

    res.redirect(`/library/manufacturers/${manufacturer_id}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /library/model/:id/update
 */
router.post('/model/:id/update', requirePermission('LIBRARY_EDIT'), async (req, res, next) => {
  try {
    const id = getParam(req.params.id);

    const {
      model_name,
      model_code,
      default_tbo_hours,
      default_tbo_months,
      service_interval_hours,
      service_interval_months,
      overhaul_interval_hours,
      overhaul_interval_months,
      maintenance_notes,
      is_life_limited,
    } = req.body;

    await LibraryService.updateModel(id, {
      model_name,
      model_code,
      default_tbo_hours: default_tbo_hours
        ? Number(default_tbo_hours)
        : undefined,
      default_tbo_months: default_tbo_months
        ? Number(default_tbo_months)
        : undefined,
      service_interval_hours: service_interval_hours
        ? Number(service_interval_hours)
        : undefined,
      service_interval_months: service_interval_months
        ? Number(service_interval_months)
        : undefined,
      overhaul_interval_hours: overhaul_interval_hours
        ? Number(overhaul_interval_hours)
        : undefined,
      overhaul_interval_months: overhaul_interval_months
        ? Number(overhaul_interval_months)
        : undefined,
      maintenance_notes,
      is_life_limited: is_life_limited === 'true' || is_life_limited === 'on',
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
    const id = getParam(req.params.id);

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
    const id = getParam(req.params.id);
    const { model_id } = req.body;

    await LibraryService.deleteRequirement(id);

    res.redirect(`/library/model/${model_id}`);
  } catch (error) {
    next(error);
  }
});

router.post('/service-bulletin', requirePermission('LIBRARY_EDIT'), async (req, res, next) => {
  try {
    const {
      model_id,
      sb_number,
      title,
      description,
      issued_on,
      compliance_type,
      revision,
      document_url,
    } = req.body;

    const toArray = (value: unknown) =>
      Array.isArray(value) ? value : value !== undefined ? [value] : [];

    const sbNumbers = toArray(sb_number);
    const titles = toArray(title);
    const descriptions = toArray(description);
    const complianceTypes = toArray(compliance_type);
    const issuedDates = toArray(issued_on);
    const revisions = toArray(revision);
    const documentUrls = toArray(document_url);

    const hasMultipleRows =
      sbNumbers.length > 1 ||
      descriptions.length > 1 ||
      complianceTypes.length > 1;

    if (hasMultipleRows) {
      const maxRows = Math.max(
        sbNumbers.length,
        titles.length,
        descriptions.length,
        complianceTypes.length,
        issuedDates.length,
        revisions.length,
        documentUrls.length
      );

      await LibraryService.createServiceBulletinsBulk(
        model_id,
        Array.from({ length: maxRows }, (_, index) => ({
          sb_number: String(sbNumbers[index] ?? ''),
          title: String(titles[index] ?? descriptions[index] ?? ''),
          description: String(descriptions[index] ?? ''),
          compliance_type: String(complianceTypes[index] ?? 'MANUAL'),
          issued_on: String(issuedDates[index] ?? ''),
          revision: String(revisions[index] ?? ''),
          document_url: String(documentUrls[index] ?? ''),
        }))
      );
    } else {
      await LibraryService.createServiceBulletin({
        model_id,
        sb_number,
        title: title || description,
        description,
        issued_on,
        compliance_type,
        revision,
        document_url,
      });
    }

    res.redirect(`/library/model/${model_id}`);
  } catch (error) {
    next(error);
  }
});

router.post('/model/:id/service-bulletins/attach', requirePermission('LIBRARY_EDIT'), async (req, res, next) => {
  try {
    const id = getParam(req.params.id);
    const selected = req.body?.service_bulletin_ids;
    const serviceBulletinIds = Array.isArray(selected)
      ? selected
      : selected
      ? [selected]
      : [];

    await LibraryService.attachServiceBulletinsToModel(id, serviceBulletinIds);

    res.redirect(`/library/model/${id}`);
  } catch (error) {
    next(error);
  }
});

router.post('/model/:id/airworthiness-directives/assign', requirePermission('LIBRARY_EDIT'), csrfProtection, async (req, res, next) => {
  try {
    const id = getParam(req.params.id);
    const selected = req.body?.airworthiness_directive_ids;
    const directiveIds = Array.isArray(selected)
      ? selected
      : selected
      ? [selected]
      : [];

    for (const directiveId of directiveIds) {
      await LibraryService.assignAirworthinessDirectiveToModel(id, String(directiveId));
    }

    res.redirect(`/library/model/${id}`);
  } catch (error) {
    next(error);
  }
});

router.post('/model/:id/sids/assign', requirePermission('LIBRARY_EDIT'), csrfProtection, async (req, res, next) => {
  try {
    const id = getParam(req.params.id);
    const selected = req.body?.sid_ids;
    const sidIds = Array.isArray(selected)
      ? selected
      : selected
      ? [selected]
      : [];

    for (const sidId of sidIds) {
      await LibraryService.assignSupplementalInspectionDocumentToModel(id, String(sidId));
    }

    res.redirect(`/library/model/${id}`);
  } catch (error) {
    next(error);
  }
});

router.post('/model/:id/standard-tasks/assign', requirePermission('LIBRARY_EDIT'), csrfProtection, async (req, res, next) => {
  try {
    const id = getParam(req.params.id);
    const selected = req.body?.task_template_ids;
    const taskTemplateIds = Array.isArray(selected)
      ? selected
      : selected
      ? [selected]
      : [];

    for (const taskTemplateId of taskTemplateIds) {
      await LibraryService.assignStandardTaskToModel(id, String(taskTemplateId));
    }

    res.redirect(`/library/model/${id}`);
  } catch (error) {
    next(error);
  }
});

export default router;
