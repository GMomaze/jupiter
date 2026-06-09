import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export type MigrationBatchStatus =
  | 'DRAFT'
  | 'DRY_RUN'
  | 'APPROVED'
  | 'EXECUTING'
  | 'COMPLETE'
  | 'FAILED'
  | 'ROLLED_BACK'
  | 'PARTIALLY_ROLLED_BACK';

export class MigrationBatch extends Model {
  declare id: string;
  declare migration_type: string;
  declare status: MigrationBatchStatus;
  declare created_by: string | null;
  declare approved_by: string | null;
  declare executed_by: string | null;
  declare rolled_back_by: string | null;
  declare approved_at: Date | null;
  declare executed_at: Date | null;
  declare rolled_back_at: Date | null;
  declare dry_run_summary: Record<string, unknown>;
  declare execution_summary: Record<string, unknown>;
  declare rollback_summary: Record<string, unknown>;
  declare report_reference: string | null;
  declare metadata: Record<string, unknown>;
  declare created_at: Date;
  declare updated_at: Date;
}

MigrationBatch.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    migration_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'DRAFT',
    },
    created_by: DataTypes.UUID,
    approved_by: DataTypes.UUID,
    executed_by: DataTypes.UUID,
    rolled_back_by: DataTypes.UUID,
    approved_at: DataTypes.DATE,
    executed_at: DataTypes.DATE,
    rolled_back_at: DataTypes.DATE,
    dry_run_summary: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    execution_summary: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    rollback_summary: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    report_reference: DataTypes.TEXT,
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    sequelize,
    tableName: 'migration_batches',
    underscored: true,
    indexes: [
      { fields: ['migration_type'] },
      { fields: ['status'] },
    ],
  }
);
