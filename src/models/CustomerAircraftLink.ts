import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

const ALLOWED_RELATIONSHIP_TYPES = [
  'OWNER',
  'CO_OWNER',
  'OPERATOR',
  'BILLING_CUSTOMER',
  'MANAGEMENT_COMPANY',
  'CONTACT_ONLY',
] as const;

export class CustomerAircraftLink extends Model {
  declare id: string;
  declare customer_id: string;
  declare aircraft_id: string;
  declare relationship_type: typeof ALLOWED_RELATIONSHIP_TYPES[number];
  declare is_current: boolean;
  declare start_date: string;
  declare end_date: string | null;
  declare notes: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

CustomerAircraftLink.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    customer_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    aircraft_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    relationship_type: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [ALLOWED_RELATIONSHIP_TYPES],
      },
    },
    is_current: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isAfterStartDate(this: CustomerAircraftLink) {
          if (this.end_date && this.start_date && this.end_date < this.start_date) {
            throw new Error('end_date cannot be earlier than start_date');
          }
        },
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
    tableName: 'customer_aircraft_links',
    underscored: true,
    indexes: [
      { fields: ['customer_id'] },
      { fields: ['aircraft_id'] },
      { fields: ['relationship_type'] },
      { fields: ['is_current'] },
      { fields: ['aircraft_id', 'is_current'] },
      { fields: ['customer_id', 'is_current'] },
      { fields: ['aircraft_id', 'relationship_type', 'is_current'] },
      { fields: ['customer_id', 'relationship_type', 'is_current'] },
      { fields: ['aircraft_id', 'customer_id', 'relationship_type'] },
      { fields: ['start_date'] },
      { fields: ['end_date'] },
    ],
  }
);
