import { QueryInterface, QueryTypes } from 'sequelize';

const CAPABILITIES = [
  ['TENANT_PROVISION', 'Provision tenants', 'Provision a tenant and its initial administrator foundation.'],
  ['TENANT_ACTIVATE', 'Activate tenants', 'Activate a provisioned tenant after prerequisite validation.'],
  ['TENANT_SUSPEND', 'Suspend tenants', 'Suspend tenant access while preserving tenant data.'],
  ['TENANT_REINSTATE', 'Reinstate tenants', 'Reinstate a suspended tenant without changing membership state.'],
] as const;

export default {
  async up(q: QueryInterface) {
    const [state]: any = await q.sequelize.query(`SELECT
      to_regclass('public.tenants') IS NOT NULL tenants,
      to_regclass('public.platform_capabilities') IS NOT NULL capabilities,
      to_regclass('public.platform_capability_grants') IS NOT NULL grants,
      to_regclass('public.platform_global_audit_log') IS NOT NULL audit,
      EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='tr_tenants_lifecycle_transition') lifecycle_trigger,
      EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='tr_tenants_delete_prohibited') delete_trigger`,
      { type: QueryTypes.SELECT });
    if (!state?.tenants || !state.capabilities || !state.grants || !state.audit) {
      throw new Error('MIGRATION_601_REQUIRES_VERIFIED_TENANT_AND_PLATFORM_FOUNDATIONS');
    }
    if (state.lifecycle_trigger || state.delete_trigger) {
      throw new Error('MIGRATION_601_REFUSES_PARTIAL_LIFECYCLE_FOUNDATION');
    }
    const existing: any[] = await q.sequelize.query(
      `SELECT code FROM platform_capabilities WHERE code IN(:codes)`,
      { replacements: { codes: CAPABILITIES.map(([code]) => code) }, type: QueryTypes.SELECT },
    );
    if (existing.length) {
      throw new Error(`MIGRATION_601_REFUSES_EXISTING_CAPABILITY:${existing.map(row => row.code).sort().join(',')}`);
    }

    await q.sequelize.transaction(async transaction => {
      for (const [code, label, description] of CAPABILITIES) {
        await q.sequelize.query(
          `INSERT INTO platform_capabilities
             (id,code,label,description,domain,is_active,system_locked)
           VALUES(gen_random_uuid(),:code,:label,:description,'TENANT_LIFECYCLE',true,true)`,
          { replacements: { code, label, description }, transaction },
        );
      }
      await q.sequelize.query(`
        CREATE FUNCTION public.fn_tenants_enforce_lifecycle_transition()
        RETURNS trigger LANGUAGE plpgsql AS $function$
        BEGIN
          IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
            IF NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason
               OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
               OR NEW.suspended_by_user_id IS DISTINCT FROM OLD.suspended_by_user_id
               OR NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
              RAISE EXCEPTION 'TENANT_LIFECYCLE_METADATA_REQUIRES_TRANSITION';
            END IF;
            RETURN NEW;
          END IF;
          IF OLD.status = 'PROVISIONING' AND NEW.status = 'ACTIVE'
             AND NEW.suspension_reason IS NULL AND NEW.suspended_at IS NULL
             AND NEW.suspended_by_user_id IS NULL AND NEW.archived_at IS NULL THEN
            RETURN NEW;
          END IF;
          IF OLD.status = 'ACTIVE' AND NEW.status = 'SUSPENDED'
             AND NEW.suspension_reason IS NOT NULL AND btrim(NEW.suspension_reason) <> ''
             AND NEW.suspended_at IS NOT NULL AND NEW.suspended_by_user_id IS NOT NULL
             AND NEW.archived_at IS NULL THEN
            RETURN NEW;
          END IF;
          IF OLD.status = 'SUSPENDED' AND NEW.status = 'ACTIVE'
             AND NEW.suspension_reason IS NULL AND NEW.suspended_at IS NULL
             AND NEW.suspended_by_user_id IS NULL AND NEW.archived_at IS NULL THEN
            RETURN NEW;
          END IF;
          RAISE EXCEPTION 'TENANT_LIFECYCLE_TRANSITION_PROHIBITED';
        END;
        $function$;

        CREATE TRIGGER tr_tenants_lifecycle_transition
        BEFORE UPDATE OF status, suspension_reason, suspended_at,
          suspended_by_user_id, archived_at ON public.tenants
        FOR EACH ROW EXECUTE FUNCTION public.fn_tenants_enforce_lifecycle_transition();

        CREATE FUNCTION public.fn_tenants_prohibit_delete()
        RETURNS trigger LANGUAGE plpgsql AS $function$
        BEGIN
          RAISE EXCEPTION 'TENANT_DELETION_PROHIBITED';
        END;
        $function$;

        CREATE TRIGGER tr_tenants_delete_prohibited
        BEFORE DELETE ON public.tenants
        FOR EACH ROW EXECUTE FUNCTION public.fn_tenants_prohibit_delete();

        GRANT SELECT, INSERT, UPDATE ON TABLE public.tenants TO jupiter_app;
        REVOKE DELETE ON TABLE public.tenants FROM jupiter_app;`,
        { transaction },
      );
    });
  },

  async down(q: QueryInterface) {
    const codes = CAPABILITIES.map(([code]) => code);
    const [state]: any = await q.sequelize.query(`SELECT
      (SELECT count(*)::int FROM platform_capabilities WHERE code IN(:codes) AND is_active AND system_locked) seeds,
      (SELECT count(*)::int FROM platform_capability_grants g JOIN platform_capabilities c ON c.id=g.capability_id WHERE c.code IN(:codes)) grants,
      (SELECT count(*)::int FROM platform_global_audit_log WHERE capability_code IN(:codes)) audits,
      (SELECT count(*)::int FROM tenants WHERE status <> 'ACTIVE') incompatible_tenants`,
      { replacements: { codes }, type: QueryTypes.SELECT });
    if (state?.seeds !== CAPABILITIES.length) throw new Error('MIGRATION_601_DOWN_REFUSES_INCONSISTENT_SEEDS');
    if (state.grants || state.audits) throw new Error('MIGRATION_601_DOWN_REFUSES_LIFECYCLE_EVIDENCE');
    if (state.incompatible_tenants) throw new Error('MIGRATION_601_DOWN_REFUSES_INCOMPATIBLE_TENANT_STATE');

    await q.sequelize.transaction(async transaction => {
      await q.sequelize.query(`
        DROP TRIGGER IF EXISTS tr_tenants_delete_prohibited ON public.tenants;
        DROP FUNCTION IF EXISTS public.fn_tenants_prohibit_delete();
        DROP TRIGGER IF EXISTS tr_tenants_lifecycle_transition ON public.tenants;
        DROP FUNCTION IF EXISTS public.fn_tenants_enforce_lifecycle_transition();
        DELETE FROM platform_capabilities WHERE code IN(:codes);
        GRANT DELETE ON TABLE public.tenants TO jupiter_app;`,
        { replacements: { codes }, transaction },
      );
    });
  },
};
