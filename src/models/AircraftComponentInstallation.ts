import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class AircraftComponentInstallation extends Model {
  declare id: string;
  declare aircraft_id: string;
  declare serialized_component_id: string;
  declare installation_context: string;
  declare installed_at: string;
  declare removed_at: string | null;
  declare position: string | null;
  declare install_tsn: number | null;
  declare install_tso: number | null;
  declare removal_tsn: number | null;
  declare removal_tso: number | null;
  declare installed_by: string | null;
  declare removed_by: string | null;
  declare notes: string | null;
  declare SerializedComponent?: any;
  declare Aircraft?: any;
}

AircraftComponentInstallation.init(
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
    serialized_component_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    installation_context: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'MAINTENANCE_INSTALL',
    },
    installed_at: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    removed_at: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    position: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    install_tsn: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    install_tso: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    removal_tsn: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    removal_tso: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    installed_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    removed_by: {
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
    tableName: 'aircraft_component_installations',
    underscored: true,
    timestamps: true,
  }
);
