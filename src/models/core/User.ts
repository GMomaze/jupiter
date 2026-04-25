import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.js';

export class User extends Model {
  declare id: string;
  declare email: string;
  declare password_hash: string;
  declare full_name: string;
  declare is_active: boolean;
  declare Roles?: any[];
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    full_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'users',
    underscored: true,
    timestamps: false,
    hooks: {
      beforeCreate: (user: User) => {
        user.email = user.email.toLowerCase();
      },
      beforeUpdate: (user: User) => {
        user.email = user.email.toLowerCase();
      },
    }
  }
);
