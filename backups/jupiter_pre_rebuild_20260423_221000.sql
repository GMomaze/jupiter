--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.workpacks DROP CONSTRAINT IF EXISTS workpacks_status_id_fkey;
ALTER TABLE IF EXISTS ONLY public.workpacks DROP CONSTRAINT IF EXISTS workpacks_released_by_fkey;
ALTER TABLE IF EXISTS ONLY public.workpacks DROP CONSTRAINT IF EXISTS workpacks_qa_reviewed_by_fkey;
ALTER TABLE IF EXISTS ONLY public.workpacks DROP CONSTRAINT IF EXISTS workpacks_certified_by_fkey;
ALTER TABLE IF EXISTS ONLY public.workpacks DROP CONSTRAINT IF EXISTS workpacks_aircraft_id_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_tasks DROP CONSTRAINT IF EXISTS workpack_tasks_workpack_id_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_tasks DROP CONSTRAINT IF EXISTS workpack_tasks_task_id_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_sources DROP CONSTRAINT IF EXISTS workpack_sources_execution_id_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_snags DROP CONSTRAINT IF EXISTS workpack_snags_workpack_id_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_snags DROP CONSTRAINT IF EXISTS workpack_snags_started_by_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_snags DROP CONSTRAINT IF EXISTS workpack_snags_resolved_by_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_snags DROP CONSTRAINT IF EXISTS workpack_snags_reported_by_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_snags DROP CONSTRAINT IF EXISTS workpack_snags_created_by_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_snags DROP CONSTRAINT IF EXISTS workpack_snags_completed_by_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_snags DROP CONSTRAINT IF EXISTS workpack_snags_closed_by_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_snags DROP CONSTRAINT IF EXISTS workpack_snags_assigned_to_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_snag_audit_log DROP CONSTRAINT IF EXISTS workpack_snag_audit_log_workpack_id_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_snag_audit_log DROP CONSTRAINT IF EXISTS workpack_snag_audit_log_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_snag_audit_log DROP CONSTRAINT IF EXISTS workpack_snag_audit_log_snag_id_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_signatures DROP CONSTRAINT IF EXISTS workpack_signatures_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_signatures DROP CONSTRAINT IF EXISTS workpack_signatures_execution_id_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_requirements DROP CONSTRAINT IF EXISTS workpack_requirements_workpack_id_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_measurements DROP CONSTRAINT IF EXISTS workpack_measurements_execution_id_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_executions DROP CONSTRAINT IF EXISTS workpack_executions_workpack_id_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_executions DROP CONSTRAINT IF EXISTS workpack_executions_task_id_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_executions DROP CONSTRAINT IF EXISTS workpack_executions_started_by_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_executions DROP CONSTRAINT IF EXISTS workpack_executions_completed_by_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_executions DROP CONSTRAINT IF EXISTS workpack_executions_certified_by_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_audit_log DROP CONSTRAINT IF EXISTS workpack_audit_log_workpack_id_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_audit_log DROP CONSTRAINT IF EXISTS workpack_audit_log_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_audit_log DROP CONSTRAINT IF EXISTS workpack_audit_log_task_id_fkey;
ALTER TABLE IF EXISTS ONLY public.workpack_audit_log DROP CONSTRAINT IF EXISTS workpack_audit_log_execution_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_id_fkey;
ALTER TABLE IF EXISTS ONLY public.task_templates DROP CONSTRAINT IF EXISTS task_templates_aircraft_model_id_fkey;
ALTER TABLE IF EXISTS ONLY public.task_templates DROP CONSTRAINT IF EXISTS task_templates_aircraft_id_fkey;
ALTER TABLE IF EXISTS ONLY public.task_cards DROP CONSTRAINT IF EXISTS task_cards_signed_by_fkey;
ALTER TABLE IF EXISTS ONLY public.task_cards DROP CONSTRAINT IF EXISTS task_cards_assigned_to_fkey;
ALTER TABLE IF EXISTS ONLY public.task_cards DROP CONSTRAINT IF EXISTS task_cards_aircraft_id_fkey;
ALTER TABLE IF EXISTS ONLY public.service_bulletin_models DROP CONSTRAINT IF EXISTS sb_models_sb_fk;
ALTER TABLE IF EXISTS ONLY public.service_bulletin_models DROP CONSTRAINT IF EXISTS sb_models_model_fk;
ALTER TABLE IF EXISTS ONLY public.rf_role_permissions DROP CONSTRAINT IF EXISTS rf_role_permissions_role_fk;
ALTER TABLE IF EXISTS ONLY public.rf_role_permissions DROP CONSTRAINT IF EXISTS rf_role_permissions_permission_fk;
ALTER TABLE IF EXISTS ONLY public.model_sids DROP CONSTRAINT IF EXISTS model_sids_sid_id_fkey;
ALTER TABLE IF EXISTS ONLY public.model_sids DROP CONSTRAINT IF EXISTS model_sids_model_id_fkey;
ALTER TABLE IF EXISTS ONLY public.maintenance_requirements DROP CONSTRAINT IF EXISTS maintenance_requirements_model_id_fk;
ALTER TABLE IF EXISTS ONLY public.component_models DROP CONSTRAINT IF EXISTS component_models_manufacturer_fk;
ALTER TABLE IF EXISTS ONLY public.component_models DROP CONSTRAINT IF EXISTS component_models_category_id_fkey;
ALTER TABLE IF EXISTS ONLY public.component_models DROP CONSTRAINT IF EXISTS component_models_asset_type_id_fkey;
ALTER TABLE IF EXISTS ONLY public.component_models DROP CONSTRAINT IF EXISTS component_models_asset_type_fk;
ALTER TABLE IF EXISTS ONLY public.audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.aircraft_sid_status DROP CONSTRAINT IF EXISTS aircraft_sid_status_sid_id_fkey;
ALTER TABLE IF EXISTS ONLY public.aircraft_sid_status DROP CONSTRAINT IF EXISTS aircraft_sid_status_aircraft_id_fkey;
ALTER TABLE IF EXISTS ONLY public.aircraft_sb_compliance DROP CONSTRAINT IF EXISTS aircraft_sb_compliance_service_bulletin_id_fkey;
ALTER TABLE IF EXISTS ONLY public.aircraft_sb_compliance DROP CONSTRAINT IF EXISTS aircraft_sb_compliance_aircraft_id_fkey;
ALTER TABLE IF EXISTS ONLY public.aircraft DROP CONSTRAINT IF EXISTS aircraft_model_id_fk;
ALTER TABLE IF EXISTS ONLY public.aircraft_components DROP CONSTRAINT IF EXISTS aircraft_components_model_id_fkey;
ALTER TABLE IF EXISTS ONLY public.aircraft_components DROP CONSTRAINT IF EXISTS aircraft_components_aircraft_id_fkey;
ALTER TABLE IF EXISTS ONLY public.aircraft DROP CONSTRAINT IF EXISTS aircraft_category_id_fkey;
DROP TRIGGER IF EXISTS tr_audit_tasks ON public.task_cards;
DROP TRIGGER IF EXISTS tr_audit_rf_role_permissions ON public.rf_role_permissions;
DROP TRIGGER IF EXISTS tr_audit_rf_permission ON public.rf_permission;
DROP TRIGGER IF EXISTS tr_audit_aircraft ON public.aircraft;
DROP INDEX IF EXISTS public.workpack_sources_source_type_index;
DROP INDEX IF EXISTS public.workpack_sources_reference_index;
DROP INDEX IF EXISTS public.workpack_sources_execution_id_index;
DROP INDEX IF EXISTS public.workpack_snags_workpack_id_index;
DROP INDEX IF EXISTS public.workpack_snags_status_workpack_idx;
DROP INDEX IF EXISTS public.workpack_snags_status_index;
DROP INDEX IF EXISTS public.workpack_snags_started_by_index;
DROP INDEX IF EXISTS public.workpack_snags_reported_by_index;
DROP INDEX IF EXISTS public.workpack_snags_completed_by_index;
DROP INDEX IF EXISTS public.workpack_snag_audit_log_workpack_id_index;
DROP INDEX IF EXISTS public.workpack_snag_audit_log_snag_id_index;
DROP INDEX IF EXISTS public.workpack_snag_audit_log_sequence_index;
DROP INDEX IF EXISTS public.workpack_snag_audit_log_action_index;
DROP INDEX IF EXISTS public.workpack_signatures_user_id_index;
DROP INDEX IF EXISTS public.workpack_signatures_signature_type_index;
DROP INDEX IF EXISTS public.workpack_signatures_role_index;
DROP INDEX IF EXISTS public.workpack_signatures_execution_id_index;
DROP INDEX IF EXISTS public.workpack_measurements_position_index;
DROP INDEX IF EXISTS public.workpack_measurements_field_key_index;
DROP INDEX IF EXISTS public.workpack_measurements_execution_id_index;
DROP INDEX IF EXISTS public.workpack_executions_workpack_id_idx;
DROP INDEX IF EXISTS public.workpack_executions_task_id_idx;
DROP INDEX IF EXISTS public.workpack_executions_status_idx;
DROP INDEX IF EXISTS public.workpack_executions_started_by_idx;
DROP INDEX IF EXISTS public.workpack_executions_created_at_idx;
DROP INDEX IF EXISTS public.workpack_executions_completed_by_idx;
DROP INDEX IF EXISTS public.workpack_executions_certified_by_idx;
DROP INDEX IF EXISTS public.workpack_audit_log_sequence_index;
DROP INDEX IF EXISTS public.workpack_audit_log_execution_id_index;
DROP INDEX IF EXISTS public.workpack_audit_log_action_index;
DROP INDEX IF EXISTS public.users_is_active_index;
DROP INDEX IF EXISTS public.task_templates_sort_order_idx;
DROP INDEX IF EXISTS public.task_templates_scope_idx;
DROP INDEX IF EXISTS public.task_templates_number_idx;
DROP INDEX IF EXISTS public.task_templates_model_idx;
DROP INDEX IF EXISTS public.task_templates_aircraft_idx;
DROP INDEX IF EXISTS public.task_cards_task_card_number;
DROP INDEX IF EXISTS public.task_cards_status;
DROP INDEX IF EXISTS public.task_cards_service_bulletin_id_idx;
DROP INDEX IF EXISTS public.task_cards_aircraft_id;
DROP INDEX IF EXISTS public.sessions_expire_idx;
DROP INDEX IF EXISTS public.service_bulletins_status_idx;
DROP INDEX IF EXISTS public.service_bulletins_source_primary_idx;
DROP INDEX IF EXISTS public.service_bulletins_sb_number_unique;
DROP INDEX IF EXISTS public.sb_models_unique;
DROP INDEX IF EXISTS public.sb_models_sb_idx;
DROP INDEX IF EXISTS public.sb_models_model_idx;
DROP INDEX IF EXISTS public.rf_workpack_status_code_idx;
DROP INDEX IF EXISTS public.rf_task_state_code_idx;
DROP INDEX IF EXISTS public.rf_signoff_role_code_idx;
DROP INDEX IF EXISTS public.rf_role_code_idx;
DROP INDEX IF EXISTS public.rf_permission_code_idx;
DROP INDEX IF EXISTS public.rf_component_condition_code_idx;
DROP INDEX IF EXISTS public.rf_component_categories_code_idx;
DROP INDEX IF EXISTS public.rf_asset_type_code_idx;
DROP INDEX IF EXISTS public.rf_aircraft_category_code_idx;
DROP INDEX IF EXISTS public.model_sids_sid_id;
DROP INDEX IF EXISTS public.model_sids_model_id;
DROP INDEX IF EXISTS public.manufacturers_name_idx;
DROP INDEX IF EXISTS public.manufacturers_code_idx;
DROP INDEX IF EXISTS public.maintenance_requirements_model_id_idx;
DROP INDEX IF EXISTS public.idx_unique_active_component;
DROP INDEX IF EXISTS public.component_models_model_name_idx;
DROP INDEX IF EXISTS public.component_models_manufacturer_id_idx;
DROP INDEX IF EXISTS public.cessna_sids_sid_number_idx;
DROP INDEX IF EXISTS public.cessna_sids_section_idx;
DROP INDEX IF EXISTS public.audit_log_table_name_idx;
DROP INDEX IF EXISTS public.audit_log_row_id_idx;
DROP INDEX IF EXISTS public.audit_log_created_at_idx;
DROP INDEX IF EXISTS public.audit_log_actor_id_idx;
DROP INDEX IF EXISTS public.aircraft_status_idx;
DROP INDEX IF EXISTS public.aircraft_sid_status_status;
DROP INDEX IF EXISTS public.aircraft_sid_status_sid_id;
DROP INDEX IF EXISTS public.aircraft_sid_status_aircraft_id;
DROP INDEX IF EXISTS public.aircraft_sb_compliance_status;
DROP INDEX IF EXISTS public.aircraft_sb_compliance_service_bulletin_id;
DROP INDEX IF EXISTS public.aircraft_sb_compliance_aircraft_id;
DROP INDEX IF EXISTS public.aircraft_model_id_idx;
DROP INDEX IF EXISTS public.aircraft_is_active_idx;
ALTER TABLE IF EXISTS ONLY public.workpacks DROP CONSTRAINT IF EXISTS workpacks_work_order_number_key;
ALTER TABLE IF EXISTS ONLY public.workpacks DROP CONSTRAINT IF EXISTS workpacks_pkey;
ALTER TABLE IF EXISTS ONLY public.workpack_tasks DROP CONSTRAINT IF EXISTS workpack_tasks_pkey;
ALTER TABLE IF EXISTS ONLY public.workpack_sources DROP CONSTRAINT IF EXISTS workpack_sources_pkey;
ALTER TABLE IF EXISTS ONLY public.workpack_sources DROP CONSTRAINT IF EXISTS workpack_sources_execution_id_source_type_reference_unique;
ALTER TABLE IF EXISTS ONLY public.workpack_snags DROP CONSTRAINT IF EXISTS workpack_snags_workpack_id_snag_no_unique;
ALTER TABLE IF EXISTS ONLY public.workpack_snags DROP CONSTRAINT IF EXISTS workpack_snags_pkey;
ALTER TABLE IF EXISTS ONLY public.workpack_snag_audit_log DROP CONSTRAINT IF EXISTS workpack_snag_audit_log_snag_sequence_unique;
ALTER TABLE IF EXISTS ONLY public.workpack_snag_audit_log DROP CONSTRAINT IF EXISTS workpack_snag_audit_log_pkey;
ALTER TABLE IF EXISTS ONLY public.workpack_snag_audit_log DROP CONSTRAINT IF EXISTS workpack_snag_audit_log_hash_unique;
ALTER TABLE IF EXISTS ONLY public.workpack_signatures DROP CONSTRAINT IF EXISTS workpack_signatures_pkey;
ALTER TABLE IF EXISTS ONLY public.workpack_signatures DROP CONSTRAINT IF EXISTS workpack_signatures_execution_id_role_signature_type_user_id_un;
ALTER TABLE IF EXISTS ONLY public.workpack_requirements DROP CONSTRAINT IF EXISTS workpack_requirements_pkey;
ALTER TABLE IF EXISTS ONLY public.workpack_measurements DROP CONSTRAINT IF EXISTS workpack_measurements_pkey;
ALTER TABLE IF EXISTS ONLY public.workpack_measurements DROP CONSTRAINT IF EXISTS workpack_measurements_execution_id_position_unique;
ALTER TABLE IF EXISTS ONLY public.workpack_measurements DROP CONSTRAINT IF EXISTS workpack_measurements_execution_id_field_key_unique;
ALTER TABLE IF EXISTS ONLY public.workpack_executions DROP CONSTRAINT IF EXISTS workpack_executions_workpack_task_attempt_unique;
ALTER TABLE IF EXISTS ONLY public.workpack_executions DROP CONSTRAINT IF EXISTS workpack_executions_pkey;
ALTER TABLE IF EXISTS ONLY public.workpack_audit_log DROP CONSTRAINT IF EXISTS workpack_audit_log_pkey;
ALTER TABLE IF EXISTS ONLY public.workpack_audit_log DROP CONSTRAINT IF EXISTS workpack_audit_log_hash_unique;
ALTER TABLE IF EXISTS ONLY public.workpack_audit_log DROP CONSTRAINT IF EXISTS workpack_audit_log_execution_sequence_unique;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS ONLY public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_id_unique;
ALTER TABLE IF EXISTS ONLY public.user_roles DROP CONSTRAINT IF EXISTS user_roles_pkey;
ALTER TABLE IF EXISTS ONLY public.cessna_sids DROP CONSTRAINT IF EXISTS unique_sid_number;
ALTER TABLE IF EXISTS ONLY public.task_templates DROP CONSTRAINT IF EXISTS task_templates_pkey;
ALTER TABLE IF EXISTS ONLY public.task_cards DROP CONSTRAINT IF EXISTS task_cards_pkey;
ALTER TABLE IF EXISTS ONLY public.sessions DROP CONSTRAINT IF EXISTS sessions_pkey;
ALTER TABLE IF EXISTS ONLY public.service_bulletins DROP CONSTRAINT IF EXISTS service_bulletins_pkey;
ALTER TABLE IF EXISTS ONLY public.service_bulletin_models DROP CONSTRAINT IF EXISTS service_bulletin_models_pkey;
ALTER TABLE IF EXISTS ONLY public.rf_workpack_status DROP CONSTRAINT IF EXISTS rf_workpack_status_pkey;
ALTER TABLE IF EXISTS ONLY public.rf_workpack_status DROP CONSTRAINT IF EXISTS rf_workpack_status_code_key;
ALTER TABLE IF EXISTS ONLY public.rf_task_state DROP CONSTRAINT IF EXISTS rf_task_state_pkey;
ALTER TABLE IF EXISTS ONLY public.rf_task_state DROP CONSTRAINT IF EXISTS rf_task_state_code_key;
ALTER TABLE IF EXISTS ONLY public.rf_signoff_role DROP CONSTRAINT IF EXISTS rf_signoff_role_pkey;
ALTER TABLE IF EXISTS ONLY public.rf_signoff_role DROP CONSTRAINT IF EXISTS rf_signoff_role_code_key;
ALTER TABLE IF EXISTS ONLY public.rf_role DROP CONSTRAINT IF EXISTS rf_role_pkey;
ALTER TABLE IF EXISTS ONLY public.rf_role_permissions DROP CONSTRAINT IF EXISTS rf_role_permissions_unique;
ALTER TABLE IF EXISTS ONLY public.rf_role_permissions DROP CONSTRAINT IF EXISTS rf_role_permissions_pkey;
ALTER TABLE IF EXISTS ONLY public.rf_role DROP CONSTRAINT IF EXISTS rf_role_code_key;
ALTER TABLE IF EXISTS ONLY public.rf_permission DROP CONSTRAINT IF EXISTS rf_permission_pkey;
ALTER TABLE IF EXISTS ONLY public.rf_permission DROP CONSTRAINT IF EXISTS rf_permission_code_key;
ALTER TABLE IF EXISTS ONLY public.rf_component_condition DROP CONSTRAINT IF EXISTS rf_component_condition_pkey;
ALTER TABLE IF EXISTS ONLY public.rf_component_condition DROP CONSTRAINT IF EXISTS rf_component_condition_code_key;
ALTER TABLE IF EXISTS ONLY public.rf_component_categories DROP CONSTRAINT IF EXISTS rf_component_categories_pkey;
ALTER TABLE IF EXISTS ONLY public.rf_component_categories DROP CONSTRAINT IF EXISTS rf_component_categories_code_key;
ALTER TABLE IF EXISTS ONLY public.rf_asset_type DROP CONSTRAINT IF EXISTS rf_asset_type_pkey;
ALTER TABLE IF EXISTS ONLY public.rf_asset_type DROP CONSTRAINT IF EXISTS rf_asset_type_code_key;
ALTER TABLE IF EXISTS ONLY public.rf_aircraft_category DROP CONSTRAINT IF EXISTS rf_aircraft_category_pkey;
ALTER TABLE IF EXISTS ONLY public.rf_aircraft_category DROP CONSTRAINT IF EXISTS rf_aircraft_category_code_key;
ALTER TABLE IF EXISTS ONLY public.model_sids DROP CONSTRAINT IF EXISTS model_sids_unique;
ALTER TABLE IF EXISTS ONLY public.model_sids DROP CONSTRAINT IF EXISTS model_sids_pkey;
ALTER TABLE IF EXISTS ONLY public.manufacturers DROP CONSTRAINT IF EXISTS manufacturers_pkey;
ALTER TABLE IF EXISTS ONLY public.manufacturers DROP CONSTRAINT IF EXISTS manufacturers_code_key;
ALTER TABLE IF EXISTS ONLY public.maintenance_requirements DROP CONSTRAINT IF EXISTS maintenance_requirements_pkey;
ALTER TABLE IF EXISTS ONLY public.component_models DROP CONSTRAINT IF EXISTS component_models_pkey;
ALTER TABLE IF EXISTS ONLY public.cessna_sids DROP CONSTRAINT IF EXISTS cessna_sids_pkey;
ALTER TABLE IF EXISTS ONLY public.audit_log DROP CONSTRAINT IF EXISTS audit_log_pkey;
ALTER TABLE IF EXISTS ONLY public.aircraft_sid_status DROP CONSTRAINT IF EXISTS aircraft_sid_unique;
ALTER TABLE IF EXISTS ONLY public.aircraft_sid_status DROP CONSTRAINT IF EXISTS aircraft_sid_status_pkey;
ALTER TABLE IF EXISTS ONLY public.aircraft DROP CONSTRAINT IF EXISTS aircraft_serial_number_key;
ALTER TABLE IF EXISTS ONLY public.aircraft_sb_compliance DROP CONSTRAINT IF EXISTS aircraft_sb_unique;
ALTER TABLE IF EXISTS ONLY public.aircraft_sb_compliance DROP CONSTRAINT IF EXISTS aircraft_sb_compliance_pkey;
ALTER TABLE IF EXISTS ONLY public.aircraft DROP CONSTRAINT IF EXISTS aircraft_registration_key;
ALTER TABLE IF EXISTS ONLY public.aircraft DROP CONSTRAINT IF EXISTS aircraft_pkey;
ALTER TABLE IF EXISTS ONLY public.aircraft_components DROP CONSTRAINT IF EXISTS aircraft_components_pkey;
ALTER TABLE IF EXISTS ONLY public."SequelizeMeta" DROP CONSTRAINT IF EXISTS "SequelizeMeta_pkey";
DROP TABLE IF EXISTS public.workpacks;
DROP TABLE IF EXISTS public.workpack_tasks;
DROP TABLE IF EXISTS public.workpack_sources;
DROP TABLE IF EXISTS public.workpack_snags;
DROP TABLE IF EXISTS public.workpack_snag_audit_log;
DROP TABLE IF EXISTS public.workpack_signatures;
DROP TABLE IF EXISTS public.workpack_requirements;
DROP TABLE IF EXISTS public.workpack_measurements;
DROP TABLE IF EXISTS public.workpack_executions;
DROP TABLE IF EXISTS public.workpack_audit_log;
DROP VIEW IF EXISTS public.vw_component_status;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.user_roles;
DROP TABLE IF EXISTS public.task_templates;
DROP TABLE IF EXISTS public.task_cards;
DROP TABLE IF EXISTS public.sessions;
DROP TABLE IF EXISTS public.service_bulletins;
DROP TABLE IF EXISTS public.service_bulletin_models;
DROP TABLE IF EXISTS public.rf_workpack_status;
DROP TABLE IF EXISTS public.rf_task_state;
DROP TABLE IF EXISTS public.rf_signoff_role;
DROP TABLE IF EXISTS public.rf_role_permissions;
DROP TABLE IF EXISTS public.rf_role;
DROP TABLE IF EXISTS public.rf_permission;
DROP TABLE IF EXISTS public.rf_component_condition;
DROP TABLE IF EXISTS public.rf_component_categories;
DROP TABLE IF EXISTS public.rf_asset_type;
DROP TABLE IF EXISTS public.rf_aircraft_category;
DROP TABLE IF EXISTS public.model_sids;
DROP TABLE IF EXISTS public.manufacturers;
DROP TABLE IF EXISTS public.maintenance_requirements;
DROP TABLE IF EXISTS public.component_models;
DROP TABLE IF EXISTS public.cessna_sids;
DROP TABLE IF EXISTS public.audit_log;
DROP TABLE IF EXISTS public.aircraft_sid_status;
DROP TABLE IF EXISTS public.aircraft_sb_compliance;
DROP TABLE IF EXISTS public.aircraft_components;
DROP TABLE IF EXISTS public.aircraft;
DROP TABLE IF EXISTS public."SequelizeMeta";
DROP FUNCTION IF EXISTS public.fn_audit_trigger();
-- *not* dropping schema, since initdb creates it
--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: fn_audit_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_audit_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        -- Only set updated_at if the column exists
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = TG_TABLE_NAME
            AND column_name = 'updated_at'
        ) THEN
          NEW.updated_at = NOW();
        END IF;

        RETURN NEW;
      END;
      $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: SequelizeMeta; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SequelizeMeta" (
    name character varying(255) NOT NULL
);


--
-- Name: aircraft; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aircraft (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    registration character varying(255) NOT NULL,
    serial_number character varying(255) NOT NULL,
    category_id uuid NOT NULL,
    status character varying(255) DEFAULT 'REGISTERED'::character varying NOT NULL,
    total_time_hours numeric(10,2) DEFAULT 0 NOT NULL,
    total_time_cycles integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    version integer DEFAULT 0 NOT NULL,
    model_id uuid NOT NULL,
    owner_name character varying(255),
    operator_name character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    is_airworthy boolean DEFAULT true NOT NULL,
    notes text,
    loaded_into_system_at date,
    manufacture_date date,
    tcds_number character varying(255),
    tcds_url text,
    photo_url text
);


--
-- Name: aircraft_components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aircraft_components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aircraft_id uuid NOT NULL,
    model_id uuid NOT NULL,
    serial_number character varying(255) NOT NULL,
    position_code character varying(50),
    installation_date date NOT NULL,
    install_af_hours numeric(10,2) DEFAULT 0 NOT NULL,
    tso_at_install numeric(10,2) DEFAULT 0 NOT NULL,
    tsn_at_install numeric(10,2) DEFAULT 0 NOT NULL,
    current_status character varying(255) DEFAULT 'INSTALLED'::character varying NOT NULL,
    is_quarantined boolean DEFAULT false NOT NULL,
    removed_at timestamp with time zone,
    version integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: aircraft_sb_compliance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aircraft_sb_compliance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aircraft_id uuid NOT NULL,
    service_bulletin_id uuid NOT NULL,
    status character varying(255) DEFAULT 'PENDING'::character varying NOT NULL,
    complied_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: aircraft_sid_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aircraft_sid_status (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aircraft_id uuid NOT NULL,
    sid_id uuid NOT NULL,
    status character varying(255) DEFAULT 'DUE'::character varying NOT NULL,
    last_done_hours numeric(10,2),
    last_done_date timestamp with time zone,
    next_due_hours numeric(10,2),
    next_due_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name character varying(255) NOT NULL,
    row_id uuid NOT NULL,
    action character varying(255) NOT NULL,
    actor_id uuid,
    old_values jsonb,
    new_values jsonb,
    reason text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: cessna_sids; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cessna_sids (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sid_number character varying(255) NOT NULL,
    section_reference character varying(255),
    ata_chapter character varying(255),
    title character varying(255) NOT NULL,
    initial_interval_hours integer,
    initial_interval_months integer,
    repeat_interval_hours integer,
    repeat_interval_months integer,
    inspection_operation character varying(255),
    source_pdf character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: component_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    manufacturer_id uuid NOT NULL,
    model_name character varying(255) NOT NULL,
    category_id uuid,
    default_tbo_hours numeric(10,2),
    default_tbo_months integer,
    service_interval_hours numeric(10,2),
    service_interval_months integer,
    overhaul_interval_hours numeric(10,2),
    overhaul_interval_months integer,
    maintenance_notes text,
    is_life_limited boolean DEFAULT false NOT NULL,
    asset_type_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    model_code character varying(100)
);


--
-- Name: maintenance_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_requirements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    model_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    interval_hours integer,
    interval_months integer,
    description text
);


--
-- Name: manufacturers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(255),
    description text,
    is_active boolean DEFAULT true NOT NULL,
    website text,
    logo_url text,
    address_line_1 text,
    address_line_2 text,
    city text,
    state text,
    country text,
    postal_code text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: model_sids; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_sids (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    model_id uuid NOT NULL,
    sid_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rf_aircraft_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rf_aircraft_category (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(255) NOT NULL,
    label character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    system_locked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rf_asset_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rf_asset_type (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(255) NOT NULL,
    label character varying(255) NOT NULL,
    description text,
    is_installable_on_aircraft boolean DEFAULT false NOT NULL,
    is_required_for_aircraft boolean DEFAULT false NOT NULL,
    required_quantity integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true,
    system_locked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rf_component_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rf_component_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(255) NOT NULL,
    label character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    system_locked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rf_component_condition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rf_component_condition (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(255) NOT NULL,
    label character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    system_locked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rf_permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rf_permission (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(255) NOT NULL,
    label character varying(255) NOT NULL,
    description text,
    module character varying(255) NOT NULL,
    is_active boolean DEFAULT true,
    system_locked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rf_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rf_role (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(255) NOT NULL,
    label character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    system_locked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rf_role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rf_role_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rf_signoff_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rf_signoff_role (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(255) NOT NULL,
    label character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    system_locked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rf_task_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rf_task_state (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(255) NOT NULL,
    label character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    system_locked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: rf_workpack_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rf_workpack_status (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(255) NOT NULL,
    label character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    system_locked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: service_bulletin_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_bulletin_models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_bulletin_id uuid NOT NULL,
    model_id uuid NOT NULL
);


--
-- Name: service_bulletins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_bulletins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sb_number character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    issued_on date,
    compliance_type character varying(255) DEFAULT 'MANUAL'::character varying NOT NULL,
    source_primary character varying(255) DEFAULT 'MANUAL'::character varying NOT NULL,
    source_refs jsonb DEFAULT '[]'::jsonb NOT NULL,
    status character varying(255) DEFAULT 'ACTIVE'::character varying NOT NULL,
    revision character varying(255),
    document_url text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    sid character varying(255) NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp with time zone NOT NULL
);


--
-- Name: task_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_card_number character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    status character varying(255) DEFAULT 'OPEN'::character varying NOT NULL,
    aircraft_id uuid NOT NULL,
    assigned_to uuid,
    component_id uuid,
    signed_by uuid,
    signed_at timestamp with time zone,
    signature_snapshot_url text,
    work_performed text,
    mechanic_completed_by uuid,
    mechanic_completed_at timestamp with time zone,
    engineer_certified_by uuid,
    engineer_certified_at timestamp with time zone,
    template_source_id uuid,
    service_bulletin_id uuid,
    version integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: task_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_card_number character varying(255) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    scope character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    aircraft_model_id uuid,
    aircraft_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_required_for_wood boolean DEFAULT false NOT NULL,
    is_required_for_fabric boolean DEFAULT false NOT NULL,
    is_required_for_bungees boolean DEFAULT false NOT NULL,
    is_required_for_woodprop boolean DEFAULT false NOT NULL,
    is_required_for_retractable boolean DEFAULT false NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(255) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: vw_component_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_component_status AS
 SELECT c.id,
    c.serial_number,
    COALESCE(m.model_name, 'UNKNOWN MODEL'::character varying) AS model_name,
    COALESCE(cat.label, 'UNCATEGORIZED'::character varying) AS category_name,
    a.registration AS tail_number,
    c.install_af_hours,
    a.total_time_hours AS current_airframe_hours,
    (COALESCE(a.total_time_hours, (0)::numeric) - COALESCE(c.install_af_hours, (0)::numeric)) AS current_actual_tso,
    COALESCE(m.default_tbo_hours, (0)::numeric) AS tbo_hours,
    (COALESCE(m.default_tbo_hours, (0)::numeric) - (COALESCE(a.total_time_hours, (0)::numeric) - COALESCE(c.install_af_hours, (0)::numeric))) AS hours_remaining,
        CASE
            WHEN ((COALESCE(m.default_tbo_hours, (0)::numeric) - (COALESCE(a.total_time_hours, (0)::numeric) - COALESCE(c.install_af_hours, (0)::numeric))) <= (0)::numeric) THEN 'EXPIRED'::text
            WHEN ((COALESCE(m.default_tbo_hours, (0)::numeric) - (COALESCE(a.total_time_hours, (0)::numeric) - COALESCE(c.install_af_hours, (0)::numeric))) <= (50)::numeric) THEN 'CRITICAL'::text
            ELSE 'NORMAL'::text
        END AS maintenance_status,
    c.current_status AS component_status,
    c.aircraft_id
   FROM (((public.aircraft_components c
     LEFT JOIN public.component_models m ON ((c.model_id = m.id)))
     LEFT JOIN public.rf_asset_type cat ON ((m.asset_type_id = cat.id)))
     LEFT JOIN public.aircraft a ON ((c.aircraft_id = a.id)));


--
-- Name: workpack_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workpack_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id uuid NOT NULL,
    workpack_id uuid NOT NULL,
    task_id uuid NOT NULL,
    user_id uuid,
    action character varying(255) NOT NULL,
    field character varying(255),
    old_value jsonb NOT NULL,
    new_value jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    hash text NOT NULL,
    previous_hash text DEFAULT ''::text NOT NULL,
    sequence integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: workpack_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workpack_executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workpack_id uuid NOT NULL,
    task_id uuid NOT NULL,
    attempt_no integer DEFAULT 1 NOT NULL,
    status character varying(255) DEFAULT 'OPEN'::character varying NOT NULL,
    started_by uuid,
    completed_by uuid,
    certified_by uuid,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    certified_at timestamp with time zone,
    notes text,
    failure_reason text,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT workpack_executions_status_check CHECK (((status)::text = ANY ((ARRAY['OPEN'::character varying, 'IN_PROGRESS'::character varying, 'COMPLETED_BY_MECHANIC'::character varying, 'CERTIFIED_BY_ENGINEER'::character varying])::text[])))
);


--
-- Name: workpack_measurements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workpack_measurements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id uuid NOT NULL,
    field_key character varying(255) NOT NULL,
    field_label character varying(255) NOT NULL,
    "position" integer NOT NULL,
    value character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: workpack_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workpack_requirements (
    workpack_id uuid NOT NULL,
    maintenance_requirement_id uuid NOT NULL,
    status character varying(255) DEFAULT 'OPEN'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: workpack_signatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workpack_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id uuid NOT NULL,
    role character varying(255) NOT NULL,
    signature_type character varying(255) DEFAULT 'APPROVAL'::character varying NOT NULL,
    user_id uuid NOT NULL,
    signed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT workpack_signatures_role_check CHECK (((role)::text = ANY ((ARRAY['MECHANIC'::character varying, 'ENGINEER'::character varying])::text[]))),
    CONSTRAINT workpack_signatures_type_check CHECK (((signature_type)::text = ANY ((ARRAY['WORK'::character varying, 'REVIEW'::character varying, 'APPROVAL'::character varying])::text[])))
);


--
-- Name: workpack_snag_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workpack_snag_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    snag_id uuid NOT NULL,
    workpack_id uuid NOT NULL,
    user_id uuid,
    action character varying(255) NOT NULL,
    field character varying(255),
    old_value jsonb,
    new_value jsonb,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    hash text NOT NULL,
    previous_hash text DEFAULT ''::text NOT NULL,
    sequence integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: workpack_snags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workpack_snags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workpack_id uuid NOT NULL,
    description text NOT NULL,
    status character varying(255) DEFAULT 'OPEN'::character varying NOT NULL,
    resolution text,
    reported_by uuid,
    started_by uuid,
    completed_by uuid,
    reported_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    assigned_to uuid,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    closed_by uuid,
    closed_at timestamp with time zone,
    resolution_notes text,
    created_by uuid,
    category character varying(255),
    priority character varying(255) DEFAULT 'MEDIUM'::character varying NOT NULL,
    parts_used text,
    time_spent_minutes integer,
    snag_no integer NOT NULL,
    CONSTRAINT workpack_snags_status_check CHECK ((((status)::text = 'OPEN'::text) OR (((status)::text = 'IN_PROGRESS'::text) AND (started_at IS NOT NULL)) OR (((status)::text = 'RESOLVED'::text) AND (started_at IS NOT NULL) AND (resolved_at IS NOT NULL)) OR (((status)::text = 'CLOSED'::text) AND (started_at IS NOT NULL) AND (resolved_at IS NOT NULL) AND (closed_at IS NOT NULL))))
);


--
-- Name: workpack_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workpack_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    execution_id uuid NOT NULL,
    source_type character varying(255) NOT NULL,
    reference character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT workpack_sources_type_check CHECK (((source_type)::text = ANY ((ARRAY['AD'::character varying, 'SB'::character varying])::text[])))
);


--
-- Name: workpack_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workpack_tasks (
    workpack_id uuid NOT NULL,
    task_id uuid NOT NULL
);


--
-- Name: workpacks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workpacks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_order_number character varying(255) NOT NULL,
    status_id uuid NOT NULL,
    aircraft_id uuid NOT NULL,
    version integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    qa_required boolean DEFAULT false NOT NULL,
    certified_by uuid,
    certified_at timestamp with time zone,
    qa_reviewed_by uuid,
    qa_reviewed_at timestamp with time zone,
    released_by uuid,
    released_at timestamp with time zone
);


--
-- Data for Name: SequelizeMeta; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SequelizeMeta" (name) FROM stdin;
010_create_reference_tables.ts
040_create_identity_schema.ts
050_create_manufacturers.ts
060_create_audit_function.ts
070_create_aircraft_table.ts
080_create_task_cards_table.ts
090_create_workpacks.ts
100_expand_aircraft_and_components.ts
110_refactor_component_categories_to_asset_type.ts
120_backfill_aircraft_model_id.ts
130_enforce_aircraft_model_fk_and_version.ts
140_component_models_asset_type_refactor.ts
150_create_maintenance_requirements.ts
160_create_user_sessions.ts
170_add_rbac_permission_matrix.ts
180_phase0_structural_hardening.ts
190_phase0_remove_cascade_maintenance_requirements.ts
200_create_audit_log.ts
210_workpack_workflow_foundation.ts
220_add_task_work_performed.ts
230_create_task_templates.ts
231_add_task_template_applicability_flags.ts
240_add_task_template_source_to_task_cards.ts
245_create_service_bulletins.ts
246_create_service_bulletin_models.ts
250_add_task_card_service_bulletin_source.ts
255_create_aircraft_sb_compliance.ts
260_expand_manufacturers_and_models_master_data.ts
270_expand_aircraft_master_data.ts
271_add_aircraft_document_fields.ts
280_create-workpack-executions.ts
290_create-workpack-measurements.ts
300_create-workpack-signatures.ts
310_create-workpack-sources.ts
320_create-workpack-audit-log.ts
330_create-workpack-snags.ts
340_upgrade-workpack-snags-lifecycle.ts
350_add-snag-numbering.ts
360_create_cessna_sids.ts
370_create_model_sids.ts
380_create_aircraft_sid_status.ts
381_create_workpack_snag_audit_log.ts
\.


--
-- Data for Name: aircraft; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.aircraft (id, registration, serial_number, category_id, status, total_time_hours, total_time_cycles, created_at, updated_at, version, model_id, owner_name, operator_name, is_active, is_airworthy, notes, loaded_into_system_at, manufacture_date, tcds_number, tcds_url, photo_url) FROM stdin;
0c67737a-1964-44f6-8905-559ac3278814	ZS-SWU	15079011	db16cdab-f577-4fd7-a704-9c2da987548f	REGISTERED	1000.00	500	2026-04-23 21:49:09.829966+02	2026-04-23 21:49:09.829966+02	0	c4e50db4-7a85-459d-b523-2225b49e34a8	\N	\N	t	t	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: aircraft_components; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.aircraft_components (id, aircraft_id, model_id, serial_number, position_code, installation_date, install_af_hours, tso_at_install, tsn_at_install, current_status, is_quarantined, removed_at, version, created_at) FROM stdin;
0f2c14ef-8785-4d93-ba66-f9980eb03c97	0c67737a-1964-44f6-8905-559ac3278814	cc778d13-3139-4fe4-912a-bece67eb993f	251893	ENG-1	2026-04-23	500.00	0.00	0.00	INSTALLED	f	\N	0	2026-04-23 21:49:09.83449+02
\.


--
-- Data for Name: aircraft_sb_compliance; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.aircraft_sb_compliance (id, aircraft_id, service_bulletin_id, status, complied_at, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: aircraft_sid_status; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.aircraft_sid_status (id, aircraft_id, sid_id, status, last_done_hours, last_done_date, next_due_hours, next_due_date, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_log (id, table_name, row_id, action, actor_id, old_values, new_values, reason, created_at) FROM stdin;
ed8acb7a-7316-45fc-b2d4-7da45d54322d	workpacks	d26000c7-5571-4a89-8ca7-e188d052596a	CREATE	36698acf-0e02-476d-9114-f986af2a26f9	\N	\N	\N	2026-04-23 21:49:43.792+02
cbfe05ca-62bb-4336-834f-5067e44315f0	workpacks	d26000c7-5571-4a89-8ca7-e188d052596a	TASK_ADDED	36698acf-0e02-476d-9114-f986af2a26f9	\N	{"task_id": "a8c014e3-0077-4f93-95f3-6d891c3043ab"}	\N	2026-04-23 21:49:55.543+02
49d2b7eb-3d61-4aba-b038-73048783de72	workpacks	d26000c7-5571-4a89-8ca7-e188d052596a	TASK_ADDED	36698acf-0e02-476d-9114-f986af2a26f9	\N	{"task_id": "7d907304-dfbc-4485-bcd3-bd6f91fe836a"}	\N	2026-04-23 21:49:57.177+02
4c654e29-6af5-4e5d-b2bd-6a6fde3e8f7c	workpacks	d26000c7-5571-4a89-8ca7-e188d052596a	TASK_ADDED	36698acf-0e02-476d-9114-f986af2a26f9	\N	{"task_id": "258c6ced-b8eb-4e77-9868-6a78d1b91339"}	\N	2026-04-23 21:49:58.288+02
9838b42b-e4e7-4533-91c5-a4b8d2f498c7	workpacks	d26000c7-5571-4a89-8ca7-e188d052596a	STATUS_CHANGE	36698acf-0e02-476d-9114-f986af2a26f9	\N	{"status": "ISSUED"}	\N	2026-04-23 21:50:08.335+02
8009a8ec-15ad-4dae-94ec-309b3a37c492	workpacks	d26000c7-5571-4a89-8ca7-e188d052596a	STATUS_CHANGE	36698acf-0e02-476d-9114-f986af2a26f9	\N	{"status": "IN_PROGRESS"}	\N	2026-04-23 21:50:13.782+02
809dc76c-22b2-4160-9c13-0c3862a8a4ab	task_cards	a8c014e3-0077-4f93-95f3-6d891c3043ab	TASK_STARTED	36698acf-0e02-476d-9114-f986af2a26f9	\N	{"status": "IN_PROGRESS"}	\N	2026-04-23 21:50:13.802+02
8699db7b-d879-4f9e-970f-0fecbd107211	task_cards	a8c014e3-0077-4f93-95f3-6d891c3043ab	TASK_COMPLETED_BY_MECHANIC	36698acf-0e02-476d-9114-f986af2a26f9	\N	{"status": "COMPLETED_BY_MECHANIC"}	\N	2026-04-23 21:50:16.527+02
84a3aaf4-8bca-4e43-afb9-1b1f6b2aa604	task_cards	a8c014e3-0077-4f93-95f3-6d891c3043ab	TASK_CERTIFIED_BY_ENGINEER	36698acf-0e02-476d-9114-f986af2a26f9	\N	{"status": "CERTIFIED_BY_ENGINEER"}	\N	2026-04-23 21:50:19.62+02
55021431-6938-4d6c-a0f8-c0d7d4d758a8	task_cards	258c6ced-b8eb-4e77-9868-6a78d1b91339	TASK_STARTED	36698acf-0e02-476d-9114-f986af2a26f9	\N	{"status": "IN_PROGRESS"}	\N	2026-04-23 21:54:55.318+02
488d3408-2165-4735-b5bb-f21682c9a376	task_cards	258c6ced-b8eb-4e77-9868-6a78d1b91339	TASK_COMPLETED_BY_MECHANIC	36698acf-0e02-476d-9114-f986af2a26f9	\N	{"status": "COMPLETED_BY_MECHANIC"}	\N	2026-04-23 21:54:58.642+02
b2487a27-18c6-423c-afb9-727acb42b170	task_cards	258c6ced-b8eb-4e77-9868-6a78d1b91339	TASK_CERTIFIED_BY_ENGINEER	36698acf-0e02-476d-9114-f986af2a26f9	\N	{"status": "CERTIFIED_BY_ENGINEER"}	\N	2026-04-23 21:55:01.435+02
7faaf6c5-f17f-45e3-9a0f-8acfee110e23	task_cards	7d907304-dfbc-4485-bcd3-bd6f91fe836a	TASK_STARTED	36698acf-0e02-476d-9114-f986af2a26f9	\N	{"status": "IN_PROGRESS"}	\N	2026-04-23 21:55:12.066+02
9a1db334-e3ad-41b6-b32b-132c3fdd6304	task_cards	7d907304-dfbc-4485-bcd3-bd6f91fe836a	TASK_COMPLETED_BY_MECHANIC	36698acf-0e02-476d-9114-f986af2a26f9	\N	{"status": "COMPLETED_BY_MECHANIC"}	\N	2026-04-23 21:57:52.003+02
3ec42765-8621-44e1-a820-41520b37bc4c	task_cards	7d907304-dfbc-4485-bcd3-bd6f91fe836a	TASK_CERTIFIED_BY_ENGINEER	36698acf-0e02-476d-9114-f986af2a26f9	\N	{"status": "CERTIFIED_BY_ENGINEER"}	\N	2026-04-23 21:57:54.949+02
ff7166b7-15b2-4ecd-8243-fcc486908eb8	workpacks	d26000c7-5571-4a89-8ca7-e188d052596a	STATUS_CHANGE	36698acf-0e02-476d-9114-f986af2a26f9	\N	{"status": "CERTIFIED"}	\N	2026-04-23 21:57:58.184+02
\.


--
-- Data for Name: cessna_sids; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cessna_sids (id, sid_number, section_reference, ata_chapter, title, initial_interval_hours, initial_interval_months, repeat_interval_hours, repeat_interval_months, inspection_operation, source_pdf, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: component_models; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.component_models (id, manufacturer_id, model_name, category_id, default_tbo_hours, default_tbo_months, service_interval_hours, service_interval_months, overhaul_interval_hours, overhaul_interval_months, maintenance_notes, is_life_limited, asset_type_id, is_active, created_at, model_code) FROM stdin;
c4e50db4-7a85-459d-b523-2225b49e34a8	a2c4514f-59cc-4cef-aec3-f9f800542af1	Cessna 150M	\N	\N	\N	\N	\N	\N	\N	\N	f	43c6ff31-865e-471c-af5e-9733615a27c4	t	2026-04-23 21:49:09.82547+02	\N
cc778d13-3139-4fe4-912a-bece67eb993f	203b275c-1a8c-4128-a80e-b355d828d9cd	O-200A	\N	2000.00	\N	\N	\N	\N	\N	\N	f	3cb4ea90-dd9d-42cc-aad3-b8b98be30f48	t	2026-04-23 21:49:09.827257+02	\N
5548684f-1c11-4f6e-a8a1-c8bb81322120	184ead8e-73c0-4372-80ad-14a2a29719f4	PA-28-181 Archer II	\N	\N	\N	\N	\N	\N	\N	\N	f	43c6ff31-865e-471c-af5e-9733615a27c4	t	2026-04-23 21:49:09.867785+02	\N
629b4b2a-ee22-45aa-88fd-0b80c3b64043	0a00b09f-3171-4def-9a33-b887805448e8	O-320-D2J	\N	2000.00	\N	\N	\N	\N	\N	\N	f	3cb4ea90-dd9d-42cc-aad3-b8b98be30f48	t	2026-04-23 21:49:09.870497+02	\N
900f3e64-9dd7-481f-bcf4-6646f0427c0a	203b275c-1a8c-4128-a80e-b355d828d9cd	O-200-A	\N	1800.00	\N	\N	\N	\N	\N	\N	f	3cb4ea90-dd9d-42cc-aad3-b8b98be30f48	t	2026-04-23 21:49:09.874167+02	\N
b6edbdab-7061-413e-9f94-15d187a17bb3	8fa809de-bf22-40a3-9302-c0a1ffede663	1A102/OCM6948	\N	2000.00	72	\N	\N	\N	\N	\N	t	90059c46-dd73-4503-a005-8f2ddd7eeb9d	t	2026-04-23 21:49:09.876701+02	\N
9d86f092-ea21-47fa-b919-984a6aaa2657	00dfca0e-fe17-4a02-a1bd-dbde5c56d65a	HC-C2YK-1BF/F7666A-2	\N	2400.00	72	\N	\N	\N	\N	\N	t	90059c46-dd73-4503-a005-8f2ddd7eeb9d	t	2026-04-23 21:49:09.879009+02	\N
\.


--
-- Data for Name: maintenance_requirements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.maintenance_requirements (id, model_id, title, interval_hours, interval_months, description) FROM stdin;
4e0435f3-9004-4c40-a869-3a5467b43ed7	c4e50db4-7a85-459d-b523-2225b49e34a8	Annual Inspection	\N	12	Complete annual airframe inspection
dd58bb42-173c-42eb-9d96-53622edfcec7	c4e50db4-7a85-459d-b523-2225b49e34a8	100 Hour Inspection	100	\N	Recurring inspection for training and rental operations
9785869f-98a1-4886-b155-e71a8849ae32	5548684f-1c11-4f6e-a8a1-c8bb81322120	Annual Inspection	\N	12	Complete annual airframe inspection
a51ace34-4a80-4b72-a3b7-1871faf94f1d	629b4b2a-ee22-45aa-88fd-0b80c3b64043	50 Hour Oil and Filter Service	50	\N	Oil, filter, and engine bay inspection
c58b5655-cb76-4669-8455-c86662f2aec5	629b4b2a-ee22-45aa-88fd-0b80c3b64043	Top Overhaul Evaluation	1000	\N	Compression, borescope, and valve train evaluation
6b602a53-8f99-4350-b588-09e6ad337ae3	900f3e64-9dd7-481f-bcf4-6646f0427c0a	50 Hour Oil and Filter Service	50	\N	Oil, filter, and engine bay inspection
2c7be0dc-93e7-4d22-b777-edb847eb1828	b6edbdab-7061-413e-9f94-15d187a17bb3	Propeller Inspection	100	\N	Blade, spinner, and tracking inspection
3f95b719-83c4-4143-aabe-4ffaf77afddc	9d86f092-ea21-47fa-b919-984a6aaa2657	Propeller Inspection	100	\N	Blade, spinner, and tracking inspection
\.


--
-- Data for Name: manufacturers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.manufacturers (id, name, code, description, is_active, website, logo_url, address_line_1, address_line_2, city, state, country, postal_code, created_at, updated_at) FROM stdin;
7af450e1-1a58-4ceb-91b1-fbdcb15372ff	Unknown Manufacturer	UNKNOWN	Fallback manufacturer created by migration 230	t	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-23 21:49:00.580572+02	2026-04-23 21:49:00.580572+02
a2c4514f-59cc-4cef-aec3-f9f800542af1	Cessna	CESSNA	General aviation airframe manufacturer	t	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-23 21:49:09.823751+02	2026-04-23 21:49:09.823751+02
184ead8e-73c0-4372-80ad-14a2a29719f4	Piper	PIPER	General aviation airframe manufacturer	t	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-23 21:49:09.858582+02	2026-04-23 21:49:09.858582+02
0a00b09f-3171-4def-9a33-b887805448e8	Lycoming	LYCOMING	Piston aircraft engine manufacturer	t	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-23 21:49:09.859475+02	2026-04-23 21:49:09.859475+02
203b275c-1a8c-4128-a80e-b355d828d9cd	Continental	CONTINENTAL	Piston aircraft engine manufacturer	t	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-23 21:49:09.824679+02	2026-04-23 21:49:09.824679+02
8fa809de-bf22-40a3-9302-c0a1ffede663	McCauley	MCCAULEY	Aircraft propeller manufacturer	t	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-23 21:49:09.861218+02	2026-04-23 21:49:09.861218+02
00dfca0e-fe17-4a02-a1bd-dbde5c56d65a	Hartzell	HARTZELL	Aircraft propeller manufacturer	t	\N	\N	\N	\N	\N	\N	\N	\N	2026-04-23 21:49:09.861951+02	2026-04-23 21:49:09.861951+02
\.


--
-- Data for Name: model_sids; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.model_sids (id, model_id, sid_id, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: rf_aircraft_category; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rf_aircraft_category (id, code, label, description, is_active, system_locked, created_at) FROM stdin;
63b29ea7-2495-44ef-a791-4b36380de27c	ROTARY	Helicopter	\N	t	t	2026-04-23 21:49:09.217316+02
db16cdab-f577-4fd7-a704-9c2da987548f	FIXED_WING	Airplane	\N	t	t	2026-04-23 21:49:09.217316+02
\.


--
-- Data for Name: rf_asset_type; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rf_asset_type (id, code, label, description, is_installable_on_aircraft, is_required_for_aircraft, required_quantity, is_active, system_locked, created_at) FROM stdin;
3cb4ea90-dd9d-42cc-aad3-b8b98be30f48	ENGINE	Engine	\N	t	t	1	t	t	2026-04-23 21:49:09.218452+02
90059c46-dd73-4503-a005-8f2ddd7eeb9d	PROPELLER	Propeller	\N	t	t	1	t	t	2026-04-23 21:49:09.218452+02
43c6ff31-865e-471c-af5e-9733615a27c4	AIRFRAME	Airframe	\N	f	f	0	t	t	2026-04-23 21:49:09.218452+02
\.


--
-- Data for Name: rf_component_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rf_component_categories (id, code, label, description, is_active, system_locked, created_at) FROM stdin;
\.


--
-- Data for Name: rf_component_condition; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rf_component_condition (id, code, label, description, is_active, system_locked, created_at) FROM stdin;
5d9fe85e-fdc7-4abc-9c1f-16e09c44ab80	SERVICEABLE	Serviceable	\N	t	t	2026-04-23 21:49:09.215496+02
f1f6ccdf-9480-4fbf-915a-5412f5d94f85	QUARANTINED	Quarantined	\N	t	t	2026-04-23 21:49:09.215496+02
55f440c2-138f-4bf1-8c99-6c5a12e3b7a3	UNSERVICEABLE	Unserviceable	\N	t	t	2026-04-23 21:49:09.215496+02
\.


--
-- Data for Name: rf_permission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rf_permission (id, code, label, description, module, is_active, system_locked, created_at) FROM stdin;
a92da6cd-7c5c-40e9-a973-588ff3a1a230	REFERENCE_VIEW	Reference View	View reference data	REFERENCE	t	t	2026-04-23 21:49:00.538795+02
dbec3dd2-8b3b-4659-9f26-6be55ee5cc36	REFERENCE_CREATE	Reference Create	Create reference data	REFERENCE	t	t	2026-04-23 21:49:00.538795+02
1c0e4733-add0-407f-8834-d71029947832	REFERENCE_EDIT	Reference Edit	Edit reference data	REFERENCE	t	t	2026-04-23 21:49:00.538795+02
db50d99d-4b79-4f2d-9d24-74adcd2be668	REFERENCE_DEACTIVATE	Reference Deactivate	Deactivate reference data	REFERENCE	t	t	2026-04-23 21:49:00.538795+02
\.


--
-- Data for Name: rf_role; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rf_role (id, code, label, description, is_active, system_locked, created_at) FROM stdin;
9525b616-1693-443b-a8a2-73655fa42be8	ADMIN	System Administrator	\N	t	t	2026-04-23 21:49:09.213148+02
1911e4bc-b282-4145-84a8-117b9bef9a93	ENGINEER	Licensed Engineer	\N	t	t	2026-04-23 21:49:09.213148+02
74f427db-2e53-4e6b-b184-1a6a3ee37573	MECHANIC	Mechanic	\N	t	t	2026-04-23 21:49:09.213148+02
a7cabcd7-7926-4515-a0c3-66a8d458a082	SUPERVISOR	Supervisor	\N	t	t	2026-04-23 21:49:09.213148+02
71f951be-18f4-4d52-ab8a-4c61598dac03	QA	Quality Assurance	\N	t	t	2026-04-23 21:49:09.213148+02
9068d983-6469-41fc-9806-b96ab9a3deaa	PLANNER	Planner	\N	t	t	2026-04-23 21:49:09.213148+02
209a3031-3e41-45ff-9a47-77682130855a	VIEWER	Viewer	\N	t	t	2026-04-23 21:49:09.213148+02
\.


--
-- Data for Name: rf_role_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rf_role_permissions (id, role_id, permission_id, created_at) FROM stdin;
\.


--
-- Data for Name: rf_signoff_role; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rf_signoff_role (id, code, label, description, is_active, system_locked, created_at) FROM stdin;
d218bb56-a86f-40e2-ab9c-47231e2165e4	MECHANIC	Mechanic Completion	Records that maintenance task execution was completed	t	t	2026-04-23 21:49:09.214108+02
41bf0e81-625c-4b77-aa09-36ef5fc272a4	ENGINEER	Engineer Certification	Legal certification of completed maintenance work	t	t	2026-04-23 21:49:09.214108+02
d0aa9caa-1f7a-48c6-8400-8622b7bad9b7	QA	QA Acceptance	Optional quality assurance acceptance	t	t	2026-04-23 21:49:09.214108+02
\.


--
-- Data for Name: rf_task_state; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rf_task_state (id, code, label, description, is_active, system_locked, created_at) FROM stdin;
93b31e58-d1c4-4339-9537-feb09ceb73cf	OPEN	Open	\N	t	t	2026-04-23 21:49:09.210744+02
f8819359-ea69-4ad8-b1ad-62b4acd70342	IN_PROGRESS	In Progress	\N	t	t	2026-04-23 21:49:09.210744+02
d2e2e6cf-3c4a-499d-b5a4-ead2c9e6b2c4	COMPLETED_BY_MECHANIC	Completed By Mechanic	Task execution recorded by mechanic	t	t	2026-04-23 21:49:09.210744+02
cc2d7d5e-ff6b-4a92-836a-9d1b72febf10	CERTIFIED_BY_ENGINEER	Certified By Engineer	Task legally certified by engineer	t	t	2026-04-23 21:49:09.210744+02
\.


--
-- Data for Name: rf_workpack_status; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rf_workpack_status (id, code, label, description, is_active, system_locked, created_at) FROM stdin;
534b40dc-704d-4b55-8a8a-3fc48e6c7ada	DRAFT	Draft	\N	t	t	2026-04-23 21:49:09.212081+02
faffe995-a3e3-409a-b57d-8069baa57d0d	ISSUED	Issued	\N	t	t	2026-04-23 21:49:09.212081+02
5956c4a1-8bef-4bb3-bd64-1ed9d5d01735	IN_PROGRESS	In Progress	\N	t	t	2026-04-23 21:49:09.212081+02
8c15a4b2-ac62-4515-851e-6e04e308598e	CERTIFIED	Certified	Technically certified by engineer	t	t	2026-04-23 21:49:09.212081+02
28fec176-c44d-4730-8b31-7c914287b2fc	QA_REVIEW	QA Review	Awaiting optional QA review	t	t	2026-04-23 21:49:09.212081+02
36b4f2dd-38e3-411e-b918-2e903a441560	RELEASED	Released	Release certificate issued and aircraft returned to service	t	t	2026-04-23 21:49:09.212081+02
\.


--
-- Data for Name: service_bulletin_models; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.service_bulletin_models (id, service_bulletin_id, model_id) FROM stdin;
\.


--
-- Data for Name: service_bulletins; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.service_bulletins (id, sb_number, title, description, issued_on, compliance_type, source_primary, source_refs, status, revision, document_url, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (sid, sess, expire) FROM stdin;
SBb-Q60FkLgdbOuf_g-_ynYKI5vLN4cb	{"flash": {}, "cookie": {"path": "/", "secure": false, "expires": "2026-04-24T19:58:33.137Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 86400000}, "passport": {"user": "36698acf-0e02-476d-9114-f986af2a26f9"}, "csrfSecret": "aIvmgyQI1yMJiC-5azfDfaJL", "lastActivity": 1776974313127}	2026-04-24 21:58:34+02
\.


--
-- Data for Name: task_cards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.task_cards (id, task_card_number, title, description, status, aircraft_id, assigned_to, component_id, signed_by, signed_at, signature_snapshot_url, work_performed, mechanic_completed_by, mechanic_completed_at, engineer_certified_by, engineer_certified_at, template_source_id, service_bulletin_id, version, created_at, updated_at) FROM stdin;
45891f57-e61e-4281-82fb-4f1042f5d87c	ENG-004	Fit new oil filter	Install a new approved oil filter and safety wire it in accordance with the maintenance manual.	OPEN	0c67737a-1964-44f6-8905-559ac3278814	\N	0f2c14ef-8785-4d93-ba66-f9980eb03c97	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	2026-04-23 21:49:09.845757+02	2026-04-23 21:49:09.845757+02
f4ee600b-2c5e-42df-ab79-0632512f9fa8	ENG-005	Replenish oil	Refill engine with the correct grade and quantity of oil.	OPEN	0c67737a-1964-44f6-8905-559ac3278814	\N	0f2c14ef-8785-4d93-ba66-f9980eb03c97	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	2026-04-23 21:49:09.848432+02	2026-04-23 21:49:09.848432+02
b14fd331-0d22-4d8b-b8d5-1104f6b4ddf1	ENG-006	Refit spark plugs	Reinstall spark plugs and reconnect ignition leads.	OPEN	0c67737a-1964-44f6-8905-559ac3278814	\N	0f2c14ef-8785-4d93-ba66-f9980eb03c97	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	2026-04-23 21:49:09.85121+02	2026-04-23 21:49:09.85121+02
a8c014e3-0077-4f93-95f3-6d891c3043ab	ENG-001	Remove spark plugs	Remove all spark plugs for inspection, cleaning, and gap check.	CERTIFIED_BY_ENGINEER	0c67737a-1964-44f6-8905-559ac3278814	36698acf-0e02-476d-9114-f986af2a26f9	0f2c14ef-8785-4d93-ba66-f9980eb03c97	\N	\N	\N	\N	36698acf-0e02-476d-9114-f986af2a26f9	2026-04-23 21:50:16.516+02	36698acf-0e02-476d-9114-f986af2a26f9	2026-04-23 21:50:19.614+02	\N	\N	3	2026-04-23 21:49:09.83641+02	2026-04-23 21:50:19.614+02
258c6ced-b8eb-4e77-9868-6a78d1b91339	ENG-002	Drain engine oil	Drain engine oil into an approved waste container and inspect for contamination.	CERTIFIED_BY_ENGINEER	0c67737a-1964-44f6-8905-559ac3278814	36698acf-0e02-476d-9114-f986af2a26f9	0f2c14ef-8785-4d93-ba66-f9980eb03c97	\N	\N	\N	\N	36698acf-0e02-476d-9114-f986af2a26f9	2026-04-23 21:54:58.63+02	36698acf-0e02-476d-9114-f986af2a26f9	2026-04-23 21:55:01.429+02	\N	\N	3	2026-04-23 21:49:09.840132+02	2026-04-23 21:55:01.429+02
7d907304-dfbc-4485-bcd3-bd6f91fe836a	ENG-003	Remove oil filter	Remove the installed oil filter and inspect the filter media for debris.	CERTIFIED_BY_ENGINEER	0c67737a-1964-44f6-8905-559ac3278814	36698acf-0e02-476d-9114-f986af2a26f9	0f2c14ef-8785-4d93-ba66-f9980eb03c97	\N	\N	\N	\N	36698acf-0e02-476d-9114-f986af2a26f9	2026-04-23 21:57:51.974+02	36698acf-0e02-476d-9114-f986af2a26f9	2026-04-23 21:57:54.942+02	\N	\N	3	2026-04-23 21:49:09.842853+02	2026-04-23 21:57:54.942+02
\.


--
-- Data for Name: task_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.task_templates (id, task_card_number, sort_order, scope, title, description, aircraft_model_id, aircraft_id, is_active, created_at, updated_at, is_required_for_wood, is_required_for_fabric, is_required_for_bungees, is_required_for_woodprop, is_required_for_retractable) FROM stdin;
1a5bcf24-03eb-414b-942c-af14670f3615	TPL-GLOBAL-001	10	GLOBAL	General post-maintenance housekeeping	Inspect work area, verify all tools and materials are accounted for, and record any outstanding observations.	\N	\N	t	2026-04-23 21:49:09.900474+02	2026-04-23 21:49:09.900474+02	f	f	f	f	f
b3f58103-a013-4094-8a9d-c0b0aab9b747	TPL-GLOBAL-002	20	GLOBAL	Maintenance documentation review	Confirm task paperwork is complete, legible, and matched to the correct work order and aircraft.	\N	\N	t	2026-04-23 21:49:09.902333+02	2026-04-23 21:49:09.902333+02	f	f	f	f	f
bbb3cf14-7269-49a0-b3a9-45641efc9f82	TPL-C150M-001	100	MODEL	Cessna 150M control run and freedom check	Carry out a full and free movement check of primary flight controls in accordance with the aircraft maintenance manual.	c4e50db4-7a85-459d-b523-2225b49e34a8	\N	t	2026-04-23 21:49:09.903085+02	2026-04-23 21:49:09.903085+02	f	f	f	f	f
96795c96-ef7a-4f97-979d-447710878cb9	TPL-ZS-SWU-001	200	AIRCRAFT	ZS-SWU recurring cabin trim inspection	Inspect the known cabin side-panel trim area on ZS-SWU for looseness, missing fasteners, and wear.	\N	0c67737a-1964-44f6-8905-559ac3278814	t	2026-04-23 21:49:09.904485+02	2026-04-23 21:49:09.904485+02	f	f	f	f	f
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_roles (id, user_id, role_id) FROM stdin;
29f41dc8-2ca9-46ff-9c7e-e080e8965caf	36698acf-0e02-476d-9114-f986af2a26f9	9525b616-1693-443b-a8a2-73655fa42be8
2671fb59-d326-4f4e-a067-20f95dd456bb	36698acf-0e02-476d-9114-f986af2a26f9	9068d983-6469-41fc-9806-b96ab9a3deaa
a16dc7c2-a983-401e-b173-69b30c5192e6	36698acf-0e02-476d-9114-f986af2a26f9	1911e4bc-b282-4145-84a8-117b9bef9a93
fcd6214c-9a36-45b4-88f9-8dbb1934c104	36698acf-0e02-476d-9114-f986af2a26f9	a7cabcd7-7926-4515-a0c3-66a8d458a082
8d6acf19-fa7c-420c-858e-7ed4fb9172ca	36698acf-0e02-476d-9114-f986af2a26f9	71f951be-18f4-4d52-ab8a-4c61598dac03
7c1f956f-0c03-4b13-a883-19738515cc79	36698acf-0e02-476d-9114-f986af2a26f9	74f427db-2e53-4e6b-b184-1a6a3ee37573
92365873-7edb-4a0c-8106-8eb913a2c1f1	36698acf-0e02-476d-9114-f986af2a26f9	209a3031-3e41-45ff-9a47-77682130855a
664f8485-2c29-490b-bfc8-15bf7463f57b	551b05b7-91ac-4559-b271-0a221781e678	1911e4bc-b282-4145-84a8-117b9bef9a93
87469f03-6d5e-4d7f-b91a-57a7609c3bdc	ce063d46-46f9-4a5e-b3ee-b7a4e02f24eb	74f427db-2e53-4e6b-b184-1a6a3ee37573
a2d4aaee-873b-48a5-928c-6d586e7338f8	38ccaed3-7a70-4857-931a-b84ac8d726d2	74f427db-2e53-4e6b-b184-1a6a3ee37573
ea0ad7aa-0785-4bbf-810c-bfbb3efed531	7a361860-1dd0-4def-a452-c1a465ee2e26	74f427db-2e53-4e6b-b184-1a6a3ee37573
31a460a6-015b-43c6-9413-b448fa7ac1e9	25a7746d-35d9-4ae4-8df6-7e807c6d3960	71f951be-18f4-4d52-ab8a-4c61598dac03
13bf69fe-a7be-427f-868b-fb5bc14190e7	c91e6e7d-93f1-4489-b622-74ed2ffb0214	a7cabcd7-7926-4515-a0c3-66a8d458a082
80c7a740-0f89-459d-9879-6ed204bf023c	074b329a-f12b-4613-ad7f-7bcfabdb2197	9068d983-6469-41fc-9806-b96ab9a3deaa
6785ca5b-026b-406b-8ead-0eab34d3284c	690be29b-95e0-472d-9307-f20b32ce6feb	209a3031-3e41-45ff-9a47-77682130855a
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, password_hash, full_name, is_active, created_at, updated_at) FROM stdin;
36698acf-0e02-476d-9114-f986af2a26f9	admin@jupiter.aero	$argon2id$v=19$m=65536,t=3,p=4$+YK9u3dQCssxqgGsWYeeXQ$vogTwq/nhrhvDmzHTRqw2tDJRVu2d5UMEW5hwIJBpZM	System Administrator	t	2026-04-23 21:49:09.297297+02	2026-04-23 21:49:09.297297+02
551b05b7-91ac-4559-b271-0a221781e678	engineer@jupiter.aero	$argon2id$v=19$m=65536,t=3,p=4$00WhRM14Ix31WLm8I0eTqQ$Jtl6QdRyFR4sRh80TSDK8QMQfdAYX5SsueixIpbdNow	Lead Engineer	t	2026-04-23 21:49:09.367002+02	2026-04-23 21:49:09.367002+02
ce063d46-46f9-4a5e-b3ee-b7a4e02f24eb	mechanic@jupiter.aero	$argon2id$v=19$m=65536,t=3,p=4$YHWD26/t+azBxqy1CwyqSQ$2+BhPCFyg5sEbO8rmhzoRNU388YDVY1OmHPD1AKylDo	Maintenance Mechanic	t	2026-04-23 21:49:09.427501+02	2026-04-23 21:49:09.427501+02
38ccaed3-7a70-4857-931a-b84ac8d726d2	mec111@jupiter.aero	$argon2id$v=19$m=65536,t=3,p=4$I1vxzvV/DZK+WfDeymHoWw$nMIGC9xQBG/fq6dAJu3RXrhDeh76OO1dcOYe8uatyuA	Maintenance Mechanic 111	t	2026-04-23 21:49:09.49676+02	2026-04-23 21:49:09.49676+02
7a361860-1dd0-4def-a452-c1a465ee2e26	mec222@jupiter.aero	$argon2id$v=19$m=65536,t=3,p=4$H/ZgD31zrDk2mCQ38N/xbg$8EBpn1Aw5oDLIzVehV1a3U6s4Ou1lXgYiQDrhcnEGGc	Maintenance Mechanic 222	t	2026-04-23 21:49:09.563158+02	2026-04-23 21:49:09.563158+02
25a7746d-35d9-4ae4-8df6-7e807c6d3960	qaulity@jupiter.aero	$argon2id$v=19$m=65536,t=3,p=4$B5u9fZX/wU9ZCGmYoQkW5Q$ubhSE4rreWmOHqN6yGqzgVqcMh7UWKYcrnLuXe9NaDY	Quality Assurance	t	2026-04-23 21:49:09.633681+02	2026-04-23 21:49:09.633681+02
c91e6e7d-93f1-4489-b622-74ed2ffb0214	supervisor@jupiter.aero	$argon2id$v=19$m=65536,t=3,p=4$Jq7iSoSbtpY2GIWIiCiSTA$n9sKk3yTkUXNhcHwE5vbFRjcTN8rE3ORXmnrQI54L0o	Maintenance Supervisor	t	2026-04-23 21:49:09.697871+02	2026-04-23 21:49:09.697871+02
074b329a-f12b-4613-ad7f-7bcfabdb2197	planner@jupiter.aero	$argon2id$v=19$m=65536,t=3,p=4$rQGFBa44zYMLLW5HuUWrug$pvivAu+/OUntBxF2+UXJ2snqDxCx79yVPBjEk+COGIU	Maintenance Planner	t	2026-04-23 21:49:09.754413+02	2026-04-23 21:49:09.754413+02
690be29b-95e0-472d-9307-f20b32ce6feb	viewer@jupiter.aero	$argon2id$v=19$m=65536,t=3,p=4$ejuASbbFxBTjz2M5c1AwSw$A/kBG5tAEApP1JgC0VhrB3KT9ot0rimkmTqzfCdCO8g	Read Only	t	2026-04-23 21:49:09.813305+02	2026-04-23 21:49:09.813305+02
\.


--
-- Data for Name: workpack_audit_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workpack_audit_log (id, execution_id, workpack_id, task_id, user_id, action, field, old_value, new_value, metadata, hash, previous_hash, sequence, created_at) FROM stdin;
77bb29ec-75f1-4968-a98b-4a3d66289b61	97dda279-d270-4c5c-a2be-34a6cd5e3032	d26000c7-5571-4a89-8ca7-e188d052596a	a8c014e3-0077-4f93-95f3-6d891c3043ab	36698acf-0e02-476d-9114-f986af2a26f9	TASK_STARTED	status	{"task_status": "OPEN", "execution_status": "OPEN"}	{"task_status": "IN_PROGRESS", "execution_status": "IN_PROGRESS"}	{"started_at": "2026-04-23T19:50:13.800Z", "assigned_to": "36698acf-0e02-476d-9114-f986af2a26f9"}	b8211fdff03f0f37f9ffeedbc940e0469bb893a9b0f8274463edb60028e81c2c		1	2026-04-23 21:50:13.808+02
8af3ab5e-d040-410e-8ecc-383aff05f600	97dda279-d270-4c5c-a2be-34a6cd5e3032	d26000c7-5571-4a89-8ca7-e188d052596a	a8c014e3-0077-4f93-95f3-6d891c3043ab	36698acf-0e02-476d-9114-f986af2a26f9	TASK_COMPLETED_BY_MECHANIC	status	{"task_status": "IN_PROGRESS", "execution_status": "IN_PROGRESS"}	{"task_status": "COMPLETED_BY_MECHANIC", "execution_status": "COMPLETED_BY_MECHANIC"}	{"completed_at": "2026-04-23T19:50:16.519Z"}	76190f0844312983f7c95a3b3fd87d9272f9c07b02736f30cc26c548b8e24597	b8211fdff03f0f37f9ffeedbc940e0469bb893a9b0f8274463edb60028e81c2c	2	2026-04-23 21:50:16.529+02
058ea418-9a9d-4fc9-bd33-3588f38dc437	97dda279-d270-4c5c-a2be-34a6cd5e3032	d26000c7-5571-4a89-8ca7-e188d052596a	a8c014e3-0077-4f93-95f3-6d891c3043ab	36698acf-0e02-476d-9114-f986af2a26f9	SIGNATURE_RECORDED	mechanic_signature	{}	{"role": "MECHANIC", "user_id": "36698acf-0e02-476d-9114-f986af2a26f9", "signature_type": "WORK"}	{"signed_at": "2026-04-23T19:50:16.530Z"}	cc1c1f8649bbc600ed219d0ec94c339389eed6b7476e7cd512cce07065e6af5f	76190f0844312983f7c95a3b3fd87d9272f9c07b02736f30cc26c548b8e24597	3	2026-04-23 21:50:16.531+02
f69847b9-2d2e-4b67-99bd-9ad024bdd421	97dda279-d270-4c5c-a2be-34a6cd5e3032	d26000c7-5571-4a89-8ca7-e188d052596a	a8c014e3-0077-4f93-95f3-6d891c3043ab	36698acf-0e02-476d-9114-f986af2a26f9	TASK_CERTIFIED_BY_ENGINEER	status	{"task_status": "COMPLETED_BY_MECHANIC", "execution_status": "COMPLETED_BY_MECHANIC"}	{"task_status": "CERTIFIED_BY_ENGINEER", "execution_status": "CERTIFIED_BY_ENGINEER"}	{"certified_at": "2026-04-23T19:50:19.617Z"}	c1da6294b057cdbe1536e7a812c6f8c00e2cb6c70aac3a863f39c93e28518010	cc1c1f8649bbc600ed219d0ec94c339389eed6b7476e7cd512cce07065e6af5f	4	2026-04-23 21:50:19.622+02
71021951-c4c1-41d6-9738-15a13f242b77	97dda279-d270-4c5c-a2be-34a6cd5e3032	d26000c7-5571-4a89-8ca7-e188d052596a	a8c014e3-0077-4f93-95f3-6d891c3043ab	36698acf-0e02-476d-9114-f986af2a26f9	SIGNATURE_RECORDED	engineer_signature	{}	{"role": "ENGINEER", "user_id": "36698acf-0e02-476d-9114-f986af2a26f9", "signature_type": "APPROVAL"}	{"signed_at": "2026-04-23T19:50:19.623Z"}	8c575c06567473d7442b7687f9f75ee385ee8e58442d291e9d503c4ed0a8dec1	c1da6294b057cdbe1536e7a812c6f8c00e2cb6c70aac3a863f39c93e28518010	5	2026-04-23 21:50:19.623+02
3f4ceb9e-a157-49f8-a8fe-362d9258e939	ac4c04d0-30a8-4819-b59b-dc792bf729ad	d26000c7-5571-4a89-8ca7-e188d052596a	258c6ced-b8eb-4e77-9868-6a78d1b91339	36698acf-0e02-476d-9114-f986af2a26f9	TASK_STARTED	status	{"task_status": "OPEN", "execution_status": "OPEN"}	{"task_status": "IN_PROGRESS", "execution_status": "IN_PROGRESS"}	{"started_at": "2026-04-23T19:54:55.316Z", "assigned_to": "36698acf-0e02-476d-9114-f986af2a26f9"}	c36cf86f143c7b17bdb88560e9d2118a835c6932f66edf76505f03652a7c7767		1	2026-04-23 21:54:55.324+02
5c1fa0e6-2a50-4699-b837-763e2ebb6566	ac4c04d0-30a8-4819-b59b-dc792bf729ad	d26000c7-5571-4a89-8ca7-e188d052596a	258c6ced-b8eb-4e77-9868-6a78d1b91339	36698acf-0e02-476d-9114-f986af2a26f9	TASK_COMPLETED_BY_MECHANIC	status	{"task_status": "IN_PROGRESS", "execution_status": "IN_PROGRESS"}	{"task_status": "COMPLETED_BY_MECHANIC", "execution_status": "COMPLETED_BY_MECHANIC"}	{"completed_at": "2026-04-23T19:54:58.633Z"}	34058332b851c8a4edcf7c79fde034f889a40208905909351bba45a3e233ac12	c36cf86f143c7b17bdb88560e9d2118a835c6932f66edf76505f03652a7c7767	2	2026-04-23 21:54:58.644+02
f44715d7-ee6d-4c0c-83cf-c6bea4e863b1	ac4c04d0-30a8-4819-b59b-dc792bf729ad	d26000c7-5571-4a89-8ca7-e188d052596a	258c6ced-b8eb-4e77-9868-6a78d1b91339	36698acf-0e02-476d-9114-f986af2a26f9	SIGNATURE_RECORDED	mechanic_signature	{}	{"role": "MECHANIC", "user_id": "36698acf-0e02-476d-9114-f986af2a26f9", "signature_type": "WORK"}	{"signed_at": "2026-04-23T19:54:58.645Z"}	db3c456e7a0c212c782fafbab696e8d3a4a65f468834637a9a49ac1aa0aa9b66	34058332b851c8a4edcf7c79fde034f889a40208905909351bba45a3e233ac12	3	2026-04-23 21:54:58.645+02
2cfa754f-bf14-41d1-b6c1-e3474edda1b9	ac4c04d0-30a8-4819-b59b-dc792bf729ad	d26000c7-5571-4a89-8ca7-e188d052596a	258c6ced-b8eb-4e77-9868-6a78d1b91339	36698acf-0e02-476d-9114-f986af2a26f9	TASK_CERTIFIED_BY_ENGINEER	status	{"task_status": "COMPLETED_BY_MECHANIC", "execution_status": "COMPLETED_BY_MECHANIC"}	{"task_status": "CERTIFIED_BY_ENGINEER", "execution_status": "CERTIFIED_BY_ENGINEER"}	{"certified_at": "2026-04-23T19:55:01.432Z"}	b5d3e8a7e271691a78cf085c92d1a46bc47bb2702ca0259ab0763156668eb601	db3c456e7a0c212c782fafbab696e8d3a4a65f468834637a9a49ac1aa0aa9b66	4	2026-04-23 21:55:01.437+02
beba3919-8c96-4271-9031-92f801255dbb	ac4c04d0-30a8-4819-b59b-dc792bf729ad	d26000c7-5571-4a89-8ca7-e188d052596a	258c6ced-b8eb-4e77-9868-6a78d1b91339	36698acf-0e02-476d-9114-f986af2a26f9	SIGNATURE_RECORDED	engineer_signature	{}	{"role": "ENGINEER", "user_id": "36698acf-0e02-476d-9114-f986af2a26f9", "signature_type": "APPROVAL"}	{"signed_at": "2026-04-23T19:55:01.438Z"}	495363c58a58547a7ff4e9e89d1318c43577607c6f57661d7ad19787408191c7	b5d3e8a7e271691a78cf085c92d1a46bc47bb2702ca0259ab0763156668eb601	5	2026-04-23 21:55:01.439+02
ad8d3395-8b89-41fd-8bb7-78068720cfb7	b8ee9690-c1d4-4e4a-96e8-a3d792578b10	d26000c7-5571-4a89-8ca7-e188d052596a	7d907304-dfbc-4485-bcd3-bd6f91fe836a	36698acf-0e02-476d-9114-f986af2a26f9	TASK_STARTED	status	{"task_status": "OPEN", "execution_status": "OPEN"}	{"task_status": "IN_PROGRESS", "execution_status": "IN_PROGRESS"}	{"started_at": "2026-04-23T19:55:12.064Z", "assigned_to": "36698acf-0e02-476d-9114-f986af2a26f9"}	4e54cad0ed7cb41538fc6bcc763e960bf4ad4e61ef335775ffbb198be0ff3367		1	2026-04-23 21:55:12.067+02
e1606dff-feab-459e-bbdf-c25b651f918c	b8ee9690-c1d4-4e4a-96e8-a3d792578b10	d26000c7-5571-4a89-8ca7-e188d052596a	7d907304-dfbc-4485-bcd3-bd6f91fe836a	36698acf-0e02-476d-9114-f986af2a26f9	TASK_COMPLETED_BY_MECHANIC	status	{"task_status": "IN_PROGRESS", "execution_status": "IN_PROGRESS"}	{"task_status": "COMPLETED_BY_MECHANIC", "execution_status": "COMPLETED_BY_MECHANIC"}	{"completed_at": "2026-04-23T19:57:51.994Z"}	a329afa4f00019d935cc7dcf3d4306d03bf1243ddab55245cef29669e27ba9ef	4e54cad0ed7cb41538fc6bcc763e960bf4ad4e61ef335775ffbb198be0ff3367	2	2026-04-23 21:57:52.009+02
f6a65246-10d1-45d2-bf27-f91273201a59	b8ee9690-c1d4-4e4a-96e8-a3d792578b10	d26000c7-5571-4a89-8ca7-e188d052596a	7d907304-dfbc-4485-bcd3-bd6f91fe836a	36698acf-0e02-476d-9114-f986af2a26f9	SIGNATURE_RECORDED	mechanic_signature	{}	{"role": "MECHANIC", "user_id": "36698acf-0e02-476d-9114-f986af2a26f9", "signature_type": "WORK"}	{"signed_at": "2026-04-23T19:57:52.010Z"}	48a4c37c09d4e1e37e9189d1f19cf38ca66c58064c48e2929439131bc32464eb	a329afa4f00019d935cc7dcf3d4306d03bf1243ddab55245cef29669e27ba9ef	3	2026-04-23 21:57:52.011+02
b207a6e2-cd65-4eaf-bc0b-236f513243aa	b8ee9690-c1d4-4e4a-96e8-a3d792578b10	d26000c7-5571-4a89-8ca7-e188d052596a	7d907304-dfbc-4485-bcd3-bd6f91fe836a	36698acf-0e02-476d-9114-f986af2a26f9	TASK_CERTIFIED_BY_ENGINEER	status	{"task_status": "COMPLETED_BY_MECHANIC", "execution_status": "COMPLETED_BY_MECHANIC"}	{"task_status": "CERTIFIED_BY_ENGINEER", "execution_status": "CERTIFIED_BY_ENGINEER"}	{"certified_at": "2026-04-23T19:57:54.945Z"}	997a320d7f2289589e526db9998bded7eabd7714d2eb784eda15b25660677edc	48a4c37c09d4e1e37e9189d1f19cf38ca66c58064c48e2929439131bc32464eb	4	2026-04-23 21:57:54.951+02
0a996c1b-086d-47a4-af95-4604b94130fc	b8ee9690-c1d4-4e4a-96e8-a3d792578b10	d26000c7-5571-4a89-8ca7-e188d052596a	7d907304-dfbc-4485-bcd3-bd6f91fe836a	36698acf-0e02-476d-9114-f986af2a26f9	SIGNATURE_RECORDED	engineer_signature	{}	{"role": "ENGINEER", "user_id": "36698acf-0e02-476d-9114-f986af2a26f9", "signature_type": "APPROVAL"}	{"signed_at": "2026-04-23T19:57:54.952Z"}	144de1fafbeb9c05e8fe0e0d100c0f76d9da7774d427d9d15c08188845f9399c	997a320d7f2289589e526db9998bded7eabd7714d2eb784eda15b25660677edc	5	2026-04-23 21:57:54.953+02
\.


--
-- Data for Name: workpack_executions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workpack_executions (id, workpack_id, task_id, attempt_no, status, started_by, completed_by, certified_by, started_at, completed_at, certified_at, notes, failure_reason, version, created_at, updated_at) FROM stdin;
97dda279-d270-4c5c-a2be-34a6cd5e3032	d26000c7-5571-4a89-8ca7-e188d052596a	a8c014e3-0077-4f93-95f3-6d891c3043ab	1	CERTIFIED_BY_ENGINEER	36698acf-0e02-476d-9114-f986af2a26f9	36698acf-0e02-476d-9114-f986af2a26f9	36698acf-0e02-476d-9114-f986af2a26f9	2026-04-23 21:50:13.8+02	2026-04-23 21:50:16.519+02	2026-04-23 21:50:19.617+02	\N	\N	4	2026-04-23 21:50:13.784+02	2026-04-23 21:50:19.617+02
ac4c04d0-30a8-4819-b59b-dc792bf729ad	d26000c7-5571-4a89-8ca7-e188d052596a	258c6ced-b8eb-4e77-9868-6a78d1b91339	1	CERTIFIED_BY_ENGINEER	36698acf-0e02-476d-9114-f986af2a26f9	36698acf-0e02-476d-9114-f986af2a26f9	36698acf-0e02-476d-9114-f986af2a26f9	2026-04-23 21:54:55.316+02	2026-04-23 21:54:58.633+02	2026-04-23 21:55:01.432+02	\N	\N	4	2026-04-23 21:54:55.253+02	2026-04-23 21:55:01.432+02
b8ee9690-c1d4-4e4a-96e8-a3d792578b10	d26000c7-5571-4a89-8ca7-e188d052596a	7d907304-dfbc-4485-bcd3-bd6f91fe836a	1	CERTIFIED_BY_ENGINEER	36698acf-0e02-476d-9114-f986af2a26f9	36698acf-0e02-476d-9114-f986af2a26f9	36698acf-0e02-476d-9114-f986af2a26f9	2026-04-23 21:55:12.064+02	2026-04-23 21:57:51.994+02	2026-04-23 21:57:54.945+02	\N	\N	4	2026-04-23 21:55:12.06+02	2026-04-23 21:57:54.945+02
\.


--
-- Data for Name: workpack_measurements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workpack_measurements (id, execution_id, field_key, field_label, "position", value, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: workpack_requirements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workpack_requirements (workpack_id, maintenance_requirement_id, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: workpack_signatures; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workpack_signatures (id, execution_id, role, signature_type, user_id, signed_at) FROM stdin;
4eb7a11c-0b7d-4c25-bf8f-c6f0d94654f5	97dda279-d270-4c5c-a2be-34a6cd5e3032	MECHANIC	WORK	36698acf-0e02-476d-9114-f986af2a26f9	2026-04-23 21:50:16.525+02
0fc02660-7607-4c86-a08d-77167c618f5b	97dda279-d270-4c5c-a2be-34a6cd5e3032	ENGINEER	APPROVAL	36698acf-0e02-476d-9114-f986af2a26f9	2026-04-23 21:50:19.619+02
01878006-7924-4629-afb3-f5efa30c6eca	ac4c04d0-30a8-4819-b59b-dc792bf729ad	MECHANIC	WORK	36698acf-0e02-476d-9114-f986af2a26f9	2026-04-23 21:54:58.64+02
e6455170-7eef-4128-969b-32f24753d727	ac4c04d0-30a8-4819-b59b-dc792bf729ad	ENGINEER	APPROVAL	36698acf-0e02-476d-9114-f986af2a26f9	2026-04-23 21:55:01.434+02
758d818f-aa7a-424a-93de-1700afc60351	b8ee9690-c1d4-4e4a-96e8-a3d792578b10	MECHANIC	WORK	36698acf-0e02-476d-9114-f986af2a26f9	2026-04-23 21:57:52+02
59cbe2d3-01ed-4d9d-920d-37b305a6d25a	b8ee9690-c1d4-4e4a-96e8-a3d792578b10	ENGINEER	APPROVAL	36698acf-0e02-476d-9114-f986af2a26f9	2026-04-23 21:57:54.947+02
\.


--
-- Data for Name: workpack_snag_audit_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workpack_snag_audit_log (id, snag_id, workpack_id, user_id, action, field, old_value, new_value, metadata, hash, previous_hash, sequence, created_at) FROM stdin;
\.


--
-- Data for Name: workpack_snags; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workpack_snags (id, workpack_id, description, status, resolution, reported_by, started_by, completed_by, reported_at, started_at, completed_at, version, created_at, updated_at, assigned_to, resolved_by, resolved_at, closed_by, closed_at, resolution_notes, created_by, category, priority, parts_used, time_spent_minutes, snag_no) FROM stdin;
\.


--
-- Data for Name: workpack_sources; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workpack_sources (id, execution_id, source_type, reference, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: workpack_tasks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workpack_tasks (workpack_id, task_id) FROM stdin;
d26000c7-5571-4a89-8ca7-e188d052596a	a8c014e3-0077-4f93-95f3-6d891c3043ab
d26000c7-5571-4a89-8ca7-e188d052596a	7d907304-dfbc-4485-bcd3-bd6f91fe836a
d26000c7-5571-4a89-8ca7-e188d052596a	258c6ced-b8eb-4e77-9868-6a78d1b91339
\.


--
-- Data for Name: workpacks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.workpacks (id, work_order_number, status_id, aircraft_id, version, created_at, updated_at, qa_required, certified_by, certified_at, qa_reviewed_by, qa_reviewed_at, released_by, released_at) FROM stdin;
d26000c7-5571-4a89-8ca7-e188d052596a	ZSSWU 836	8c15a4b2-ac62-4515-851e-6e04e308598e	0c67737a-1964-44f6-8905-559ac3278814	3	2026-04-23 21:49:43.786+02	2026-04-23 21:57:58.183+02	f	\N	\N	\N	\N	\N	\N
\.


--
-- Name: SequelizeMeta SequelizeMeta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SequelizeMeta"
    ADD CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY (name);


--
-- Name: aircraft_components aircraft_components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft_components
    ADD CONSTRAINT aircraft_components_pkey PRIMARY KEY (id);


--
-- Name: aircraft aircraft_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft
    ADD CONSTRAINT aircraft_pkey PRIMARY KEY (id);


--
-- Name: aircraft aircraft_registration_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft
    ADD CONSTRAINT aircraft_registration_key UNIQUE (registration);


--
-- Name: aircraft_sb_compliance aircraft_sb_compliance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft_sb_compliance
    ADD CONSTRAINT aircraft_sb_compliance_pkey PRIMARY KEY (id);


--
-- Name: aircraft_sb_compliance aircraft_sb_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft_sb_compliance
    ADD CONSTRAINT aircraft_sb_unique UNIQUE (aircraft_id, service_bulletin_id);


--
-- Name: aircraft aircraft_serial_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft
    ADD CONSTRAINT aircraft_serial_number_key UNIQUE (serial_number);


--
-- Name: aircraft_sid_status aircraft_sid_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft_sid_status
    ADD CONSTRAINT aircraft_sid_status_pkey PRIMARY KEY (id);


--
-- Name: aircraft_sid_status aircraft_sid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft_sid_status
    ADD CONSTRAINT aircraft_sid_unique UNIQUE (aircraft_id, sid_id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: cessna_sids cessna_sids_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cessna_sids
    ADD CONSTRAINT cessna_sids_pkey PRIMARY KEY (id);


--
-- Name: component_models component_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_models
    ADD CONSTRAINT component_models_pkey PRIMARY KEY (id);


--
-- Name: maintenance_requirements maintenance_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requirements
    ADD CONSTRAINT maintenance_requirements_pkey PRIMARY KEY (id);


--
-- Name: manufacturers manufacturers_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturers
    ADD CONSTRAINT manufacturers_code_key UNIQUE (code);


--
-- Name: manufacturers manufacturers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturers
    ADD CONSTRAINT manufacturers_pkey PRIMARY KEY (id);


--
-- Name: model_sids model_sids_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_sids
    ADD CONSTRAINT model_sids_pkey PRIMARY KEY (id);


--
-- Name: model_sids model_sids_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_sids
    ADD CONSTRAINT model_sids_unique UNIQUE (model_id, sid_id);


--
-- Name: rf_aircraft_category rf_aircraft_category_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_aircraft_category
    ADD CONSTRAINT rf_aircraft_category_code_key UNIQUE (code);


--
-- Name: rf_aircraft_category rf_aircraft_category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_aircraft_category
    ADD CONSTRAINT rf_aircraft_category_pkey PRIMARY KEY (id);


--
-- Name: rf_asset_type rf_asset_type_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_asset_type
    ADD CONSTRAINT rf_asset_type_code_key UNIQUE (code);


--
-- Name: rf_asset_type rf_asset_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_asset_type
    ADD CONSTRAINT rf_asset_type_pkey PRIMARY KEY (id);


--
-- Name: rf_component_categories rf_component_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_component_categories
    ADD CONSTRAINT rf_component_categories_code_key UNIQUE (code);


--
-- Name: rf_component_categories rf_component_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_component_categories
    ADD CONSTRAINT rf_component_categories_pkey PRIMARY KEY (id);


--
-- Name: rf_component_condition rf_component_condition_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_component_condition
    ADD CONSTRAINT rf_component_condition_code_key UNIQUE (code);


--
-- Name: rf_component_condition rf_component_condition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_component_condition
    ADD CONSTRAINT rf_component_condition_pkey PRIMARY KEY (id);


--
-- Name: rf_permission rf_permission_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_permission
    ADD CONSTRAINT rf_permission_code_key UNIQUE (code);


--
-- Name: rf_permission rf_permission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_permission
    ADD CONSTRAINT rf_permission_pkey PRIMARY KEY (id);


--
-- Name: rf_role rf_role_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_role
    ADD CONSTRAINT rf_role_code_key UNIQUE (code);


--
-- Name: rf_role_permissions rf_role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_role_permissions
    ADD CONSTRAINT rf_role_permissions_pkey PRIMARY KEY (id);


--
-- Name: rf_role_permissions rf_role_permissions_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_role_permissions
    ADD CONSTRAINT rf_role_permissions_unique UNIQUE (role_id, permission_id);


--
-- Name: rf_role rf_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_role
    ADD CONSTRAINT rf_role_pkey PRIMARY KEY (id);


--
-- Name: rf_signoff_role rf_signoff_role_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_signoff_role
    ADD CONSTRAINT rf_signoff_role_code_key UNIQUE (code);


--
-- Name: rf_signoff_role rf_signoff_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_signoff_role
    ADD CONSTRAINT rf_signoff_role_pkey PRIMARY KEY (id);


--
-- Name: rf_task_state rf_task_state_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_task_state
    ADD CONSTRAINT rf_task_state_code_key UNIQUE (code);


--
-- Name: rf_task_state rf_task_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_task_state
    ADD CONSTRAINT rf_task_state_pkey PRIMARY KEY (id);


--
-- Name: rf_workpack_status rf_workpack_status_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_workpack_status
    ADD CONSTRAINT rf_workpack_status_code_key UNIQUE (code);


--
-- Name: rf_workpack_status rf_workpack_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_workpack_status
    ADD CONSTRAINT rf_workpack_status_pkey PRIMARY KEY (id);


--
-- Name: service_bulletin_models service_bulletin_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_bulletin_models
    ADD CONSTRAINT service_bulletin_models_pkey PRIMARY KEY (id);


--
-- Name: service_bulletins service_bulletins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_bulletins
    ADD CONSTRAINT service_bulletins_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- Name: task_cards task_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_cards
    ADD CONSTRAINT task_cards_pkey PRIMARY KEY (id);


--
-- Name: task_templates task_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_templates
    ADD CONSTRAINT task_templates_pkey PRIMARY KEY (id);


--
-- Name: cessna_sids unique_sid_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cessna_sids
    ADD CONSTRAINT unique_sid_number UNIQUE (sid_number);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_id_unique UNIQUE (user_id, role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: workpack_audit_log workpack_audit_log_execution_sequence_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_audit_log
    ADD CONSTRAINT workpack_audit_log_execution_sequence_unique UNIQUE (execution_id, sequence);


--
-- Name: workpack_audit_log workpack_audit_log_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_audit_log
    ADD CONSTRAINT workpack_audit_log_hash_unique UNIQUE (hash);


--
-- Name: workpack_audit_log workpack_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_audit_log
    ADD CONSTRAINT workpack_audit_log_pkey PRIMARY KEY (id);


--
-- Name: workpack_executions workpack_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_executions
    ADD CONSTRAINT workpack_executions_pkey PRIMARY KEY (id);


--
-- Name: workpack_executions workpack_executions_workpack_task_attempt_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_executions
    ADD CONSTRAINT workpack_executions_workpack_task_attempt_unique UNIQUE (workpack_id, task_id, attempt_no);


--
-- Name: workpack_measurements workpack_measurements_execution_id_field_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_measurements
    ADD CONSTRAINT workpack_measurements_execution_id_field_key_unique UNIQUE (execution_id, field_key);


--
-- Name: workpack_measurements workpack_measurements_execution_id_position_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_measurements
    ADD CONSTRAINT workpack_measurements_execution_id_position_unique UNIQUE (execution_id, "position");


--
-- Name: workpack_measurements workpack_measurements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_measurements
    ADD CONSTRAINT workpack_measurements_pkey PRIMARY KEY (id);


--
-- Name: workpack_requirements workpack_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_requirements
    ADD CONSTRAINT workpack_requirements_pkey PRIMARY KEY (workpack_id, maintenance_requirement_id);


--
-- Name: workpack_signatures workpack_signatures_execution_id_role_signature_type_user_id_un; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_signatures
    ADD CONSTRAINT workpack_signatures_execution_id_role_signature_type_user_id_un UNIQUE (execution_id, role, signature_type, user_id);


--
-- Name: workpack_signatures workpack_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_signatures
    ADD CONSTRAINT workpack_signatures_pkey PRIMARY KEY (id);


--
-- Name: workpack_snag_audit_log workpack_snag_audit_log_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_snag_audit_log
    ADD CONSTRAINT workpack_snag_audit_log_hash_unique UNIQUE (hash);


--
-- Name: workpack_snag_audit_log workpack_snag_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_snag_audit_log
    ADD CONSTRAINT workpack_snag_audit_log_pkey PRIMARY KEY (id);


--
-- Name: workpack_snag_audit_log workpack_snag_audit_log_snag_sequence_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_snag_audit_log
    ADD CONSTRAINT workpack_snag_audit_log_snag_sequence_unique UNIQUE (snag_id, sequence);


--
-- Name: workpack_snags workpack_snags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_snags
    ADD CONSTRAINT workpack_snags_pkey PRIMARY KEY (id);


--
-- Name: workpack_snags workpack_snags_workpack_id_snag_no_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_snags
    ADD CONSTRAINT workpack_snags_workpack_id_snag_no_unique UNIQUE (workpack_id, snag_no);


--
-- Name: workpack_sources workpack_sources_execution_id_source_type_reference_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_sources
    ADD CONSTRAINT workpack_sources_execution_id_source_type_reference_unique UNIQUE (execution_id, source_type, reference);


--
-- Name: workpack_sources workpack_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_sources
    ADD CONSTRAINT workpack_sources_pkey PRIMARY KEY (id);


--
-- Name: workpack_tasks workpack_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_tasks
    ADD CONSTRAINT workpack_tasks_pkey PRIMARY KEY (workpack_id, task_id);


--
-- Name: workpacks workpacks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpacks
    ADD CONSTRAINT workpacks_pkey PRIMARY KEY (id);


--
-- Name: workpacks workpacks_work_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpacks
    ADD CONSTRAINT workpacks_work_order_number_key UNIQUE (work_order_number);


--
-- Name: aircraft_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aircraft_is_active_idx ON public.aircraft USING btree (is_active);


--
-- Name: aircraft_model_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aircraft_model_id_idx ON public.aircraft USING btree (model_id);


--
-- Name: aircraft_sb_compliance_aircraft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aircraft_sb_compliance_aircraft_id ON public.aircraft_sb_compliance USING btree (aircraft_id);


--
-- Name: aircraft_sb_compliance_service_bulletin_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aircraft_sb_compliance_service_bulletin_id ON public.aircraft_sb_compliance USING btree (service_bulletin_id);


--
-- Name: aircraft_sb_compliance_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aircraft_sb_compliance_status ON public.aircraft_sb_compliance USING btree (status);


--
-- Name: aircraft_sid_status_aircraft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aircraft_sid_status_aircraft_id ON public.aircraft_sid_status USING btree (aircraft_id);


--
-- Name: aircraft_sid_status_sid_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aircraft_sid_status_sid_id ON public.aircraft_sid_status USING btree (sid_id);


--
-- Name: aircraft_sid_status_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aircraft_sid_status_status ON public.aircraft_sid_status USING btree (status);


--
-- Name: aircraft_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aircraft_status_idx ON public.aircraft USING btree (status);


--
-- Name: audit_log_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_actor_id_idx ON public.audit_log USING btree (actor_id);


--
-- Name: audit_log_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_created_at_idx ON public.audit_log USING btree (created_at);


--
-- Name: audit_log_row_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_row_id_idx ON public.audit_log USING btree (row_id);


--
-- Name: audit_log_table_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_table_name_idx ON public.audit_log USING btree (table_name);


--
-- Name: cessna_sids_section_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cessna_sids_section_idx ON public.cessna_sids USING btree (section_reference);


--
-- Name: cessna_sids_sid_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cessna_sids_sid_number_idx ON public.cessna_sids USING btree (sid_number);


--
-- Name: component_models_manufacturer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX component_models_manufacturer_id_idx ON public.component_models USING btree (manufacturer_id);


--
-- Name: component_models_model_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX component_models_model_name_idx ON public.component_models USING btree (model_name);


--
-- Name: idx_unique_active_component; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_unique_active_component ON public.aircraft_components USING btree (aircraft_id, model_id) WHERE ((current_status)::text = 'INSTALLED'::text);


--
-- Name: maintenance_requirements_model_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maintenance_requirements_model_id_idx ON public.maintenance_requirements USING btree (model_id);


--
-- Name: manufacturers_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX manufacturers_code_idx ON public.manufacturers USING btree (code);


--
-- Name: manufacturers_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX manufacturers_name_idx ON public.manufacturers USING btree (name);


--
-- Name: model_sids_model_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_sids_model_id ON public.model_sids USING btree (model_id);


--
-- Name: model_sids_sid_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_sids_sid_id ON public.model_sids USING btree (sid_id);


--
-- Name: rf_aircraft_category_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rf_aircraft_category_code_idx ON public.rf_aircraft_category USING btree (code);


--
-- Name: rf_asset_type_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rf_asset_type_code_idx ON public.rf_asset_type USING btree (code);


--
-- Name: rf_component_categories_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rf_component_categories_code_idx ON public.rf_component_categories USING btree (code);


--
-- Name: rf_component_condition_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rf_component_condition_code_idx ON public.rf_component_condition USING btree (code);


--
-- Name: rf_permission_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rf_permission_code_idx ON public.rf_permission USING btree (code);


--
-- Name: rf_role_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rf_role_code_idx ON public.rf_role USING btree (code);


--
-- Name: rf_signoff_role_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rf_signoff_role_code_idx ON public.rf_signoff_role USING btree (code);


--
-- Name: rf_task_state_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rf_task_state_code_idx ON public.rf_task_state USING btree (code);


--
-- Name: rf_workpack_status_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rf_workpack_status_code_idx ON public.rf_workpack_status USING btree (code);


--
-- Name: sb_models_model_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sb_models_model_idx ON public.service_bulletin_models USING btree (model_id);


--
-- Name: sb_models_sb_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sb_models_sb_idx ON public.service_bulletin_models USING btree (service_bulletin_id);


--
-- Name: sb_models_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sb_models_unique ON public.service_bulletin_models USING btree (service_bulletin_id, model_id);


--
-- Name: service_bulletins_sb_number_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX service_bulletins_sb_number_unique ON public.service_bulletins USING btree (sb_number);


--
-- Name: service_bulletins_source_primary_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_bulletins_source_primary_idx ON public.service_bulletins USING btree (source_primary);


--
-- Name: service_bulletins_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_bulletins_status_idx ON public.service_bulletins USING btree (status);


--
-- Name: sessions_expire_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_expire_idx ON public.sessions USING btree (expire);


--
-- Name: task_cards_aircraft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_cards_aircraft_id ON public.task_cards USING btree (aircraft_id);


--
-- Name: task_cards_service_bulletin_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_cards_service_bulletin_id_idx ON public.task_cards USING btree (service_bulletin_id);


--
-- Name: task_cards_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_cards_status ON public.task_cards USING btree (status);


--
-- Name: task_cards_task_card_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_cards_task_card_number ON public.task_cards USING btree (task_card_number);


--
-- Name: task_templates_aircraft_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_templates_aircraft_idx ON public.task_templates USING btree (aircraft_id);


--
-- Name: task_templates_model_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_templates_model_idx ON public.task_templates USING btree (aircraft_model_id);


--
-- Name: task_templates_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_templates_number_idx ON public.task_templates USING btree (task_card_number);


--
-- Name: task_templates_scope_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_templates_scope_idx ON public.task_templates USING btree (scope);


--
-- Name: task_templates_sort_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_templates_sort_order_idx ON public.task_templates USING btree (sort_order);


--
-- Name: users_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_is_active_index ON public.users USING btree (is_active);


--
-- Name: workpack_audit_log_action_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_audit_log_action_index ON public.workpack_audit_log USING btree (action);


--
-- Name: workpack_audit_log_execution_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_audit_log_execution_id_index ON public.workpack_audit_log USING btree (execution_id);


--
-- Name: workpack_audit_log_sequence_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_audit_log_sequence_index ON public.workpack_audit_log USING btree (sequence);


--
-- Name: workpack_executions_certified_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_executions_certified_by_idx ON public.workpack_executions USING btree (certified_by);


--
-- Name: workpack_executions_completed_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_executions_completed_by_idx ON public.workpack_executions USING btree (completed_by);


--
-- Name: workpack_executions_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_executions_created_at_idx ON public.workpack_executions USING btree (created_at);


--
-- Name: workpack_executions_started_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_executions_started_by_idx ON public.workpack_executions USING btree (started_by);


--
-- Name: workpack_executions_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_executions_status_idx ON public.workpack_executions USING btree (status);


--
-- Name: workpack_executions_task_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_executions_task_id_idx ON public.workpack_executions USING btree (task_id);


--
-- Name: workpack_executions_workpack_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_executions_workpack_id_idx ON public.workpack_executions USING btree (workpack_id);


--
-- Name: workpack_measurements_execution_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_measurements_execution_id_index ON public.workpack_measurements USING btree (execution_id);


--
-- Name: workpack_measurements_field_key_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_measurements_field_key_index ON public.workpack_measurements USING btree (field_key);


--
-- Name: workpack_measurements_position_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_measurements_position_index ON public.workpack_measurements USING btree ("position");


--
-- Name: workpack_signatures_execution_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_signatures_execution_id_index ON public.workpack_signatures USING btree (execution_id);


--
-- Name: workpack_signatures_role_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_signatures_role_index ON public.workpack_signatures USING btree (role);


--
-- Name: workpack_signatures_signature_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_signatures_signature_type_index ON public.workpack_signatures USING btree (signature_type);


--
-- Name: workpack_signatures_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_signatures_user_id_index ON public.workpack_signatures USING btree (user_id);


--
-- Name: workpack_snag_audit_log_action_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_snag_audit_log_action_index ON public.workpack_snag_audit_log USING btree (action);


--
-- Name: workpack_snag_audit_log_sequence_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_snag_audit_log_sequence_index ON public.workpack_snag_audit_log USING btree (sequence);


--
-- Name: workpack_snag_audit_log_snag_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_snag_audit_log_snag_id_index ON public.workpack_snag_audit_log USING btree (snag_id);


--
-- Name: workpack_snag_audit_log_workpack_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_snag_audit_log_workpack_id_index ON public.workpack_snag_audit_log USING btree (workpack_id);


--
-- Name: workpack_snags_completed_by_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_snags_completed_by_index ON public.workpack_snags USING btree (completed_by);


--
-- Name: workpack_snags_reported_by_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_snags_reported_by_index ON public.workpack_snags USING btree (reported_by);


--
-- Name: workpack_snags_started_by_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_snags_started_by_index ON public.workpack_snags USING btree (started_by);


--
-- Name: workpack_snags_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_snags_status_index ON public.workpack_snags USING btree (status);


--
-- Name: workpack_snags_status_workpack_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_snags_status_workpack_idx ON public.workpack_snags USING btree (status, workpack_id);


--
-- Name: workpack_snags_workpack_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_snags_workpack_id_index ON public.workpack_snags USING btree (workpack_id);


--
-- Name: workpack_sources_execution_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_sources_execution_id_index ON public.workpack_sources USING btree (execution_id);


--
-- Name: workpack_sources_reference_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_sources_reference_index ON public.workpack_sources USING btree (reference);


--
-- Name: workpack_sources_source_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_sources_source_type_index ON public.workpack_sources USING btree (source_type);


--
-- Name: aircraft tr_audit_aircraft; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_audit_aircraft AFTER INSERT OR UPDATE ON public.aircraft FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();


--
-- Name: rf_permission tr_audit_rf_permission; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_audit_rf_permission AFTER INSERT OR DELETE OR UPDATE ON public.rf_permission FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();


--
-- Name: rf_role_permissions tr_audit_rf_role_permissions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_audit_rf_role_permissions AFTER INSERT OR DELETE OR UPDATE ON public.rf_role_permissions FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();


--
-- Name: task_cards tr_audit_tasks; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tr_audit_tasks AFTER INSERT OR UPDATE ON public.task_cards FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();


--
-- Name: aircraft aircraft_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft
    ADD CONSTRAINT aircraft_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.rf_aircraft_category(id);


--
-- Name: aircraft_components aircraft_components_aircraft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft_components
    ADD CONSTRAINT aircraft_components_aircraft_id_fkey FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(id) ON DELETE CASCADE;


--
-- Name: aircraft_components aircraft_components_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft_components
    ADD CONSTRAINT aircraft_components_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.component_models(id);


--
-- Name: aircraft aircraft_model_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft
    ADD CONSTRAINT aircraft_model_id_fk FOREIGN KEY (model_id) REFERENCES public.component_models(id) ON DELETE RESTRICT;


--
-- Name: aircraft_sb_compliance aircraft_sb_compliance_aircraft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft_sb_compliance
    ADD CONSTRAINT aircraft_sb_compliance_aircraft_id_fkey FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(id) ON DELETE CASCADE;


--
-- Name: aircraft_sb_compliance aircraft_sb_compliance_service_bulletin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft_sb_compliance
    ADD CONSTRAINT aircraft_sb_compliance_service_bulletin_id_fkey FOREIGN KEY (service_bulletin_id) REFERENCES public.service_bulletins(id) ON DELETE CASCADE;


--
-- Name: aircraft_sid_status aircraft_sid_status_aircraft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft_sid_status
    ADD CONSTRAINT aircraft_sid_status_aircraft_id_fkey FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(id) ON DELETE CASCADE;


--
-- Name: aircraft_sid_status aircraft_sid_status_sid_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft_sid_status
    ADD CONSTRAINT aircraft_sid_status_sid_id_fkey FOREIGN KEY (sid_id) REFERENCES public.cessna_sids(id) ON DELETE CASCADE;


--
-- Name: audit_log audit_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: component_models component_models_asset_type_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_models
    ADD CONSTRAINT component_models_asset_type_fk FOREIGN KEY (asset_type_id) REFERENCES public.rf_asset_type(id) ON DELETE RESTRICT;


--
-- Name: component_models component_models_asset_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_models
    ADD CONSTRAINT component_models_asset_type_id_fkey FOREIGN KEY (asset_type_id) REFERENCES public.rf_asset_type(id);


--
-- Name: component_models component_models_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_models
    ADD CONSTRAINT component_models_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.rf_component_categories(id);


--
-- Name: component_models component_models_manufacturer_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_models
    ADD CONSTRAINT component_models_manufacturer_fk FOREIGN KEY (manufacturer_id) REFERENCES public.manufacturers(id) ON DELETE RESTRICT;


--
-- Name: maintenance_requirements maintenance_requirements_model_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requirements
    ADD CONSTRAINT maintenance_requirements_model_id_fk FOREIGN KEY (model_id) REFERENCES public.component_models(id) ON DELETE RESTRICT;


--
-- Name: model_sids model_sids_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_sids
    ADD CONSTRAINT model_sids_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.component_models(id) ON DELETE CASCADE;


--
-- Name: model_sids model_sids_sid_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_sids
    ADD CONSTRAINT model_sids_sid_id_fkey FOREIGN KEY (sid_id) REFERENCES public.cessna_sids(id) ON DELETE CASCADE;


--
-- Name: rf_role_permissions rf_role_permissions_permission_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_role_permissions
    ADD CONSTRAINT rf_role_permissions_permission_fk FOREIGN KEY (permission_id) REFERENCES public.rf_permission(id) ON DELETE CASCADE;


--
-- Name: rf_role_permissions rf_role_permissions_role_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_role_permissions
    ADD CONSTRAINT rf_role_permissions_role_fk FOREIGN KEY (role_id) REFERENCES public.rf_role(id) ON DELETE CASCADE;


--
-- Name: service_bulletin_models sb_models_model_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_bulletin_models
    ADD CONSTRAINT sb_models_model_fk FOREIGN KEY (model_id) REFERENCES public.component_models(id) ON DELETE CASCADE;


--
-- Name: service_bulletin_models sb_models_sb_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_bulletin_models
    ADD CONSTRAINT sb_models_sb_fk FOREIGN KEY (service_bulletin_id) REFERENCES public.service_bulletins(id) ON DELETE CASCADE;


--
-- Name: task_cards task_cards_aircraft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_cards
    ADD CONSTRAINT task_cards_aircraft_id_fkey FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(id);


--
-- Name: task_cards task_cards_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_cards
    ADD CONSTRAINT task_cards_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: task_cards task_cards_signed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_cards
    ADD CONSTRAINT task_cards_signed_by_fkey FOREIGN KEY (signed_by) REFERENCES public.users(id);


--
-- Name: task_templates task_templates_aircraft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_templates
    ADD CONSTRAINT task_templates_aircraft_id_fkey FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(id) ON DELETE CASCADE;


--
-- Name: task_templates task_templates_aircraft_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_templates
    ADD CONSTRAINT task_templates_aircraft_model_id_fkey FOREIGN KEY (aircraft_model_id) REFERENCES public.component_models(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.rf_role(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workpack_audit_log workpack_audit_log_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_audit_log
    ADD CONSTRAINT workpack_audit_log_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.workpack_executions(id) ON DELETE CASCADE;


--
-- Name: workpack_audit_log workpack_audit_log_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_audit_log
    ADD CONSTRAINT workpack_audit_log_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task_cards(id) ON DELETE CASCADE;


--
-- Name: workpack_audit_log workpack_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_audit_log
    ADD CONSTRAINT workpack_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workpack_audit_log workpack_audit_log_workpack_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_audit_log
    ADD CONSTRAINT workpack_audit_log_workpack_id_fkey FOREIGN KEY (workpack_id) REFERENCES public.workpacks(id) ON DELETE CASCADE;


--
-- Name: workpack_executions workpack_executions_certified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_executions
    ADD CONSTRAINT workpack_executions_certified_by_fkey FOREIGN KEY (certified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workpack_executions workpack_executions_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_executions
    ADD CONSTRAINT workpack_executions_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workpack_executions workpack_executions_started_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_executions
    ADD CONSTRAINT workpack_executions_started_by_fkey FOREIGN KEY (started_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workpack_executions workpack_executions_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_executions
    ADD CONSTRAINT workpack_executions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task_cards(id) ON DELETE CASCADE;


--
-- Name: workpack_executions workpack_executions_workpack_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_executions
    ADD CONSTRAINT workpack_executions_workpack_id_fkey FOREIGN KEY (workpack_id) REFERENCES public.workpacks(id) ON DELETE CASCADE;


--
-- Name: workpack_measurements workpack_measurements_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_measurements
    ADD CONSTRAINT workpack_measurements_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.workpack_executions(id) ON DELETE CASCADE;


--
-- Name: workpack_requirements workpack_requirements_workpack_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_requirements
    ADD CONSTRAINT workpack_requirements_workpack_id_fkey FOREIGN KEY (workpack_id) REFERENCES public.workpacks(id) ON DELETE CASCADE;


--
-- Name: workpack_signatures workpack_signatures_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_signatures
    ADD CONSTRAINT workpack_signatures_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.workpack_executions(id) ON DELETE CASCADE;


--
-- Name: workpack_signatures workpack_signatures_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_signatures
    ADD CONSTRAINT workpack_signatures_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: workpack_snag_audit_log workpack_snag_audit_log_snag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_snag_audit_log
    ADD CONSTRAINT workpack_snag_audit_log_snag_id_fkey FOREIGN KEY (snag_id) REFERENCES public.workpack_snags(id) ON DELETE CASCADE;


--
-- Name: workpack_snag_audit_log workpack_snag_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_snag_audit_log
    ADD CONSTRAINT workpack_snag_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workpack_snag_audit_log workpack_snag_audit_log_workpack_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_snag_audit_log
    ADD CONSTRAINT workpack_snag_audit_log_workpack_id_fkey FOREIGN KEY (workpack_id) REFERENCES public.workpacks(id) ON DELETE CASCADE;


--
-- Name: workpack_snags workpack_snags_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_snags
    ADD CONSTRAINT workpack_snags_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workpack_snags workpack_snags_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_snags
    ADD CONSTRAINT workpack_snags_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workpack_snags workpack_snags_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_snags
    ADD CONSTRAINT workpack_snags_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workpack_snags workpack_snags_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_snags
    ADD CONSTRAINT workpack_snags_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workpack_snags workpack_snags_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_snags
    ADD CONSTRAINT workpack_snags_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workpack_snags workpack_snags_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_snags
    ADD CONSTRAINT workpack_snags_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workpack_snags workpack_snags_started_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_snags
    ADD CONSTRAINT workpack_snags_started_by_fkey FOREIGN KEY (started_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workpack_snags workpack_snags_workpack_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_snags
    ADD CONSTRAINT workpack_snags_workpack_id_fkey FOREIGN KEY (workpack_id) REFERENCES public.workpacks(id) ON DELETE CASCADE;


--
-- Name: workpack_sources workpack_sources_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_sources
    ADD CONSTRAINT workpack_sources_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.workpack_executions(id) ON DELETE CASCADE;


--
-- Name: workpack_tasks workpack_tasks_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_tasks
    ADD CONSTRAINT workpack_tasks_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task_cards(id) ON DELETE RESTRICT;


--
-- Name: workpack_tasks workpack_tasks_workpack_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_tasks
    ADD CONSTRAINT workpack_tasks_workpack_id_fkey FOREIGN KEY (workpack_id) REFERENCES public.workpacks(id) ON DELETE CASCADE;


--
-- Name: workpacks workpacks_aircraft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpacks
    ADD CONSTRAINT workpacks_aircraft_id_fkey FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(id) ON DELETE RESTRICT;


--
-- Name: workpacks workpacks_certified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpacks
    ADD CONSTRAINT workpacks_certified_by_fkey FOREIGN KEY (certified_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workpacks workpacks_qa_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpacks
    ADD CONSTRAINT workpacks_qa_reviewed_by_fkey FOREIGN KEY (qa_reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workpacks workpacks_released_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpacks
    ADD CONSTRAINT workpacks_released_by_fkey FOREIGN KEY (released_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workpacks workpacks_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpacks
    ADD CONSTRAINT workpacks_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.rf_workpack_status(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

