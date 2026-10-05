import { QueryInterface, QueryTypes } from 'sequelize';

const FUNCTION = 'fn_tenant_requires_active_admin';
const MEMBERSHIP_TRIGGER = 'tr_tenant_memberships_require_active_admin';
const ROLE_TRIGGER = 'tr_tenant_membership_roles_require_active_admin';

async function state(q: QueryInterface) {
  const [row]: any = await q.sequelize.query(`SELECT
    (SELECT count(*)::int FROM public."SequelizeMeta" WHERE name='602_create_staff_membership_administration.ts') migration_602,
    to_regprocedure('public.fn_tenant_requires_active_admin()') IS NOT NULL function_present,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='tr_tenant_memberships_require_active_admin' AND NOT tgisinternal) membership_trigger,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='tr_tenant_membership_roles_require_active_admin' AND NOT tgisinternal) role_trigger,
    to_regclass('public.staff_invitations') IS NOT NULL invitations,
    to_regclass('public.tenant_membership_authority_audit') IS NOT NULL audit,
    (SELECT count(*)::int FROM platform_capabilities WHERE code='TENANT_ADMIN_RECOVER' AND is_active AND system_locked) capability`,
    { type: QueryTypes.SELECT });
  return row;
}

export default {
  async up(q: QueryInterface) {
    const before = await state(q);
    if (before?.migration_602 !== 1 || !before.invitations || !before.audit || before.capability !== 1) {
      throw new Error('MIGRATION_603_REQUIRES_VERIFIED_602_FOUNDATION');
    }
    if (!before.function_present || !before.membership_trigger || !before.role_trigger) {
      throw new Error('MIGRATION_603_REFUSES_UNEXPECTED_LAST_ADMIN_ENFORCEMENT_STATE');
    }
    await q.sequelize.transaction(async transaction => q.sequelize.query(`
      DROP TRIGGER ${ROLE_TRIGGER} ON public.tenant_membership_roles;
      DROP TRIGGER ${MEMBERSHIP_TRIGGER} ON public.tenant_memberships;
      DROP FUNCTION public.${FUNCTION}();
    `, { transaction }));
  },

  async down(q: QueryInterface) {
    const before = await state(q);
    if (before?.migration_602 !== 1 || !before.invitations || !before.audit || before.capability !== 1) {
      throw new Error('MIGRATION_603_DOWN_REQUIRES_VERIFIED_602_FOUNDATION');
    }
    if (before.function_present || before.membership_trigger || before.role_trigger) {
      throw new Error('MIGRATION_603_DOWN_REFUSES_EXISTING_LAST_ADMIN_ENFORCEMENT');
    }
    await q.sequelize.transaction(async transaction => q.sequelize.query(`
      CREATE FUNCTION public.${FUNCTION}() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE affected_tenant uuid; DECLARE removes_admin boolean := false;
      BEGIN
        IF TG_TABLE_NAME='tenant_memberships' THEN
          affected_tenant:=COALESCE(NEW.tenant_id,OLD.tenant_id);
          removes_admin:=OLD.status='ACTIVE' AND (TG_OP='DELETE' OR NEW.status<>'ACTIVE') AND EXISTS(
            SELECT 1 FROM tenant_membership_roles tmr JOIN rf_role r ON r.id=tmr.role_id
            WHERE tmr.membership_id=OLD.id AND tmr.revoked_at IS NULL AND r.code='ADMIN' AND r.is_active=true);
        ELSE
          SELECT tenant_id INTO affected_tenant FROM tenant_memberships WHERE id=COALESCE(NEW.membership_id,OLD.membership_id);
          removes_admin:=(TG_OP='DELETE' OR (OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL)) AND EXISTS(
            SELECT 1 FROM rf_role r JOIN tenant_memberships tm ON tm.id=OLD.membership_id
            WHERE r.id=OLD.role_id AND r.code='ADMIN' AND r.is_active=true AND tm.status='ACTIVE');
        END IF;
        IF removes_admin AND affected_tenant IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM tenant_memberships tm
          JOIN tenant_membership_roles tmr ON tmr.membership_id=tm.id AND tmr.revoked_at IS NULL
          JOIN rf_role r ON r.id=tmr.role_id AND r.code='ADMIN' AND r.is_active=true
          WHERE tm.tenant_id=affected_tenant AND tm.status='ACTIVE') THEN
          RAISE EXCEPTION 'LAST_ACTIVE_TENANT_ADMIN_REQUIRED';
        END IF;
        RETURN NULL;
      END; $$;
      CREATE CONSTRAINT TRIGGER ${MEMBERSHIP_TRIGGER}
        AFTER INSERT OR UPDATE OR DELETE ON public.tenant_memberships DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION public.${FUNCTION}();
      CREATE CONSTRAINT TRIGGER ${ROLE_TRIGGER}
        AFTER INSERT OR UPDATE OR DELETE ON public.tenant_membership_roles DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION public.${FUNCTION}();
    `, { transaction }));
  },
};
