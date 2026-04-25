import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class ServiceBulletin extends Model {
  declare id: string;
  declare sb_number: string;
  declare title: string;
  declare description: string | null;
  declare issued_on: Date | null;
  declare compliance_type: string;
  declare source_primary: string;
  declare source_refs: unknown;
  declare status: string;
  declare revision: string | null;
  declare document_url: string | null;
}

ServiceBulletin.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    sb_number: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: DataTypes.TEXT,
    issued_on: DataTypes.DATEONLY,
    compliance_type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'MANUAL',
    },
    source_primary: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'MANUAL',
    },
    source_refs: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    revision: DataTypes.STRING,
    document_url: DataTypes.TEXT,
  },
  {
    sequelize,
    tableName: 'service_bulletins',
    underscored: true,
  }
);
