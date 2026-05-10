import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.js';

export class WorkpackType extends Model {
  declare id: string;
  declare code: string;
  declare label: string;
}

WorkpackType.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'rf_workpack_type',
    timestamps: false,
  }
);
