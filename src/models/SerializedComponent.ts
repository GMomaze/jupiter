import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class SerializedComponent extends Model {
  declare id: string;
  declare readonly custodian_tenant_id: string;
  declare component_model_id: string;
  declare serial_number: string;
  declare part_number: string | null;
  declare status: string;
  declare condition: string | null;
  declare notes: string | null;
  declare ComponentModel?: any;
  declare LifeState?: any;
}

SerializedComponent.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    custodian_tenant_id: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'custodian_tenant_id',
      references: { model: 'tenants', key: 'id' },
      onUpdate: 'RESTRICT',
      onDelete: 'RESTRICT',
    },
    component_model_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    serial_number: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notBlank(value: string) {
          if (String(value).trim() === '') {
            throw new Error('SERIALIZED_COMPONENT_SERIAL_NUMBER_BLANK');
          }
        },
      },
    },
    part_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'AVAILABLE',
    },
    condition: {
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
    tableName: 'serialized_components',
    underscored: true,
    timestamps: true,
    hooks: {
      beforeUpdate(instance) {
        if (instance.changed('custodian_tenant_id')) {
          throw new Error('ROOT_OPERATIONAL_TENANT_OWNERSHIP_IMMUTABLE');
        }
      },
      beforeBulkUpdate(options) {
        const attributes = 'attributes' in options ? options.attributes : undefined;
        if (
          (attributes != null &&
            typeof attributes === 'object' &&
            Object.prototype.hasOwnProperty.call(attributes, 'custodian_tenant_id')) ||
          options.fields?.includes('custodian_tenant_id')
        ) {
          throw new Error('ROOT_OPERATIONAL_TENANT_OWNERSHIP_IMMUTABLE');
        }
      },
    },
  }
);
