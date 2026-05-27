import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class AirworthinessDirective extends Model {
  declare id: string;
  declare ad_number: string;
  declare revision: string | null;
  declare subject_heading: string | null;
  declare subject: string | null;
  declare summary: string | null;
  declare comments: string | null;
  declare status: string | null;
  declare cfr_part_reference: string | null;
  declare effective_date: string | null;
  declare authority: string | null;
  declare service_office: string | null;
  declare primary_responsibility_office: string | null;
  declare docket_number: string | null;
  declare citation: string | null;
  declare citation_publish_date: string | null;
  declare make: string | null;
  declare model: string | null;
  declare product_type: string | null;
  declare product_subtype: string | null;
  declare is_recurring: boolean | null;
  declare interval_hours: number | null;
  declare interval_months: number | null;
  declare is_active: boolean;
  declare created_at: Date;
  declare updated_at: Date;
}

AirworthinessDirective.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    ad_number: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    revision: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    subject_heading: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    subject: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    comments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cfr_part_reference: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    effective_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    authority: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    service_office: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    primary_responsibility_office: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    docket_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    citation: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    citation_publish_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    make: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    model: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    product_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    product_subtype: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    is_recurring: {
      type: DataTypes.BOOLEAN,
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
    tableName: 'airworthiness_directives',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['ad_number', 'revision'],
      },
      {
        fields: ['ad_number'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['effective_date'],
      },
      {
        fields: ['make'],
      },
      {
        fields: ['model'],
      },
      {
        fields: ['product_type'],
      },
    ],
  }
);
