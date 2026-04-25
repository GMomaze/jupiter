import { Router } from 'express';
import { ServiceBulletinService } from './service-bulletin.service.js';

const router = Router();

function getFriendlyCreateErrorMessage(error: any) {
  if (error?.name === 'SequelizeUniqueConstraintError') {
    return 'A service bulletin with that SB number already exists for the selected model.';
  }

  return error?.message || 'Unable to create service bulletin.';
}

router.get('/sync-status', async (_req, res, next) => {
  try {
    const syncInfo = await ServiceBulletinService.getSyncStatus();
    res.json(syncInfo);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req: any, res, next) => {
  try {
    const bulletins = await ServiceBulletinService.getAll();
    const rows = ServiceBulletinService.toApiPayload(bulletins as any[]);
    const componentModels = await ServiceBulletinService.getCreateOptions();
    const syncInfo = await ServiceBulletinService.getSyncStatus();

    // ✅ Get unmatched models from session
    const unmatchedModels = req.session?.unmatchedModels || [];

    // ✅ Clear from session immediately after reading to avoid repeat prompts
    if (req.session) {
      req.session.unmatchedModels = null;
    }

    const wantsJson =
      req.query.format === 'json' || req.accepts(['html', 'json']) === 'json';

    if (wantsJson) {
      return res.json(rows);
    }

    res.render('service-bulletins/index', {
      bulletins: rows,
      componentModels,
      formData: {},
      syncInfo,
      syncMethods: ['VERYON', 'PIPER_PDF', 'ATP'],
      syncFormData: {
        sync_method: 'VERYON',
        piper_pdf_path: '',
      },
      // ✅ Expose to EJS
      unmatchedModels,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: any, res, next) => {
  try {
    const {
      sb_number,
      title,
      model_id,
      compliance_type,
      revision,
      document_url,
      description,
      issued_on,
    } = req.body;

    if (!sb_number || !String(sb_number).trim()) {
      throw new Error('SB number is required.');
    }

    if (!model_id || !String(model_id).trim()) {
      throw new Error('Model is required.');
    }

    const created = await ServiceBulletinService.create({
      sb_number,
      title,
      model_id,
      compliance_type,
      revision,
      document_url,
      description,
      issued_on,
    });

    const wantsJson =
      req.query.format === 'json' || req.accepts(['html', 'json']) === 'json';

    if (wantsJson) {
      return res.status(201).json(created);
    }

    req.flash('success', `Service bulletin ${created.sb_number} created.`);
    res.redirect('/service-bulletins');
  } catch (error: any) {
    const wantsJson =
      req.query.format === 'json' || req.accepts(['html', 'json']) === 'json';

    if (wantsJson) {
      return res.status(400).json({
        error: getFriendlyCreateErrorMessage(error),
      });
    }

    try {
      const bulletins = await ServiceBulletinService.getAll();
      const rows = ServiceBulletinService.toApiPayload(bulletins as any[]);
      const componentModels = await ServiceBulletinService.getCreateOptions();
      const syncInfo = await ServiceBulletinService.getSyncStatus();

      res.status(400).render('service-bulletins/index', {
        bulletins: rows,
        componentModels,
        formData: req.body,
        syncInfo,
        syncMethods: ['VERYON', 'PIPER_PDF', 'ATP'],
        syncFormData: {
          sync_method: 'VERYON',
          piper_pdf_path: '',
        },
        unmatchedModels: [],
        messages: {
          ...(res.locals.messages || {}),
          error: [getFriendlyCreateErrorMessage(error)],
        },
      });
    } catch (renderError) {
      next(renderError);
    }
  }
});

export default router;
