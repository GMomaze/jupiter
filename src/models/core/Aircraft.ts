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
import type { Tenant } from '../Tenant.js';

export class Aircraft extends Model<
  InferAttributes<Aircraft>,
  InferCreationAttributes<Aircraft>
> {
  declare id: CreationOptional<string>;
  declare readonly tenant_id: ForeignKey<Tenant['id']>;
  declare registration: string;
  declare serial_number: string;

  declare model_id: ForeignKey<ComponentModel['id']>;
  declare category_id: string;

  declare status: string;

  declare total_time_hours: CreationOptional<number>;
  declare total_time_cycles: CreationOptional<number>;
  declare loaded_into_system_at: CreationOptional<string | null>;
  declare manufacture_date: CreationOptional<string | null>;
  declare tcds_number: CreationOptional<string | null>;
  declare tcds_url: CreationOptional<string | null>;
  declare photo_url: CreationOptional<string | null>;

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

    tenant_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'tenant_id',
      references: { model: 'tenants', key: 'id' },
      onUpdate: 'RESTRICT',
      onDelete: 'RESTRICT',
    },

    registration: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notBlank(value: string) {
          if (String(value).trim() === '') {
            throw new Error('AIRCRAFT_REGISTRATION_BLANK');
          }
        },
      },
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

    loaded_into_system_at: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    manufacture_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    tcds_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    tcds_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    photo_url: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    hooks: {
      beforeUpdate(instance) {
        if (instance.changed('tenant_id')) {
          throw new Error('ROOT_OPERATIONAL_TENANT_OWNERSHIP_IMMUTABLE');
        }
      },
      beforeBulkUpdate(options) {
        const attributes = 'attributes' in options ? options.attributes : undefined;
        if (
          (attributes != null &&
            typeof attributes === 'object' &&
            Object.prototype.hasOwnProperty.call(attributes, 'tenant_id')) ||
          options.fields?.includes('tenant_id')
        ) {
          throw new Error('ROOT_OPERATIONAL_TENANT_OWNERSHIP_IMMUTABLE');
        }
      },
    },
  }
);

/* ============================================================
   ASSOCIATIONS
============================================================ */

// Aircraft → ComponentModel
Aircraft.belongsTo(ComponentModel, {
  foreignKey: 'model_id',
});
