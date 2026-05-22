import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class SerializedComponentMaintenanceEvent extends Model {
  declare id: string;
  declare serialized_component_id: string;
  declare event_type: string;
  declare occurred_at: string | null;
  declare recorded_by: string | null;
  declare notes: string | null;
  declare Recorder?: any;
}

SerializedComponentMaintenanceEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    serialized_component_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    event_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    occurred_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    recorded_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'serialized_component_maintenance_events',
    underscored: true,
    timestamps: true,
  }
);
