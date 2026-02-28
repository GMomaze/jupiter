import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.js';

export class Workpack extends Model {
  declare id: string;
  declare work_order_number: string;
  declare aircraft_id: string;
  declare status_id: string;
  declare version: number;
}

Workpack.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    work_order_number: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    aircraft_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'workpacks',
    underscored: true,
    version: true,
  }
);