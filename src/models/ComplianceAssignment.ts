import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class ComplianceAssignment extends Model {
  declare id: string;
  declare compliance_item_id: string;
  declare assignment_type: 'MODEL' | 'AIRCRAFT';
  declare model_id: string | null;
  declare aircraft_id: string | null;
  declare assignment_source: 'AUTO' | 'MANUAL';
  declare is_active: boolean;
  declare created_at: Date;
  declare updated_at: Date;
}

ComplianceAssignment.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    compliance_item_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    assignment_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    model_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    aircraft_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    assignment_source: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'MANUAL',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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
    tableName: 'compliance_assignments',
    underscored: true,
    indexes: [
      { fields: ['compliance_item_id'] },
      { fields: ['assignment_type'] },
      { fields: ['model_id'] },
      { fields: ['aircraft_id'] },
      { fields: ['assignment_source'] },
      { fields: ['is_active'] },
    ],
  }
);
