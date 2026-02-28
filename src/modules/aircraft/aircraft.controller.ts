import { Request, Response } from 'express';

import { AircraftService } from './aircraft.service.ts';
import { AircraftComponentService } from './aircraft-component.service.ts';

import {
  Aircraft,
  ComponentModel,
  AssetType,
  Manufacturer,
  AircraftComponent
} from '../../models/index.ts';

export class AircraftController {

  static async index(req: Request, res: Response) {
    try {
      const aircraft = await Aircraft.findAll({
        include: [
          {
            model: ComponentModel,
            include: [Manufacturer]
          }
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
      const manufacturers = await Manufacturer.findAll({
        order: [['name', 'ASC']]
      });

      const assetTypes = await AssetType.findAll({
        order: [['code', 'ASC']]
      });

      res.render('aircraft/create', {
        manufacturers,
        assetTypes
      });

    } catch (err: any) {
      res.status(500).send(err.message);
    }
  }

  static async getModelsByManufacturer(req: Request, res: Response) {
    try {
      const models = await ComponentModel.findAll({
        where: {
          manufacturer_id: req.params.manufacturerId
        },
        include: [Manufacturer],
        order: [['model_name', 'ASC']]
      });

      res.render('aircraft/partials/model-options', { models });

    } catch (err: any) {
      res.status(500).send(err.message);
    }
  }

  static async create(req: Request, res: Response) {
    try {
      const { registration, serial_number, model_id } = req.body;

      const aircraft = await AircraftService.create({
        registration,
        serial_number,
        model_id
      });

      res.redirect(`/aircraft/view/${aircraft.id}`);

    } catch (err: any) {
      res.status(400).send(err.message);
    }
  }

  static async showView(req: Request, res: Response) {
    try {
      const aircraft = await Aircraft.findByPk(req.params.id, {
        include: [
          {
            model: ComponentModel,
            include: [Manufacturer, AssetType]
          },
          {
            model: AircraftComponent,
            as: 'installed_components',
            required: false,
            include: [
              {
                model: ComponentModel,
                include: [Manufacturer]
              }
            ]
          }
        ]
      });

      if (!aircraft) {
        return res.status(404).send('Aircraft not found');
      }

      // ✅ Future-proof filtering using domain flag
      const componentModels = await ComponentModel.findAll({
        include: [
          {
            model: AssetType,
            where: {
              is_installable_on_aircraft: true
            }
          },
          Manufacturer
        ],
        order: [['model_name', 'ASC']]
      });

      res.render('aircraft/view', {
        aircraft,
        componentModels
      });

    } catch (err: any) {
      res.status(500).send(err.message);
    }
  }

  static async showByRegistration(req: Request, res: Response) {
    try {
      const aircraft = await Aircraft.findOne({
        where: { registration: req.params.registration.toUpperCase() },
        include: [
          {
            model: ComponentModel,
            include: [Manufacturer, AssetType]
          },
          {
            model: AircraftComponent,
            as: 'installed_components',
            required: false,
            include: [
              {
                model: ComponentModel,
                include: [Manufacturer]
              }
            ]
          }
        ]
      });

      if (!aircraft) {
        return res.status(404).send('Aircraft not found');
      }

      const componentModels = await ComponentModel.findAll({
        include: [
          {
            model: AssetType,
            where: {
              is_installable_on_aircraft: true
            }
          },
          Manufacturer
        ],
        order: [['model_name', 'ASC']]
      });

      res.render('aircraft/view', {
        aircraft,
        componentModels
      });

    } catch (err: any) {
      res.status(500).send(err.message);
    }
  }

  static async update(req: Request, res: Response) {
    try {
      const { serial_number, version } = req.body;

      await AircraftService.updateAllowedFields(req.params.id, {
        serial_number,
        version: Number(version)
      });

      res.status(204).send();

    } catch (err: any) {
      res.status(409).send(err.message);
    }
  }

  static async transition(req: Request, res: Response) {
    try {
      const { action, reason } = req.body;

      switch (action) {
        case 'ACTIVATE':
          await AircraftService.activate(req.params.id, reason);
          break;
        case 'GROUND':
          await AircraftService.ground(req.params.id, reason);
          break;
        case 'RETURN_TO_SERVICE':
          await AircraftService.returnToService(req.params.id, reason);
          break;
        case 'RETIRE':
          await AircraftService.retire(req.params.id, reason);
          break;
        default:
          throw new Error('INVALID_TRANSITION_ACTION');
      }

      res.redirect(`/aircraft/view/${req.params.id}`);

    } catch (err: any) {
      res.status(422).send(err.message);
    }
  }

  static async installComponent(req: Request, res: Response) {
    try {
      const data = {
        ...req.body,
        aircraft_id: req.params.id
      };

      await AircraftComponentService.installComponent(data);

      res.redirect(`/aircraft/view/${req.params.id}`);

    } catch (err: any) {
      res.status(400).send(err.message);
    }
  }
}
