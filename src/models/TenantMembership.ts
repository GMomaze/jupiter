import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export const TENANT_MEMBERSHIP_STATUSES = [
  'INVITED',
  'ACTIVE',
  'SUSPENDED',
  'DISABLED',
] as const;

export type TenantMembershipStatus = (typeof TENANT_MEMBERSHIP_STATUSES)[number];

export class TenantMembership extends Model {
  declare id: string;
  declare tenant_id: string;
  declare user_id: string;
  declare status: TenantMembershipStatus;
  declare joined_at: Date | null;
  declare suspended_at: Date | null;
  declare suspended_by_user_id: string | null;
  declare disabled_at: Date | null;
  declare disabled_by_user_id: string | null;
  declare status_reason: string | null;
  declare created_at: Date;
  declare created_by_user_id: string;
  declare updated_at: Date;
  declare updated_by_user_id: string;
}

TenantMembership.init(
  {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    tenant_id: { type: DataTypes.UUID, allowNull: false },
    user_id: { type: DataTypes.UUID, allowNull: false },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'INVITED',
      validate: { isIn: [[...TENANT_MEMBERSHIP_STATUSES]] },
    },
    joined_at: { type: DataTypes.DATE, allowNull: true },
    suspended_at: { type: DataTypes.DATE, allowNull: true },
    suspended_by_user_id: { type: DataTypes.UUID, allowNull: true },
    disabled_at: { type: DataTypes.DATE, allowNull: true },
    disabled_by_user_id: { type: DataTypes.UUID, allowNull: true },
    status_reason: { type: DataTypes.TEXT, allowNull: true, validate: { notEmpty: true } },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    created_by_user_id: { type: DataTypes.UUID, allowNull: false },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_by_user_id: { type: DataTypes.UUID, allowNull: false },
  },
  {
    sequelize,
    tableName: 'tenant_memberships',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [{ unique: true, fields: ['tenant_id', 'user_id'] }],
    hooks: {
      beforeValidate(instance) {
        instance.status_reason = instance.status_reason == null
          ? null
          : String(instance.status_reason).trim();
      },
      beforeUpdate(instance) {
        if (instance.changed('id') || instance.changed('tenant_id') || instance.changed('user_id')) {
          throw new Error('TENANT_MEMBERSHIP_IDENTITY_IMMUTABLE');
        }
      },
    },
    validate: {
      lifecycle(this: TenantMembership) {
        const reason = Boolean(this.status_reason?.trim());
        const joined = this.joined_at != null;
        const suspendedValues = [this.suspended_at != null, this.suspended_by_user_id != null];
        const disabledValues = [this.disabled_at != null, this.disabled_by_user_id != null];
        const suspended = suspendedValues.every(Boolean);
        const disabled = disabledValues.every(Boolean);

        if (suspendedValues.some(Boolean) && !suspended) {
          throw new Error('TENANT_MEMBERSHIP_SUSPENSION_METADATA_INCOMPLETE');
        }
        if (disabledValues.some(Boolean) && !disabled) {
          throw new Error('TENANT_MEMBERSHIP_DISABLE_METADATA_INCOMPLETE');
        }

        if (this.status === 'INVITED' && (joined || suspended || disabled || reason)) {
          throw new Error('TENANT_MEMBERSHIP_INVITED_STATE_INVALID');
        }
        if (this.status === 'ACTIVE' && (!joined || suspended || disabled || reason)) {
          throw new Error('TENANT_MEMBERSHIP_ACTIVE_STATE_INVALID');
        }
        if (this.status === 'SUSPENDED' && (!joined || !suspended || disabled || !reason)) {
          throw new Error('TENANT_MEMBERSHIP_SUSPENDED_STATE_INVALID');
        }
        if (this.status === 'DISABLED' && (suspended || !disabled || !reason)) {
          throw new Error('TENANT_MEMBERSHIP_DISABLED_STATE_INVALID');
        }
        if (this.joined_at && this.created_at && this.joined_at < this.created_at) {
          throw new Error('TENANT_MEMBERSHIP_JOINED_DATE_INVALID');
        }
        if (this.suspended_at && (!this.joined_at || this.suspended_at < this.joined_at)) {
          throw new Error('TENANT_MEMBERSHIP_SUSPENDED_DATE_INVALID');
        }
        if (this.disabled_at && this.created_at && this.disabled_at < this.created_at) {
          throw new Error('TENANT_MEMBERSHIP_DISABLED_DATE_INVALID');
        }
        if (this.disabled_at && this.joined_at && this.disabled_at < this.joined_at) {
          throw new Error('TENANT_MEMBERSHIP_DISABLED_JOINED_DATE_INVALID');
        }
      },
    },
  }
);
