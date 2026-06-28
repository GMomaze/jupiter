import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export type AdApplicabilityAllocationTargetType =
  | 'MANUFACTURER'
  | 'MODEL'
  | 'BROAD_RULE'
  | 'MANUAL_LINK'
  | 'IGNORED'
  | 'UNRESOLVED';

export type AdApplicabilityAllocationStatus =
  | 'SUGGESTED'
  | 'ACCEPTED'
  | 'NEEDS_REVIEW'
  | 'IGNORED'
  | 'RESTORED';

export type AdApplicabilityAllocationClassification =
  | 'EXACT_MODEL_CODE'
  | 'EXACT_MODEL_NAME'
  | 'MANUFACTURER_MATCH'
  | 'BROAD_SERIES'
  | 'BROAD_ALL'
  | 'MULTI_MODEL_REVIEW'
  | 'MANUAL_MODEL_LINK'
  | 'MANUAL_MANUFACTURER_LINK'
  | 'UNRESOLVED_MAKE'
  | 'UNRESOLVED_MODEL'
  | 'IGNORED_BY_USER';

export class AdApplicabilityAllocation extends Model {
  declare id: string;
  declare airworthiness_directive_id: string;
  declare ad_number_snapshot: string;
  declare ad_revision_snapshot: string | null;
  declare source_make: string | null;
  declare source_model: string | null;
  declare source_product_type: string | null;
  declare source_product_subtype: string | null;
  declare source_key: string;
  declare target_type: AdApplicabilityAllocationTargetType;
  declare target_id: string | null;
  declare matched_manufacturer_id: string | null;
  declare matched_component_model_id: string | null;
  declare status: AdApplicabilityAllocationStatus;
  declare classification: AdApplicabilityAllocationClassification;
  declare match_confidence: number | null;
  declare match_reason: string | null;
  declare reviewed_by: string | null;
  declare reviewed_at: Date | null;
  declare review_reason: string | null;
  declare created_by: string | null;
  declare metadata: Record<string, unknown>;
  declare created_at: Date;
  declare updated_at: Date;
}

AdApplicabilityAllocation.init(
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
    ad_number_snapshot: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    ad_revision_snapshot: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    source_make: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    source_model: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    source_product_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    source_product_subtype: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    source_key: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    target_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    target_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    matched_manufacturer_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    matched_component_model_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    classification: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    match_confidence: {
      type: DataTypes.SMALLINT,
      allowNull: true,
    },
    match_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reviewed_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    review_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
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
    tableName: 'ad_applicability_allocations',
    underscored: true,
    indexes: [
      { unique: true, fields: ['airworthiness_directive_id', 'source_key'] },
      { fields: ['airworthiness_directive_id'] },
      { fields: ['ad_number_snapshot'] },
      { fields: ['source_key'] },
      { fields: ['target_type'] },
      { fields: ['target_id'] },
      { fields: ['status'] },
      { fields: ['classification'] },
      { fields: ['matched_manufacturer_id'] },
      { fields: ['matched_component_model_id'] },
      { fields: ['reviewed_by'] },
      { fields: ['reviewed_at'] },
    ],
  }
);
