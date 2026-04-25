import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class ModelSid extends Model {
  declare id: string;
  declare model_id: string;
  declare sid_id: string;
  declare is_active: boolean;
  declare created_at: Date;
}

ModelSid.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    model_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    sid_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
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
  },
  {
    sequelize,
    tableName: 'model_sids',
    underscored: true,
    timestamps: false,
  }
);
