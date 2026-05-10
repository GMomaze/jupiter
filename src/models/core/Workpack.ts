import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.js';

export class Workpack extends Model {
  declare id: string;
  declare work_order_number: string;
  declare aircraft_id: string;
  declare status_id: string;
  declare planning_session_id: string | null;
  declare certified_by: string | null;
  declare certified_at: Date | null;
  declare qa_reviewed_by: string | null;
  declare qa_reviewed_at: Date | null;
  declare released_by: string | null;
  declare released_at: Date | null;
  declare version: number;
}

Workpack.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    work_order_number: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    aircraft_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    status_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    planning_session_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    certified_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    certified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    qa_reviewed_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    qa_reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    released_by: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    released_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'workpacks',
    underscored: true,
    version: true,
  }
);
