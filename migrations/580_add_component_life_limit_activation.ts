'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

type CountRow = { count: number };

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        ALTER TABLE public.component_life_limit_publications
          ADD COLUMN activated_by uuid NULL REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
          ADD COLUMN activated_at timestamptz NULL,
          ADD COLUMN activation_reason text NULL;

        ALTER TABLE public.component_life_limit_publications
          DROP CONSTRAINT component_life_limit_publications_terminal_shape,
          ADD CONSTRAINT component_life_limit_publications_lifecycle_shape CHECK (
            (publication_state = 'DORMANT' AND activated_by IS NULL AND activated_at IS NULL AND activation_reason IS NULL AND terminal_by IS NULL AND terminal_at IS NULL AND terminal_reason IS NULL) OR
            (publication_state = 'ACTIVE' AND activated_by IS NOT NULL AND activated_at IS NOT NULL AND btrim(activation_reason) <> '' AND terminal_by IS NULL AND terminal_at IS NULL AND terminal_reason IS NULL) OR
            (publication_state IN ('WITHDRAWN','SUPERSEDED') AND terminal_by IS NOT NULL AND terminal_at IS NOT NULL AND btrim(terminal_reason) <> '' AND (
              (activated_by IS NULL AND activated_at IS NULL AND activation_reason IS NULL) OR
              (activated_by IS NOT NULL AND activated_at IS NOT NULL AND btrim(activation_reason) <> '')
            ))
          );

        CREATE INDEX component_life_limit_publications_activator_index ON public.component_life_limit_publications(activated_by);
        CREATE INDEX component_life_limit_publications_activated_at_index ON public.component_life_limit_publications(activated_at);

        ALTER TABLE public.component_life_limit_governance_transition_gate
          ADD COLUMN publication_id uuid NULL,
          ADD COLUMN transition_code varchar(40) NULL;

        CREATE OR REPLACE FUNCTION public.fn_cllg_protect_publication() RETURNS trigger
        LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
        DECLARE activation_gate boolean;
        BEGIN
          IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_GOVERNANCE_IMMUTABLE'; END IF;
          SELECT EXISTS (
            SELECT 1 FROM public.component_life_limit_governance_transition_gate
            WHERE backend_pid = pg_backend_pid() AND transaction_id = txid_current()
              AND publication_id = OLD.id AND transition_code = 'PUBLICATION_ACTIVATED'
          ) INTO activation_gate;
          IF NOT EXISTS (
            SELECT 1 FROM public.component_life_limit_governance_transition_gate
            WHERE backend_pid = pg_backend_pid() AND transaction_id = txid_current()
          ) THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_DIRECT_TRANSITION_FORBIDDEN'; END IF;
          IF ROW(NEW.id,NEW.proposal_id,NEW.component_life_limit_id,NEW.published_by,NEW.published_at,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.proposal_id,OLD.component_life_limit_id,OLD.published_by,OLD.published_at,OLD.created_at) THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_PUBLICATION_IMMUTABLE'; END IF;
          IF OLD.publication_state = 'DORMANT' AND NEW.publication_state = 'ACTIVE' THEN
            IF NOT activation_gate THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_DIRECT_TRANSITION_FORBIDDEN'; END IF;
            IF NEW.activated_by IS NULL OR NEW.activated_at IS NULL OR btrim(NEW.activation_reason) = '' THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_INVALID_ACTIVATION'; END IF;
          ELSIF OLD.publication_state IN ('DORMANT','ACTIVE') AND NEW.publication_state IN ('WITHDRAWN','SUPERSEDED') THEN
            IF ROW(NEW.activated_by,NEW.activated_at,NEW.activation_reason) IS DISTINCT FROM ROW(OLD.activated_by,OLD.activated_at,OLD.activation_reason) THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_ACTIVATION_IMMUTABLE'; END IF;
          ELSE
            RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_INVALID_PUBLICATION_TRANSITION';
          END IF;
          RETURN NEW;
        END; $$;

        CREATE FUNCTION public.fn_cllg_activate_publication(
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
          SELECT EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.rf_role_permissions rp ON rp.role_id = ur.role_id
            JOIN public.rf_permission permission ON permission.id = rp.permission_id
            WHERE ur.user_id = p_actor_id AND permission.code = 'COMPONENT_LIFE_LIMIT_ACTIVATE' AND permission.is_active = true
          ) INTO allowed;
          IF NOT allowed THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_PERMISSION_DENIED:COMPONENT_LIFE_LIMIT_ACTIVATE'; END IF;
          SELECT * INTO publication FROM public.component_life_limit_publications WHERE id = p_publication_id FOR UPDATE;
          IF publication.id IS NULL THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_PUBLICATION_NOT_FOUND'; END IF;
          SELECT * INTO proposal FROM public.component_life_limit_proposals WHERE id = publication.proposal_id FOR UPDATE;
          SELECT * INTO operational_limit FROM public.component_life_limits WHERE id = publication.component_life_limit_id FOR UPDATE;
          IF publication.publication_state <> 'DORMANT' THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_INVALID_ACTIVATION_TRANSITION'; END IF;
          IF proposal.id IS NULL OR proposal.status <> 'APPROVED' OR proposal.determination <> 'LIFE_LIMITED' OR proposal.proposal_purpose NOT IN ('ESTABLISH','REPLACEMENT') OR proposal.applicability_scope <> 'ALL_SERIALS_OF_MODEL' OR NOT proposal.narrower_effectivity_absent THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_PUBLICATION_NOT_ELIGIBLE'; END IF;
          IF operational_limit.id IS NULL OR operational_limit.is_active THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_PUBLICATION_NOT_ELIGIBLE'; END IF;
          IF p_actor_id = proposal.proposed_by THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_SELF_ACTIVATION_FORBIDDEN'; END IF;
          IF ROW(operational_limit.component_model_id,operational_limit.limit_type,operational_limit.basis,operational_limit.limit_hours,operational_limit.limit_cycles,operational_limit.limit_months,operational_limit.description)
             IS DISTINCT FROM
             ROW(proposal.component_model_id,proposal.limit_type,proposal.basis,proposal.limit_hours,proposal.limit_cycles,proposal.limit_months,
                 format('Governed proposal %s revision %s; source %s; effective %s',proposal.id,proposal.revision_number,proposal.source_reference,proposal.source_effective_date))
          THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_PUBLICATION_PROJECTION_MISMATCH'; END IF;

          INSERT INTO public.component_life_limit_governance_transition_gate(backend_pid,transaction_id,publication_id,transition_code)
          VALUES(pg_backend_pid(),txid_current(),publication.id,'PUBLICATION_ACTIVATED')
          ON CONFLICT (backend_pid,transaction_id) DO UPDATE SET publication_id=EXCLUDED.publication_id,transition_code=EXCLUDED.transition_code;
          UPDATE public.component_life_limit_publications SET publication_state='ACTIVE',activated_by=p_actor_id,
            activated_at=CURRENT_TIMESTAMP,activation_reason=p_reason,updated_at=CURRENT_TIMESTAMP WHERE id=publication.id
            RETURNING * INTO after_publication;
          UPDATE public.component_life_limits SET is_active=true,updated_at=CURRENT_TIMESTAMP WHERE id=operational_limit.id
            RETURNING * INTO after_limit;
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
        REVOKE ALL ON FUNCTION public.fn_cllg_activate_publication(uuid,uuid,text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.fn_cllg_activate_publication(uuid,uuid,text) TO jupiter_app;
      `, { transaction });
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [row] = await queryInterface.sequelize.query<CountRow>(
        `SELECT COUNT(*)::int AS count FROM public.component_life_limit_publications p
         WHERE p.publication_state='ACTIVE' OR p.activated_by IS NOT NULL OR p.activated_at IS NOT NULL OR p.activation_reason IS NOT NULL
            OR EXISTS (SELECT 1 FROM public.component_life_limit_governance_history h WHERE h.event_code='PUBLICATION_ACTIVATED');`,
        { type: QueryTypes.SELECT, transaction }
      );
      if ((row?.count || 0) > 0) throw new Error('COMPONENT_LIFE_LIMIT_ACTIVATION_HISTORY_EXISTS');
      await queryInterface.sequelize.query(`
        DROP FUNCTION public.fn_cllg_activate_publication(uuid,uuid,text);
        CREATE OR REPLACE FUNCTION public.fn_cllg_protect_publication() RETURNS trigger
        LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
        BEGIN
          IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_GOVERNANCE_IMMUTABLE'; END IF;
          IF NOT EXISTS (SELECT 1 FROM public.component_life_limit_governance_transition_gate WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current()) THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_DIRECT_TRANSITION_FORBIDDEN'; END IF;
          IF ROW(NEW.id,NEW.proposal_id,NEW.component_life_limit_id,NEW.published_by,NEW.published_at,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.proposal_id,OLD.component_life_limit_id,OLD.published_by,OLD.published_at,OLD.created_at) THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_PUBLICATION_IMMUTABLE'; END IF;
          IF OLD.publication_state NOT IN ('DORMANT','ACTIVE') OR NEW.publication_state NOT IN ('WITHDRAWN','SUPERSEDED') THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_INVALID_PUBLICATION_TRANSITION'; END IF;
          RETURN NEW;
        END; $$;
        ALTER TABLE public.component_life_limit_publications DROP CONSTRAINT component_life_limit_publications_lifecycle_shape;
        DROP INDEX public.component_life_limit_publications_activated_at_index;
        DROP INDEX public.component_life_limit_publications_activator_index;
        ALTER TABLE public.component_life_limit_publications DROP COLUMN activation_reason,DROP COLUMN activated_at,DROP COLUMN activated_by;
        ALTER TABLE public.component_life_limit_publications ADD CONSTRAINT component_life_limit_publications_terminal_shape CHECK (
          (publication_state IN ('DORMANT','ACTIVE') AND terminal_by IS NULL AND terminal_at IS NULL AND terminal_reason IS NULL) OR
          (publication_state IN ('WITHDRAWN','SUPERSEDED') AND terminal_by IS NOT NULL AND terminal_at IS NOT NULL AND btrim(terminal_reason) <> '')
        );
        ALTER TABLE public.component_life_limit_governance_transition_gate DROP COLUMN transition_code,DROP COLUMN publication_id;
      `, { transaction });
    });
  },
};
