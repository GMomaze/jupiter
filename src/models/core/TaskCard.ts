import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.js';

export class TaskCard extends Model {
  declare id: string;
  declare task_card_number: string;
  declare title: string;
  declare description: string;
  declare status: string;
  declare work_performed: string | null;
  declare template_source_id: string | null;
  declare service_bulletin_id: string | null;
  declare assigned_to: string | null;
  declare mechanic_completed_by: string | null;
  declare mechanic_completed_at: Date | null;
  declare engineer_certified_by: string | null;
  declare engineer_certified_at: Date | null;
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
    task_card_number: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'OPEN',
    },
    work_performed: DataTypes.TEXT,
    template_source_id: DataTypes.UUID,
    service_bulletin_id: DataTypes.UUID,
    assigned_to: DataTypes.UUID,
    mechanic_completed_by: DataTypes.UUID,
    mechanic_completed_at: DataTypes.DATE,
    engineer_certified_by: DataTypes.UUID,
    engineer_certified_at: DataTypes.DATE,
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