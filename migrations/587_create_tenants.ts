'use strict';

import { DataTypes, QueryInterface, literal } from 'sequelize';

const TABLE = 'tenants';

async function tableExists(queryInterface: QueryInterface, table: string) {
  return Boolean(await queryInterface.describeTable(table).catch(() => null));
}

export default {
  async up(queryInterface: QueryInterface) {
    if (!(await tableExists(queryInterface, 'users'))) {
      throw new Error('USERS_TABLE_REQUIRED');
    }
    if (await tableExists(queryInterface, TABLE)) {
      throw new Error('TENANTS_TABLE_ALREADY_EXISTS');
    }

    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.createTable(
        TABLE,
        {
          id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: literal('gen_random_uuid()'),
          },
          public_id: {
            type: DataTypes.UUID,
            allowNull: false,
            defaultValue: literal('gen_random_uuid()'),
          },
          code: { type: DataTypes.STRING(50), allowNull: false },
          display_name: { type: DataTypes.STRING(150), allowNull: false },
          legal_name: { type: DataTypes.STRING(200), allowNull: true },
          status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'PROVISIONING',
          },
          suspension_reason: { type: DataTypes.TEXT, allowNull: true },
          suspended_at: { type: DataTypes.DATE, allowNull: true },
          suspended_by_user_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onUpdate: 'RESTRICT',
            onDelete: 'RESTRICT',
          },
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
          archived_at: { type: DataTypes.DATE, allowNull: true },
        },
        { transaction }
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE public.tenants
           ADD CONSTRAINT tenants_public_id_unique UNIQUE (public_id),
           ADD CONSTRAINT tenants_code_unique UNIQUE (code),
           ADD CONSTRAINT tenants_code_format_check
             CHECK (code ~ '^[A-Z0-9]+(_[A-Z0-9]+)*$'),
           ADD CONSTRAINT tenants_display_name_nonblank_check
             CHECK (btrim(display_name) <> ''),
           ADD CONSTRAINT tenants_legal_name_nonblank_check
             CHECK (legal_name IS NULL OR btrim(legal_name) <> ''),
           ADD CONSTRAINT tenants_status_check
             CHECK (status IN ('PROVISIONING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED')),
           ADD CONSTRAINT tenants_suspension_metadata_shape_check
             CHECK (
               (suspension_reason IS NULL AND suspended_at IS NULL AND suspended_by_user_id IS NULL)
               OR
               (suspension_reason IS NOT NULL AND btrim(suspension_reason) <> ''
                 AND suspended_at IS NOT NULL AND suspended_by_user_id IS NOT NULL)
             ),
           ADD CONSTRAINT tenants_suspended_state_check
             CHECK (
               status <> 'SUSPENDED'
               OR (suspension_reason IS NOT NULL AND btrim(suspension_reason) <> ''
                 AND suspended_at IS NOT NULL AND suspended_by_user_id IS NOT NULL
                 AND archived_at IS NULL)
             ),
           ADD CONSTRAINT tenants_active_state_check
             CHECK (
               status NOT IN ('PROVISIONING', 'ACTIVE')
               OR (suspension_reason IS NULL AND suspended_at IS NULL AND suspended_by_user_id IS NULL)
             ),
           ADD CONSTRAINT tenants_archive_state_check
             CHECK (
               (status = 'ARCHIVED' AND archived_at IS NOT NULL)
               OR (status <> 'ARCHIVED' AND archived_at IS NULL)
             ),
           ADD CONSTRAINT tenants_suspension_date_check
             CHECK (suspended_at IS NULL OR suspended_at >= created_at),
           ADD CONSTRAINT tenants_archive_date_check
             CHECK (archived_at IS NULL OR archived_at >= created_at);`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `CREATE INDEX tenants_status_index ON public.tenants (status);
         CREATE INDEX tenants_display_name_index ON public.tenants (display_name);`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `CREATE FUNCTION public.fn_tenants_preserve_identity()
         RETURNS trigger
         LANGUAGE plpgsql
         AS $function$
         BEGIN
           IF NEW.id IS DISTINCT FROM OLD.id
              OR NEW.public_id IS DISTINCT FROM OLD.public_id THEN
             RAISE EXCEPTION 'TENANT_IDENTITY_IMMUTABLE';
           END IF;
           RETURN NEW;
         END;
         $function$;

         CREATE TRIGGER tr_tenants_preserve_identity
         BEFORE UPDATE ON public.tenants
         FOR EACH ROW
         EXECUTE FUNCTION public.fn_tenants_preserve_identity();`,
        { transaction }
      );
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      if (await tableExists(queryInterface, TABLE)) {
        await queryInterface.sequelize.query(
          'DROP TRIGGER IF EXISTS tr_tenants_preserve_identity ON public.tenants;',
          { transaction }
        );
        await queryInterface.dropTable(TABLE, { transaction });
      }
      await queryInterface.sequelize.query(
        'DROP FUNCTION IF EXISTS public.fn_tenants_preserve_identity();',
        { transaction }
      );
    });
  },
};
