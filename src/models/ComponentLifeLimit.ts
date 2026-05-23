import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class ComponentLifeLimit extends Model {
  declare id: string;
  declare component_model_id: string;
  declare limit_type: string;
  declare basis: string;
  declare limit_hours: number | null;
  declare limit_cycles: number | null;
  declare limit_months: number | null;
  declare description: string | null;
  declare is_active: boolean;
  declare created_at: Date;
  declare updated_at: Date;
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
    basis: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    limit_hours: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    limit_cycles: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    limit_months: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'component_life_limits',
    underscored: true,
    timestamps: true,
  }
);
