import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class MigrationCreatedTarget extends Model {
  declare id: string;
  declare batch_id: string;
  declare batch_row_id: string;
  declare target_table: string;
  declare target_row_id: string;
  declare created_snapshot: Record<string, unknown>;
  declare rollback_action: string | null;
  declare rollback_status: string;
  declare rollback_timestamp: Date | null;
  declare metadata: Record<string, unknown>;
  declare created_at: Date;
  declare updated_at: Date;
}

MigrationCreatedTarget.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    batch_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    batch_row_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    target_table: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    target_row_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    created_snapshot: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    rollback_action: DataTypes.STRING,
    rollback_status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'PENDING',
    },
    rollback_timestamp: DataTypes.DATE,
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    sequelize,
    tableName: 'migration_created_targets',
    underscored: true,
    indexes: [
      { fields: ['batch_id'] },
      { fields: ['batch_row_id'] },
      { unique: true, fields: ['batch_row_id', 'target_table', 'target_row_id'] },
    ],
  }
);
