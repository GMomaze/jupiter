import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.js';

export class Permission extends Model {
  declare id: string;
  declare code: string;
  declare label: string;
  declare description: string | null;
  declare module: string;
  declare is_active: boolean;
}

Permission.init(
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
    description: DataTypes.TEXT,
    module: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'rf_permission',
    timestamps: false,
  }
);