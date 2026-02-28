import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class ComponentModel extends Model {
  declare id: string;
  declare model_name: string;
  declare manufacturer_id: string;
  declare asset_type_id: string;
  declare default_tbo_hours: number | null;
  declare default_tbo_months: number | null;
  declare is_life_limited: boolean;
  declare is_active: boolean;
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
    default_tbo_hours: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    default_tbo_months: {
      type: DataTypes.INTEGER,
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
  },
  {
    sequelize,
    tableName: 'component_models',
    timestamps: false,
  }
);