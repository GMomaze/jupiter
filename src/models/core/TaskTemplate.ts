import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.js';

export class TaskTemplate extends Model {
  declare id: string;
  declare scope: 'GLOBAL' | 'MODEL' | 'AIRCRAFT';
  declare title: string;
  declare description: string;
  declare aircraft_model_id: string | null;
  declare aircraft_id: string | null;
  declare is_active: boolean;
}

TaskTemplate.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    scope: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    aircraft_model_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    aircraft_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'task_templates',
    underscored: true,
  }
);
