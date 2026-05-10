import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class Customer extends Model {
  declare id: string;
  declare name: string;
  declare contact_person: string;
  declare email: string;
  declare phone: string;
  declare alternate_phone: string | null;
  declare billing_address_line_1: string | null;
  declare billing_address_line_2: string | null;
  declare billing_city: string | null;
  declare billing_state_or_province: string | null;
  declare billing_postal_code: string | null;
  declare billing_country: string | null;
  declare physical_address_line_1: string | null;
  declare physical_address_line_2: string | null;
  declare physical_city: string | null;
  declare physical_state_or_province: string | null;
  declare physical_postal_code: string | null;
  declare physical_country: string | null;
  declare vat_number: string | null;
  declare tax_number: string | null;
  declare account_reference: string | null;
  declare status: 'ACTIVE' | 'INACTIVE';
  declare notes: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

Customer.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    contact_person: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    alternate_phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    billing_address_line_1: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    billing_address_line_2: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    billing_city: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    billing_state_or_province: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    billing_postal_code: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    billing_country: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    physical_address_line_1: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    physical_address_line_2: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    physical_city: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    physical_state_or_province: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    physical_postal_code: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    physical_country: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    vat_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tax_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    account_reference: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'ACTIVE',
      validate: {
        isIn: [['ACTIVE', 'INACTIVE']],
      },
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
    tableName: 'customers',
    underscored: true,
    indexes: [
      { fields: ['status'] },
      { fields: ['name'] },
      { fields: ['account_reference'] },
    ],
  }
);
