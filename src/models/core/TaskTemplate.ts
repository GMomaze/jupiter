import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.js';

export class TaskTemplate extends Model {
  declare id: string;
  declare scope: 'GLOBAL' | 'MODEL' | 'AIRCRAFT' | 'MPI';
  declare task_card_number: string;
  declare sort_order: number;
  declare title: string;
  declare description: string;
  declare source_type: string | null;
  declare interval_hours: number | null;
  declare interval_months: number | null;
  declare model_applicability: string | null;
  declare aircraft_applicability: string | null;
  declare aircraft_model_id: string | null;
  declare aircraft_id: string | null;
  declare is_active: boolean;

  // Applicability Flags
  declare is_required_for_wood: boolean;
  declare is_required_for_fabric: boolean;
  declare is_required_for_bungees: boolean;
  declare is_required_for_woodprop: boolean;
  declare is_required_for_retractable: boolean;
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
      defaultValue: 'GLOBAL',
    },
    task_card_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    sort_order: {
      type: DataTypes.DECIMAL(10, 2),
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
    source_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    interval_hours: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    interval_months: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    model_applicability: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    aircraft_applicability: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    is_required_for_wood: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_required_for_fabric: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_required_for_bungees: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_required_for_woodprop: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_required_for_retractable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'task_templates',
    underscored: true,
  }
);
