import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class SbModelApplicabilityAllocation extends Model {
  declare id: string;
  declare service_bulletin_id: string;
  declare raw_models_affected_text: string;
  declare parsed_token: string | null;
  declare normalized_token: string | null;
  declare classification:
    | 'EXACT_MODEL_CODE'
    | 'SHORTHAND_GROUP'
    | 'BROAD_APPLICABILITY'
    | 'AMBIGUOUS_PHRASE'
    | 'UNPARSED_TEXT';
  declare status:
    | 'MATCHED'
    | 'NEEDS_REVIEW'
    | 'LINKED_MANUALLY'
    | 'MODEL_CREATED_INCOMPLETE'
    | 'BROAD_RULE_MARKED'
    | 'IGNORED';
  declare matched_model_id: string | null;
  declare allocated_model_id: string | null;
  declare created_model_id: string | null;
  declare source_row: number | null;
  declare source_column: string | null;
  declare source_adapter: string;
  declare source_hash: string;
  declare reviewed_by: string | null;
  declare reviewed_at: Date | null;
  declare review_notes: string | null;
  declare ignored_reason: string | null;
  declare parsed_tokens: unknown[];
  declare matched_models: unknown[];
  declare unmatched_tokens: unknown[];
  declare shorthand_expansions: unknown[];
  declare metadata: Record<string, unknown>;
  declare created_at: Date;
  declare updated_at: Date;
}

SbModelApplicabilityAllocation.init(
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
    raw_models_affected_text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    parsed_token: DataTypes.TEXT,
    normalized_token: DataTypes.TEXT,
    classification: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    matched_model_id: DataTypes.UUID,
    allocated_model_id: DataTypes.UUID,
    created_model_id: DataTypes.UUID,
    source_row: DataTypes.INTEGER,
    source_column: DataTypes.STRING,
    source_adapter: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    source_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    reviewed_by: DataTypes.UUID,
    reviewed_at: DataTypes.DATE,
    review_notes: DataTypes.TEXT,
    ignored_reason: DataTypes.TEXT,
    parsed_tokens: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    matched_models: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    unmatched_tokens: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    shorthand_expansions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
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
    tableName: 'sb_model_applicability_allocations',
    underscored: true,
    indexes: [
      { unique: true, fields: ['service_bulletin_id', 'source_hash'] },
      { fields: ['service_bulletin_id'] },
      { fields: ['status'] },
      { fields: ['classification'] },
      { fields: ['matched_model_id'] },
      { fields: ['allocated_model_id'] },
    ],
  }
);
