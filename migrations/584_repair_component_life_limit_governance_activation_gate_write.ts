'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

const OWNER = 'jupiter_governance_owner';
const APP = 'jupiter_app';
const TEST = 'jupiter_test';
const MIGRATION_583 = '583_repair_component_life_limit_governance_gate_acl.ts';
const ACTIVATION = 'public.fn_cllg_activate_publication(uuid,uuid,text)';
const TRIGGERS = [
  'public.fn_cllg_validate_proposal_revision()',
  'public.fn_cllg_protect_proposal()',
  'public.fn_cllg_protect_publication()',
  'public.fn_cllg_prevent_history_mutation()',
  'public.fn_cllg_protect_operational_limit()',
] as const;

type Boundary = Record<string, boolean | number | string | null>;

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      const [preflight] = await queryInterface.sequelize.query<Boundary>(
        `WITH gate AS (
           SELECT c.oid,c.relowner,r.rolname AS owner FROM pg_catalog.pg_class c
           JOIN pg_catalog.pg_roles r ON r.oid=c.relowner
           WHERE c.oid=to_regclass('public.component_life_limit_governance_transition_gate')
         ), activation AS (
           SELECT p.oid,p.proowner,p.prosecdef,p.proconfig,r.rolname AS owner
           FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_roles r ON r.oid=p.proowner
           WHERE p.oid=to_regprocedure(:activation)
         ) SELECT
           current_database() IN ('jupiter_db','jupiter_test') AS database_approved,
           current_user='postgres' AND COALESCE((SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user),false) AS migration_authorized,
           EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=:owner) AS owner_exists,
           COALESCE((SELECT NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
             AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=:owner),false) AS owner_safe,
           CASE WHEN EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=:owner)
             THEN pg_catalog.pg_has_role(:app,:owner,'SET') OR pg_catalog.pg_has_role(:test,:owner,'SET') ELSE true END AS runtime_can_set_owner,
           EXISTS (SELECT 1 FROM public."SequelizeMeta" WHERE name=:migration583) AS migration_583_applied,
           (SELECT count(*)::int FROM public."SequelizeMeta" WHERE name=:migration583) AS migration_583_count,
           EXISTS (SELECT 1 FROM gate) AS gate_exists,(SELECT owner FROM gate) AS gate_owner,
           has_table_privilege(:owner,(SELECT oid FROM gate),'SELECT') AS owner_select,
           has_table_privilege(:owner,(SELECT oid FROM gate),'INSERT') AS owner_insert,
           has_table_privilege(:owner,(SELECT oid FROM gate),'DELETE') AS owner_delete,
           has_table_privilege(:owner,(SELECT oid FROM gate),'UPDATE') AS owner_update,
           has_table_privilege(:owner,(SELECT oid FROM gate),'TRUNCATE') AS owner_truncate,
           has_table_privilege(:owner,(SELECT oid FROM gate),'REFERENCES') AS owner_references,
           has_table_privilege(:owner,(SELECT oid FROM gate),'TRIGGER') AS owner_trigger,
           has_table_privilege(:app,(SELECT oid FROM gate),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS app_gate,
           has_table_privilege(:test,(SELECT oid FROM gate),'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS test_gate,
           EXISTS (SELECT 1 FROM gate g JOIN pg_catalog.aclexplode(COALESCE((SELECT relacl FROM pg_catalog.pg_class WHERE oid=g.oid),pg_catalog.acldefault('r',g.relowner))) a ON true WHERE a.grantee=0) AS public_gate,
           (SELECT count(*)::int FROM activation) AS activation_count,
           (SELECT owner FROM activation) AS activation_owner,
           COALESCE((SELECT prosecdef AND proconfig @> ARRAY['search_path=pg_catalog, public'] FROM activation),false) AS activation_safe,
           has_schema_privilege(:owner,'public','USAGE') AS owner_usage,
           has_schema_privilege(:owner,'public','CREATE') AS owner_create;`,
        { replacements: { owner: OWNER, app: APP, test: TEST, migration583: MIGRATION_583, activation: ACTIVATION }, type: QueryTypes.SELECT, transaction }
      );
      if (!preflight?.database_approved) throw new Error('COMPONENT_LIFE_LIMIT_ACTIVATION_GATE_DATABASE_IDENTITY_REQUIRED');
      if (!preflight.migration_authorized) throw new Error('COMPONENT_LIFE_LIMIT_ACTIVATION_GATE_MIGRATION_AUTHORITY_REQUIRED');
      if (!preflight.owner_exists) throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_OWNER_MISSING');
      if (!preflight.owner_safe || preflight.runtime_can_set_owner) throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_OWNER_UNSAFE');
      if (!preflight.migration_583_applied || preflight.migration_583_count !== 1) throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_MIGRATION_583_REQUIRED');
      if (!preflight.gate_exists || preflight.gate_owner !== OWNER) throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_GATE_BOUNDARY_INVALID');
      if (!preflight.owner_select || !preflight.owner_insert || !preflight.owner_delete
          || preflight.owner_update || preflight.owner_truncate || preflight.owner_references || preflight.owner_trigger
          || preflight.public_gate || preflight.app_gate || preflight.test_gate) throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_GATE_ACL_INVALID');
      if (preflight.activation_count !== 1 || preflight.activation_owner !== OWNER || !preflight.activation_safe) throw new Error('COMPONENT_LIFE_LIMIT_ACTIVATION_FUNCTION_BOUNDARY_INVALID');
      if (!preflight.owner_usage || preflight.owner_create) throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_SCHEMA_BOUNDARY_INVALID');

      await queryInterface.sequelize.query(
        `CREATE OR REPLACE FUNCTION public.fn_cllg_activate_publication(
          p_publication_id uuid, p_actor_id uuid, p_reason text
        ) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
        SET search_path = pg_catalog, public AS $$
        DECLARE publication public.component_life_limit_publications%ROWTYPE;
        DECLARE proposal public.component_life_limit_proposals%ROWTYPE;
        DECLARE operational_limit public.component_life_limits%ROWTYPE;
        DECLARE after_publication public.component_life_limit_publications%ROWTYPE;
        DECLARE after_limit public.component_life_limits%ROWTYPE;
        DECLARE allowed boolean;
        BEGIN
          IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_INVALID_ACTIVATION'; END IF;
          SELECT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.rf_role_permissions rp ON rp.role_id=ur.role_id
            JOIN public.rf_permission permission ON permission.id=rp.permission_id WHERE ur.user_id=p_actor_id
            AND permission.code='COMPONENT_LIFE_LIMIT_ACTIVATE' AND permission.is_active=true) INTO allowed;
          IF NOT allowed THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_PERMISSION_DENIED:COMPONENT_LIFE_LIMIT_ACTIVATE'; END IF;
          SELECT * INTO publication FROM public.component_life_limit_publications WHERE id=p_publication_id FOR UPDATE;
          IF publication.id IS NULL THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_PUBLICATION_NOT_FOUND'; END IF;
          SELECT * INTO proposal FROM public.component_life_limit_proposals WHERE id=publication.proposal_id FOR UPDATE;
          SELECT * INTO operational_limit FROM public.component_life_limits WHERE id=publication.component_life_limit_id FOR UPDATE;
          IF publication.publication_state <> 'DORMANT' THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_INVALID_ACTIVATION_TRANSITION'; END IF;
          IF proposal.id IS NULL OR proposal.status <> 'APPROVED' OR proposal.determination <> 'LIFE_LIMITED' OR proposal.proposal_purpose NOT IN ('ESTABLISH','REPLACEMENT') OR proposal.applicability_scope <> 'ALL_SERIALS_OF_MODEL' OR NOT proposal.narrower_effectivity_absent THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_PUBLICATION_NOT_ELIGIBLE'; END IF;
          IF operational_limit.id IS NULL OR operational_limit.is_active THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_PUBLICATION_NOT_ELIGIBLE'; END IF;
          IF p_actor_id=proposal.proposed_by THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_SELF_ACTIVATION_FORBIDDEN'; END IF;
          IF ROW(operational_limit.component_model_id,operational_limit.limit_type,operational_limit.basis,operational_limit.limit_hours,operational_limit.limit_cycles,operational_limit.limit_months,operational_limit.description)
             IS DISTINCT FROM ROW(proposal.component_model_id,proposal.limit_type,proposal.basis,proposal.limit_hours,proposal.limit_cycles,proposal.limit_months,
               format('Governed proposal %s revision %s; source %s; effective %s',proposal.id,proposal.revision_number,proposal.source_reference,proposal.source_effective_date))
          THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_PUBLICATION_PROJECTION_MISMATCH'; END IF;
          DELETE FROM public.component_life_limit_governance_transition_gate
            WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current();
          INSERT INTO public.component_life_limit_governance_transition_gate(backend_pid,transaction_id,publication_id,transition_code)
            VALUES(pg_backend_pid(),txid_current(),publication.id,'PUBLICATION_ACTIVATED');
          UPDATE public.component_life_limit_publications SET publication_state='ACTIVE',activated_by=p_actor_id,
            activated_at=CURRENT_TIMESTAMP,activation_reason=p_reason,updated_at=CURRENT_TIMESTAMP WHERE id=publication.id RETURNING * INTO after_publication;
          UPDATE public.component_life_limits SET is_active=true,updated_at=CURRENT_TIMESTAMP WHERE id=operational_limit.id RETURNING * INTO after_limit;
          INSERT INTO public.component_life_limit_governance_history
            (proposal_id,publication_id,event_code,actor_id,reason,evidence_confirmed,from_status,to_status,before_snapshot,after_snapshot)
          VALUES(proposal.id,publication.id,'PUBLICATION_ACTIVATED',p_actor_id,p_reason,true,'DORMANT','ACTIVE',
            jsonb_build_object('proposal',to_jsonb(proposal),'publication',to_jsonb(publication),'operational_limit',to_jsonb(operational_limit)),
            jsonb_build_object('proposal',to_jsonb(proposal),'publication',to_jsonb(after_publication),'operational_limit',to_jsonb(after_limit)));
          DELETE FROM public.component_life_limit_governance_transition_gate WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current();
          RETURN publication.id;
        EXCEPTION WHEN OTHERS THEN
          DELETE FROM public.component_life_limit_governance_transition_gate WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current();
          RAISE;
        END; $$;
        ALTER FUNCTION ${ACTIVATION} OWNER TO ${OWNER};
        ALTER FUNCTION ${ACTIVATION} SECURITY DEFINER;
        ALTER FUNCTION ${ACTIVATION} SET search_path = pg_catalog, public;
        REVOKE ALL ON FUNCTION ${ACTIVATION} FROM PUBLIC;
        REVOKE ALL ON FUNCTION ${ACTIVATION} FROM ${APP};
        REVOKE ALL ON FUNCTION ${ACTIVATION} FROM ${TEST};
        GRANT EXECUTE ON FUNCTION ${ACTIVATION} TO ${APP};`, { transaction }
      );

      const [verified] = await queryInterface.sequelize.query<Boundary>(
        `WITH activation AS (SELECT p.oid,p.proowner,p.prosecdef,p.proconfig,p.proacl,r.rolname AS owner FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_roles r ON r.oid=p.proowner WHERE p.oid=to_regprocedure(:activation))
         SELECT (SELECT count(*)::int FROM activation) AS activation_count,(SELECT owner FROM activation) AS activation_owner,
          COALESCE((SELECT prosecdef AND proconfig @> ARRAY['search_path=pg_catalog, public'] FROM activation),false) AS activation_safe,
          EXISTS (SELECT 1 FROM activation a JOIN pg_catalog.aclexplode(COALESCE(a.proacl,pg_catalog.acldefault('f',a.proowner))) x ON true WHERE x.grantee=0 AND x.privilege_type='EXECUTE') AS public_execute,
          has_function_privilege(:app,:activation,'EXECUTE') AS app_execute,
          has_function_privilege(:test,:activation,'EXECUTE') AS test_execute,
          (SELECT count(*)::int FROM pg_catalog.pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname='fn_cllg_activate_publication') AS overload_count,
          EXISTS (SELECT 1 FROM unnest(ARRAY[:triggers]::regprocedure[]) f WHERE has_function_privilege(:app,f,'EXECUTE') OR has_function_privilege(:test,f,'EXECUTE')) AS runtime_trigger_execute,
          EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) x ON true WHERE p.oid=ANY(ARRAY[:triggers]::regprocedure[]) AND x.grantee=0 AND x.privilege_type='EXECUTE') AS public_trigger_execute,
          has_table_privilege(:owner,'public.component_life_limit_governance_transition_gate','SELECT') AS owner_select,
          has_table_privilege(:owner,'public.component_life_limit_governance_transition_gate','INSERT') AS owner_insert,
          has_table_privilege(:owner,'public.component_life_limit_governance_transition_gate','DELETE') AS owner_delete,
          has_table_privilege(:owner,'public.component_life_limit_governance_transition_gate','UPDATE') AS owner_update,
          has_table_privilege(:owner,'public.component_life_limit_governance_transition_gate','TRUNCATE,REFERENCES,TRIGGER') AS owner_broad,
          has_schema_privilege(:owner,'public','USAGE') AS owner_usage,has_schema_privilege(:owner,'public','CREATE') AS owner_create;`,
        { replacements: { owner: OWNER, app: APP, test: TEST, activation: ACTIVATION, triggers: [...TRIGGERS] }, type: QueryTypes.SELECT, transaction }
      );
      if (!verified || verified.activation_count !== 1 || verified.overload_count !== 1 || verified.activation_owner !== OWNER || !verified.activation_safe
          || verified.public_execute || !verified.app_execute || verified.test_execute || verified.runtime_trigger_execute || verified.public_trigger_execute
          || !verified.owner_select || !verified.owner_insert || !verified.owner_delete || verified.owner_update || verified.owner_broad
          || !verified.owner_usage || verified.owner_create) throw new Error('COMPONENT_LIFE_LIMIT_ACTIVATION_GATE_WRITE_VERIFICATION_FAILED');
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async () => {
      throw new Error('COMPONENT_LIFE_LIMIT_ACTIVATION_GATE_WRITE_ROLLBACK_REFUSED');
    });
  },
};
