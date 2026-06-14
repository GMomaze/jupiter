import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class ServiceBulletin extends Model {
  declare id: string;
  declare manufacturer: string;
  declare sb_number: string;
  declare title: string;
  declare category: string | null;
  declare applicability_make: string | null;
  declare applicability_model: string | null;
  declare applicability_product_type: string | null;
  declare applicability_notes: string | null;
  declare description: string | null;
  declare issued_on: Date | null;
  declare compliance_type: string;
  declare source_primary: string;
  declare source_refs: unknown;
  declare status: string;
  declare revision: string | null;
  declare document_url: string | null;
  declare raw_source_text: string | null;
  declare is_active: boolean;
  declare created_at: Date;
  declare updated_at: Date;

  get reference(): string {
    return this.getDataValue('sb_number');
  }

  set reference(value: string) {
    this.setDataValue('sb_number', value);
  }

  get issue_date(): Date | null {
    return this.getDataValue('issued_on');
  }

  set issue_date(value: Date | null) {
    this.setDataValue('issued_on', value);
  }

  get summary(): string | null {
    return this.getDataValue('description');
  }

  set summary(value: string | null) {
    this.setDataValue('description', value);
  }

  get compliance_requirement(): string {
    return this.getDataValue('compliance_type');
  }

  set compliance_requirement(value: string) {
    this.setDataValue('compliance_type', value);
  }

  get source_file(): string | null {
    return this.getDataValue('document_url');
  }

  set source_file(value: string | null) {
    this.setDataValue('document_url', value);
  }

  get source_format(): string {
    return this.getDataValue('source_primary');
  }

  set source_format(value: string) {
    this.setDataValue('source_primary', value);
  }
}

ServiceBulletin.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    manufacturer: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'UNKNOWN',
    },
    sb_number: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'reference',
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    category: DataTypes.STRING,
    applicability_make: DataTypes.STRING,
    applicability_model: DataTypes.TEXT,
    applicability_product_type: DataTypes.STRING,
    applicability_notes: DataTypes.TEXT,
    description: {
      type: DataTypes.TEXT,
      field: 'summary',
    },
    issued_on: {
      type: DataTypes.DATEONLY,
      field: 'issue_date',
    },
    compliance_type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'MANUAL',
      field: 'compliance_requirement',
    },
    source_primary: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'MANUAL',
      field: 'source_format',
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
    document_url: {
      type: DataTypes.TEXT,
      field: 'source_file',
    },
    raw_source_text: DataTypes.TEXT,
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
    tableName: 'service_bulletins',
    underscored: true,
    hooks: {
      beforeValidate(instance) {
        if (!instance.manufacturer) {
          instance.manufacturer = instance.source_primary || 'UNKNOWN';
        }

        if (!instance.sb_number) {
          instance.sb_number = 'UNSPECIFIED';
        }

        if (!instance.compliance_type) {
          instance.compliance_type = 'MANUAL';
        }

        if (!instance.source_primary) {
          instance.source_primary = 'MANUAL';
        }

        if (instance.is_active === undefined || instance.is_active === null) {
          instance.is_active = !instance.status || instance.status.toUpperCase() === 'ACTIVE';
        }
      },
    },
  }
);
