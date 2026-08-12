'use strict';

import { QueryInterface, QueryTypes } from 'sequelize';

type CountRow = { count: number };

export default {
  async up(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
        CREATE TABLE public.component_life_limit_proposals (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          component_model_id uuid NOT NULL REFERENCES component_models(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
          lineage_id uuid NOT NULL,
          revision_number integer NOT NULL CHECK (revision_number > 0),
          proposal_purpose varchar(32) NOT NULL CHECK (proposal_purpose IN ('ESTABLISH','REPLACEMENT','WITHDRAWAL')),
          target_proposal_id uuid NULL REFERENCES public.component_life_limit_proposals(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
          determination varchar(32) NOT NULL CHECK (determination IN ('LIFE_LIMITED','NOT_LIFE_LIMITED','LIMIT_STATUS_UNKNOWN')),
          applicability_scope varchar(32) NOT NULL CHECK (applicability_scope = 'ALL_SERIALS_OF_MODEL'),
          applicability_statement text NOT NULL CHECK (btrim(applicability_statement) <> ''),
          narrower_effectivity_absent boolean NOT NULL DEFAULT false CHECK (narrower_effectivity_absent),
          limit_type varchar(32) NULL,
          basis varchar(32) NULL,
          limit_hours numeric(10,2) NULL CHECK (limit_hours > 0),
          limit_cycles integer NULL CHECK (limit_cycles > 0),
          limit_months integer NULL CHECK (limit_months > 0),
          source_reference text NOT NULL CHECK (btrim(source_reference) <> ''),
          source_document_reference text NULL,
          source_effective_date date NOT NULL,
          evidence_summary text NOT NULL CHECK (btrim(evidence_summary) <> ''),
          proposal_reason text NOT NULL CHECK (btrim(proposal_reason) <> ''),
          status varchar(20) NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED','APPROVED','REJECTED','WITHDRAWN','SUPERSEDED')),
          proposed_by uuid NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
          proposed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
          decision_by uuid NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
          decision_at timestamptz NULL,
          decision_reason text NULL,
          evidence_confirmed boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT component_life_limit_proposals_lineage_revision_unique UNIQUE (lineage_id, revision_number),
          CONSTRAINT component_life_limit_proposals_independent_decision CHECK (decision_by IS NULL OR decision_by <> proposed_by),
          CONSTRAINT component_life_limit_proposals_purpose_shape CHECK (
            (proposal_purpose = 'ESTABLISH' AND target_proposal_id IS NULL AND revision_number = 1) OR
            (proposal_purpose IN ('REPLACEMENT','WITHDRAWAL') AND target_proposal_id IS NOT NULL AND revision_number > 1)
          ),
          CONSTRAINT component_life_limit_proposals_workflow_shape CHECK (
            (status = 'PROPOSED' AND decision_by IS NULL AND decision_at IS NULL AND decision_reason IS NULL AND evidence_confirmed = false) OR
            (status = 'APPROVED' AND decision_by IS NOT NULL AND decision_at IS NOT NULL AND btrim(decision_reason) <> '' AND evidence_confirmed = true) OR
            (status = 'REJECTED' AND decision_by IS NOT NULL AND decision_at IS NOT NULL AND btrim(decision_reason) <> '' AND evidence_confirmed = false) OR
            (status IN ('WITHDRAWN','SUPERSEDED') AND decision_by IS NOT NULL AND decision_at IS NOT NULL AND btrim(decision_reason) <> '' AND evidence_confirmed = true)
          ),
          CONSTRAINT component_life_limit_proposals_payload_shape CHECK (
            (proposal_purpose = 'WITHDRAWAL' AND limit_type IS NULL AND basis IS NULL AND limit_hours IS NULL AND limit_cycles IS NULL AND limit_months IS NULL) OR
            (proposal_purpose <> 'WITHDRAWAL' AND determination IN ('NOT_LIFE_LIMITED','LIMIT_STATUS_UNKNOWN') AND limit_type IS NULL AND basis IS NULL AND limit_hours IS NULL AND limit_cycles IS NULL AND limit_months IS NULL) OR
            (proposal_purpose <> 'WITHDRAWAL' AND determination = 'LIFE_LIMITED' AND (
              (limit_type = 'TBO_HOURS' AND basis = 'SINCE_OVERHAUL' AND limit_hours IS NOT NULL AND limit_cycles IS NULL AND limit_months IS NULL) OR
              (limit_type = 'TBO_CYCLES' AND basis = 'SINCE_OVERHAUL' AND limit_hours IS NULL AND limit_cycles IS NOT NULL AND limit_months IS NULL) OR
              (limit_type = 'LIFE_LIMIT_HOURS' AND basis = 'SINCE_NEW' AND limit_hours IS NOT NULL AND limit_cycles IS NULL AND limit_months IS NULL) OR
              (limit_type = 'LIFE_LIMIT_CYCLES' AND basis = 'SINCE_NEW' AND limit_hours IS NULL AND limit_cycles IS NOT NULL AND limit_months IS NULL) OR
              (limit_type = 'CALENDAR_LIFE' AND basis = 'CALENDAR' AND limit_hours IS NULL AND limit_cycles IS NULL AND limit_months IS NOT NULL)
            ))
          )
        );

        CREATE TABLE public.component_life_limit_publications (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          proposal_id uuid NOT NULL UNIQUE REFERENCES public.component_life_limit_proposals(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
          component_life_limit_id uuid NOT NULL UNIQUE REFERENCES public.component_life_limits(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
          publication_state varchar(20) NOT NULL DEFAULT 'DORMANT' CHECK (publication_state IN ('DORMANT','ACTIVE','WITHDRAWN','SUPERSEDED')),
          published_by uuid NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
          published_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
          terminal_by uuid NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
          terminal_at timestamptz NULL,
          terminal_reason text NULL,
          created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT component_life_limit_publications_terminal_shape CHECK (
            (publication_state IN ('DORMANT','ACTIVE') AND terminal_by IS NULL AND terminal_at IS NULL AND terminal_reason IS NULL) OR
            (publication_state IN ('WITHDRAWN','SUPERSEDED') AND terminal_by IS NOT NULL AND terminal_at IS NOT NULL AND btrim(terminal_reason) <> '')
          )
        );

        CREATE TABLE public.component_life_limit_governance_history (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          proposal_id uuid NOT NULL REFERENCES public.component_life_limit_proposals(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
          publication_id uuid NULL REFERENCES public.component_life_limit_publications(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
          event_code varchar(40) NOT NULL CHECK (event_code IN ('PROPOSAL_CREATED','PROPOSAL_APPROVED','PROPOSAL_REJECTED','PUBLICATION_CREATED_DORMANT','WITHDRAWAL_PROPOSED','PUBLICATION_WITHDRAWN','REPLACEMENT_PROPOSED','PUBLICATION_SUPERSEDED','PUBLICATION_ACTIVATED')),
          actor_id uuid NOT NULL REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
          reason text NOT NULL CHECK (btrim(reason) <> ''),
          evidence_confirmed boolean NOT NULL DEFAULT false,
          from_status varchar(20) NULL CHECK (from_status IS NULL OR from_status IN ('PROPOSED','APPROVED','REJECTED','WITHDRAWN','SUPERSEDED','DORMANT','ACTIVE')),
          to_status varchar(20) NOT NULL CHECK (to_status IN ('PROPOSED','APPROVED','REJECTED','WITHDRAWN','SUPERSEDED','DORMANT','ACTIVE')),
          before_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(before_snapshot) = 'object'),
          after_snapshot jsonb NOT NULL CHECK (jsonb_typeof(after_snapshot) = 'object'),
          created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX component_life_limit_proposals_model_index ON public.component_life_limit_proposals(component_model_id);
        CREATE INDEX component_life_limit_proposals_status_index ON public.component_life_limit_proposals(status);
        CREATE INDEX component_life_limit_proposals_target_index ON public.component_life_limit_proposals(target_proposal_id);
        CREATE UNIQUE INDEX component_life_limit_proposals_open_target_unique ON public.component_life_limit_proposals(target_proposal_id) WHERE status = 'PROPOSED' AND target_proposal_id IS NOT NULL;
        CREATE INDEX component_life_limit_publications_state_index ON public.component_life_limit_publications(publication_state);
        CREATE INDEX component_life_limit_publications_publisher_index ON public.component_life_limit_publications(published_by);
        CREATE INDEX component_life_limit_governance_history_proposal_index ON public.component_life_limit_governance_history(proposal_id);
        CREATE INDEX component_life_limit_governance_history_publication_index ON public.component_life_limit_governance_history(publication_id);
        CREATE INDEX component_life_limit_governance_history_event_index ON public.component_life_limit_governance_history(event_code);
        CREATE INDEX component_life_limit_governance_history_actor_index ON public.component_life_limit_governance_history(actor_id);
        CREATE INDEX component_life_limit_governance_history_created_index ON public.component_life_limit_governance_history(created_at);
        CREATE INDEX component_life_limit_governance_history_order_index ON public.component_life_limit_governance_history(proposal_id, created_at, id);

        CREATE TABLE public.component_life_limit_governance_transition_gate (
          backend_pid integer NOT NULL,
          transaction_id bigint NOT NULL,
          PRIMARY KEY (backend_pid, transaction_id)
        );
        REVOKE ALL ON public.component_life_limit_governance_transition_gate FROM PUBLIC;
        REVOKE ALL ON public.component_life_limit_governance_transition_gate FROM jupiter_app;

        CREATE FUNCTION public.fn_cllg_validate_proposal_revision() RETURNS trigger
        LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
        DECLARE target_row public.component_life_limit_proposals%ROWTYPE;
        DECLARE target_publication_state varchar(20);
        BEGIN
          IF NEW.proposal_purpose = 'ESTABLISH' THEN RETURN NEW; END IF;
          SELECT * INTO target_row FROM public.component_life_limit_proposals WHERE id = NEW.target_proposal_id FOR UPDATE;
          SELECT publication_state INTO target_publication_state FROM public.component_life_limit_publications WHERE proposal_id = target_row.id FOR UPDATE;
          IF target_row.id IS NULL OR target_row.component_model_id <> NEW.component_model_id OR target_row.lineage_id <> NEW.lineage_id OR NEW.revision_number <> target_row.revision_number + 1 OR target_row.status <> 'APPROVED' OR target_publication_state NOT IN ('DORMANT','ACTIVE') THEN
            RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_INVALID_REVISION_TARGET';
          END IF;
          IF NEW.proposal_purpose = 'WITHDRAWAL' AND NEW.determination <> target_row.determination THEN
            RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_WITHDRAWAL_DETERMINATION_MISMATCH';
          END IF;
          RETURN NEW;
        END; $$;

        CREATE FUNCTION public.fn_cllg_protect_proposal() RETURNS trigger
        LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
        BEGIN
          IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_GOVERNANCE_IMMUTABLE'; END IF;
          IF ROW(NEW.id,NEW.component_model_id,NEW.lineage_id,NEW.revision_number,NEW.proposal_purpose,NEW.target_proposal_id,NEW.determination,NEW.applicability_scope,NEW.applicability_statement,NEW.narrower_effectivity_absent,NEW.limit_type,NEW.basis,NEW.limit_hours,NEW.limit_cycles,NEW.limit_months,NEW.source_reference,NEW.source_document_reference,NEW.source_effective_date,NEW.evidence_summary,NEW.proposal_reason,NEW.proposed_by,NEW.proposed_at,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.component_model_id,OLD.lineage_id,OLD.revision_number,OLD.proposal_purpose,OLD.target_proposal_id,OLD.determination,OLD.applicability_scope,OLD.applicability_statement,OLD.narrower_effectivity_absent,OLD.limit_type,OLD.basis,OLD.limit_hours,OLD.limit_cycles,OLD.limit_months,OLD.source_reference,OLD.source_document_reference,OLD.source_effective_date,OLD.evidence_summary,OLD.proposal_reason,OLD.proposed_by,OLD.proposed_at,OLD.created_at) THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_PROPOSAL_PAYLOAD_IMMUTABLE'; END IF;
          IF NEW.status IS DISTINCT FROM OLD.status AND NOT EXISTS (
            SELECT 1 FROM public.component_life_limit_governance_transition_gate
            WHERE backend_pid = pg_backend_pid() AND transaction_id = txid_current()
          ) THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_DIRECT_TRANSITION_FORBIDDEN'; END IF;
          IF OLD.status <> 'PROPOSED' AND NEW.status IS DISTINCT FROM OLD.status THEN
            IF NOT (OLD.status = 'APPROVED' AND NEW.status IN ('WITHDRAWN','SUPERSEDED')) THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_INVALID_TRANSITION'; END IF;
          ELSIF OLD.status = 'PROPOSED' AND NEW.status NOT IN ('APPROVED','REJECTED') THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_INVALID_TRANSITION'; END IF;
          IF OLD.decision_by IS NOT NULL AND ROW(NEW.decision_by,NEW.decision_at,NEW.decision_reason,NEW.evidence_confirmed) IS DISTINCT FROM ROW(OLD.decision_by,OLD.decision_at,OLD.decision_reason,OLD.evidence_confirmed) THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_DECISION_IMMUTABLE'; END IF;
          RETURN NEW;
        END; $$;

        CREATE FUNCTION public.fn_cllg_protect_publication() RETURNS trigger
        LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
        BEGIN
          IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_GOVERNANCE_IMMUTABLE'; END IF;
          IF NOT EXISTS (SELECT 1 FROM public.component_life_limit_governance_transition_gate WHERE backend_pid = pg_backend_pid() AND transaction_id = txid_current()) THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_DIRECT_TRANSITION_FORBIDDEN'; END IF;
          IF ROW(NEW.id,NEW.proposal_id,NEW.component_life_limit_id,NEW.published_by,NEW.published_at,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.proposal_id,OLD.component_life_limit_id,OLD.published_by,OLD.published_at,OLD.created_at) THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_PUBLICATION_IMMUTABLE'; END IF;
          IF OLD.publication_state NOT IN ('DORMANT','ACTIVE') OR NEW.publication_state NOT IN ('WITHDRAWN','SUPERSEDED') THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_INVALID_PUBLICATION_TRANSITION'; END IF;
          RETURN NEW;
        END; $$;

        CREATE FUNCTION public.fn_cllg_prevent_history_mutation() RETURNS trigger
        LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$ BEGIN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_HISTORY_IMMUTABLE'; END; $$;

        CREATE FUNCTION public.fn_cllg_protect_operational_limit() RETURNS trigger
        LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
        DECLARE state varchar(20);
        BEGIN
          SELECT publication_state INTO state FROM public.component_life_limit_publications WHERE component_life_limit_id = OLD.id;
          IF state IS NULL THEN RETURN NEW; END IF;
          IF ROW(NEW.component_model_id,NEW.limit_type,NEW.basis,NEW.limit_hours,NEW.limit_cycles,NEW.limit_months,NEW.description) IS DISTINCT FROM ROW(OLD.component_model_id,OLD.limit_type,OLD.basis,OLD.limit_hours,OLD.limit_cycles,OLD.limit_months,OLD.description) THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_GOVERNED_ROW_IMMUTABLE'; END IF;
          IF NEW.is_active AND state <> 'ACTIVE' THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_PUBLICATION_NOT_ACTIVE'; END IF;
          RETURN NEW;
        END; $$;

        CREATE FUNCTION public.fn_cllg_decide_proposal(
          p_proposal_id uuid, p_actor_id uuid, p_decision varchar, p_reason text,
          p_evidence_confirmed boolean
        ) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
        SET search_path = pg_catalog, public AS $$
        DECLARE proposal public.component_life_limit_proposals%ROWTYPE;
        DECLARE target public.component_life_limit_proposals%ROWTYPE;
        DECLARE publication public.component_life_limit_publications%ROWTYPE;
        DECLARE new_limit_id uuid;
        DECLARE new_publication_id uuid;
        DECLARE terminal_status varchar(20);
        BEGIN
          IF p_decision NOT IN ('APPROVED','REJECTED') OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_INVALID_DECISION'; END IF;
          SELECT * INTO proposal FROM public.component_life_limit_proposals WHERE id = p_proposal_id FOR UPDATE;
          IF proposal.id IS NULL THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_PROPOSAL_NOT_FOUND'; END IF;
          IF proposal.status <> 'PROPOSED' THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_INVALID_TRANSITION'; END IF;
          IF proposal.proposed_by = p_actor_id THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_SELF_DECISION_FORBIDDEN'; END IF;
          IF p_decision = 'APPROVED' AND NOT p_evidence_confirmed THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_EVIDENCE_CONFIRMATION_REQUIRED'; END IF;
          IF p_decision = 'REJECTED' AND p_evidence_confirmed THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_INVALID_REJECTION_EVIDENCE'; END IF;
          INSERT INTO public.component_life_limit_governance_transition_gate VALUES (pg_backend_pid(), txid_current()) ON CONFLICT DO NOTHING;
          UPDATE public.component_life_limit_proposals SET status=p_decision, decision_by=p_actor_id,
            decision_at=CURRENT_TIMESTAMP, decision_reason=p_reason,
            evidence_confirmed=p_evidence_confirmed, updated_at=CURRENT_TIMESTAMP WHERE id=p_proposal_id;
          INSERT INTO public.component_life_limit_governance_history
            (proposal_id,event_code,actor_id,reason,evidence_confirmed,from_status,to_status,before_snapshot,after_snapshot)
          VALUES (proposal.id, CASE WHEN p_decision='APPROVED' THEN 'PROPOSAL_APPROVED' ELSE 'PROPOSAL_REJECTED' END,
            p_actor_id,p_reason,p_evidence_confirmed,'PROPOSED',p_decision,to_jsonb(proposal),
            (SELECT to_jsonb(p) FROM public.component_life_limit_proposals p WHERE p.id=proposal.id));
          IF p_decision='APPROVED' AND proposal.proposal_purpose <> 'WITHDRAWAL' AND proposal.determination='LIFE_LIMITED' THEN
            INSERT INTO public.component_life_limits(component_model_id,limit_type,basis,limit_hours,limit_cycles,limit_months,description,is_active,created_at,updated_at)
            VALUES(proposal.component_model_id,proposal.limit_type,proposal.basis,proposal.limit_hours,proposal.limit_cycles,proposal.limit_months,
              format('Governed proposal %s revision %s; source %s; effective %s',proposal.id,proposal.revision_number,proposal.source_reference,proposal.source_effective_date),false,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
            RETURNING id INTO new_limit_id;
            INSERT INTO public.component_life_limit_publications(proposal_id,component_life_limit_id,publication_state,published_by)
            VALUES(proposal.id,new_limit_id,'DORMANT',p_actor_id) RETURNING id INTO new_publication_id;
            INSERT INTO public.component_life_limit_governance_history(proposal_id,publication_id,event_code,actor_id,reason,evidence_confirmed,from_status,to_status,before_snapshot,after_snapshot)
            VALUES(proposal.id,new_publication_id,'PUBLICATION_CREATED_DORMANT',p_actor_id,p_reason,true,NULL,'DORMANT','{}'::jsonb,
              (SELECT to_jsonb(p) FROM public.component_life_limit_publications p WHERE p.id=new_publication_id));
          END IF;
          IF p_decision='APPROVED' AND proposal.proposal_purpose IN ('REPLACEMENT','WITHDRAWAL') THEN
            SELECT * INTO target FROM public.component_life_limit_proposals WHERE id=proposal.target_proposal_id FOR UPDATE;
            SELECT * INTO publication FROM public.component_life_limit_publications WHERE proposal_id=target.id FOR UPDATE;
            IF publication.id IS NULL OR publication.publication_state NOT IN ('DORMANT','ACTIVE') THEN RAISE EXCEPTION 'COMPONENT_LIFE_LIMIT_INVALID_REVISION_TARGET'; END IF;
            terminal_status := CASE WHEN proposal.proposal_purpose='REPLACEMENT' THEN 'SUPERSEDED' ELSE 'WITHDRAWN' END;
            UPDATE public.component_life_limit_proposals SET status=terminal_status,updated_at=CURRENT_TIMESTAMP WHERE id=target.id;
            UPDATE public.component_life_limit_publications SET publication_state=terminal_status,terminal_by=p_actor_id,terminal_at=CURRENT_TIMESTAMP,terminal_reason=p_reason,updated_at=CURRENT_TIMESTAMP WHERE id=publication.id;
            UPDATE public.component_life_limits SET is_active=false,updated_at=CURRENT_TIMESTAMP WHERE id=publication.component_life_limit_id;
            INSERT INTO public.component_life_limit_governance_history(proposal_id,publication_id,event_code,actor_id,reason,evidence_confirmed,from_status,to_status,before_snapshot,after_snapshot)
            VALUES(proposal.id,publication.id,CASE WHEN terminal_status='SUPERSEDED' THEN 'PUBLICATION_SUPERSEDED' ELSE 'PUBLICATION_WITHDRAWN' END,p_actor_id,p_reason,true,publication.publication_state,terminal_status,
              jsonb_build_object('proposal',to_jsonb(target),'publication',to_jsonb(publication)),
              jsonb_build_object('proposal',(SELECT to_jsonb(p) FROM public.component_life_limit_proposals p WHERE p.id=target.id),'publication',(SELECT to_jsonb(p) FROM public.component_life_limit_publications p WHERE p.id=publication.id)));
          END IF;
          DELETE FROM public.component_life_limit_governance_transition_gate WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current();
          RETURN new_publication_id;
        EXCEPTION WHEN OTHERS THEN
          DELETE FROM public.component_life_limit_governance_transition_gate WHERE backend_pid=pg_backend_pid() AND transaction_id=txid_current();
          RAISE;
        END; $$;
        REVOKE ALL ON FUNCTION public.fn_cllg_decide_proposal(uuid,uuid,varchar,text,boolean) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION public.fn_cllg_decide_proposal(uuid,uuid,varchar,text,boolean) TO jupiter_app;

        CREATE TRIGGER tr_cllg_proposal_revision BEFORE INSERT ON public.component_life_limit_proposals FOR EACH ROW EXECUTE FUNCTION public.fn_cllg_validate_proposal_revision();
        CREATE TRIGGER tr_cllg_proposal_protect BEFORE UPDATE OR DELETE ON public.component_life_limit_proposals FOR EACH ROW EXECUTE FUNCTION public.fn_cllg_protect_proposal();
        CREATE TRIGGER tr_cllg_publication_protect BEFORE UPDATE OR DELETE ON public.component_life_limit_publications FOR EACH ROW EXECUTE FUNCTION public.fn_cllg_protect_publication();
        CREATE TRIGGER tr_cllg_history_protect BEFORE UPDATE OR DELETE ON public.component_life_limit_governance_history FOR EACH ROW EXECUTE FUNCTION public.fn_cllg_prevent_history_mutation();
        CREATE TRIGGER tr_cllg_operational_limit_protect BEFORE UPDATE ON public.component_life_limits FOR EACH ROW EXECUTE FUNCTION public.fn_cllg_protect_operational_limit();
        `,
        { transaction }
      );
    });
  },

  async down(queryInterface: QueryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [row] = await queryInterface.sequelize.query<CountRow>(
        `SELECT (
          (SELECT COUNT(*) FROM public.component_life_limit_proposals) +
          (SELECT COUNT(*) FROM public.component_life_limit_publications) +
          (SELECT COUNT(*) FROM public.component_life_limit_governance_history)
        )::int AS count;`,
        { type: QueryTypes.SELECT, transaction }
      );
      if ((row?.count || 0) > 0) {
        throw new Error('COMPONENT_LIFE_LIMIT_GOVERNANCE_HISTORY_EXISTS');
      }
      await queryInterface.sequelize.query(`
        DROP TRIGGER tr_cllg_operational_limit_protect ON public.component_life_limits;
        DROP TRIGGER tr_cllg_history_protect ON public.component_life_limit_governance_history;
        DROP TRIGGER tr_cllg_publication_protect ON public.component_life_limit_publications;
        DROP TRIGGER tr_cllg_proposal_protect ON public.component_life_limit_proposals;
        DROP TRIGGER tr_cllg_proposal_revision ON public.component_life_limit_proposals;
        DROP FUNCTION public.fn_cllg_decide_proposal(uuid,uuid,varchar,text,boolean);
        DROP TABLE public.component_life_limit_governance_history;
        DROP TABLE public.component_life_limit_publications;
        DROP TABLE public.component_life_limit_proposals;
        DROP TABLE public.component_life_limit_governance_transition_gate;
        DROP FUNCTION public.fn_cllg_protect_operational_limit();
        DROP FUNCTION public.fn_cllg_prevent_history_mutation();
        DROP FUNCTION public.fn_cllg_protect_publication();
        DROP FUNCTION public.fn_cllg_protect_proposal();
        DROP FUNCTION public.fn_cllg_validate_proposal_revision();
      `, { transaction });
    });
  },
};
