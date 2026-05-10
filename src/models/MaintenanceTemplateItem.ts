import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class MaintenanceTemplateItem extends Model {
  declare id: string;
  declare template_id: string;
  declare item_type: 'STANDARD_TASK' | 'COMPLIANCE_ITEM' | 'SID';
  declare item_id: string;
  declare sequence_no: number;
  declare is_required: boolean;
  declare notes: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

MaintenanceTemplateItem.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    template_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    item_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    item_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    sequence_no: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    is_required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    tableName: 'maintenance_template_items',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['template_id', 'sequence_no'],
      },
      {
        unique: true,
        fields: ['template_id', 'item_type', 'item_id'],
      },
      {
        fields: ['template_id'],
      },
      {
        fields: ['item_type'],
      },
      {
        fields: ['item_id'],
      },
      {
        fields: ['sequence_no'],
      },
      {
        fields: ['is_required'],
      },
      {
        fields: ['item_type', 'item_id'],
      },
    ],
  }
);
