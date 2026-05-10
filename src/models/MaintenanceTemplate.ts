import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class MaintenanceTemplate extends Model {
  declare id: string;
  declare name: string;
  declare description: string | null;
  declare template_type: 'MPI' | 'ANNUAL' | 'CUSTOM';
  declare model_id: string;
  declare interval_hours: number | null;
  declare interval_months: number | null;
  declare is_active: boolean;
  declare created_at: Date;
  declare updated_at: Date;
}

MaintenanceTemplate.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    template_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    model_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    interval_hours: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    interval_months: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'maintenance_templates',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['model_id', 'name'],
      },
      {
        fields: ['model_id'],
      },
      {
        fields: ['template_type'],
      },
      {
        fields: ['is_active'],
      },
      {
        fields: ['interval_hours'],
      },
      {
        fields: ['interval_months'],
      },
      {
        fields: ['model_id', 'is_active'],
      },
    ],
  }
);
