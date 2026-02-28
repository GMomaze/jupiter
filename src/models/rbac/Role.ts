import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.js';

export class Role extends Model {
  declare id: string;
  declare code: string;
  declare label: string;
  declare description: string | null;
  declare is_active: boolean;
  declare system_locked: boolean;
}

Role.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: DataTypes.TEXT,
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    system_locked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'rf_role',
    timestamps: false,
  }
);