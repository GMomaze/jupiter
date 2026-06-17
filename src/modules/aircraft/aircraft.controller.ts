import { Request, Response } from 'express';

import { AircraftService } from './aircraft.service.js';
import { AircraftComponentService } from './aircraft-component.service.js';
import {
  ApplicabilityEngineService,
  ApplicabilityItem,
} from '../compliance/applicability-engine.service.js';

import {
  Aircraft,
  AircraftCategory,
  ComponentModel,
  AssetType,
  Manufacturer,
  AircraftComponent,
  ServiceBulletin,
  AircraftSbCompliance,
  Customer,
  CustomerAircraftLink,
} from '../../models/index.js';
import { CustomersService } from '../customers/customers.service.js';

export class AircraftController {
  private static getParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] || '' : value || '';
  }

  private static readonly serializedRemovalStatuses = ['REMOVED', 'AVAILABLE'];

  private static readonly serviceBulletinAttributes = [
    'id',
    'sb_number',
    'title',
    'compliance_type',
    'status',
    'issued_on',
    'document_url',
    'description',
  ];

  private static manufacturerInclude(required = false) {
    return {
      model: Manufacturer,
      attributes: ['id', 'name', 'code'],
      required,
    };
  }

  private static assetTypeInclude(required = false, where?: Record<string, unknown>) {
    return {
      model: AssetType,
      attributes: ['id', 'code', 'label', 'is_installable_on_aircraft'],
      required,
      ...(where ? { where } : {}),
    };
  }

  private static componentModelAttributes = [
    'id',
    'model_name',
    'model_code',
    'manufacturer_id',
    'asset_type_id',
    'default_tbo_hours',
    'default_tbo_months',
    'is_life_limited',
    'is_active',
  ];

  private static componentModelInclude() {
    return {
      model: ComponentModel,
      attributes: AircraftController.componentModelAttributes,
      include: [AircraftController.manufacturerInclude()],
    };
  }

  private static getSerializedHistoryEventLabel(entry: any) {
    const installationContext = String(entry?.installation_context || 'MAINTENANCE_INSTALL');

    if (installationContext === 'BASELINE_CAPTURE') {
      return entry?.removed_at ? 'Closed Baseline Installation' : 'Baseline Capture';
    }

    return entry?.removed_at ? 'Closed Installation' : 'Active Installation';
  }

  private static getSerializedProvenanceLabel(installationContext: string) {
    return installationContext === 'BASELINE_CAPTURE'
      ? 'Baseline Capture'
      : 'Authoritative Install';
  }

  private static buildSerializedTraceabilitySummary(installation: any) {
    const provenanceLabel =
      AircraftController.getSerializedProvenanceLabel(
        String(installation?.installation_context || 'MAINTENANCE_INSTALL')
      );

    return [
      provenanceLabel === 'Baseline Capture'
        ? (installation?.installed_at
            ? `Baseline captured effective ${installation.installed_at}`
            : 'Baseline capture effective date unavailable')
        : (installation?.installed_at
            ? `Installed through authoritative workflow on ${installation.installed_at}`
            : 'Authoritative install date unavailable'),
      installation?.position
        ? `Position ${installation.position}`
        : 'Position not captured',
      installation?.install_tsn !== null && installation?.install_tsn !== undefined && installation?.install_tsn !== ''
        ? `Install TSN ${installation.install_tsn}`
        : 'Install TSN unavailable',
      installation?.install_tso !== null && installation?.install_tso !== undefined && installation?.install_tso !== ''
        ? `Install TSO ${installation.install_tso}`
        : 'Install TSO unavailable',
      `Provenance ${provenanceLabel}`,
    ].join(' | ');
  }

  private static buildSerializedUncertaintyFlags(params: {
    installation: any;
    serializedComponent: any;
    historyEntries: any[];
  }) {
    const flags: string[] = [];
    const installation = params.installation;
    const serializedComponent = params.serializedComponent;
    const historyEntries = params.historyEntries || [];
    const notes = String(installation?.notes || '').toLowerCase();

    if (!installation?.position) {
      flags.push('Position Not Captured');
    }

    if (installation?.install_tsn === null || installation?.install_tsn === undefined || installation?.install_tsn === '') {
      flags.push('Unknown Install TSN');
    }

    if (installation?.install_tso === null || installation?.install_tso === undefined || installation?.install_tso === '') {
      flags.push('Unknown Install TSO');
    }

    if (String(installation?.installation_context || '') === 'BASELINE_CAPTURE') {
      flags.push('Inherited Visibility');
    }

    if (notes.includes('uncertainty')) {
      flags.push('Evidence Limited');
    }

    if (!serializedComponent?.condition) {
      flags.push('Condition Not Captured');
    }

    if (historyEntries.length === 0) {
      flags.push('Limited Installation History');
    }

    return Array.from(new Set(flags));
  }

  private static buildSerializedMaintenanceContextSummary(params: {
    installation: any;
    historyEntries: any[];
  }) {
    const installation = params.installation;
    const historyEntries = params.historyEntries || [];
    const closedHistoryCount = historyEntries.filter((entry) => Boolean(entry?.removed_at)).length;

    return {
      maintenance_event_count: 0,
      headline: closedHistoryCount > 0
        ? 'Installation lifecycle history is visible, but no separate maintenance-event records are linked here yet.'
        : 'No maintenance-event visibility is currently available for this serialized component.',
      explanation: String(installation?.installation_context || '') === 'BASELINE_CAPTURE'
        ? 'Baseline provenance remains visible. Operational review can use installation history and notes, but separate maintenance-event visibility is not yet linked in this layer.'
        : 'Authoritative installation provenance remains visible. Operational review can use installation history and notes, but separate maintenance-event visibility is not yet linked in this layer.',
      visibility_state: closedHistoryCount > 0 ? 'LIMITED_CONTEXT' : 'NO_EVENT_VISIBILITY',
    };
  }

  private static buildSerializedDocumentVisibilitySummary(params: {
    installation: any;
    serializedComponent: any;
  }) {
    const installation = params.installation;
    const serializedComponent = params.serializedComponent;
    const hasComponentNotes = Boolean(String(serializedComponent?.notes || '').trim());
    const isBaselineCapture =
      String(installation?.installation_context || '') === 'BASELINE_CAPTURE';
    const evidenceBadges = [
      'No Supporting Documents Visible',
      'No Maintenance-Event-Linked Documents',
      'No Component-Only Documents',
      isBaselineCapture ? 'Baseline Provenance Preserved' : 'Authoritative Install Preserved',
      hasComponentNotes ? 'Operational Notes Visible' : null,
    ].filter(Boolean);
    const warnings = [
      'Document Visibility Limited',
      'No Maintenance-Event-Linked Documents Visible',
      'No Component-Only Evidence Visible',
    ];

    return {
      document_count: 0,
      maintenance_event_linked_document_count: 0,
      component_only_document_count: 0,
      document_types: [] as string[],
      evidence_badges: evidenceBadges,
      headline: 'No supporting component documents are currently linked in this operational layer.',
      explanation: hasComponentNotes
        ? 'Operational notes are visible on the serialized component, but they are not treated as component documents or maintenance evidence. Supporting component-document visibility is not yet linked here.'
        : 'No linked component-document visibility is available here, so operational understanding relies on installation traceability, provenance, and any captured notes only.',
      maintenance_event_relationship:
        'No maintenance-event-linked document records are visible in this operational layer.',
      component_relationship:
        'No component-only document records are visible in this operational layer.',
      traceability_summary: isBaselineCapture
        ? 'Baseline provenance remains separate from document visibility. Missing documents do not convert this onboarding record into maintenance evidence.'
        : 'Authoritative installation provenance remains visible, but no supporting component documents are linked here as evidence.',
      explainability_summary: hasComponentNotes
        ? 'Stored component notes improve operational explainability, but document-backed evidence visibility remains limited.'
        : 'Document-backed explainability is limited because no supporting component documents are visible for this serialized component.',
      readiness_summary: {
        state: 'LIMITED',
        label: 'Evidence Visibility Limited',
        explanation:
          'Advisory only: no supporting component documents are linked here, so evidence visibility remains incomplete and should not be treated as compliance or maintenance completion.',
      },
      warnings,
      visibility_state: 'NO_DOCUMENT_VISIBILITY',
    };
  }

  private static buildSerializedReadinessSummary(params: {
    installation: any;
    uncertaintyFlags: string[];
    maintenanceContextSummary: any;
    documentVisibilitySummary: any;
  }) {
    const uncertaintyFlags = params.uncertaintyFlags || [];
    const missingCriticalInputs = uncertaintyFlags.filter((flag) =>
      [
        'Position Not Captured',
        'Unknown Install TSN',
        'Unknown Install TSO',
      ].includes(flag)
    ).length;

    if (missingCriticalInputs >= 2) {
      return {
        state: 'LIMITED',
        label: 'Operational Visibility Limited',
        explanation:
          'Advisory only: multiple core operational inputs remain unknown or uncaptured, so aircraft component understanding should be reviewed before relying on this visibility alone.',
      };
    }

    if (
      uncertaintyFlags.length > 0 ||
      params.maintenanceContextSummary?.visibility_state !== 'LIMITED_CONTEXT' ||
      params.documentVisibilitySummary?.visibility_state !== 'DOCUMENTED'
    ) {
      return {
        state: 'REVIEW',
        label: 'Operational Review Recommended',
        explanation:
          'Advisory only: serialized component visibility is usable, but supporting context or technical certainty remains incomplete and should be reviewed operationally.',
      };
    }

    return {
      state: 'CLEAR',
      label: 'Operationally Clear',
      explanation:
        'Advisory only: the serialized component currently appears operationally legible from visible traceability and captured inputs.',
    };
  }

  private static async getSerializedWorkflowContext(aircraftId: string) {
    const [availableSerializedComponents, activeSerializedInstallations] = await Promise.all([
      AircraftComponentService.getAvailableSerializedComponents(),
      AircraftComponentService.getActiveSerializedInstallationsForAircraft(aircraftId),
    ]);

    const serializedComponentIds = activeSerializedInstallations
      .map((installation: any) => String(
        installation?.serialized_component_id ||
        installation?.SerializedComponent?.id ||
        ''
      ).trim())
      .filter(Boolean);

    const serializedInstallationHistory =
      await AircraftComponentService.getSerializedInstallationHistoryForComponents(
        serializedComponentIds
      );

    const serializedInstallationHistoryByComponentId = serializedInstallationHistory.reduce(
      (accumulator: Record<string, any[]>, entry: any) => {
        const key = String(entry?.serialized_component_id || '').trim();

        if (!key) {
          return accumulator;
        }

        accumulator[key] = accumulator[key] || [];
        accumulator[key].push({
          ...(typeof entry?.toJSON === 'function' ? entry.toJSON() : entry),
          event_label: AircraftController.getSerializedHistoryEventLabel(entry),
        });

        return accumulator;
      },
      {} as Record<string, any[]>
    );

    const serializedInstallationsWithHistory = activeSerializedInstallations.map((installation: any) => {
      const normalizedInstallation =
        typeof installation?.toJSON === 'function' ? installation.toJSON() : installation;
      const serializedComponentId = String(
        normalizedInstallation?.serialized_component_id ||
        normalizedInstallation?.SerializedComponent?.id ||
        ''
      ).trim();
      const historyEntries = serializedInstallationHistoryByComponentId[serializedComponentId] || [];
      const serializedComponent = normalizedInstallation?.SerializedComponent || null;
      const uncertaintyFlags = AircraftController.buildSerializedUncertaintyFlags({
        installation: normalizedInstallation,
        serializedComponent,
        historyEntries,
      });
      const maintenanceContextSummary =
        AircraftController.buildSerializedMaintenanceContextSummary({
          installation: normalizedInstallation,
          historyEntries,
        });
      const documentVisibilitySummary =
        AircraftController.buildSerializedDocumentVisibilitySummary({
          installation: normalizedInstallation,
          serializedComponent,
        });
      const readinessSummary = AircraftController.buildSerializedReadinessSummary({
        installation: normalizedInstallation,
        uncertaintyFlags,
        maintenanceContextSummary,
        documentVisibilitySummary,
      });
      const provenanceLabel = AircraftController.getSerializedProvenanceLabel(
        String(normalizedInstallation?.installation_context || 'MAINTENANCE_INSTALL')
      );
      const operationalWarnings = [
        ...uncertaintyFlags,
        maintenanceContextSummary.visibility_state === 'NO_EVENT_VISIBILITY'
          ? 'No Maintenance-Event Visibility'
          : null,
        documentVisibilitySummary.visibility_state === 'NO_DOCUMENT_VISIBILITY'
          ? 'No Component-Document Visibility'
          : null,
        ...(documentVisibilitySummary.warnings || []),
      ].filter(Boolean);

      return {
        ...normalizedInstallation,
        history_entries: historyEntries,
        provenance_label: provenanceLabel,
        traceability_summary:
          AircraftController.buildSerializedTraceabilitySummary(normalizedInstallation),
        explainability_summary: normalizedInstallation?.notes
          ? 'Operational explainability is supported by stored installation notes and provenance context.'
          : 'Operational explainability is limited because no installation notes were captured.',
        uncertainty_flags: uncertaintyFlags,
        maintenance_context_summary: maintenanceContextSummary,
        document_visibility_summary: documentVisibilitySummary,
        readiness_summary: readinessSummary,
        operational_warnings: operationalWarnings,
      };
    });

    const occupiedPositions = Array.from(
      new Set(
        serializedInstallationsWithHistory
          .map((installation: any) => String(installation?.position || '').trim())
          .filter(Boolean)
      )
    ).sort();

    const recentPositions = Array.from(
      new Set(
        serializedInstallationHistory
          .map((entry: any) => String(entry?.position || '').trim())
          .filter(Boolean)
      )
    ).sort();

    const operationalSummary = {
      active_serialized_count: serializedInstallationsWithHistory.length,
      baseline_capture_count: serializedInstallationsWithHistory.filter(
        (installation: any) => installation.installation_context === 'BASELINE_CAPTURE'
      ).length,
      authoritative_install_count: serializedInstallationsWithHistory.filter(
        (installation: any) => installation.installation_context !== 'BASELINE_CAPTURE'
      ).length,
      readiness_limited_count: serializedInstallationsWithHistory.filter(
        (installation: any) => installation.readiness_summary?.state === 'LIMITED'
      ).length,
      review_recommended_count: serializedInstallationsWithHistory.filter(
        (installation: any) => installation.readiness_summary?.state === 'REVIEW'
      ).length,
      uncertainty_visible_count: serializedInstallationsWithHistory.filter(
        (installation: any) => (installation.uncertainty_flags || []).length > 0
      ).length,
      maintenance_context_limited_count: serializedInstallationsWithHistory.filter(
        (installation: any) => installation.maintenance_context_summary?.visibility_state !== 'LIMITED_CONTEXT'
      ).length,
      document_visibility_limited_count: serializedInstallationsWithHistory.filter(
        (installation: any) => installation.document_visibility_summary?.visibility_state !== 'DOCUMENTED'
      ).length,
      maintenance_event_linked_document_visible_count: serializedInstallationsWithHistory.filter(
        (installation: any) =>
          Number(installation.document_visibility_summary?.maintenance_event_linked_document_count || 0) > 0
      ).length,
      component_only_document_visible_count: serializedInstallationsWithHistory.filter(
        (installation: any) =>
          Number(installation.document_visibility_summary?.component_only_document_count || 0) > 0
      ).length,
      occupied_position_count: occupiedPositions.length,
    };

    return {
      availableSerializedComponents,
      activeSerializedInstallations: serializedInstallationsWithHistory,
      serializedRemovalStatuses: AircraftController.serializedRemovalStatuses,
      serializedInstallationHistoryByComponentId,
      serializedOperationalSummary: operationalSummary,
      serializedPositionContext: {
        occupied_positions: occupiedPositions,
        recent_positions: recentPositions,
      },
    };
  }

  private static async getAircraftFormOptions(selectedManufacturerId?: string) {
    const airframeModels = await ComponentModel.findAll({
      attributes: ['id', 'model_name', 'model_code', 'manufacturer_id', 'asset_type_id', 'is_active'],
      where: { is_active: true },
      include: [
        {
          ...AircraftController.manufacturerInclude(true),
        },
        {
          ...AircraftController.assetTypeInclude(true, { code: 'AIRFRAME' })
        }
      ],
      order: [['model_name', 'ASC']]
    });

    const manufacturers = Array.from(
      new Map(
        airframeModels
          .map((model: any) => [model.Manufacturer?.id, model.Manufacturer] as const)
          .filter(([id]) => Boolean(id))
      ).values()
    ).sort((left: any, right: any) => left.name.localeCompare(right.name));

    const categories = await AircraftCategory.findAll({
      where: { is_active: true },
      order: [['label', 'ASC']]
    });

    const manufacturerModels = selectedManufacturerId
      ? airframeModels.filter(
        (model: any) => model.manufacturer_id === selectedManufacturerId
      )
      : [];

    return {
      categories,
      manufacturers,
      manufacturerModels
    };
  }

  private static getServiceBulletinFilters(req: Request) {
    return {
      status: typeof req.query.status === 'string' ? req.query.status : '',
      critical: typeof req.query.critical === 'string' ? req.query.critical : '',
      open_only: typeof req.query.open_only === 'string' ? req.query.open_only : '',
      sort: typeof req.query.sort === 'string' ? req.query.sort : 'sb_number'
    };
  }

  private static async attachServiceBulletinCompliance(aircraft: any) {
    const serviceBulletins = aircraft?.ComponentModel?.ApplicableServiceBulletins || [];

    if (serviceBulletins.length === 0) {
      return;
    }

    const complianceRows = await AircraftSbCompliance.findAll({
      where: { aircraft_id: aircraft.id }
    });

    const complianceByBulletinId = new Map(
      complianceRows.map((row: any) => [row.service_bulletin_id, row] as const)
    );

    for (const bulletin of serviceBulletins) {
      const compliance = complianceByBulletinId.get(bulletin.id);
      bulletin.setDataValue('AircraftCompliance', compliance ? [compliance] : []);
    }
  }

  private static async getAircraftServiceBulletinOrThrow(aircraftId: string, serviceBulletinId: string) {
    const serviceBulletins = await AircraftService.getServiceBulletinsForAircraft(aircraftId);
    const serviceBulletin = serviceBulletins.find((item) => item.id === serviceBulletinId);

    if (!serviceBulletin) {
      throw new Error('SERVICE_BULLETIN_NOT_FOUND');
    }

    return serviceBulletin;
  }

  private static buildApplicabilitySummary(items: ApplicabilityItem[]) {
    const counts = {
      total: items.length,
      ad: 0,
      sb: 0,
      sid: 0,
    };

    for (const item of items) {
      if (item.source_type === 'AD') {
        counts.ad += 1;
      } else if (item.source_type === 'SB') {
        counts.sb += 1;
      } else if (item.source_type === 'SID') {
        counts.sid += 1;
      }
    }

    return counts;
  }

  private static groupApplicabilityItems(items: ApplicabilityItem[]) {
    return {
      ad: items.filter((item) => item.source_type === 'AD'),
      sb: items.filter((item) => item.source_type === 'SB'),
      sid: items.filter((item) => item.source_type === 'SID'),
    };
  }

  static async index(req: Request, res: Response) {
    try {
      const aircraft = await Aircraft.findAll({
        include: [
          AircraftController.componentModelInclude()
        ],
        order: [['registration', 'ASC']]
      });

      res.render('aircraft/index', { aircraft });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  }

  static async showCreate(req: Request, res: Response) {
    try {
      const { manufacturers, categories } =
        await AircraftController.getAircraftFormOptions();

      res.render('aircraft/create', {
        manufacturers,
        categories,
        today: new Date().toISOString().slice(0, 10),
      });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  }

  static async getModelsByManufacturer(req: Request, res: Response) {
    const manufacturerId = AircraftController.getParam(req.params.manufacturerId);
    console.log(`[AircraftController] 📥 Request received for models. Mfg ID: ${manufacturerId}`);

    try {
      const models = await ComponentModel.findAll({
        attributes: ['id', 'model_name', 'model_code', 'manufacturer_id', 'asset_type_id', 'is_active'],
        where: {
          manufacturer_id: manufacturerId,
          is_active: true
        },
        include: [
          AircraftController.manufacturerInclude(),
          {
            ...AircraftController.assetTypeInclude(false, { code: 'AIRFRAME' })
          }
        ],
        order: [['model_name', 'ASC']]
      });

      console.log(`[AircraftController] ✅ Found ${models.length} models for Mfg ID: ${manufacturerId}`);
      res.render('aircraft/partials/model-options', { models });
    } catch (err: any) {
      console.error(`[AircraftController] ❌ Error in getModelsByManufacturer:`, err.message);
      res.status(500).send(err.message);
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const {
        registration,
        serial_number,
        model_id,
        category_id,
        total_time_hours,
        total_time_cycles,
        loaded_into_system_at,
        manufacture_date,
        tcds_number,
        tcds_url,
      } = req.body;
      const uploadedPhotoPath =
        (req as any).file ? `/uploads/aircraft/${(req as any).file.filename}` : null;

      const aircraft = await AircraftService.create({
        registration,
        serial_number,
        model_id,
        category_id,
        total_time_hours: total_time_hours ? Number(total_time_hours) : 0,
        total_time_cycles: total_time_cycles ? Number(total_time_cycles) : 0,
        loaded_into_system_at,
        manufacture_date,
        tcds_number,
        tcds_url,
        photo_url: uploadedPhotoPath,
      });

      res.redirect(`/aircraft/view/${aircraft.id}`);
    } catch (err: any) {
      res.status(400).send(err.message);
    }
  }

  static async showView(req: Request, res: Response) {
    try {
      const aircraftId = AircraftController.getParam(req.params.id);
      const aircraft = await Aircraft.findByPk(aircraftId, {
        include: [
          {
            model: ComponentModel,
            attributes: AircraftController.componentModelAttributes,
            include: [
              AircraftController.manufacturerInclude(),
              AircraftController.assetTypeInclude(),
              {
                model: ServiceBulletin,
                as: 'ApplicableServiceBulletins',
                through: { attributes: [] },
                attributes: AircraftController.serviceBulletinAttributes,
                required: false
              }
            ]
          },
          {
            model: AircraftComponent,
            as: 'installed_components',
            required: false,
            include: [
              {
                model: ComponentModel,
                attributes: AircraftController.componentModelAttributes,
                include: [AircraftController.manufacturerInclude()]
              }
            ]
          },
          {
            model: CustomerAircraftLink,
            as: 'CustomerLinks',
            required: false,
            include: [
              {
                model: Customer,
                as: 'Customer',
              }
            ]
          }
        ]
      });

      if (!aircraft) {
        return res.status(404).send('Aircraft not found');
      }

      await AircraftController.attachServiceBulletinCompliance(aircraft);
      const sbFilters = AircraftController.getServiceBulletinFilters(req);
      const serviceBulletins = await AircraftService.getServiceBulletinsForAircraft(aircraft.id, sbFilters);
      const applicableStandardTasks =
        await AircraftService.getApplicableStandardTasksForAircraft(aircraft.id);
      const selectedManufacturerId =
        (aircraft as any).ComponentModel?.manufacturer_id ||
        (aircraft as any).ComponentModel?.Manufacturer?.id;
      const { manufacturers, categories, manufacturerModels } =
        await AircraftController.getAircraftFormOptions(selectedManufacturerId);

      const componentModels = await ComponentModel.findAll({
        attributes: ['id', 'model_name', 'model_code', 'manufacturer_id', 'asset_type_id', 'is_active'],
        include: [
          {
            ...AircraftController.assetTypeInclude(false, {
              is_installable_on_aircraft: true
            })
          },
          AircraftController.manufacturerInclude()
        ],
        order: [['model_name', 'ASC']]
      });

      const customerOptions = await CustomersService.getActiveCustomers();
      const customerLinks = ((aircraft as any).CustomerLinks || []).slice().sort((left: any, right: any) => {
        if (left.is_current !== right.is_current) {
          return left.is_current ? -1 : 1;
        }

        return String(right.start_date || '').localeCompare(String(left.start_date || ''));
      });
      const currentCustomerLinks = customerLinks.filter((link: any) => link.is_current);
      const historicalCustomerLinks = customerLinks.filter((link: any) => !link.is_current);
      const serializedWorkflowContext =
        await AircraftController.getSerializedWorkflowContext(aircraft.id);

      res.render('aircraft/view', {
        aircraft,
        categories,
        componentModels,
        manufacturerModels,
        manufacturers,
        serviceBulletins,
        sbFilters,
        aircraftViewPath: `/aircraft/view/${aircraft.id}`,
        customerOptions,
        currentCustomerLinks,
        historicalCustomerLinks,
        applicableStandardTasks,
        ...serializedWorkflowContext,
      });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  }

  static async showApplicability(req: Request, res: Response) {
    try {
      const aircraftId = AircraftController.getParam(req.params.id);
      const aircraft = await Aircraft.findByPk(aircraftId, {
        include: [AircraftController.componentModelInclude()],
      });

      if (!aircraft) {
        return res.status(404).send('Aircraft not found');
      }

      const applicability =
        await ApplicabilityEngineService.getApplicabilityForAircraft(aircraftId);
      const summary = AircraftController.buildApplicabilitySummary(
        applicability.items
      );
      const groupedItems = AircraftController.groupApplicabilityItems(
        applicability.items
      );

      res.render('aircraft/applicability', {
        aircraft,
        applicability,
        summary,
        groupedItems,
      });
    } catch (err: any) {
      if (err.message === 'INVALID_AIRCRAFT') {
        return res.status(404).send('Aircraft not found');
      }

      res.status(500).send(err.message);
    }
  }

  static async showByRegistration(req: Request, res: Response) {
    try {
      const registration = AircraftController.getParam(req.params.registration);
      const aircraft = await Aircraft.findOne({
        where: { registration: registration.toUpperCase() },
        include: [
          {
            model: ComponentModel,
            attributes: AircraftController.componentModelAttributes,
            include: [
              AircraftController.manufacturerInclude(),
              AircraftController.assetTypeInclude(),
              {
                model: ServiceBulletin,
                as: 'ApplicableServiceBulletins',
                through: { attributes: [] },
                attributes: AircraftController.serviceBulletinAttributes,
                required: false
              }
            ]
          },
          {
            model: AircraftComponent,
            as: 'installed_components',
            required: false,
            include: [
              {
                model: ComponentModel,
                attributes: AircraftController.componentModelAttributes,
                include: [AircraftController.manufacturerInclude()]
              }
            ]
          },
          {
            model: CustomerAircraftLink,
            as: 'CustomerLinks',
            required: false,
            include: [
              {
                model: Customer,
                as: 'Customer',
              }
            ]
          }
        ]
      });

      if (!aircraft) {
        return res.status(404).send('Aircraft not found');
      }

      await AircraftController.attachServiceBulletinCompliance(aircraft);
      const sbFilters = AircraftController.getServiceBulletinFilters(req);
      const serviceBulletins = await AircraftService.getServiceBulletinsForAircraft(aircraft.id, sbFilters);
      const applicableStandardTasks =
        await AircraftService.getApplicableStandardTasksForAircraft(aircraft.id);
      const selectedManufacturerId =
        (aircraft as any).ComponentModel?.manufacturer_id ||
        (aircraft as any).ComponentModel?.Manufacturer?.id;
      const { manufacturers, categories, manufacturerModels } =
        await AircraftController.getAircraftFormOptions(selectedManufacturerId);

      const componentModels = await ComponentModel.findAll({
        attributes: ['id', 'model_name', 'model_code', 'manufacturer_id', 'asset_type_id', 'is_active'],
        include: [
          {
            ...AircraftController.assetTypeInclude(false, {
              is_installable_on_aircraft: true
            })
          },
          AircraftController.manufacturerInclude()
        ],
        order: [['model_name', 'ASC']]
      });

      const customerOptions = await CustomersService.getActiveCustomers();
      const customerLinks = ((aircraft as any).CustomerLinks || []).slice().sort((left: any, right: any) => {
        if (left.is_current !== right.is_current) {
          return left.is_current ? -1 : 1;
        }

        return String(right.start_date || '').localeCompare(String(left.start_date || ''));
      });
      const currentCustomerLinks = customerLinks.filter((link: any) => link.is_current);
      const historicalCustomerLinks = customerLinks.filter((link: any) => !link.is_current);
      const serializedWorkflowContext =
        await AircraftController.getSerializedWorkflowContext(aircraft.id);

      res.render('aircraft/view', {
        aircraft,
        categories,
        componentModels,
        manufacturerModels,
        manufacturers,
        serviceBulletins,
        sbFilters,
        aircraftViewPath: `/aircraft/${aircraft.registration}`,
        customerOptions,
        currentCustomerLinks,
        historicalCustomerLinks,
        applicableStandardTasks,
        ...serializedWorkflowContext,
      });
    } catch (err: any) {
      res.status(500).send(err.message);
    }
  }

  static async assignCustomer(req: Request, res: Response) {
    try {
      const aircraftId = AircraftController.getParam(req.params.id);

      await CustomersService.assignAircraftToCustomer({
        aircraft_id: aircraftId,
        customer_id: String(req.body.customer_id || ''),
        relationship_type: String(req.body.relationship_type || ''),
        start_date: String(req.body.start_date || ''),
        notes: typeof req.body.notes === 'string' ? req.body.notes : null,
        actor_id: (req.user as any)?.id || null,
      });

      req.flash('success', 'Aircraft customer link saved successfully.');
      res.redirect(`/aircraft/view/${aircraftId}`);
    } catch (err: any) {
      const message = err?.message || 'Unable to link aircraft to customer.';

      switch (message) {
        case 'CUSTOMER_ID_REQUIRED':
          req.flash('error', 'A customer must be selected.');
          break;
        case 'RELATIONSHIP_TYPE_REQUIRED':
          req.flash('error', 'Relationship type is required.');
          break;
        case 'START_DATE_REQUIRED':
          req.flash('error', 'A valid start date is required.');
          break;
        case 'CURRENT_CUSTOMER_ALREADY_ASSIGNED':
          req.flash('error', 'That customer relationship is already current for this aircraft.');
          break;
        case 'CUSTOMER_NOT_FOUND':
          req.flash('error', 'Customer not found.');
          break;
        case 'AIRCRAFT_NOT_FOUND':
          req.flash('error', 'Aircraft not found.');
          break;
        default:
          req.flash('error', message);
          break;
      }

      res.redirect(`/aircraft/view/${AircraftController.getParam(req.params.id)}`);
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const aircraftId = AircraftController.getParam(req.params.id);
      const uploadedPhotoPath =
        (req as any).file ? `/uploads/aircraft/${(req as any).file.filename}` : undefined;

      await AircraftService.updateDetails(aircraftId, {
        registration: req.body.registration,
        serial_number: req.body.serial_number,
        model_id: req.body.model_id,
        category_id: req.body.category_id,
        total_time_hours: req.body.total_time_hours,
        total_time_cycles: req.body.total_time_cycles,
        loaded_into_system_at: req.body.loaded_into_system_at,
        manufacture_date: req.body.manufacture_date,
        tcds_number: req.body.tcds_number,
        tcds_url: req.body.tcds_url,
        photo_url: uploadedPhotoPath,
        version: req.body.version,
      });

      if (req.method === 'PATCH') {
        return res.status(204).send();
      }

      res.redirect(`/aircraft/view/${aircraftId}`);
    } catch (err: any) {
      if (err.message === 'AIRCRAFT_NOT_FOUND') {
        return res.status(404).send(err.message);
      }

      if (err.message === 'STALE_AIRCRAFT_RECORD') {
        return res.status(409).send(err.message);
      }

      res.status(400).send(err.message);
    }
  }

  static async transition(req: Request, res: Response) {
    try {
      const aircraftId = AircraftController.getParam(req.params.id);
      const { action, reason } = req.body;

      switch (action) {
        case 'ACTIVATE':
          await AircraftService.activate(aircraftId, reason);
          break;
        case 'GROUND':
          await AircraftService.ground(aircraftId, reason);
          break;
        case 'RETURN_TO_SERVICE':
          await AircraftService.returnToService(aircraftId, reason);
          break;
        case 'RETIRE':
          await AircraftService.retire(aircraftId, reason);
          break;
        default:
          throw new Error('INVALID_TRANSITION_ACTION');
      }

      res.redirect(`/aircraft/view/${aircraftId}`);
    } catch (err: any) {
      res.status(422).send(err.message);
    }
  }

  static async installComponent(req: Request, res: Response) {
    try {
      const aircraftId = AircraftController.getParam(req.params.id);
      const data = {
        ...req.body,
        aircraft_id: aircraftId
      };

      await AircraftComponentService.installComponent(data);

      res.redirect(`/aircraft/view/${aircraftId}`);
    } catch (err: any) {
      res.status(400).send(err.message);
    }
  }

  static async installSerializedComponent(req: Request, res: Response) {
    const aircraftId = AircraftController.getParam(req.params.id);

    try {
      await AircraftComponentService.installSerializedComponent({
        ...req.body,
        aircraft_id: aircraftId,
      });

      req.flash('success', 'Serialized authoritative installation recorded successfully.');
    } catch (err: any) {
      req.flash('error', err.message);
    }

    res.redirect(`/aircraft/view/${aircraftId}?tab=installed-components`);
  }

  static async baselineCaptureSerializedComponent(req: Request, res: Response) {
    const aircraftId = AircraftController.getParam(req.params.id);

    try {
      await AircraftComponentService.baselineCaptureSerializedComponent({
        ...req.body,
        aircraft_id: aircraftId,
      });

      req.flash('success', 'Baseline capture recorded for inherited aircraft configuration.');
    } catch (err: any) {
      req.flash('error', err.message);
    }

    res.redirect(`/aircraft/view/${aircraftId}?tab=installed-components`);
  }

  static async removeSerializedComponent(req: Request, res: Response) {
    const aircraftId = AircraftController.getParam(req.params.id);
    const installationId = AircraftController.getParam(req.params.installationId);

    try {
      await AircraftComponentService.removeSerializedComponent({
        ...req.body,
        aircraft_id: aircraftId,
        installation_id: installationId,
      });

      req.flash('success', 'Serialized component removal recorded successfully.');
    } catch (err: any) {
      req.flash('error', err.message);
    }

    res.redirect(`/aircraft/view/${aircraftId}?tab=installed-components`);
  }

  static async updateServiceBulletinCompliance(req: Request, res: Response) {
    try {
      const aircraftId = AircraftController.getParam(req.params.id);
      const serviceBulletinId = AircraftController.getParam(req.params.serviceBulletinId);
      await AircraftService.updateServiceBulletinCompliance({
        aircraft_id: aircraftId,
        service_bulletin_id: serviceBulletinId,
        status: req.body.status,
        notes: req.body.notes,
      });

      res.redirect(`/aircraft/view/${aircraftId}`);
    } catch (err: any) {
      res.status(400).send(err.message);
    }
  }

  static async complyServiceBulletin(req: Request, res: Response) {
    try {
      const aircraftId = AircraftController.getParam(req.params.id);
      const sbId = AircraftController.getParam(req.params.sbId);
      await AircraftService.markServiceBulletinComplied(
        aircraftId,
        sbId
      );

      const serviceBulletin =
        await AircraftController.getAircraftServiceBulletinOrThrow(
          aircraftId,
          sbId
        );

      if (req.get('HX-Request') === 'true') {
        return res.render('aircraft/partials/service-bulletin-row', {
          aircraftId,
          sb: serviceBulletin
        });
      }

      res.redirect(`/aircraft/view/${aircraftId}`);
    } catch (err: any) {
      if (err.message === 'SERVICE_BULLETIN_NOT_FOUND') {
        return res.status(404).send('Service bulletin not found');
      }

      res.status(400).send(err.message);
    }
  }

  static async markServiceBulletinNotApplicable(req: Request, res: Response) {
    try {
      const aircraftId = AircraftController.getParam(req.params.id);
      const sbId = AircraftController.getParam(req.params.sbId);
      await AircraftService.markServiceBulletinNotApplicable(
        aircraftId,
        sbId
      );

      const serviceBulletin =
        await AircraftController.getAircraftServiceBulletinOrThrow(
          aircraftId,
          sbId
        );

      if (req.get('HX-Request') === 'true') {
        return res.render('aircraft/partials/service-bulletin-row', {
          aircraftId,
          sb: serviceBulletin
        });
      }

      res.redirect(`/aircraft/view/${aircraftId}`);
    } catch (err: any) {
      if (err.message === 'SERVICE_BULLETIN_NOT_FOUND') {
        return res.status(404).send('Service bulletin not found');
      }

      res.status(400).send(err.message);
    }
  }

  static async getServiceBulletins(req: Request, res: Response) {
    try {
      const aircraftId = AircraftController.getParam(req.params.id);
      const serviceBulletins = await AircraftService.getServiceBulletinsForAircraft(
        aircraftId,
        AircraftController.getServiceBulletinFilters(req)
      );
      res.json(serviceBulletins);
    } catch (err: any) {
      if (err.message === 'AIRCRAFT_NOT_FOUND') {
        return res.status(404).json({ error: 'Aircraft not found' });
      }

      res.status(500).json({ error: err.message });
    }
  }
}
