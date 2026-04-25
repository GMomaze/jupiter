import { Router } from 'express';
import { ServiceBulletinSyncService } from './service-bulletin-sync.service.js';
import { serviceBulletinImportUpload } from '../../middleware/upload.middleware.js';

const router = Router();

router.post(
  '/sync',
  serviceBulletinImportUpload.fields([
    { name: 'veryon_csv_file', maxCount: 1 },
    { name: 'piper_pdf_file', maxCount: 1 },
  ]),
  async (req: any, res, next) => {
    try {
      const files = req.files as {
        veryon_csv_file?: Express.Multer.File[];
        piper_pdf_file?: Express.Multer.File[];
      };

      const uploadedVeryonFile = files?.veryon_csv_file?.[0]?.path || null;
      const uploadedPiperFile = files?.piper_pdf_file?.[0]?.path || null;

      const method = req.body?.sync_method || 'VERYON';

      console.log(
        `[ServiceBulletinSyncRoutes] Sync requested | method=${method} | veryonFile=${uploadedVeryonFile || 'none'} | piperFile=${uploadedPiperFile || 'none'}`
      );

      if (method === 'VERYON' && !uploadedVeryonFile) {
        throw new Error('Veryon CSV file is required.');
      }

      if (
        method === 'PIPER_PDF' &&
        !uploadedPiperFile &&
        !req.body?.piper_pdf_path
      ) {
        throw new Error('Piper PDF file or path is required.');
      }

      const result = await ServiceBulletinSyncService.syncAll('MANUAL', {
        method,
        veryonRootPath: uploadedVeryonFile || req.body?.veryon_root_path || null,
        piperPdfPath: uploadedPiperFile || req.body?.piper_pdf_path || null,
      });

      // ✅ Store unmatched models in session for the frontend to react to
      if (result.unmatchedModels && result.unmatchedModels.length > 0) {
        req.session.unmatchedModels = result.unmatchedModels;
      }

      const wantsJson =
        req.query.format === 'json' ||
        req.accepts(['html', 'json']) === 'json';

      if (wantsJson) {
        return res.status(200).json(result);
      }

      req.flash('success', `${result.synced} SBs synced`);
      return res.redirect('/service-bulletins');
    } catch (error) {
      console.error('[ServiceBulletinSyncRoutes] ERROR:', error);

      const wantsJson =
        req.query.format === 'json' ||
        req.accepts(['html', 'json']) === 'json';

      if (wantsJson) {
        return res.status(400).json({
          error: (error as Error).message || 'Unable to sync service bulletins.',
        });
      }

      req.flash(
        'error',
        (error as Error).message || 'Unable to sync service bulletins.'
      );

      return res.redirect('/service-bulletins');
    }
  }
);

export default router;