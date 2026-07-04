import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class AdServiceBulletinReference extends Model {
  declare id: string;
  declare airworthiness_directive_id: string;
  declare raw_reference_text: string;
  declare normalized_reference_text: string;
  declare matched_service_bulletin_id: string | null;
  declare match_status: 'UNRESOLVED' | 'MATCHED' | 'IGNORED';
  declare match_reason: string | null;
  declare source_context: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

AdServiceBulletinReference.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    airworthiness_directive_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    raw_reference_text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    normalized_reference_text: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    matched_service_bulletin_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    match_status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'UNRESOLVED',
      validate: {
        isIn: [['UNRESOLVED', 'MATCHED', 'IGNORED']],
      },
    },
    match_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    source_context: {
      type: DataTypes.TEXT,
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
    tableName: 'ad_service_bulletin_references',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['airworthiness_directive_id', 'normalized_reference_text'],
      },
      { fields: ['airworthiness_directive_id'] },
      { fields: ['matched_service_bulletin_id'] },
      { fields: ['match_status'] },
      { fields: ['normalized_reference_text'] },
    ],
  }
);
