import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional
} from 'sequelize';

import sequelize from '../../config/database.js';

export class AircraftCategory extends Model<
  InferAttributes<AircraftCategory>,
  InferCreationAttributes<AircraftCategory>
> {
  declare id: CreationOptional<string>;
  declare code: string;
  declare label: string;
  declare is_active: CreationOptional<boolean>;
  declare system_locked: CreationOptional<boolean>;
  declare created_at: CreationOptional<Date>;
}

AircraftCategory.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    label: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    system_locked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'rf_aircraft_category',
    timestamps: false,
  }
);
