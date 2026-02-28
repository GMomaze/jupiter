/**
 * PATH: C:\GMO\Projects\jupiter\src\models\MaintenanceRequirement.ts
 * PURPOSE: Definitive model for Maintenance Requirements.
 */

import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class MaintenanceRequirement extends Model {
  declare id: string;
  declare model_id: string;
  declare title: string;
  declare interval_hours: number | null;
  declare interval_months: number | null;
  declare description: string | null;
}

MaintenanceRequirement.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    model_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
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
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'maintenance_requirements',
    timestamps: false,
  }
);