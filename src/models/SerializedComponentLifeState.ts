import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class SerializedComponentLifeState extends Model {
  declare id: string;
  declare serialized_component_id: string;
  declare total_time_hours: number | null;
  declare total_time_cycles: number | null;
  declare total_time_days: number | null;
  declare notes: string | null;
}

SerializedComponentLifeState.init(
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
    total_time_hours: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    total_time_cycles: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    total_time_days: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'serialized_component_life_states',
    underscored: true,
    timestamps: true,
  }
);
