import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey
} from 'sequelize';

import sequelize from '../../config/database.js';
import { ComponentModel } from '../ComponentModel.js';
import { AircraftComponent } from '../aircraftComponent.model.js';

export class Aircraft extends Model<
  InferAttributes<Aircraft>,
  InferCreationAttributes<Aircraft>
> {
  declare id: CreationOptional<string>;
  declare registration: string;
  declare serial_number: string;

  declare model_id: ForeignKey<ComponentModel['id']>;
  declare category_id: string;

  declare status: string;

  declare total_time_hours: CreationOptional<number>;
  declare total_time_cycles: CreationOptional<number>;

  declare version: CreationOptional<number>;

  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

Aircraft.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    registration: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    serial_number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },

    model_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'component_models',
        key: 'id',
      },
      onDelete: 'RESTRICT',
    },

    category_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'rf_aircraft_category',
        key: 'id',
      },
      onDelete: 'RESTRICT',
    },

    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'REGISTERED',
    },

    total_time_hours: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    total_time_cycles: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
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
    tableName: 'aircraft',
    underscored: true,
    version: true, // enables optimistic locking via version column
  }
);

/* ============================================================
   ASSOCIATIONS
============================================================ */

// Aircraft → ComponentModel
Aircraft.belongsTo(ComponentModel, {
  foreignKey: 'model_id',
});
