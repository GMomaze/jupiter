import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database.js';

export class WorkpackSource extends Model {
  declare id: string;
  declare execution_id: string;
  declare source_type: string;
  declare reference: string;
}

WorkpackSource.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    execution_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    source_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    reference: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'workpack_sources',
    underscored: true,
  }
);
