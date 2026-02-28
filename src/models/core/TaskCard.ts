import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.js';

export class TaskCard extends Model {
  declare id: string;
  declare title: string;
  declare description: string;
  declare status: string;
  declare assigned_to: string | null;
  declare aircraft_id: string;
  declare component_id: string | null;
  declare version: number;
}

TaskCard.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: DataTypes.TEXT,
    status: {
      type: DataTypes.STRING,
      defaultValue: 'OPEN',
    },
    assigned_to: DataTypes.UUID,
    aircraft_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    component_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'task_cards',
    underscored: true,
    version: true,
  }
);