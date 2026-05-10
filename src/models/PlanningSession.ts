import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class PlanningSession extends Model {
  declare id: string;
  declare user_id: string;
  declare created_by: string | null;
  declare aircraft_id: string;
  declare template_id: string;
  declare maintenance_type: string;
  declare candidate_content: Record<string, unknown>;
  declare selected_item_ids: string[];
  declare status: 'DRAFT' | 'IN_PROGRESS' | 'READY_FOR_GENERATION' | 'GENERATED';
  declare generated_workpack_id: string | null;
  declare finalized_by: string | null;
  declare finalized_at: Date | null;
  declare created_at: Date;
  declare updated_at: Date;
}

PlanningSession.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    aircraft_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    template_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    maintenance_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    candidate_content: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    selected_item_ids: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'DRAFT',
    },
    generated_workpack_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    finalized_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    finalized_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'planning_sessions',
    underscored: true,
    indexes: [
      { fields: ['user_id'] },
      { fields: ['aircraft_id'] },
      { fields: ['template_id'] },
      { fields: ['status'] },
      { fields: ['user_id', 'status', 'updated_at'] },
    ],
  }
);
