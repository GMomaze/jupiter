import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
import { normalizeTenantCode } from '../modules/tenancy/tenant-code-normalization.js';

export const TENANT_STATUSES = [
  'PROVISIONING',
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED',
] as const;

export type TenantStatus = (typeof TENANT_STATUSES)[number];

export class Tenant extends Model {
  declare id: string;
  declare public_id: string;
  declare code: string;
  declare display_name: string;
  declare legal_name: string | null;
  declare status: TenantStatus;
  declare suspension_reason: string | null;
  declare suspended_at: Date | null;
  declare suspended_by_user_id: string | null;
  declare created_at: Date;
  declare created_by_user_id: string;
  declare updated_at: Date;
  declare updated_by_user_id: string;
  declare archived_at: Date | null;
}

Tenant.init(
  {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    public_id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      unique: true,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [1, 50],
        is: /^[A-Z0-9]+(?:_[A-Z0-9]+)*$/,
      },
    },
    display_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: { notEmpty: true, len: [1, 150] },
    },
    legal_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
      validate: { notEmpty: true, len: [1, 200] },
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'PROVISIONING',
      validate: { isIn: [[...TENANT_STATUSES]] },
    },
    suspension_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: { notEmpty: true },
    },
    suspended_at: { type: DataTypes.DATE, allowNull: true },
    suspended_by_user_id: { type: DataTypes.UUID, allowNull: true },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    created_by_user_id: { type: DataTypes.UUID, allowNull: false },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_by_user_id: { type: DataTypes.UUID, allowNull: false },
    archived_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'tenants',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
      beforeValidate(instance) {
        instance.code = normalizeTenantCode(instance.code);
        instance.display_name = String(instance.display_name ?? '').trim();
        instance.legal_name = instance.legal_name == null ? null : String(instance.legal_name).trim();
        instance.suspension_reason =
          instance.suspension_reason == null ? null : String(instance.suspension_reason).trim();
      },
      beforeUpdate(instance) {
        if (instance.changed('id') || instance.changed('public_id')) {
          throw new Error('TENANT_IDENTITY_IMMUTABLE');
        }
      },
    },
    validate: {
      lifecycleMetadata(this: Tenant) {
        const hasReason = Boolean(this.suspension_reason?.trim());
        const hasSuspendedAt = this.suspended_at != null;
        const hasSuspendedBy = this.suspended_by_user_id != null;
        const suspensionIsEmpty = !hasReason && !hasSuspendedAt && !hasSuspendedBy;
        const suspensionIsComplete = hasReason && hasSuspendedAt && hasSuspendedBy;

        if (!suspensionIsEmpty && !suspensionIsComplete) {
          throw new Error('TENANT_SUSPENSION_METADATA_INCOMPLETE');
        }
        if (this.status === 'SUSPENDED' && (!suspensionIsComplete || this.archived_at != null)) {
          throw new Error('TENANT_SUSPENDED_STATE_INVALID');
        }
        if ((this.status === 'PROVISIONING' || this.status === 'ACTIVE') && !suspensionIsEmpty) {
          throw new Error('TENANT_ACTIVE_SUSPENSION_METADATA_INVALID');
        }
        if (this.status === 'ARCHIVED' ? this.archived_at == null : this.archived_at != null) {
          throw new Error('TENANT_ARCHIVE_STATE_INVALID');
        }
        if (this.suspended_at && this.created_at && this.suspended_at < this.created_at) {
          throw new Error('TENANT_SUSPENSION_DATE_INVALID');
        }
        if (this.archived_at && this.created_at && this.archived_at < this.created_at) {
          throw new Error('TENANT_ARCHIVE_DATE_INVALID');
        }
      },
    },
  }
);
