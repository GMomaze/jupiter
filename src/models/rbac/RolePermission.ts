import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.js';

export class RolePermission extends Model {
  declare role_id: string;
  declare permission_id: string;
}

RolePermission.init(
  {
    role_id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    permission_id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
  },
  {
    sequelize,
    tableName: 'rf_role_permissions',
    timestamps: false,
  }
);