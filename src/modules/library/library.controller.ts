import { Request, Response } from 'express';
import { LibraryService } from './library.service.js';

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export class LibraryController {
  /**
   * GET /library
   * Render main library entry point with placeholder sections
   */
  static renderLibrary(req: Request, res: Response): void {
    res.render('library/index', {
      title: 'Maintenance Library',
    });
  }

  static async renderStandardTaskList(_req: Request, res: Response): Promise<void> {
    const standardTasks = await LibraryService.getStandardTasks();

    res.render('library/tasks/index', {
      title: 'Standard Tasks',
      standardTasks,
    });
  }

  static async renderAdList(_req: Request, res: Response): Promise<void> {
    const directives = await LibraryService.getAirworthinessDirectives();

    res.render('library/ads/index', {
      title: 'Airworthiness Directives',
      directives,
    });
  }

  static async renderSbList(_req: Request, res: Response): Promise<void> {
    const bulletins = await LibraryService.getServiceBulletins();

    res.render('library/sbs/index', {
      title: 'Service Bulletins',
      bulletins,
    });
  }

  static async renderSidList(_req: Request, res: Response): Promise<void> {
    const sids = await LibraryService.getSupplementalInspectionDocuments();

    res.render('library/sids/index', {
      title: 'Supplemental Inspection Documents',
      sids,
    });
  }

  static async renderSidDetail(req: Request, res: Response): Promise<void> {
    const sid = await LibraryService.getSupplementalInspectionDocumentById(getParam(req.params.id));

    if (!sid) {
      res.status(404).send('Supplemental Inspection Document not found.');
      return;
    }

    res.render('library/sids/detail', {
      title: `${sid.reference} - Supplemental Inspection Document`,
      sid,
    });
  }

  static async renderComplianceList(_req: Request, res: Response): Promise<void> {
    const complianceItems = await LibraryService.getComplianceItems();

    res.render('library/compliance/index', {
      title: 'Compliance Items',
      complianceItems,
    });
  }

  static async renderTemplateList(_req: Request, res: Response): Promise<void> {
    const templates = await LibraryService.getMaintenanceTemplates();

    res.render('library/templates/index', {
      title: 'Maintenance Templates',
      templates,
    });
  }

  static async renderTemplateDetail(req: Request, res: Response): Promise<void> {
    const template = await LibraryService.getMaintenanceTemplateById(getParam(req.params.id));

    if (!template) {
      res.status(404).send('Maintenance template not found.');
      return;
    }

    res.render('library/templates/detail', {
      title: `${template.name} - Maintenance Template`,
      template,
    });
  }
}
