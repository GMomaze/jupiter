import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
import { normalizeManufacturerSourceName } from '../modules/library/manufacturer-source-name-normalization.js';

export type ManufacturerSourceType = 'FAA_AD';

export class ManufacturerSourceName extends Model {
  declare id: string;
  declare manufacturer_id: string;
  declare source_type: ManufacturerSourceType;
  declare source_name: string;
  declare normalized_source_name: string;
  declare is_active: boolean;
  declare created_at: Date;
  declare updated_at: Date;
}

ManufacturerSourceName.init(
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    manufacturer_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    source_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: { isIn: [['FAA_AD']] },
    },
    source_name: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { notEmpty: true },
    },
    normalized_source_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: { notEmpty: true },
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
    tableName: 'manufacturer_source_names',
    underscored: true,
    timestamps: false,
    hooks: {
      beforeValidate(instance) {
        instance.source_name = String(instance.source_name ?? '').trim();
        instance.normalized_source_name = normalizeManufacturerSourceName(instance.source_name);
      },
    },
    indexes: [
      { unique: true, fields: ['source_type', 'normalized_source_name'] },
      { fields: ['manufacturer_id', 'source_type', 'is_active'] },
    ],
  }
);
