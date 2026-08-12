import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class ComponentLifeLimitProposal extends Model {
  declare id: string;
  declare component_model_id: string;
  declare lineage_id: string;
  declare revision_number: number;
  declare proposal_purpose: 'ESTABLISH' | 'REPLACEMENT' | 'WITHDRAWAL';
  declare target_proposal_id: string | null;
  declare determination: 'LIFE_LIMITED' | 'NOT_LIFE_LIMITED' | 'LIMIT_STATUS_UNKNOWN';
  declare applicability_scope: 'ALL_SERIALS_OF_MODEL';
  declare applicability_statement: string;
  declare narrower_effectivity_absent: boolean;
  declare limit_type: string | null;
  declare basis: string | null;
  declare limit_hours: number | null;
  declare limit_cycles: number | null;
  declare limit_months: number | null;
  declare source_reference: string;
  declare source_document_reference: string | null;
  declare source_effective_date: string;
  declare evidence_summary: string;
  declare proposal_reason: string;
  declare status: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN' | 'SUPERSEDED';
  declare proposed_by: string;
  declare proposed_at: Date;
  declare decision_by: string | null;
  declare decision_at: Date | null;
  declare decision_reason: string | null;
  declare evidence_confirmed: boolean;
}

ComponentLifeLimitProposal.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    component_model_id: { type: DataTypes.UUID, allowNull: false },
    lineage_id: { type: DataTypes.UUID, allowNull: false },
    revision_number: { type: DataTypes.INTEGER, allowNull: false },
    proposal_purpose: { type: DataTypes.STRING(32), allowNull: false },
    target_proposal_id: { type: DataTypes.UUID, allowNull: true },
    determination: { type: DataTypes.STRING(32), allowNull: false },
    applicability_scope: { type: DataTypes.STRING(32), allowNull: false },
    applicability_statement: { type: DataTypes.TEXT, allowNull: false },
    narrower_effectivity_absent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    limit_type: { type: DataTypes.STRING(32), allowNull: true },
    basis: { type: DataTypes.STRING(32), allowNull: true },
    limit_hours: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    limit_cycles: { type: DataTypes.INTEGER, allowNull: true },
    limit_months: { type: DataTypes.INTEGER, allowNull: true },
    source_reference: { type: DataTypes.TEXT, allowNull: false },
    source_document_reference: { type: DataTypes.TEXT, allowNull: true },
    source_effective_date: { type: DataTypes.DATEONLY, allowNull: false },
    evidence_summary: { type: DataTypes.TEXT, allowNull: false },
    proposal_reason: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PROPOSED' },
    proposed_by: { type: DataTypes.UUID, allowNull: false },
    proposed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    decision_by: { type: DataTypes.UUID, allowNull: true },
    decision_at: { type: DataTypes.DATE, allowNull: true },
    decision_reason: { type: DataTypes.TEXT, allowNull: true },
    evidence_confirmed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  { sequelize, tableName: 'component_life_limit_proposals', underscored: true, timestamps: true }
);
