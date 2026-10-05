import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class AircraftComponentMovementHistory extends Model {
  declare id: string;
  declare aircraft_component_id: string;
  declare readonly tenant_id: string;
  declare action_type: 'INSTALLATION' | 'REMOVAL';
  declare source_aircraft_id: string | null;
  declare target_aircraft_id: string | null;
  declare actor_id: string;
  declare occurred_at: Date;
  declare aircraft_hours: string | null;
  declare remarks: string | null;
}

AircraftComponentMovementHistory.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    aircraft_component_id: { type: DataTypes.UUID, allowNull: false },
    tenant_id: { type: DataTypes.UUID, allowNull: false },
    action_type: { type: DataTypes.STRING, allowNull: false },
    source_aircraft_id: { type: DataTypes.UUID, allowNull: true },
    target_aircraft_id: { type: DataTypes.UUID, allowNull: true },
    actor_id: { type: DataTypes.UUID, allowNull: false },
    occurred_at: { type: DataTypes.DATE, allowNull: false },
    aircraft_hours: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    remarks: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    tableName: 'aircraft_component_movement_history',
    underscored: true,
    timestamps: false,
    hooks: {
      beforeUpdate() { throw new Error('AIRCRAFT_COMPONENT_MOVEMENT_HISTORY_IMMUTABLE'); },
      beforeDestroy() { throw new Error('AIRCRAFT_COMPONENT_MOVEMENT_HISTORY_IMMUTABLE'); },
      beforeBulkUpdate() { throw new Error('AIRCRAFT_COMPONENT_MOVEMENT_HISTORY_IMMUTABLE'); },
      beforeBulkDestroy() { throw new Error('AIRCRAFT_COMPONENT_MOVEMENT_HISTORY_IMMUTABLE'); },
    },
  },
);
