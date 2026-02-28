import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.js';

export class UserRole extends Model {
  declare user_id: string;
  declare role_id: string;
}

UserRole.init(
  {
    user_id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    role_id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
  },
  {
    sequelize,
    tableName: 'user_roles',
    timestamps: false,
  }
);