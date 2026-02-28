/**
 * PATH: C:\GMO\Projects\jupiter\src\modules\library\library.service.ts
 * PURPOSE: Service for managing the component and requirement library.
 */

import {
  AssetType,
  Manufacturer,
  ComponentModel,
  MaintenanceRequirement,
} from '../../models/index.js';

export class LibraryService {
  /**
   * Fetch all asset types (AIRFRAME, ENGINE, etc.)
   */
  static async getAssetTypes() {
    return AssetType.findAll({
      order: [['code', 'ASC']],
    });
  }

  /**
   * Fetch manufacturers that have models for a specific asset type.
   */
  static async getManufacturersByAssetType(assetTypeId: string) {
    return Manufacturer.findAll({
      include: [
        {
          model: ComponentModel,
          where: { asset_type_id: assetTypeId },
          attributes: [],
        },
      ],
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
      distinct: true,
    });
  }

  /**
   * Fetch models filtered by manufacturer + asset type.
   */
  static async getModelsByManufacturerAndAssetType(
    manufacturerId: string,
    assetTypeId: string
  ) {
    return ComponentModel.findAll({
      where: {
        manufacturer_id: manufacturerId,
        asset_type_id: assetTypeId,
      },
      order: [['model_name', 'ASC']],
    });
  }

  /**
   * Fetch single model by ID
   */
  static async getModelById(id: string) {
    return ComponentModel.findByPk(id);
  }

  /**
   * Fetch maintenance requirements for a model
   */
  static async getModelRequirements(modelId: string) {
    return MaintenanceRequirement.findAll({
      where: { model_id: modelId },
      order: [['interval_hours', 'ASC']],
    });
  }

  /**
   * CREATE: Add a new model
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
      is_life_limited: data.is_life_limited ?? false,
    });
  }

  /**
   * UPDATE: Update existing model
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
    await ComponentModel.update(
      {
        model_name: data.model_name,
        default_tbo_hours: data.default_tbo_hours ?? null,
        default_tbo_months: data.default_tbo_months ?? null,
        is_life_limited: data.is_life_limited ?? false,
      },
      { where: { id } }
    );

    return ComponentModel.findByPk(id);
  }

  /**
   * CREATE maintenance requirement
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
      description: data.description ?? null,
    });
  }

  /**
   * UPDATE maintenance requirement
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
    await MaintenanceRequirement.update(
      {
        title: data.title,
        interval_hours: data.interval_hours ?? null,
        interval_months: data.interval_months ?? null,
        description: data.description ?? null,
      },
      { where: { id } }
    );

    return MaintenanceRequirement.findByPk(id);
  }

  /**
   * DELETE maintenance requirement
   */
  static async deleteRequirement(id: string) {
    const deleted = await MaintenanceRequirement.destroy({
      where: { id },
    });

    return deleted > 0;
  }
}