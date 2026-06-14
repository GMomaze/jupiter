import { Request, Response } from 'express';
import { LibraryService } from './library.service.js';
import { MigrationDryRunService } from '../migration/migration-dry-run.service.js';
import { MigrationLedgerService } from '../migration/migration-ledger.service.js';

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function getMigrationDryRunFilters(source: Record<string, any>) {
  return {
    aircraft_id: String(source.aircraft_id || '').trim(),
    category: String(source.category || '').trim(),
    readiness: String(source.readiness || '').trim(),
    include_removed: source.include_removed === 'on',
    include_quarantined: source.include_quarantined === 'on',
    include_historical: source.include_historical === 'on',
  };
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

  static async renderSbModelAllocationIssues(req: Request, res: Response): Promise<void> {
    const filters = {
      status: String(req.query.status || ''),
      classification: String(req.query.classification || ''),
      reviewBucket: String(req.query.review_bucket || ''),
      search: String(req.query.search || ''),
      sort: String(req.query.sort || 'created_at'),
      direction: String(req.query.direction || 'desc'),
    };
    const [allocations, componentModels, reviewBucketCounts] = await Promise.all([
      LibraryService.getSbModelApplicabilityAllocations(filters),
      LibraryService.getSbModelAllocationLinkOptions(),
      LibraryService.getSbModelAllocationReviewBucketCounts(),
    ]);

    res.render('library/sbs/allocation-issues', {
      title: 'SB Import Issues - Unallocated Models',
      allocations,
      componentModels,
      reviewBucketCounts,
      filters,
      statusOptions: LibraryService.sbModelAllocationStatuses,
      classificationOptions: LibraryService.sbModelAllocationClassifications,
      reviewBucketOptions: LibraryService.sbModelAllocationReviewBuckets,
      sortOptions: [
        { value: 'created_at', label: 'Created Date' },
        { value: 'sb_reference', label: 'SB Reference' },
        { value: 'classification', label: 'Classification' },
        { value: 'status', label: 'Status' },
      ],
    });
  }

  static async linkSbModelAllocation(req: Request, res: Response): Promise<void> {
    const allocationId = getParam(req.params.id);
    const selected = req.body?.model_ids;
    const modelIds = Array.isArray(selected) ? selected : selected ? [selected] : [];
    const returnTo = String(req.body?.return_to || '/library/sbs/import-issues/unallocated-models');

    try {
      const result = await LibraryService.linkSbModelAllocationToModels(
        allocationId,
        modelIds.map((id) => String(id)),
        (req.user as any)?.id || null
      );

      req.flash(
        'success',
        `Linked ${result.linkedCount} model(s) while preserving raw Models Affected text.`
      );
      res.redirect(returnTo.startsWith('/library/sbs/import-issues') ? returnTo : '/library/sbs/import-issues/unallocated-models');
    } catch (error: any) {
      req.flash('error', error?.message || 'Unable to link allocation to model.');
      res.redirect(returnTo.startsWith('/library/sbs/import-issues') ? returnTo : '/library/sbs/import-issues/unallocated-models');
    }
  }

  static async recheckExactSbModelAllocations(req: Request, res: Response): Promise<void> {
    const returnTo = String(req.body?.return_to || '/library/sbs/import-issues/unallocated-models');

    try {
      const result = await LibraryService.recheckExactSbModelAllocations(
        (req.user as any)?.id || null
      );

      req.flash(
        'success',
        `Exact model-code recheck complete: ${result.matched} allocation(s) matched, ${result.linked} new model link(s) created, ${result.noMatch} left unmatched, ${result.multipleMatches} left for duplicate review.`
      );
      res.redirect(returnTo.startsWith('/library/sbs/import-issues') ? returnTo : '/library/sbs/import-issues/unallocated-models');
    } catch (error: any) {
      req.flash('error', error?.message || 'Unable to run exact model-code recheck.');
      res.redirect(returnTo.startsWith('/library/sbs/import-issues') ? returnTo : '/library/sbs/import-issues/unallocated-models');
    }
  }

  static async expandSafeSbShorthandAllocations(req: Request, res: Response): Promise<void> {
    const returnTo = String(req.body?.return_to || '/library/sbs/import-issues/unallocated-models');

    try {
      const result = await LibraryService.expandSafeSbShorthandAllocations(
        (req.user as any)?.id || null
      );

      req.flash(
        'success',
        `Safe shorthand expansion complete: ${result.expanded} allocation(s) expanded, ${result.matchedAllocations} fully matched, ${result.linked} new model link(s) created, ${result.partial} left partially unresolved, ${result.skippedUnsafe} unsafe row(s) skipped.`
      );
      res.redirect(returnTo.startsWith('/library/sbs/import-issues') ? returnTo : '/library/sbs/import-issues/unallocated-models');
    } catch (error: any) {
      req.flash('error', error?.message || 'Unable to run safe shorthand expansion.');
      res.redirect(returnTo.startsWith('/library/sbs/import-issues') ? returnTo : '/library/sbs/import-issues/unallocated-models');
    }
  }

  static async ignoreSbModelAllocation(req: Request, res: Response): Promise<void> {
    const allocationId = getParam(req.params.id);
    const returnTo = String(req.body?.return_to || '/library/sbs/import-issues/unallocated-models');

    try {
      await LibraryService.ignoreSbModelAllocation(
        allocationId,
        String(req.body?.ignored_reason || ''),
        (req.user as any)?.id || null
      );

      req.flash('success', 'Allocation issue ignored with review reason recorded.');
      res.redirect(returnTo.startsWith('/library/sbs/import-issues') ? returnTo : '/library/sbs/import-issues/unallocated-models');
    } catch (error: any) {
      req.flash('error', error?.message || 'Unable to ignore allocation issue.');
      res.redirect(returnTo.startsWith('/library/sbs/import-issues') ? returnTo : '/library/sbs/import-issues/unallocated-models');
    }
  }

  static async createIncompleteModelFromSbAllocation(req: Request, res: Response): Promise<void> {
    const allocationId = getParam(req.params.id);
    const returnTo = String(req.body?.return_to || '/library/sbs/import-issues/unallocated-models');

    try {
      const result = await LibraryService.createIncompleteModelFromSbAllocation(
        allocationId,
        String(req.body?.model_code || ''),
        String(req.body?.model_name || ''),
        (req.user as any)?.id || null
      );

      req.flash(
        'success',
        `${result.created ? 'Created' : 'Reused'} incomplete model ${result.modelName} and linked it to the SB.`
      );
      res.redirect(returnTo.startsWith('/library/sbs/import-issues') ? returnTo : '/library/sbs/import-issues/unallocated-models');
    } catch (error: any) {
      req.flash('error', error?.message || 'Unable to create incomplete model.');
      res.redirect(returnTo.startsWith('/library/sbs/import-issues') ? returnTo : '/library/sbs/import-issues/unallocated-models');
    }
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
