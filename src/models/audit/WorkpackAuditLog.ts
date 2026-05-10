import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.js';

export class WorkpackAuditLog extends Model {
  declare id: string;
  declare execution_id: string;
  declare workpack_id: string;
  declare task_id: string;
  declare user_id: string | null;
  declare action: string;
  declare field: string | null;
  declare old_value: unknown;
  declare new_value: unknown;
  declare metadata: unknown;
  declare hash: string;
  declare previous_hash: string;
  declare sequence: number;
  declare created_at: Date;
}

WorkpackAuditLog.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    execution_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    workpack_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    task_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    field: DataTypes.STRING,
    old_value: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
    },
    new_value: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    hash: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    previous_hash: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: '',
    },
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'workpack_audit_log',
    underscored: true,
    timestamps: false,
    hooks: {
      beforeUpdate() {
        throw new Error('AUDIT_LOG_IMMUTABLE');
      },
      beforeDestroy() {
        throw new Error('AUDIT_LOG_IMMUTABLE');
      },
      beforeBulkUpdate() {
        throw new Error('AUDIT_LOG_IMMUTABLE');
      },
      beforeBulkDestroy() {
        throw new Error('AUDIT_LOG_IMMUTABLE');
      },
    },
  }
);
