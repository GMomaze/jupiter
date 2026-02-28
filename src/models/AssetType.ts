import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class AssetType extends Model {
  declare id: string;
  declare code: string;
  declare label: string;
  declare is_installable_on_aircraft: boolean;
  declare is_required_for_aircraft: boolean;
  declare required_quantity: number;
}

AssetType.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    is_installable_on_aircraft: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_required_for_aircraft: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    required_quantity: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'rf_asset_type',
    timestamps: false,
  }
);