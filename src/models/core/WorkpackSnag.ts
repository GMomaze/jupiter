import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.js';

export class WorkpackSnag extends Model {
  declare id: string;
  declare workpack_id: string;
  declare snag_no: number;
  declare description: string;
  declare status: string;
  declare category: string | null;
  declare priority: string;
  declare parts_used: string | null;
  declare time_spent_minutes: number | null;
  declare resolution_notes: string | null;
  declare created_by: string | null;
  declare assigned_to: string | null;
  declare resolved_by: string | null;
  declare closed_by: string | null;
  declare started_by: string | null;
  declare created_at: Date | null;
  declare started_at: Date | null;
  declare resolved_at: Date | null;
  declare closed_at: Date | null;
  declare version: number;
}

WorkpackSnag.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    workpack_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    snag_no: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'OPEN',
    },
    category: DataTypes.STRING,
    priority: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'MEDIUM',
    },
    parts_used: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    time_spent_minutes: DataTypes.INTEGER,
    resolution_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: DataTypes.UUID,
    assigned_to: DataTypes.UUID,
    resolved_by: DataTypes.UUID,
    closed_by: DataTypes.UUID,
    started_by: DataTypes.UUID,
    created_at: DataTypes.DATE,
    started_at: DataTypes.DATE,
    resolved_at: DataTypes.DATE,
    closed_at: DataTypes.DATE,
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
  },
  {
    sequelize,
    tableName: 'workpack_snags',
    underscored: true,
    version: true,
  }
);
