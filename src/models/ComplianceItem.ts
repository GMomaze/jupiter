import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class ComplianceItem extends Model {
  declare id: string;
  declare item_type: 'AD' | 'SB';
  declare code: string;
  declare title: string;
  declare description: string | null;
  declare authority: string | null;
  declare revision: string | null;
  declare issued_on: Date | null;
  declare effective_on: Date | null;
  declare source_table: string | null;
  declare source_type: 'AD' | 'SB';
  declare source_id: string;
  declare compliance_basis: string;
  declare status: string;
  declare notes: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

ComplianceItem.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    item_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    code: {
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
    authority: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    revision: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    issued_on: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    effective_on: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    source_table: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    source_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    source_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    compliance_basis: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'MANUAL',
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    notes: {
      type: DataTypes.TEXT,
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
    tableName: 'compliance_items',
    underscored: true,
  }
);
