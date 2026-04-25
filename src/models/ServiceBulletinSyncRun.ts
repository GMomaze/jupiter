import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class ServiceBulletinSyncRun extends Model {
  declare id: string;
  declare trigger_type: 'MANUAL' | 'CRON';
  declare status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  declare synced_count: number;
  declare created_count: number;
  declare updated_count: number;
  declare error_message: string | null;
  declare started_at: Date;
  declare finished_at: Date | null;
}

ServiceBulletinSyncRun.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    trigger_type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'MANUAL',
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'RUNNING',
    },
    synced_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    created_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    updated_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    error_message: DataTypes.TEXT,
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    finished_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'service_bulletin_sync_runs',
    underscored: true,
    timestamps: false,
  }
);
