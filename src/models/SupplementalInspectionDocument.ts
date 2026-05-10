import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class SupplementalInspectionDocument extends Model {
  declare id: string;
  declare manufacturer: string;
  declare reference: string;
  declare title: string;
  declare description: string | null;
  declare category: string | null;
  declare section_reference: string | null;
  declare ata_chapter: string | null;
  declare initial_interval_hours: number | null;
  declare initial_interval_months: number | null;
  declare repeat_interval_hours: number | null;
  declare repeat_interval_months: number | null;
  declare inspection_operation: string | null;
  declare notes: string | null;
  declare source_document: string | null;
  declare is_active: boolean;
  declare created_at: Date;
  declare updated_at: Date;
}

SupplementalInspectionDocument.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    manufacturer: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    reference: {
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
    category: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    section_reference: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ata_chapter: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    initial_interval_hours: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    initial_interval_months: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    repeat_interval_hours: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    repeat_interval_months: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    inspection_operation: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    source_document: {
      type: DataTypes.STRING,
      allowNull: true,
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
    tableName: 'supplemental_inspection_documents',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['manufacturer', 'reference'],
      },
      {
        fields: ['manufacturer'],
      },
      {
        fields: ['reference'],
      },
      {
        fields: ['category'],
      },
      {
        fields: ['is_active'],
      },
    ],
  }
);
