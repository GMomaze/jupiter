import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class SidModelApplicability extends Model {
  declare id: string;
  declare sid_id: string;
  declare model_id: string;
  declare is_active: boolean;
  declare created_at: Date;
  declare updated_at: Date;
}

SidModelApplicability.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    sid_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    model_id: {
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
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'sid_model_applicability',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['sid_id', 'model_id'],
      },
      {
        fields: ['sid_id'],
      },
      {
        fields: ['model_id'],
      },
    ],
  }
);
