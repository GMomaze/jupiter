import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class ComponentLifeLimitPublication extends Model {
  declare id: string;
  declare proposal_id: string;
  declare component_life_limit_id: string;
  declare publication_state: 'DORMANT' | 'ACTIVE' | 'WITHDRAWN' | 'SUPERSEDED';
  declare published_by: string;
  declare published_at: Date;
  declare terminal_by: string | null;
  declare terminal_at: Date | null;
  declare terminal_reason: string | null;
}

ComponentLifeLimitPublication.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    proposal_id: { type: DataTypes.UUID, allowNull: false, unique: true },
    component_life_limit_id: { type: DataTypes.UUID, allowNull: false, unique: true },
    publication_state: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'DORMANT' },
    published_by: { type: DataTypes.UUID, allowNull: false },
    published_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    terminal_by: { type: DataTypes.UUID, allowNull: true },
    terminal_at: { type: DataTypes.DATE, allowNull: true },
    terminal_reason: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, tableName: 'component_life_limit_publications', underscored: true, timestamps: true }
);
