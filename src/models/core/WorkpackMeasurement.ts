import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.js';

export class WorkpackMeasurement extends Model {
  declare id: string;
  declare execution_id: string;
  declare field_key: string;
  declare field_label: string;
  declare position: number;
  declare value: string | null;
}

WorkpackMeasurement.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    execution_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    field_key: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    field_label: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    value: DataTypes.STRING,
  },
  {
    sequelize,
    tableName: 'workpack_measurements',
    underscored: true,
  }
);
