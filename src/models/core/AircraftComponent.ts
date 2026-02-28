import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.js';

export class AircraftComponent extends Model {
  declare id: string;
  declare aircraft_id: string;
  declare model_id: string;
  declare serial_number: string;
  declare installation_date: string;
  declare tsn_at_install: number;
  declare tso_at_install: number;
  declare current_status: string;
  declare install_af_hours: number;
  declare is_quarantined: boolean;
}

AircraftComponent.init(
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
    model_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    serial_number: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    installation_date: {
      type: DataTypes.DATEONLY,
      defaultValue: DataTypes.NOW,
    },
    tsn_at_install: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    tso_at_install: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    current_status: {
      type: DataTypes.TEXT,
      defaultValue: 'INSTALLED',
    },
    install_af_hours: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    is_quarantined: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: 'aircraft_components',
    underscored: true,
    timestamps: false,
  }
);