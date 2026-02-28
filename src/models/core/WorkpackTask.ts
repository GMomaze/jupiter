import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.js';

export class WorkpackTask extends Model {
  declare workpack_id: string;
  declare task_id: string;
}

WorkpackTask.init(
  {
    workpack_id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    task_id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
  },
  {
    sequelize,
    tableName: 'workpack_tasks',
    timestamps: false,
  }
);