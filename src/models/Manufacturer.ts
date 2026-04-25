import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class Manufacturer extends Model {
  declare id: string;
  declare name: string;
  declare code: string | null;
  declare description: string | null;
  declare website: string | null;
  declare logo_url: string | null;
  declare address_line_1: string | null;
  declare address_line_2: string | null;
  declare city: string | null;
  declare state: string | null;
  declare country: string | null;
  declare postal_code: string | null;
  declare current_owner: string | null;
  declare is_active: boolean;
  declare is_operational: boolean;
  declare support_email: string | null;
  declare support_phone: string | null;
  declare notes: string | null;
}

Manufacturer.init(
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
    code: {
      type: DataTypes.STRING,
      unique: true,
    },
    description: DataTypes.TEXT,
    website: DataTypes.STRING,
    logo_url: DataTypes.TEXT,
    address_line_1: DataTypes.TEXT,
    address_line_2: DataTypes.TEXT,
    city: DataTypes.TEXT,
    state: DataTypes.TEXT,
    country: DataTypes.TEXT,
    postal_code: DataTypes.TEXT,
    current_owner: DataTypes.TEXT,
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    is_operational: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    support_email: DataTypes.TEXT,
    support_phone: DataTypes.TEXT,
    notes: DataTypes.TEXT,
  },
  {
    sequelize,
    tableName: 'manufacturers',
    timestamps: false,
  }
);
