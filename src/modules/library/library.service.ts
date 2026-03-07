/**
 * PATH: src/modules/library/library.service.ts
 */

import {
  AssetType,
  Manufacturer,
  ComponentModel,
  MaintenanceRequirement,
} from '../../models/index.js';

export class LibraryService {

  /**
   * Fetch asset types
   */
  static async getAssetTypes() {

    return AssetType.findAll({
      order: [['code', 'ASC']]
    });

  }

  /**
   * Fetch manufacturers filtered by asset type
   */
  static async getManufacturersByAssetType(assetTypeId: string) {

    console.log("LIBRARY:getManufacturersByAssetType", assetTypeId);

    const manufacturers = await Manufacturer.findAll({

      include: [
        {
          model: ComponentModel,
          required: true,
          attributes: [],
          where: {
            asset_type_id: assetTypeId
          }
        }
      ],

      attributes: ['id', 'name'],

      order: [['name', 'ASC']],

      group: ['Manufacturer.id']

    });

    return manufacturers;

  }

  /**
   * Create manufacturer
   */
  static async createManufacturer(assetTypeId: string, name: string) {

    const manufacturer = await Manufacturer.create({
      name,
      code: name.replace(/\s+/g, "_").toUpperCase()
    });

    /**
     * Create generic model to link manufacturer to asset type
     */
    await ComponentModel.create({
      manufacturer_id: manufacturer.id,
      asset_type_id: assetTypeId,
      model_name: "GENERIC"
    });

    return manufacturer;

  }

  /**
   * Delete manufacturer
   */
  static async deleteManufacturer(manufacturerId: string) {

    const deleted = await Manufacturer.destroy({
      where: { id: manufacturerId }
    });

    return deleted > 0;

  }

  /**
   * Fetch models filtered by manufacturer and asset type
   */
  static async getModelsByManufacturerAndAssetType(
    manufacturerId: string,
    assetTypeId: string
  ) {

    return ComponentModel.findAll({

      where: {
        manufacturer_id: manufacturerId,
        asset_type_id: assetTypeId
      },

      order: [['model_name', 'ASC']]

    });

  }

  /**
   * Fetch single model
   */
  static async getModelById(id: string) {

    return ComponentModel.findByPk(id);

  }

  /**
   * Fetch model requirements
   */
  static async getModelRequirements(modelId: string) {

    return MaintenanceRequirement.findAll({

      where: { model_id: modelId },

      order: [['interval_hours', 'ASC']]

    });

  }

  /**
   * Create model
   */
  static async createModel(data: {
    manufacturer_id: string;
    asset_type_id: string;
    model_name: string;
    default_tbo_hours?: number;
    default_tbo_months?: number;
    is_life_limited?: boolean;
  }) {

    return ComponentModel.create({
      manufacturer_id: data.manufacturer_id,
      asset_type_id: data.asset_type_id,
      model_name: data.model_name,
      default_tbo_hours: data.default_tbo_hours ?? null,
      default_tbo_months: data.default_tbo_months ?? null,
      is_life_limited: data.is_life_limited ?? false
    });

  }

  /**
   * Update model
   */
  static async updateModel(
    id: string,
    data: {
      model_name: string;
      default_tbo_hours?: number;
      default_tbo_months?: number;
      is_life_limited?: boolean;
    }
  ) {

    await ComponentModel.update({

      model_name: data.model_name,
      default_tbo_hours: data.default_tbo_hours ?? null,
      default_tbo_months: data.default_tbo_months ?? null,
      is_life_limited: data.is_life_limited ?? false

    }, {
      where: { id }
    });

    return ComponentModel.findByPk(id);

  }

  /**
   * Create maintenance requirement
   */
  static async createRequirement(data: {
    model_id: string;
    title: string;
    interval_hours?: number;
    interval_months?: number;
    description?: string;
  }) {

    return MaintenanceRequirement.create({

      model_id: data.model_id,
      title: data.title,
      interval_hours: data.interval_hours ?? null,
      interval_months: data.interval_months ?? null,
      description: data.description ?? null

    });

  }

  /**
   * Update requirement
   */
  static async updateRequirement(
    id: string,
    data: {
      title: string;
      interval_hours?: number;
      interval_months?: number;
      description?: string;
    }
  ) {

    await MaintenanceRequirement.update({

      title: data.title,
      interval_hours: data.interval_hours ?? null,
      interval_months: data.interval_months ?? null,
      description: data.description ?? null

    }, {
      where: { id }
    });

    return MaintenanceRequirement.findByPk(id);

  }

  /**
   * Delete requirement
   */
  static async deleteRequirement(id: string) {

    const deleted = await MaintenanceRequirement.destroy({
      where: { id }
    });

    return deleted > 0;

  }

}