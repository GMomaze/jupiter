import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class CessnaSid extends Model {
  declare id: string;
  declare sid_number: string;
  declare ata_chapter: string;
  declare section_reference: string | null;
  declare title: string;

  declare initial_interval_hours: number | null;
  declare initial_interval_months: number | null;
  declare repeat_interval_hours: number | null;
  declare repeat_interval_months: number | null;

  declare inspection_operation: string | null;
  declare source_pdf: string | null;
}

CessnaSid.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },

    sid_number: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    ata_chapter: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    section_reference: DataTypes.STRING,

    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    initial_interval_hours: DataTypes.INTEGER,
    initial_interval_months: DataTypes.INTEGER,
    repeat_interval_hours: DataTypes.INTEGER,
    repeat_interval_months: DataTypes.INTEGER,

    inspection_operation: DataTypes.STRING,
    source_pdf: DataTypes.STRING,
  },
  {
    sequelize,
    tableName: 'cessna_sids',
    underscored: true,
    timestamps: true,
  }
);
