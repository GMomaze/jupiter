import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class Manufacturer extends Model {
  declare id: string;
  declare name: string;
  declare code: string | null;
  declare description: string | null;
  declare website: string | null;
  declare is_active: boolean;
}

Manufacturer.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING,
      unique: true,
    },
    description: DataTypes.TEXT,
    website: DataTypes.STRING,
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'manufacturers',
    timestamps: false,
  }
);