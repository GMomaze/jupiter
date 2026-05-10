import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.js';

export class AuditLog extends Model {
  declare id: string;
  declare table_name: string;
  declare row_id: string;
  declare action: string;
  declare actor_id: string | null;
  declare old_values: any;
  declare new_values: any;
  declare reason: string | null;
  declare created_at: Date;
}

AuditLog.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    table_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    row_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    actor_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    old_values: DataTypes.JSONB,
    new_values: DataTypes.JSONB,
    reason: DataTypes.TEXT,
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'audit_log',
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
