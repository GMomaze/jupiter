import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class AircraftSbCompliance extends Model {
  declare id: string;
  declare aircraft_id: string;
  declare service_bulletin_id: string;
  declare status: string;
  declare complied_at: Date | null;
  declare notes: string | null;
}

AircraftSbCompliance.init(
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
    service_bulletin_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'PENDING',
    },
    complied_at: DataTypes.DATE,
    notes: DataTypes.TEXT,
  },
  {
    sequelize,
    tableName: 'aircraft_sb_compliance',
    underscored: true,
  }
);
