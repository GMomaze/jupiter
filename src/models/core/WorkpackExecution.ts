import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.js';

export class WorkpackExecution extends Model {
  declare id: string;
  declare workpack_id: string;
  declare task_id: string;
  declare attempt_no: number;
  declare status: string;
  declare started_by: string | null;
  declare completed_by: string | null;
  declare certified_by: string | null;
  declare started_at: Date | null;
  declare completed_at: Date | null;
  declare certified_at: Date | null;
  declare version: number;
}

WorkpackExecution.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    workpack_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    task_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    attempt_no: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'OPEN',
    },
    started_by: DataTypes.UUID,
    completed_by: DataTypes.UUID,
    certified_by: DataTypes.UUID,
    started_at: DataTypes.DATE,
    completed_at: DataTypes.DATE,
    certified_at: DataTypes.DATE,
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
  },
  {
    sequelize,
    tableName: 'workpack_executions',
    underscored: true,
    version: true,
  }
);
