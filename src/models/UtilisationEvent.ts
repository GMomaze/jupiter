import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class UtilisationEvent extends Model {
  declare id: string;
  declare aircraft_id: string;
  declare source_type: string;
  declare source_reference: string | null;
  declare effective_date: string;
  declare previous_total_time_hours: number;
  declare new_total_time_hours: number;
  declare delta_hours: number;
  declare previous_total_time_cycles: number;
  declare new_total_time_cycles: number;
  declare delta_cycles: number;
  declare reason: string;
  declare correction_of_event_id: string | null;
  declare metadata: any;
  declare created_by: string | null;
  declare created_at: Date;
}

UtilisationEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    aircraft_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    source_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    source_reference: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    effective_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    previous_total_time_hours: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    new_total_time_hours: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    delta_hours: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    previous_total_time_cycles: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    new_total_time_cycles: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    delta_cycles: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    correction_of_event_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'utilisation_events',
    underscored: true,
    timestamps: false,
    hooks: {
      beforeUpdate() {
        throw new Error('UTILISATION_EVENT_IMMUTABLE');
      },
      beforeDestroy() {
        throw new Error('UTILISATION_EVENT_IMMUTABLE');
      },
      beforeBulkUpdate() {
        throw new Error('UTILISATION_EVENT_IMMUTABLE');
      },
      beforeBulkDestroy() {
        throw new Error('UTILISATION_EVENT_IMMUTABLE');
      },
    },
  }
);
