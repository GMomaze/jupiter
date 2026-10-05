import { QueryInterface, QueryTypes } from 'sequelize';

const CAPABILITY = 'TENANT_ADMIN_RECOVER';

export default {
  async up(q: QueryInterface) {
    const [state]: any = await q.sequelize.query(`SELECT
      to_regclass('public.tenant_memberships') IS NOT NULL memberships,
      to_regclass('public.tenant_membership_roles') IS NOT NULL membership_roles,
      to_regclass('public.platform_capabilities') IS NOT NULL capabilities,
      to_regclass('public.staff_invitations') IS NOT NULL invitations,
      to_regclass('public.tenant_membership_authority_audit') IS NOT NULL audit`, { type: QueryTypes.SELECT });
    if (!state?.memberships || !state.membership_roles || !state.capabilities) {
      throw new Error('MIGRATION_602_REQUIRES_VERIFIED_MEMBERSHIP_AND_PLATFORM_FOUNDATIONS');
    }
    if (state.invitations || state.audit) throw new Error('MIGRATION_602_REFUSES_PARTIAL_FOUNDATION');
    const existing: any[] = await q.sequelize.query(`SELECT code FROM platform_capabilities WHERE code=:code`, {
      replacements: { code: CAPABILITY }, type: QueryTypes.SELECT,
    });
    if (existing.length) throw new Error('MIGRATION_602_REFUSES_EXISTING_CAPABILITY');
    await q.sequelize.transaction(async transaction => q.sequelize.query(`
      INSERT INTO platform_capabilities(id,code,label,description,domain,is_active,system_locked)
      VALUES(gen_random_uuid(),'${CAPABILITY}','Recover tenant administrators',
        'Restore or establish administrator continuity for one exact tenant.','TENANT_ADMINISTRATION',true,true);

      CREATE TABLE public.staff_invitations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
        membership_id uuid NOT NULL REFERENCES tenant_memberships(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
        user_id uuid NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
        normalized_email varchar(320) NOT NULL,
        token_hash char(64) NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        identity_created boolean NOT NULL DEFAULT false,
        invited_by_user_id uuid NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
        consumed_at timestamptz NULL,
        revoked_at timestamptz NULL,
        revoked_by_user_id uuid NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT staff_invitations_email_normalized CHECK (normalized_email=lower(btrim(normalized_email))),
        CONSTRAINT staff_invitations_expiry CHECK (expires_at>created_at),
        CONSTRAINT staff_invitations_terminal_state CHECK (NOT(consumed_at IS NOT NULL AND revoked_at IS NOT NULL)),
        CONSTRAINT staff_invitations_revocation_shape CHECK ((revoked_at IS NULL AND revoked_by_user_id IS NULL) OR (revoked_at IS NOT NULL AND revoked_by_user_id IS NOT NULL))
      );
      CREATE UNIQUE INDEX staff_invitations_one_live_membership ON staff_invitations(membership_id)
        WHERE consumed_at IS NULL AND revoked_at IS NULL;
      CREATE INDEX staff_invitations_tenant_created ON staff_invitations(tenant_id,created_at);

      CREATE TABLE public.tenant_membership_authority_audit (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
        membership_id uuid NOT NULL REFERENCES tenant_memberships(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
        actor_user_id uuid NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
        actor_kind varchar(24) NOT NULL CHECK(actor_kind IN('TENANT_ADMIN','PLATFORM_HUMAN','INVITEE')),
        action varchar(48) NOT NULL,
        reason text NOT NULL CHECK(btrim(reason)<>''),
        correlation_id uuid NOT NULL,
        old_values jsonb NULL,
        new_values jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX tenant_membership_authority_audit_tenant_created ON tenant_membership_authority_audit(tenant_id,created_at,id);

      CREATE FUNCTION public.fn_tenant_membership_authority_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'TENANT_MEMBERSHIP_AUTHORITY_AUDIT_IMMUTABLE'; END; $$;
      CREATE TRIGGER tr_tenant_membership_authority_audit_immutable BEFORE UPDATE OR DELETE ON tenant_membership_authority_audit
        FOR EACH ROW EXECUTE FUNCTION public.fn_tenant_membership_authority_audit_immutable();

      CREATE FUNCTION public.fn_tenant_requires_active_admin() RETURNS trigger LANGUAGE plpgsql AS $$
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
      CREATE CONSTRAINT TRIGGER tr_tenant_memberships_require_active_admin
        AFTER INSERT OR UPDATE OR DELETE ON tenant_memberships DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION public.fn_tenant_requires_active_admin();
      CREATE CONSTRAINT TRIGGER tr_tenant_membership_roles_require_active_admin
        AFTER INSERT OR UPDATE OR DELETE ON tenant_membership_roles DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION public.fn_tenant_requires_active_admin();

      DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='jupiter_app') THEN
        GRANT SELECT,INSERT,UPDATE ON staff_invitations TO jupiter_app;
        REVOKE DELETE ON staff_invitations FROM jupiter_app;
        GRANT SELECT,INSERT ON tenant_membership_authority_audit TO jupiter_app;
        REVOKE UPDATE,DELETE ON tenant_membership_authority_audit FROM jupiter_app;
        GRANT INSERT,UPDATE ON tenant_memberships,tenant_membership_roles TO jupiter_app;
        GRANT INSERT,UPDATE ON users TO jupiter_app;
      END IF; END $$;
    `, { transaction }));
  },

  async down(q: QueryInterface) {
    const [state]: any = await q.sequelize.query(`SELECT
      (SELECT count(*)::int FROM platform_capabilities WHERE code=:code AND is_active AND system_locked) capability,
      (SELECT count(*)::int FROM platform_capability_grants g JOIN platform_capabilities c ON c.id=g.capability_id WHERE c.code=:code) grants,
      (SELECT count(*)::int FROM platform_global_audit_log WHERE capability_code=:code) platform_audits,
      (SELECT count(*)::int FROM staff_invitations) invitations,
      (SELECT count(*)::int FROM tenant_membership_authority_audit) membership_audits`,
      { replacements: { code: CAPABILITY }, type: QueryTypes.SELECT });
    if (state?.capability !== 1) throw new Error('MIGRATION_602_DOWN_REFUSES_INCONSISTENT_CAPABILITY');
    if (state.grants || state.platform_audits || state.invitations || state.membership_audits) throw new Error('MIGRATION_602_DOWN_REFUSES_AUTHORITY_EVIDENCE');
    await q.sequelize.transaction(async transaction => q.sequelize.query(`
      DROP TRIGGER tr_tenant_membership_roles_require_active_admin ON tenant_membership_roles;
      DROP TRIGGER tr_tenant_memberships_require_active_admin ON tenant_memberships;
      DROP FUNCTION public.fn_tenant_requires_active_admin();
      DROP TRIGGER tr_tenant_membership_authority_audit_immutable ON tenant_membership_authority_audit;
      DROP FUNCTION public.fn_tenant_membership_authority_audit_immutable();
      DROP TABLE tenant_membership_authority_audit;
      DROP TABLE staff_invitations;
      DELETE FROM platform_capabilities WHERE code=:code;
    `, { replacements: { code: CAPABILITY }, transaction }));
  },
};
