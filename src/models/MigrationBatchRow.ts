import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export type MigrationBatchRowStatus =
  | 'PENDING'
  | 'MIGRATED'
  | 'FAILED'
  | 'SKIPPED'
  | 'ROLLED_BACK';

export class MigrationBatchRow extends Model {
  declare id: string;
  declare batch_id: string;
  declare source_table: string;
  declare source_row_id: string;
  declare migration_category: string | null;
  declare decision: string | null;
  declare status: MigrationBatchRowStatus;
  declare source_snapshot: Record<string, unknown>;
  declare planned_target_snapshot: Record<string, unknown>;
  declare actual_target_snapshot: Record<string, unknown>;
  declare warnings: unknown[];
  declare conflicts: unknown[];
  declare failure_reason: string | null;
  declare rollback_status: string | null;
  declare metadata: Record<string, unknown>;
  declare created_at: Date;
  declare updated_at: Date;
}

MigrationBatchRow.init(
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
    source_table: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    source_row_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    migration_category: DataTypes.STRING,
    decision: DataTypes.STRING,
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'PENDING',
    },
    source_snapshot: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    planned_target_snapshot: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    actual_target_snapshot: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    warnings: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    conflicts: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    failure_reason: DataTypes.TEXT,
    rollback_status: DataTypes.STRING,
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    sequelize,
    tableName: 'migration_batch_rows',
    underscored: true,
    indexes: [
      { fields: ['batch_id'] },
      { fields: ['status'] },
      { unique: true, fields: ['batch_id', 'source_table', 'source_row_id'] },
    ],
  }
);
