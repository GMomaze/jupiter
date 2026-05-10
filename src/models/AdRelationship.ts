import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class AdRelationship extends Model {
  declare id: string;
  declare ad_id: string;
  declare related_ad_number: string | null;
  declare relationship_type: string | null;
}

AdRelationship.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    ad_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    related_ad_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    relationship_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'ad_relationships',
    underscored: true,
    timestamps: false,
    indexes: [
      {
        fields: ['ad_id'],
      },
    ],
  }
);
