import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class SerializedComponent extends Model {
  declare id: string;
  declare component_model_id: string;
  declare serial_number: string;
  declare part_number: string | null;
  declare status: string;
  declare condition: string | null;
  declare notes: string | null;
  declare ComponentModel?: any;
  declare LifeState?: any;
}

SerializedComponent.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    component_model_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    serial_number: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    part_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'AVAILABLE',
    },
    condition: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'serialized_components',
    underscored: true,
    timestamps: true,
  }
);
