import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class ServiceBulletinModel extends Model {
  declare id: string;
  declare service_bulletin_id: string;
  declare model_id: string;
}

ServiceBulletinModel.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    service_bulletin_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    model_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'service_bulletin_models',
    underscored: true,
    timestamps: false,
  }
);
