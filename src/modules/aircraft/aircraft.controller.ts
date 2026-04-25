import { Request, Response } from 'express';

import { AircraftService } from './aircraft.service.js';
import { AircraftComponentService } from './aircraft-component.service.js';

import {
  Aircraft,
  AircraftCategory,
  ComponentModel,
  AssetType,
  Manufacturer,
  AircraftComponent,
  ServiceBulletin,
  AircraftSbCompliance
} from '../../models/index.js';

export class AircraftController {
  private static getParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] || '' : value || '';
  }

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
          }
        ]
      });

      if (!aircraft) {
        return res.status(404).send('Aircraft not found');
      }

      await AircraftController.attachServiceBulletinCompliance(aircraft);
      const sbFilters = AircraftController.getServiceBulletinFilters(req);
      const serviceBulletins = await AircraftService.getServiceBulletinsForAircraft(aircraft.id, sbFilters);
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

      res.render('aircraft/view', {
        aircraft,
        categories,
        componentModels,
        manufacturerModels,
        manufacturers,
        serviceBulletins,
        sbFilters,
        aircraftViewPath: `/aircraft/view/${aircraft.id}`
      });
    } catch (err: any) {
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
          }
        ]
      });

      if (!aircraft) {
        return res.status(404).send('Aircraft not found');
      }

      await AircraftController.attachServiceBulletinCompliance(aircraft);
      const sbFilters = AircraftController.getServiceBulletinFilters(req);
      const serviceBulletins = await AircraftService.getServiceBulletinsForAircraft(aircraft.id, sbFilters);
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

      res.render('aircraft/view', {
        aircraft,
        categories,
        componentModels,
        manufacturerModels,
        manufacturers,
        serviceBulletins,
        sbFilters,
        aircraftViewPath: `/aircraft/${aircraft.registration}`
      });
    } catch (err: any) {
      res.status(500).send(err.message);
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
