import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export class TenantMembershipRole extends Model {
  declare id: string;
  declare membership_id: string;
  declare role_id: string;
  declare assigned_at: Date;
  declare assigned_by_user_id: string;
  declare revoked_at: Date | null;
  declare revoked_by_user_id: string | null;
  declare revocation_reason: string | null;
  declare created_at: Date;
  declare updated_at: Date;
}

TenantMembershipRole.init(
  {
    id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    membership_id: { type: DataTypes.UUID, allowNull: false },
    role_id: { type: DataTypes.UUID, allowNull: false },
    assigned_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    assigned_by_user_id: { type: DataTypes.UUID, allowNull: false },
    revoked_at: { type: DataTypes.DATE, allowNull: true },
    revoked_by_user_id: { type: DataTypes.UUID, allowNull: true },
    revocation_reason: { type: DataTypes.TEXT, allowNull: true, validate: { notEmpty: true } },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'tenant_membership_roles',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
      beforeValidate(instance) {
        instance.revocation_reason = instance.revocation_reason == null
          ? null
          : String(instance.revocation_reason).trim();
      },
      beforeUpdate(instance) {
        const identityFields: Array<keyof TenantMembershipRole> = [
          'id', 'membership_id', 'role_id', 'assigned_at', 'assigned_by_user_id',
        ];
        for (const field of identityFields) {
          if (instance.changed(field)) throw new Error('TENANT_MEMBERSHIP_ROLE_IDENTITY_IMMUTABLE');
        }
        if (instance.previous('revoked_at') != null && instance.changed()) {
          throw new Error('TENANT_MEMBERSHIP_ROLE_HISTORY_IMMUTABLE');
        }
      },
    },
    validate: {
      revocation(this: TenantMembershipRole) {
        const reason = Boolean(this.revocation_reason?.trim());
        const values = [this.revoked_at != null, this.revoked_by_user_id != null, reason];
        if (!values.every(Boolean) && values.some(Boolean)) {
          throw new Error('TENANT_MEMBERSHIP_ROLE_REVOCATION_INCOMPLETE');
        }
        if (this.revoked_at && this.assigned_at && this.revoked_at < this.assigned_at) {
          throw new Error('TENANT_MEMBERSHIP_ROLE_REVOCATION_DATE_INVALID');
        }
      },
    },
  }
);
