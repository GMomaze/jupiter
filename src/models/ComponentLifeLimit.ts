import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class ComponentLifeLimit extends Model {
  declare id: string;
  declare component_model_id: string;
  declare limit_type: string;
  declare threshold_value: number | null;
  declare threshold_unit: string | null;
  declare notes: string | null;
}

ComponentLifeLimit.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    component_model_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    limit_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    threshold_value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    threshold_unit: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'component_life_limits',
    underscored: true,
    timestamps: true,
  }
);
