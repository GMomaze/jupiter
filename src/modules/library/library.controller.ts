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

  static async renderSerializedReconciliationReport(
    _req: Request,
    res: Response
  ): Promise<void> {
    const report = await LibraryService.getSerializedComponentReconciliationReport();

    res.render('library/serialized-reconciliation', {
      title: 'Serialized Component Reconciliation',
      report,
      buckets: LibraryService.serializedReconciliationBuckets,
    });
  }

  static async renderSerializedMigrationDryRunReport(
    req: Request,
    res: Response
  ): Promise<void> {
    const filters = getMigrationDryRunFilters(req.query);

    const report = await MigrationDryRunService.previewLegacyAircraftComponentMigration({
      aircraft_id: filters.aircraft_id || null,
      include_removed: filters.include_removed,
      include_quarantined: filters.include_quarantined,
      include_historical: filters.include_historical,
    });

    const readinessCategories: Record<string, string[]> = {
      READY: ['AUTO_MIGRATE'],
      REVIEW: ['MANUAL_REVIEW_REQUIRED'],
      BLOCKED: ['CONFLICT', 'BLOCKED'],
      SKIPPED: ['SKIP'],
    };
    const categoryOptions = [
      'AUTO_MIGRATE',
      'MANUAL_REVIEW_REQUIRED',
      'CONFLICT',
      'BLOCKED',
      'SKIP',
    ];
    const rows = Array.isArray(report.rows) ? report.rows : [];
    const filteredRows = rows.filter((row: any) => {
      const categoryMatch = filters.category
        ? row.migration_category === filters.category
        : true;
      const readinessMatch = filters.readiness
        ? (readinessCategories[filters.readiness] || []).includes(row.migration_category)
        : true;

      return categoryMatch && readinessMatch;
    });

    res.render('library/serialized-migration-dry-run', {
      title: 'Serialized Component Migration Dry Run',
      report,
      rows: filteredRows,
      filters,
      categoryOptions,
      readinessOptions: Object.keys(readinessCategories),
      totalRows: rows.length,
    });
  }

  static async saveSerializedMigrationDryRunReport(
    req: Request,
    res: Response
  ): Promise<void> {
    const filters = getMigrationDryRunFilters(req.body);
    const report = await MigrationDryRunService.previewLegacyAircraftComponentMigration({
      aircraft_id: filters.aircraft_id || null,
      include_removed: filters.include_removed,
      include_quarantined: filters.include_quarantined,
      include_historical: filters.include_historical,
    });

    const batch = await MigrationLedgerService.saveLegacyAircraftComponentDryRun({
      report,
      filters,
      actor_id: (req.user as any)?.id || null,
    });

    req.flash('success', 'Migration dry-run saved for review.');
    res.redirect(`/library/serialized-components/migration-dry-run/batches/${batch.id}`);
  }

  static async renderSavedSerializedMigrationDryRunReport(
    req: Request,
    res: Response
  ): Promise<void> {
    const batch = await MigrationLedgerService.getSavedDryRunBatch(getParam(req.params.batchId));

    if (!batch) {
      res.status(404).send('Migration dry-run batch not found.');
      return;
    }

    res.render('library/serialized-migration-dry-run-saved', {
      title: 'Saved Migration Dry Run',
      batch,
      rows: Array.isArray(batch.Rows) ? batch.Rows : [],
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
