'use strict';

import { DataTypes, QueryInterface, literal } from 'sequelize';

const MEMBERSHIPS = 'tenant_memberships';
const MEMBERSHIP_ROLES = 'tenant_membership_roles';

async function tableExists(queryInterface: QueryInterface, table: string) {
  return Boolean(await queryInterface.describeTable(table).catch(() => null));
}

export default {
  async up(queryInterface: QueryInterface) {
    for (const prerequisite of ['tenants', 'users', 'rf_role']) {
      if (!(await tableExists(queryInterface, prerequisite))) {
        throw new Error(`${prerequisite.toUpperCase()}_TABLE_REQUIRED`);
      }
    }
    if (await tableExists(queryInterface, MEMBERSHIPS)) {
      throw new Error('TENANT_MEMBERSHIPS_TABLE_ALREADY_EXISTS');
    }
    if (await tableExists(queryInterface, MEMBERSHIP_ROLES)) {
      throw new Error('TENANT_MEMBERSHIP_ROLES_TABLE_ALREADY_EXISTS');
    }

    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.createTable(
        MEMBERSHIPS,
        {
          id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: literal('gen_random_uuid()'),
          },
          tenant_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'tenants', key: 'id' },
            onUpdate: 'RESTRICT',
            onDelete: 'RESTRICT',
          },
          user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onUpdate: 'RESTRICT',
            onDelete: 'RESTRICT',
          },
          status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'INVITED',
          },
          joined_at: { type: DataTypes.DATE, allowNull: true },
          suspended_at: { type: DataTypes.DATE, allowNull: true },
          suspended_by_user_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onUpdate: 'RESTRICT',
            onDelete: 'RESTRICT',
          },
          disabled_at: { type: DataTypes.DATE, allowNull: true },
          disabled_by_user_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onUpdate: 'RESTRICT',
            onDelete: 'RESTRICT',
          },
          status_reason: { type: DataTypes.TEXT, allowNull: true },
          created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: literal('CURRENT_TIMESTAMP'),
          },
          created_by_user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onUpdate: 'RESTRICT',
            onDelete: 'RESTRICT',
          },
          updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: literal('CURRENT_TIMESTAMP'),
          },
          updated_by_user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onUpdate: 'RESTRICT',
            onDelete: 'RESTRICT',
          },
        },
        { transaction }
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE public.tenant_memberships
           ADD CONSTRAINT tenant_memberships_tenant_user_unique UNIQUE (tenant_id, user_id),
           ADD CONSTRAINT tenant_memberships_status_check
             CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED')),
           ADD CONSTRAINT tenant_memberships_lifecycle_check
             CHECK (
               (status = 'INVITED'
                 AND joined_at IS NULL
                 AND suspended_at IS NULL AND suspended_by_user_id IS NULL
                 AND disabled_at IS NULL AND disabled_by_user_id IS NULL
                 AND status_reason IS NULL)
               OR
               (status = 'ACTIVE'
                 AND joined_at IS NOT NULL
                 AND suspended_at IS NULL AND suspended_by_user_id IS NULL
                 AND disabled_at IS NULL AND disabled_by_user_id IS NULL
                 AND status_reason IS NULL)
               OR
               (status = 'SUSPENDED'
                 AND joined_at IS NOT NULL
                 AND suspended_at IS NOT NULL AND suspended_by_user_id IS NOT NULL
                 AND disabled_at IS NULL AND disabled_by_user_id IS NULL
                 AND status_reason IS NOT NULL AND btrim(status_reason) <> '')
               OR
               (status = 'DISABLED'
                 AND suspended_at IS NULL AND suspended_by_user_id IS NULL
                 AND disabled_at IS NOT NULL AND disabled_by_user_id IS NOT NULL
                 AND status_reason IS NOT NULL AND btrim(status_reason) <> '')
             ),
           ADD CONSTRAINT tenant_memberships_joined_date_check
             CHECK (joined_at IS NULL OR joined_at >= created_at),
           ADD CONSTRAINT tenant_memberships_suspended_date_check
             CHECK (suspended_at IS NULL OR suspended_at >= joined_at),
           ADD CONSTRAINT tenant_memberships_disabled_date_check
             CHECK (disabled_at IS NULL OR disabled_at >= created_at),
           ADD CONSTRAINT tenant_memberships_disabled_joined_date_check
             CHECK (disabled_at IS NULL OR joined_at IS NULL OR disabled_at >= joined_at);`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `CREATE INDEX tenant_memberships_tenant_status_index
           ON public.tenant_memberships (tenant_id, status);
         CREATE INDEX tenant_memberships_user_status_index
           ON public.tenant_memberships (user_id, status);

         CREATE FUNCTION public.fn_tenant_memberships_preserve_identity()
         RETURNS trigger
         LANGUAGE plpgsql
         AS $function$
         BEGIN
           IF NEW.id IS DISTINCT FROM OLD.id
              OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
              OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
             RAISE EXCEPTION 'TENANT_MEMBERSHIP_IDENTITY_IMMUTABLE';
           END IF;
           RETURN NEW;
         END;
         $function$;

         CREATE TRIGGER tr_tenant_memberships_preserve_identity
         BEFORE UPDATE ON public.tenant_memberships
         FOR EACH ROW
         EXECUTE FUNCTION public.fn_tenant_memberships_preserve_identity();`,
        { transaction }
      );

      await queryInterface.createTable(
        MEMBERSHIP_ROLES,
        {
          id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: literal('gen_random_uuid()'),
          },
          membership_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: MEMBERSHIPS, key: 'id' },
            onUpdate: 'RESTRICT',
            onDelete: 'RESTRICT',
          },
          role_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'rf_role', key: 'id' },
            onUpdate: 'RESTRICT',
            onDelete: 'RESTRICT',
          },
          assigned_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: literal('CURRENT_TIMESTAMP'),
          },
          assigned_by_user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'users', key: 'id' },
            onUpdate: 'RESTRICT',
            onDelete: 'RESTRICT',
          },
          revoked_at: { type: DataTypes.DATE, allowNull: true },
          revoked_by_user_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onUpdate: 'RESTRICT',
            onDelete: 'RESTRICT',
          },
          revocation_reason: { type: DataTypes.TEXT, allowNull: true },
          created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: literal('CURRENT_TIMESTAMP'),
          },
          updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: literal('CURRENT_TIMESTAMP'),
          },
        },
        { transaction }
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE public.tenant_membership_roles
           ADD CONSTRAINT tenant_membership_roles_revocation_shape_check
             CHECK (
               (revoked_at IS NULL AND revoked_by_user_id IS NULL AND revocation_reason IS NULL)
               OR
               (revoked_at IS NOT NULL AND revoked_by_user_id IS NOT NULL
                 AND revocation_reason IS NOT NULL AND btrim(revocation_reason) <> '')
             ),
           ADD CONSTRAINT tenant_membership_roles_revocation_date_check
             CHECK (revoked_at IS NULL OR revoked_at >= assigned_at);

         CREATE UNIQUE INDEX tenant_membership_roles_active_unique
           ON public.tenant_membership_roles (membership_id, role_id)
           WHERE revoked_at IS NULL;

         CREATE FUNCTION public.fn_tenant_membership_roles_preserve_history()
         RETURNS trigger
         LANGUAGE plpgsql
         AS $function$
         BEGIN
           IF NEW.id IS DISTINCT FROM OLD.id
              OR NEW.membership_id IS DISTINCT FROM OLD.membership_id
              OR NEW.role_id IS DISTINCT FROM OLD.role_id
              OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at
              OR NEW.assigned_by_user_id IS DISTINCT FROM OLD.assigned_by_user_id THEN
             RAISE EXCEPTION 'TENANT_MEMBERSHIP_ROLE_IDENTITY_IMMUTABLE';
           END IF;
           IF OLD.revoked_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
             RAISE EXCEPTION 'TENANT_MEMBERSHIP_ROLE_HISTORY_IMMUTABLE';
           END IF;
           RETURN NEW;
         END;
         $function$;

         CREATE TRIGGER tr_tenant_membership_roles_preserve_history
         BEFORE UPDATE ON public.tenant_membership_roles
         FOR EACH ROW
         EXECUTE FUNCTION public.fn_tenant_membership_roles_preserve_history();`,
        { transaction }
      );
    });
  },

  async down(queryInterface: QueryInterface) {
    const membershipRolesExist = await tableExists(queryInterface, MEMBERSHIP_ROLES);
    const membershipsExist = await tableExists(queryInterface, MEMBERSHIPS);

    await queryInterface.sequelize.transaction(async transaction => {
      if (membershipRolesExist) {
        await queryInterface.sequelize.query(
          'DROP TRIGGER IF EXISTS tr_tenant_membership_roles_preserve_history ON public.tenant_membership_roles;',
          { transaction }
        );
        await queryInterface.dropTable(MEMBERSHIP_ROLES, { transaction });
      }
      await queryInterface.sequelize.query(
        'DROP FUNCTION IF EXISTS public.fn_tenant_membership_roles_preserve_history();',
        { transaction }
      );
      if (membershipsExist) {
        await queryInterface.sequelize.query(
          'DROP TRIGGER IF EXISTS tr_tenant_memberships_preserve_identity ON public.tenant_memberships;',
          { transaction }
        );
        await queryInterface.dropTable(MEMBERSHIPS, { transaction });
      }
      await queryInterface.sequelize.query(
        'DROP FUNCTION IF EXISTS public.fn_tenant_memberships_preserve_identity();',
        { transaction }
      );
    });
  },
};
