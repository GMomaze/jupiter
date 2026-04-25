'use strict';

export default {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      -- ===============================================
      -- JUPITER AMMS
      -- PHASE 0.5 — TABLE-DRIVEN RBAC MATRIX
      -- ===============================================

      -- ==================================================
      -- 1. PERMISSIONS TABLE
      -- ==================================================

      CREATE TABLE IF NOT EXISTS public.rf_permission
      (
          id uuid NOT NULL DEFAULT gen_random_uuid(),
          code varchar(255) NOT NULL,
          label varchar(255) NOT NULL,
          description text,
          module varchar(100) NOT NULL,
          is_active boolean DEFAULT true,
          system_locked boolean DEFAULT false,
          created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT rf_permission_pkey PRIMARY KEY (id),
          CONSTRAINT rf_permission_code_unique UNIQUE (code)
      );

      GRANT ALL ON TABLE public.rf_permission TO jupiter_app;

      CREATE OR REPLACE TRIGGER tr_audit_rf_permission
      AFTER INSERT OR DELETE OR UPDATE
      ON public.rf_permission
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_audit_trigger();


      -- ==================================================
      -- 2. ROLE ↔ PERMISSION LINK TABLE
      -- ==================================================

      CREATE TABLE IF NOT EXISTS public.rf_role_permissions
      (
          id uuid NOT NULL DEFAULT gen_random_uuid(),
          role_id uuid NOT NULL,
          permission_id uuid NOT NULL,
          created_at timestamptz DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT rf_role_permissions_pkey PRIMARY KEY (id),

          CONSTRAINT rf_role_permissions_unique
              UNIQUE (role_id, permission_id),

          CONSTRAINT rf_role_permissions_role_fk
              FOREIGN KEY (role_id)
              REFERENCES public.rf_role (id)
              ON DELETE CASCADE,

          CONSTRAINT rf_role_permissions_permission_fk
              FOREIGN KEY (permission_id)
              REFERENCES public.rf_permission (id)
              ON DELETE CASCADE
      );

      GRANT ALL ON TABLE public.rf_role_permissions TO jupiter_app;

      CREATE OR REPLACE TRIGGER tr_audit_rf_role_permissions
      AFTER INSERT OR DELETE OR UPDATE
      ON public.rf_role_permissions
      FOR EACH ROW
      EXECUTE FUNCTION public.fn_audit_trigger();


      -- ==================================================
      -- 3. SEED PERMISSIONS
      -- ==================================================

      INSERT INTO public.rf_permission (code, label, description, module, system_locked)
      VALUES
      ('REFERENCE_VIEW', 'Reference View', 'View reference data', 'REFERENCE', true),
      ('REFERENCE_CREATE', 'Reference Create', 'Create reference data', 'REFERENCE', true),
      ('REFERENCE_EDIT', 'Reference Edit', 'Edit reference data', 'REFERENCE', true),
      ('REFERENCE_DEACTIVATE', 'Reference Deactivate', 'Deactivate reference data', 'REFERENCE', true)
      ON CONFLICT (code) DO NOTHING;


      -- ==================================================
      -- 4. SEED ROLES
      -- ==================================================

      INSERT INTO public.rf_role (code, label, description, system_locked)
      VALUES
      ('REFERENCE_ADMIN', 'Reference Administrator', 'Full control of reference data', true),
      ('REFERENCE_EDITOR', 'Reference Editor', 'Create and edit reference data', true),
      ('REFERENCE_VIEWER', 'Reference Viewer', 'View-only access to reference data', true)
      ON CONFLICT (code) DO NOTHING;


      -- ==================================================
      -- 5. ASSIGN PERMISSIONS
      -- ==================================================

      INSERT INTO public.rf_role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM public.rf_role r
      JOIN public.rf_permission p ON p.module = 'REFERENCE'
      WHERE r.code = 'REFERENCE_ADMIN'
      ON CONFLICT DO NOTHING;

      INSERT INTO public.rf_role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM public.rf_role r
      JOIN public.rf_permission p 
          ON p.code IN ('REFERENCE_VIEW','REFERENCE_CREATE','REFERENCE_EDIT')
      WHERE r.code = 'REFERENCE_EDITOR'
      ON CONFLICT DO NOTHING;

      INSERT INTO public.rf_role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM public.rf_role r
      JOIN public.rf_permission p 
          ON p.code = 'REFERENCE_VIEW'
      WHERE r.code = 'REFERENCE_VIEWER'
      ON CONFLICT DO NOTHING;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS tr_audit_rf_role_permissions ON public.rf_role_permissions;
      DROP TRIGGER IF EXISTS tr_audit_rf_permission ON public.rf_permission;

      DROP TABLE IF EXISTS public.rf_role_permissions;
      DROP TABLE IF EXISTS public.rf_permission;
    `);
  },
};