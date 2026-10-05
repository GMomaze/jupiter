import { QueryInterface, QueryTypes } from 'sequelize';

const TABLES = ['platform_principals', 'platform_capabilities', 'platform_capability_grants', 'platform_global_audit_log'];

async function tableExists(q: QueryInterface, table: string) {
  return Boolean(await q.sequelize.query(`SELECT to_regclass('public.${table}') IS NOT NULL AS present`, { type: QueryTypes.SELECT }).then((r: any[]) => r[0]?.present));
}

export default {
  async up(q: QueryInterface) {
    for (const table of TABLES) if (await tableExists(q, table)) throw new Error(`MIGRATION_598_REFUSES_PARTIAL_STATE:${table}`);
    await q.sequelize.transaction(async (transaction) => {
      await q.sequelize.query(`
        CREATE TABLE public.platform_principals (
          id uuid PRIMARY KEY,
          principal_type varchar(16) NOT NULL CHECK (principal_type IN ('HUMAN','SERVICE')),
          user_id uuid NULL REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
          service_code varchar(100) NULL,
          display_name varchar(200) NOT NULL,
          status varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
          created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
          disabled_at timestamptz NULL,
          disabled_by_principal_id uuid NULL,
          CONSTRAINT platform_principal_identity_check CHECK (
            (principal_type='HUMAN' AND user_id IS NOT NULL AND service_code IS NULL) OR
            (principal_type='SERVICE' AND user_id IS NULL AND service_code IS NOT NULL AND service_code=upper(trim(service_code)))
          )
        );
        ALTER TABLE public.platform_principals ADD CONSTRAINT platform_principals_disabled_by_fk
          FOREIGN KEY (disabled_by_principal_id) REFERENCES public.platform_principals(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
        CREATE UNIQUE INDEX platform_principals_active_human_uidx ON public.platform_principals(user_id) WHERE status='ACTIVE' AND user_id IS NOT NULL;
        CREATE UNIQUE INDEX platform_principals_active_service_uidx ON public.platform_principals(service_code) WHERE status='ACTIVE' AND service_code IS NOT NULL;

        CREATE TABLE public.platform_capabilities (
          id uuid PRIMARY KEY,
          code varchar(120) NOT NULL UNIQUE CHECK (code=upper(trim(code))),
          label varchar(200) NOT NULL,
          description text NULL,
          domain varchar(100) NOT NULL,
          is_active boolean NOT NULL DEFAULT true,
          system_locked boolean NOT NULL DEFAULT true
        );

        CREATE TABLE public.platform_capability_grants (
          id uuid PRIMARY KEY,
          principal_id uuid NOT NULL REFERENCES public.platform_principals(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
          capability_id uuid NOT NULL REFERENCES public.platform_capabilities(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
          granted_by_principal_id uuid NOT NULL REFERENCES public.platform_principals(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
          granted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
          grant_reason text NOT NULL,
          revoked_by_principal_id uuid NULL REFERENCES public.platform_principals(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
          revoked_at timestamptz NULL,
          revocation_reason text NULL,
          CONSTRAINT platform_grant_revocation_check CHECK (
            (revoked_at IS NULL AND revoked_by_principal_id IS NULL AND revocation_reason IS NULL) OR
            (revoked_at IS NOT NULL AND revoked_by_principal_id IS NOT NULL AND length(trim(revocation_reason)) > 0)
          )
        );
        CREATE UNIQUE INDEX platform_capability_grants_active_uidx ON public.platform_capability_grants(principal_id, capability_id) WHERE revoked_at IS NULL;
        CREATE INDEX platform_capability_grants_capability_idx ON public.platform_capability_grants(capability_id) WHERE revoked_at IS NULL;

        CREATE TABLE public.platform_global_audit_log (
          id uuid PRIMARY KEY,
          principal_id uuid NOT NULL REFERENCES public.platform_principals(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
          principal_type varchar(16) NOT NULL,
          principal_code varchar(200) NOT NULL,
          capability_code varchar(120) NOT NULL,
          action varchar(120) NOT NULL,
          resource_type varchar(120) NOT NULL,
          resource_id text NULL,
          correlation_id uuid NOT NULL,
          source_provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
          old_values jsonb NULL,
          new_values jsonb NULL,
          outcome varchar(32) NOT NULL,
          reason text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX platform_global_audit_resource_idx ON public.platform_global_audit_log(resource_type, resource_id);
        CREATE INDEX platform_global_audit_principal_idx ON public.platform_global_audit_log(principal_id, created_at);
        CREATE INDEX platform_global_audit_correlation_idx ON public.platform_global_audit_log(correlation_id);

        CREATE FUNCTION public.fn_platform_global_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'PLATFORM_GLOBAL_AUDIT_IMMUTABLE'; END; $$;
        CREATE TRIGGER tr_platform_global_audit_immutable BEFORE UPDATE OR DELETE ON public.platform_global_audit_log
          FOR EACH ROW EXECUTE FUNCTION public.fn_platform_global_audit_immutable();

        INSERT INTO public.platform_capabilities(id,code,label,description,domain) VALUES
          (gen_random_uuid(),'PLATFORM_AUTHORITY_MANAGE','Manage platform authority','Grant and revoke explicitly persisted platform authority.','PLATFORM_AUTHORITY'),
          (gen_random_uuid(),'PLATFORM_AUDIT_VIEW','View platform audit','Read immutable platform-global audit evidence.','PLATFORM_AUDIT');

        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='jupiter_app') THEN
            GRANT SELECT, INSERT, UPDATE ON public.platform_principals, public.platform_capability_grants TO jupiter_app;
            GRANT SELECT ON public.platform_capabilities TO jupiter_app;
            GRANT SELECT, INSERT ON public.platform_global_audit_log TO jupiter_app;
          END IF;
        END $$;
      `, { transaction });
    });
  },

  async down(q: QueryInterface) {
    for (const table of TABLES) if (!(await tableExists(q, table))) throw new Error(`MIGRATION_598_DOWN_REFUSES_INCOMPLETE_STATE:${table}`);
    const [row]: any = await q.sequelize.query(`
      SELECT
        (SELECT count(*)::int FROM platform_principals) principals,
        (SELECT count(*)::int FROM platform_capability_grants) grants,
        (SELECT count(*)::int FROM platform_global_audit_log) audits`, { type: QueryTypes.SELECT });
    if (row.principals || row.grants || row.audits) throw new Error('MIGRATION_598_DOWN_REFUSES_POPULATED_AUTHORITY');
    await q.sequelize.transaction(async (transaction) => {
      await q.sequelize.query(`
        DROP TRIGGER tr_platform_global_audit_immutable ON public.platform_global_audit_log;
        DROP FUNCTION public.fn_platform_global_audit_immutable();
        DROP TABLE public.platform_global_audit_log;
        DROP TABLE public.platform_capability_grants;
        DROP TABLE public.platform_capabilities;
        DROP TABLE public.platform_principals;
      `, { transaction });
    });
  },
};
