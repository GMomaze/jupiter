import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class SerializedComponentLifeState extends Model {
  declare id: string;
  declare serialized_component_id: string;
  declare tsn_hours: number | null;
  declare tso_hours: number | null;
  declare csn_cycles: number | null;
  declare cso_cycles: number | null;
  declare overhaul_reference_date: string | null;
  declare calendar_reference_date: string | null;
  declare notes: string | null;
  declare created_at: Date;
  declare updated_at: Date;
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
    tsn_hours: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    tso_hours: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    csn_cycles: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    cso_cycles: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    overhaul_reference_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    calendar_reference_date: {
      type: DataTypes.DATEONLY,
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
