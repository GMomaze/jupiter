import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class ComponentLifeLimitGovernanceHistory extends Model {
  declare id: string;
  declare proposal_id: string;
  declare publication_id: string | null;
  declare event_code: string;
  declare actor_id: string;
  declare reason: string;
  declare evidence_confirmed: boolean;
  declare from_status: string | null;
  declare to_status: string;
  declare before_snapshot: Record<string, unknown>;
  declare after_snapshot: Record<string, unknown>;
  declare created_at: Date;
}

ComponentLifeLimitGovernanceHistory.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    proposal_id: { type: DataTypes.UUID, allowNull: false },
    publication_id: { type: DataTypes.UUID, allowNull: true },
    event_code: { type: DataTypes.STRING(40), allowNull: false },
    actor_id: { type: DataTypes.UUID, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: false },
    evidence_confirmed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    from_status: { type: DataTypes.STRING(20), allowNull: true },
    to_status: { type: DataTypes.STRING(20), allowNull: false },
    before_snapshot: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    after_snapshot: { type: DataTypes.JSONB, allowNull: false },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: 'component_life_limit_governance_history', underscored: true, timestamps: false }
);
