import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

const CUSTOMER_USER_STATUSES = ['ACTIVE', 'INVITED', 'DISABLED'] as const;

export class CustomerUser extends Model {
  declare id: string;
  declare customer_id: string;
  declare email: string;
  declare display_name: string;
  declare password_hash: string | null;
  declare status: typeof CUSTOMER_USER_STATUSES[number];
  declare invite_token_hash: string | null;
  declare invite_expires_at: Date | null;
  declare password_reset_token_hash: string | null;
  declare password_reset_expires_at: Date | null;
  declare last_login_at: Date | null;
  declare created_at: Date;
  declare updated_at: Date;
}

CustomerUser.init(
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
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    display_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'INVITED',
      validate: {
        isIn: [CUSTOMER_USER_STATUSES],
      },
    },
    invite_token_hash: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    invite_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    password_reset_token_hash: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    password_reset_expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_login_at: {
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
    tableName: 'customer_users',
    underscored: true,
    indexes: [
      { unique: true, fields: ['email'] },
      { fields: ['customer_id'] },
      { fields: ['status'] },
    ],
  }
);
