import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class ComponentModel extends Model {
  declare id: string;
  declare model_name: string;
  declare model_code: string | null;
  declare manufacturer_id: string;
  declare asset_type_id: string;
  declare default_tbo_hours: number | null;
  declare default_tbo_months: number | null;
  declare service_interval_hours: number | null;
  declare service_interval_months: number | null;
  declare overhaul_interval_hours: number | null;
  declare overhaul_interval_months: number | null;
  declare maintenance_notes: string | null;
  declare is_life_limited: boolean;
  declare is_active: boolean;
  declare warning_threshold_percent: number | null;
  declare created_at: Date | null;
  declare Manufacturer?: any;
  declare AssetType?: any;
}

ComponentModel.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    model_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    model_code: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    default_tbo_hours: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    default_tbo_months: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    service_interval_hours: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    service_interval_months: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    overhaul_interval_hours: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    overhaul_interval_months: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    maintenance_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_life_limited: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    manufacturer_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    asset_type_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'component_models',
    timestamps: false,
  }
);
