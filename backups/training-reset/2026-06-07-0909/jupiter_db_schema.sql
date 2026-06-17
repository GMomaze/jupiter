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
-- Name: ad_relationships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_relationships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ad_id uuid NOT NULL,
    related_ad_number character varying(255),
    relationship_type character varying(255)
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
-- Name: aircraft_compliance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aircraft_compliance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aircraft_id uuid NOT NULL,
    compliance_item_id uuid NOT NULL,
    status character varying(255) DEFAULT 'DUE'::character varying NOT NULL,
    last_complied_at timestamp with time zone,
    next_due_at timestamp with time zone,
    last_complied_hours numeric(10,2),
    next_due_hours numeric(10,2),
    compliance_method character varying(255),
    complied_workpack_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT aircraft_compliance_status_check CHECK (((status)::text = ANY ((ARRAY['DUE'::character varying, 'IN_PROGRESS'::character varying, 'COMPLIANT'::character varying, 'NOT_APPLICABLE'::character varying])::text[])))
);


--
-- Name: aircraft_component_installations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aircraft_component_installations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aircraft_id uuid NOT NULL,
    serialized_component_id uuid NOT NULL,
    installation_context character varying(255) DEFAULT 'MAINTENANCE_INSTALL'::character varying NOT NULL,
    installed_at date NOT NULL,
    removed_at date,
    "position" character varying(255),
    install_tsn numeric(10,2),
    install_tso numeric(10,2),
    removal_tsn numeric(10,2),
    removal_tso numeric(10,2),
    installed_by uuid,
    removed_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
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
-- Name: airworthiness_directives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.airworthiness_directives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ad_number character varying(255) NOT NULL,
    revision character varying(255),
    subject_heading text,
    subject text,
    summary text,
    comments text,
    status character varying(255),
    cfr_part_reference character varying(255),
    effective_date date,
    authority character varying(255),
    service_office character varying(255),
    primary_responsibility_office character varying(255),
    docket_number character varying(255),
    citation text,
    citation_publish_date date,
    make text,
    model text,
    product_type character varying(255),
    product_subtype character varying(255),
    is_recurring boolean,
    interval_hours integer,
    interval_months integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
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
-- Name: compliance_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    compliance_item_id uuid NOT NULL,
    assignment_type character varying(255) NOT NULL,
    model_id uuid,
    aircraft_id uuid,
    assignment_source character varying(255) DEFAULT 'MANUAL'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT compliance_assignments_assignment_source_check CHECK (((assignment_source)::text = ANY ((ARRAY['AUTO'::character varying, 'MANUAL'::character varying])::text[]))),
    CONSTRAINT compliance_assignments_assignment_type_check CHECK (((assignment_type)::text = ANY ((ARRAY['MODEL'::character varying, 'AIRCRAFT'::character varying])::text[]))),
    CONSTRAINT compliance_assignments_target_check CHECK (((((assignment_type)::text = 'MODEL'::text) AND (model_id IS NOT NULL) AND (aircraft_id IS NULL)) OR (((assignment_type)::text = 'AIRCRAFT'::text) AND (aircraft_id IS NOT NULL))))
);


--
-- Name: compliance_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    item_type character varying(255) NOT NULL,
    code character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    authority character varying(255),
    revision character varying(255),
    issued_on date,
    effective_on date,
    source_table character varying(255),
    source_id uuid NOT NULL,
    compliance_basis character varying(255) DEFAULT 'MANUAL'::character varying NOT NULL,
    status character varying(255) DEFAULT 'ACTIVE'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    source_type character varying(255) NOT NULL,
    CONSTRAINT compliance_items_compliance_basis_check CHECK (((compliance_basis)::text = ANY ((ARRAY['MANDATORY'::character varying, 'RECOMMENDED'::character varying, 'MANUAL'::character varying])::text[]))),
    CONSTRAINT compliance_items_item_type_check CHECK (((item_type)::text = ANY ((ARRAY['AD'::character varying, 'SB'::character varying])::text[]))),
    CONSTRAINT compliance_items_source_type_check CHECK (((source_type)::text = ANY ((ARRAY['AD'::character varying, 'SB'::character varying])::text[]))),
    CONSTRAINT compliance_items_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'SUPERSEDED'::character varying, 'CANCELLED'::character varying, 'INACTIVE'::character varying])::text[])))
);


--
-- Name: component_life_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.component_life_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    component_model_id uuid NOT NULL,
    limit_type character varying(255) NOT NULL,
    basis character varying(255) NOT NULL,
    limit_hours numeric(10,2),
    limit_cycles integer,
    limit_months integer,
    description text,
    is_active boolean DEFAULT true NOT NULL,
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
-- Name: customer_aircraft_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_aircraft_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    aircraft_id uuid NOT NULL,
    relationship_type character varying(255) NOT NULL,
    is_current boolean DEFAULT true NOT NULL,
    start_date date NOT NULL,
    end_date date,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT customer_aircraft_links_date_range_check CHECK (((end_date IS NULL) OR (end_date >= start_date))),
    CONSTRAINT customer_aircraft_links_relationship_type_check CHECK (((relationship_type)::text = ANY ((ARRAY['OWNER'::character varying, 'CO_OWNER'::character varying, 'OPERATOR'::character varying, 'BILLING_CUSTOMER'::character varying, 'MANAGEMENT_COMPANY'::character varying, 'CONTACT_ONLY'::character varying])::text[])))
);


--
-- Name: customer_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    email character varying(255) NOT NULL,
    display_name character varying(255) NOT NULL,
    password_hash character varying(255),
    status character varying(255) DEFAULT 'INVITED'::character varying NOT NULL,
    invite_token_hash character varying(255),
    invite_expires_at timestamp with time zone,
    password_reset_token_hash character varying(255),
    password_reset_expires_at timestamp with time zone,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT customer_users_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INVITED'::character varying, 'DISABLED'::character varying])::text[])))
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    contact_person character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(255) NOT NULL,
    alternate_phone character varying(255),
    billing_address_line_1 character varying(255),
    billing_address_line_2 character varying(255),
    billing_city character varying(255),
    billing_state_or_province character varying(255),
    billing_postal_code character varying(255),
    billing_country character varying(255),
    physical_address_line_1 character varying(255),
    physical_address_line_2 character varying(255),
    physical_city character varying(255),
    physical_state_or_province character varying(255),
    physical_postal_code character varying(255),
    physical_country character varying(255),
    vat_number character varying(255),
    tax_number character varying(255),
    account_reference character varying(255),
    status character varying(255) DEFAULT 'ACTIVE'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT customers_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))
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
-- Name: maintenance_template_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_template_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_id uuid NOT NULL,
    item_type character varying(255) NOT NULL,
    item_id uuid NOT NULL,
    sequence_no integer NOT NULL,
    is_required boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT maintenance_template_items_item_type_check CHECK (((item_type)::text = ANY ((ARRAY['STANDARD_TASK'::character varying, 'COMPLIANCE_ITEM'::character varying, 'SID'::character varying])::text[])))
);


--
-- Name: maintenance_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    template_type character varying(255) NOT NULL,
    model_id uuid NOT NULL,
    interval_hours integer,
    interval_months integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT maintenance_templates_template_type_check CHECK (((template_type)::text = ANY ((ARRAY['MPI'::character varying, 'ANNUAL'::character varying, 'CUSTOM'::character varying])::text[])))
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
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    current_owner text,
    is_operational boolean DEFAULT true,
    support_email text,
    support_phone text,
    notes text
);


--
-- Name: migration_batch_rows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migration_batch_rows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    source_table character varying(255) NOT NULL,
    source_row_id uuid NOT NULL,
    migration_category character varying(255),
    decision character varying(255),
    status character varying(255) DEFAULT 'PENDING'::character varying NOT NULL,
    source_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    planned_target_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    actual_target_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    warnings jsonb DEFAULT '[]'::jsonb NOT NULL,
    conflicts jsonb DEFAULT '[]'::jsonb NOT NULL,
    failure_reason text,
    rollback_status character varying(255),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT migration_batch_rows_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'MIGRATED'::character varying, 'FAILED'::character varying, 'SKIPPED'::character varying, 'ROLLED_BACK'::character varying])::text[])))
);


--
-- Name: migration_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migration_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    migration_type character varying(255) NOT NULL,
    status character varying(255) DEFAULT 'DRAFT'::character varying NOT NULL,
    created_by uuid,
    approved_by uuid,
    executed_by uuid,
    rolled_back_by uuid,
    approved_at timestamp with time zone,
    executed_at timestamp with time zone,
    rolled_back_at timestamp with time zone,
    dry_run_summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    execution_summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    rollback_summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    report_reference text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT migration_batches_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'DRY_RUN'::character varying, 'APPROVED'::character varying, 'EXECUTING'::character varying, 'COMPLETE'::character varying, 'FAILED'::character varying, 'ROLLED_BACK'::character varying, 'PARTIALLY_ROLLED_BACK'::character varying])::text[])))
);


--
-- Name: migration_created_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migration_created_targets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    batch_row_id uuid NOT NULL,
    target_table character varying(255) NOT NULL,
    target_row_id uuid NOT NULL,
    created_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    rollback_action character varying(255),
    rollback_status character varying(255) DEFAULT 'PENDING'::character varying NOT NULL,
    rollback_timestamp timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
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
-- Name: planning_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planning_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    aircraft_id uuid NOT NULL,
    template_id uuid NOT NULL,
    maintenance_type character varying(255) NOT NULL,
    candidate_content jsonb DEFAULT '{}'::jsonb NOT NULL,
    selected_item_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    status character varying(255) DEFAULT 'DRAFT'::character varying NOT NULL,
    generated_workpack_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by uuid,
    finalized_by uuid,
    finalized_at timestamp with time zone,
    CONSTRAINT planning_sessions_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'IN_PROGRESS'::character varying, 'READY_FOR_GENERATION'::character varying, 'GENERATED'::character varying])::text[])))
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
-- Name: rf_workpack_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rf_workpack_type (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(255) NOT NULL,
    label character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    system_locked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sb_model_applicability_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sb_model_applicability_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_bulletin_id uuid NOT NULL,
    raw_models_affected_text text NOT NULL,
    parsed_token text,
    normalized_token text,
    classification character varying(255) NOT NULL,
    status character varying(255) NOT NULL,
    matched_model_id uuid,
    allocated_model_id uuid,
    created_model_id uuid,
    source_row integer,
    source_column character varying(255),
    source_adapter character varying(255) NOT NULL,
    source_hash character varying(64) NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    review_notes text,
    ignored_reason text,
    parsed_tokens jsonb DEFAULT '[]'::jsonb NOT NULL,
    matched_models jsonb DEFAULT '[]'::jsonb NOT NULL,
    unmatched_tokens jsonb DEFAULT '[]'::jsonb NOT NULL,
    shorthand_expansions jsonb DEFAULT '[]'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT sb_model_applicability_allocations_classification_check CHECK (((classification)::text = ANY ((ARRAY['EXACT_MODEL_CODE'::character varying, 'SHORTHAND_GROUP'::character varying, 'BROAD_APPLICABILITY'::character varying, 'AMBIGUOUS_PHRASE'::character varying, 'UNPARSED_TEXT'::character varying])::text[]))),
    CONSTRAINT sb_model_applicability_allocations_status_check CHECK (((status)::text = ANY ((ARRAY['MATCHED'::character varying, 'NEEDS_REVIEW'::character varying, 'LINKED_MANUALLY'::character varying, 'MODEL_CREATED_INCOMPLETE'::character varying, 'BROAD_RULE_MARKED'::character varying, 'IGNORED'::character varying])::text[])))
);


--
-- Name: serialized_component_life_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.serialized_component_life_states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    serialized_component_id uuid NOT NULL,
    tsn_hours numeric(10,2),
    tso_hours numeric(10,2),
    csn_cycles integer,
    cso_cycles integer,
    overhaul_reference_date date,
    calendar_reference_date date,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: serialized_component_maintenance_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.serialized_component_maintenance_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    serialized_component_id uuid NOT NULL,
    event_type character varying(255) NOT NULL,
    occurred_at timestamp with time zone,
    recorded_by uuid,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: serialized_components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.serialized_components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    component_model_id uuid NOT NULL,
    serial_number character varying(255) NOT NULL,
    part_number character varying(255),
    status character varying(255) DEFAULT 'AVAILABLE'::character varying NOT NULL,
    condition character varying(255),
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
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
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    manufacturer character varying(255) DEFAULT 'UNKNOWN'::character varying NOT NULL,
    reference character varying(255) NOT NULL,
    issue_date date,
    category character varying(255),
    applicability_make character varying(255),
    applicability_model text,
    applicability_product_type character varying(255),
    applicability_notes text,
    summary text,
    compliance_requirement character varying(255) DEFAULT 'MANUAL'::character varying,
    source_file text,
    source_format character varying(255) DEFAULT 'MANUAL'::character varying,
    raw_source_text text,
    is_active boolean DEFAULT true NOT NULL
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
-- Name: sid_model_applicability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sid_model_applicability (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sid_id uuid NOT NULL,
    model_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: supplemental_inspection_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplemental_inspection_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    manufacturer character varying(255) NOT NULL,
    reference character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    category character varying(255),
    section_reference character varying(255),
    ata_chapter character varying(255),
    initial_interval_hours integer,
    initial_interval_months integer,
    repeat_interval_hours integer,
    repeat_interval_months integer,
    inspection_operation character varying(255),
    notes text,
    source_document character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
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
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    compliance_item_id uuid
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
    is_required_for_wood boolean DEFAULT false NOT NULL,
    is_required_for_fabric boolean DEFAULT false NOT NULL,
    is_required_for_bungees boolean DEFAULT false NOT NULL,
    is_required_for_woodprop boolean DEFAULT false NOT NULL,
    is_required_for_retractable boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    source_type character varying(255),
    interval_hours integer,
    interval_months integer,
    model_applicability text,
    aircraft_applicability text
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
-- Name: workpack_compliance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workpack_compliance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workpack_id uuid NOT NULL,
    compliance_item_id uuid NOT NULL,
    task_id uuid,
    status character varying(255) DEFAULT 'PLANNED'::character varying NOT NULL,
    linked_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT workpack_compliance_status_check CHECK (((status)::text = ANY ((ARRAY['PLANNED'::character varying, 'IN_PROGRESS'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying])::text[])))
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
    aircraft_id uuid NOT NULL,
    component_id uuid,
    defect_text text NOT NULL,
    CONSTRAINT workpack_snags_aircraft_component_match_check CHECK (((component_id IS NULL) OR (aircraft_id IS NOT NULL))),
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
    released_at timestamp with time zone,
    planning_session_id uuid
);


--
-- Name: SequelizeMeta SequelizeMeta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SequelizeMeta"
    ADD CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY (name);


--
-- Name: ad_relationships ad_relationships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_relationships
    ADD CONSTRAINT ad_relationships_pkey PRIMARY KEY (id);


--
-- Name: aircraft_compliance aircraft_compliance_aircraft_item_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft_compliance
    ADD CONSTRAINT aircraft_compliance_aircraft_item_unique UNIQUE (aircraft_id, compliance_item_id);


--
-- Name: aircraft_compliance aircraft_compliance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft_compliance
    ADD CONSTRAINT aircraft_compliance_pkey PRIMARY KEY (id);


--
-- Name: aircraft_component_installations aircraft_component_installations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft_component_installations
    ADD CONSTRAINT aircraft_component_installations_pkey PRIMARY KEY (id);


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
-- Name: airworthiness_directives airworthiness_directives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.airworthiness_directives
    ADD CONSTRAINT airworthiness_directives_pkey PRIMARY KEY (id);


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
-- Name: compliance_assignments compliance_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_assignments
    ADD CONSTRAINT compliance_assignments_pkey PRIMARY KEY (id);


--
-- Name: compliance_items compliance_items_item_type_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_items
    ADD CONSTRAINT compliance_items_item_type_code_unique UNIQUE (item_type, code);


--
-- Name: compliance_items compliance_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_items
    ADD CONSTRAINT compliance_items_pkey PRIMARY KEY (id);


--
-- Name: compliance_items compliance_items_source_type_source_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_items
    ADD CONSTRAINT compliance_items_source_type_source_id_unique UNIQUE (source_type, source_id);


--
-- Name: component_life_limits component_life_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_life_limits
    ADD CONSTRAINT component_life_limits_pkey PRIMARY KEY (id);


--
-- Name: component_models component_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_models
    ADD CONSTRAINT component_models_pkey PRIMARY KEY (id);


--
-- Name: customer_aircraft_links customer_aircraft_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_aircraft_links
    ADD CONSTRAINT customer_aircraft_links_pkey PRIMARY KEY (id);


--
-- Name: customer_users customer_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_users
    ADD CONSTRAINT customer_users_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: maintenance_requirements maintenance_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requirements
    ADD CONSTRAINT maintenance_requirements_pkey PRIMARY KEY (id);


--
-- Name: maintenance_template_items maintenance_template_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_template_items
    ADD CONSTRAINT maintenance_template_items_pkey PRIMARY KEY (id);


--
-- Name: maintenance_template_items maintenance_template_items_template_id_sequence_no_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_template_items
    ADD CONSTRAINT maintenance_template_items_template_id_sequence_no_unique UNIQUE (template_id, sequence_no);


--
-- Name: maintenance_template_items maintenance_template_items_template_item_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_template_items
    ADD CONSTRAINT maintenance_template_items_template_item_unique UNIQUE (template_id, item_type, item_id);


--
-- Name: maintenance_templates maintenance_templates_model_id_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_templates
    ADD CONSTRAINT maintenance_templates_model_id_name_unique UNIQUE (model_id, name);


--
-- Name: maintenance_templates maintenance_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_templates
    ADD CONSTRAINT maintenance_templates_pkey PRIMARY KEY (id);


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
-- Name: migration_batch_rows migration_batch_rows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_batch_rows
    ADD CONSTRAINT migration_batch_rows_pkey PRIMARY KEY (id);


--
-- Name: migration_batches migration_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_batches
    ADD CONSTRAINT migration_batches_pkey PRIMARY KEY (id);


--
-- Name: migration_created_targets migration_created_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_created_targets
    ADD CONSTRAINT migration_created_targets_pkey PRIMARY KEY (id);


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
-- Name: planning_sessions planning_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_sessions
    ADD CONSTRAINT planning_sessions_pkey PRIMARY KEY (id);


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
-- Name: rf_workpack_type rf_workpack_type_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_workpack_type
    ADD CONSTRAINT rf_workpack_type_code_key UNIQUE (code);


--
-- Name: rf_workpack_type rf_workpack_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rf_workpack_type
    ADD CONSTRAINT rf_workpack_type_pkey PRIMARY KEY (id);


--
-- Name: sb_model_applicability_allocations sb_model_applicability_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sb_model_applicability_allocations
    ADD CONSTRAINT sb_model_applicability_allocations_pkey PRIMARY KEY (id);


--
-- Name: serialized_component_life_states serialized_component_life_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.serialized_component_life_states
    ADD CONSTRAINT serialized_component_life_states_pkey PRIMARY KEY (id);


--
-- Name: serialized_component_maintenance_events serialized_component_maintenance_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.serialized_component_maintenance_events
    ADD CONSTRAINT serialized_component_maintenance_events_pkey PRIMARY KEY (id);


--
-- Name: serialized_components serialized_components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.serialized_components
    ADD CONSTRAINT serialized_components_pkey PRIMARY KEY (id);


--
-- Name: service_bulletin_models service_bulletin_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_bulletin_models
    ADD CONSTRAINT service_bulletin_models_pkey PRIMARY KEY (id);


--
-- Name: service_bulletins service_bulletins_manufacturer_reference_revision_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_bulletins
    ADD CONSTRAINT service_bulletins_manufacturer_reference_revision_unique UNIQUE (manufacturer, reference, revision);


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
-- Name: sid_model_applicability sid_model_applicability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sid_model_applicability
    ADD CONSTRAINT sid_model_applicability_pkey PRIMARY KEY (id);


--
-- Name: sid_model_applicability sid_model_applicability_sid_id_model_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sid_model_applicability
    ADD CONSTRAINT sid_model_applicability_sid_id_model_id_unique UNIQUE (sid_id, model_id);


--
-- Name: supplemental_inspection_documents supplemental_inspection_documents_manufacturer_reference_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplemental_inspection_documents
    ADD CONSTRAINT supplemental_inspection_documents_manufacturer_reference_unique UNIQUE (manufacturer, reference);


--
-- Name: supplemental_inspection_documents supplemental_inspection_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplemental_inspection_documents
    ADD CONSTRAINT supplemental_inspection_documents_pkey PRIMARY KEY (id);


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
-- Name: workpack_compliance workpack_compliance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_compliance
    ADD CONSTRAINT workpack_compliance_pkey PRIMARY KEY (id);


--
-- Name: workpack_compliance workpack_compliance_workpack_item_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_compliance
    ADD CONSTRAINT workpack_compliance_workpack_item_unique UNIQUE (workpack_id, compliance_item_id);


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
-- Name: ad_relationships_ad_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ad_relationships_ad_id_index ON public.ad_relationships USING btree (ad_id);


--
-- Name: aircraft_compliance_aircraft_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aircraft_compliance_aircraft_id_index ON public.aircraft_compliance USING btree (aircraft_id);


--
-- Name: aircraft_compliance_compliance_item_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aircraft_compliance_compliance_item_id_index ON public.aircraft_compliance USING btree (compliance_item_id);


--
-- Name: aircraft_compliance_complied_workpack_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aircraft_compliance_complied_workpack_id_index ON public.aircraft_compliance USING btree (complied_workpack_id);


--
-- Name: aircraft_compliance_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aircraft_compliance_status_index ON public.aircraft_compliance USING btree (status);


--
-- Name: aircraft_component_installations_aircraft_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aircraft_component_installations_aircraft_id_index ON public.aircraft_component_installations USING btree (aircraft_id);


--
-- Name: aircraft_component_installations_aircraft_removed_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aircraft_component_installations_aircraft_removed_at_index ON public.aircraft_component_installations USING btree (aircraft_id, removed_at);


--
-- Name: aircraft_component_installations_serialized_component_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aircraft_component_installations_serialized_component_id_index ON public.aircraft_component_installations USING btree (serialized_component_id);


--
-- Name: aircraft_component_installations_serialized_installed_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX aircraft_component_installations_serialized_installed_at_index ON public.aircraft_component_installations USING btree (serialized_component_id, installed_at);


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
-- Name: airworthiness_directives_ad_number_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX airworthiness_directives_ad_number_index ON public.airworthiness_directives USING btree (ad_number);


--
-- Name: airworthiness_directives_ad_number_revision_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX airworthiness_directives_ad_number_revision_unique ON public.airworthiness_directives USING btree (ad_number, revision);


--
-- Name: airworthiness_directives_effective_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX airworthiness_directives_effective_date_index ON public.airworthiness_directives USING btree (effective_date);


--
-- Name: airworthiness_directives_product_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX airworthiness_directives_product_type_index ON public.airworthiness_directives USING btree (product_type);


--
-- Name: airworthiness_directives_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX airworthiness_directives_status_index ON public.airworthiness_directives USING btree (status);


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
-- Name: compliance_assignments_active_aircraft_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX compliance_assignments_active_aircraft_unique ON public.compliance_assignments USING btree (compliance_item_id, aircraft_id) WHERE ((is_active = true) AND ((assignment_type)::text = 'AIRCRAFT'::text));


--
-- Name: compliance_assignments_active_model_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX compliance_assignments_active_model_unique ON public.compliance_assignments USING btree (compliance_item_id, model_id) WHERE ((is_active = true) AND ((assignment_type)::text = 'MODEL'::text));


--
-- Name: compliance_assignments_aircraft_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compliance_assignments_aircraft_id_index ON public.compliance_assignments USING btree (aircraft_id);


--
-- Name: compliance_assignments_assignment_source_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compliance_assignments_assignment_source_index ON public.compliance_assignments USING btree (assignment_source);


--
-- Name: compliance_assignments_assignment_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compliance_assignments_assignment_type_index ON public.compliance_assignments USING btree (assignment_type);


--
-- Name: compliance_assignments_compliance_item_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compliance_assignments_compliance_item_id_index ON public.compliance_assignments USING btree (compliance_item_id);


--
-- Name: compliance_assignments_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compliance_assignments_is_active_index ON public.compliance_assignments USING btree (is_active);


--
-- Name: compliance_assignments_model_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compliance_assignments_model_id_index ON public.compliance_assignments USING btree (model_id);


--
-- Name: compliance_items_code_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compliance_items_code_index ON public.compliance_items USING btree (code);


--
-- Name: compliance_items_item_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compliance_items_item_type_index ON public.compliance_items USING btree (item_type);


--
-- Name: compliance_items_source_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compliance_items_source_id_index ON public.compliance_items USING btree (source_id);


--
-- Name: compliance_items_source_lookup_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compliance_items_source_lookup_index ON public.compliance_items USING btree (source_table, source_id);


--
-- Name: compliance_items_source_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compliance_items_source_type_index ON public.compliance_items USING btree (source_type);


--
-- Name: compliance_items_source_type_source_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compliance_items_source_type_source_id_index ON public.compliance_items USING btree (source_type, source_id);


--
-- Name: compliance_items_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX compliance_items_status_index ON public.compliance_items USING btree (status);


--
-- Name: component_life_limits_component_model_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX component_life_limits_component_model_id_index ON public.component_life_limits USING btree (component_model_id);


--
-- Name: component_life_limits_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX component_life_limits_is_active_index ON public.component_life_limits USING btree (is_active);


--
-- Name: component_models_manufacturer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX component_models_manufacturer_id_idx ON public.component_models USING btree (manufacturer_id);


--
-- Name: component_models_model_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX component_models_model_name_idx ON public.component_models USING btree (model_name);


--
-- Name: customer_aircraft_links_aircraft_current_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_aircraft_links_aircraft_current_index ON public.customer_aircraft_links USING btree (aircraft_id, is_current);


--
-- Name: customer_aircraft_links_aircraft_customer_role_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_aircraft_links_aircraft_customer_role_index ON public.customer_aircraft_links USING btree (aircraft_id, customer_id, relationship_type);


--
-- Name: customer_aircraft_links_aircraft_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_aircraft_links_aircraft_id_index ON public.customer_aircraft_links USING btree (aircraft_id);


--
-- Name: customer_aircraft_links_aircraft_role_current_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_aircraft_links_aircraft_role_current_index ON public.customer_aircraft_links USING btree (aircraft_id, relationship_type, is_current);


--
-- Name: customer_aircraft_links_customer_current_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_aircraft_links_customer_current_index ON public.customer_aircraft_links USING btree (customer_id, is_current);


--
-- Name: customer_aircraft_links_customer_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_aircraft_links_customer_id_index ON public.customer_aircraft_links USING btree (customer_id);


--
-- Name: customer_aircraft_links_customer_role_current_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_aircraft_links_customer_role_current_index ON public.customer_aircraft_links USING btree (customer_id, relationship_type, is_current);


--
-- Name: customer_aircraft_links_end_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_aircraft_links_end_date_index ON public.customer_aircraft_links USING btree (end_date);


--
-- Name: customer_aircraft_links_is_current_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_aircraft_links_is_current_index ON public.customer_aircraft_links USING btree (is_current);


--
-- Name: customer_aircraft_links_one_current_per_role; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customer_aircraft_links_one_current_per_role ON public.customer_aircraft_links USING btree (aircraft_id, customer_id, relationship_type) WHERE (is_current = true);


--
-- Name: customer_aircraft_links_relationship_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_aircraft_links_relationship_type_index ON public.customer_aircraft_links USING btree (relationship_type);


--
-- Name: customer_aircraft_links_start_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_aircraft_links_start_date_index ON public.customer_aircraft_links USING btree (start_date);


--
-- Name: customer_users_customer_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_users_customer_id_index ON public.customer_users USING btree (customer_id);


--
-- Name: customer_users_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customer_users_email_unique ON public.customer_users USING btree (email);


--
-- Name: customer_users_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_users_status_index ON public.customer_users USING btree (status);


--
-- Name: customers_account_reference_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customers_account_reference_unique ON public.customers USING btree (account_reference) WHERE (account_reference IS NOT NULL);


--
-- Name: customers_name_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_name_index ON public.customers USING btree (name);


--
-- Name: customers_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_status_index ON public.customers USING btree (status);


--
-- Name: idx_unique_active_component; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_unique_active_component ON public.aircraft_components USING btree (aircraft_id, model_id) WHERE ((current_status)::text = 'INSTALLED'::text);


--
-- Name: maintenance_requirements_model_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maintenance_requirements_model_id_idx ON public.maintenance_requirements USING btree (model_id);


--
-- Name: maintenance_template_items_is_required_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maintenance_template_items_is_required_index ON public.maintenance_template_items USING btree (is_required);


--
-- Name: maintenance_template_items_item_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maintenance_template_items_item_id_index ON public.maintenance_template_items USING btree (item_id);


--
-- Name: maintenance_template_items_item_lookup_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maintenance_template_items_item_lookup_index ON public.maintenance_template_items USING btree (item_type, item_id);


--
-- Name: maintenance_template_items_item_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maintenance_template_items_item_type_index ON public.maintenance_template_items USING btree (item_type);


--
-- Name: maintenance_template_items_sequence_no_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maintenance_template_items_sequence_no_index ON public.maintenance_template_items USING btree (sequence_no);


--
-- Name: maintenance_template_items_template_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maintenance_template_items_template_id_index ON public.maintenance_template_items USING btree (template_id);


--
-- Name: maintenance_templates_interval_hours_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maintenance_templates_interval_hours_index ON public.maintenance_templates USING btree (interval_hours);


--
-- Name: maintenance_templates_interval_months_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maintenance_templates_interval_months_index ON public.maintenance_templates USING btree (interval_months);


--
-- Name: maintenance_templates_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maintenance_templates_is_active_index ON public.maintenance_templates USING btree (is_active);


--
-- Name: maintenance_templates_model_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maintenance_templates_model_active_index ON public.maintenance_templates USING btree (model_id, is_active);


--
-- Name: maintenance_templates_model_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maintenance_templates_model_id_index ON public.maintenance_templates USING btree (model_id);


--
-- Name: maintenance_templates_template_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maintenance_templates_template_type_index ON public.maintenance_templates USING btree (template_type);


--
-- Name: manufacturers_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX manufacturers_code_idx ON public.manufacturers USING btree (code);


--
-- Name: manufacturers_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX manufacturers_name_idx ON public.manufacturers USING btree (name);


--
-- Name: migration_batch_rows_batch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX migration_batch_rows_batch_id_idx ON public.migration_batch_rows USING btree (batch_id);


--
-- Name: migration_batch_rows_source_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX migration_batch_rows_source_unique ON public.migration_batch_rows USING btree (batch_id, source_table, source_row_id);


--
-- Name: migration_batch_rows_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX migration_batch_rows_status_idx ON public.migration_batch_rows USING btree (status);


--
-- Name: migration_batches_migration_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX migration_batches_migration_type_idx ON public.migration_batches USING btree (migration_type);


--
-- Name: migration_batches_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX migration_batches_status_idx ON public.migration_batches USING btree (status);


--
-- Name: migration_created_targets_batch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX migration_created_targets_batch_id_idx ON public.migration_created_targets USING btree (batch_id);


--
-- Name: migration_created_targets_batch_row_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX migration_created_targets_batch_row_id_idx ON public.migration_created_targets USING btree (batch_row_id);


--
-- Name: migration_created_targets_target_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX migration_created_targets_target_unique ON public.migration_created_targets USING btree (batch_row_id, target_table, target_row_id);


--
-- Name: model_sids_model_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_sids_model_id ON public.model_sids USING btree (model_id);


--
-- Name: model_sids_sid_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX model_sids_sid_id ON public.model_sids USING btree (sid_id);


--
-- Name: planning_sessions_aircraft_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX planning_sessions_aircraft_id_index ON public.planning_sessions USING btree (aircraft_id);


--
-- Name: planning_sessions_created_by_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX planning_sessions_created_by_index ON public.planning_sessions USING btree (created_by);


--
-- Name: planning_sessions_finalized_by_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX planning_sessions_finalized_by_index ON public.planning_sessions USING btree (finalized_by);


--
-- Name: planning_sessions_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX planning_sessions_status_index ON public.planning_sessions USING btree (status);


--
-- Name: planning_sessions_template_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX planning_sessions_template_id_index ON public.planning_sessions USING btree (template_id);


--
-- Name: planning_sessions_user_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX planning_sessions_user_id_index ON public.planning_sessions USING btree (user_id);


--
-- Name: planning_sessions_user_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX planning_sessions_user_status_index ON public.planning_sessions USING btree (user_id, status, updated_at DESC);


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
-- Name: rf_workpack_type_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rf_workpack_type_code_idx ON public.rf_workpack_type USING btree (code);


--
-- Name: sb_model_applicability_allocations_allocated_model_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sb_model_applicability_allocations_allocated_model_idx ON public.sb_model_applicability_allocations USING btree (allocated_model_id);


--
-- Name: sb_model_applicability_allocations_classification_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sb_model_applicability_allocations_classification_idx ON public.sb_model_applicability_allocations USING btree (classification);


--
-- Name: sb_model_applicability_allocations_matched_model_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sb_model_applicability_allocations_matched_model_idx ON public.sb_model_applicability_allocations USING btree (matched_model_id);


--
-- Name: sb_model_applicability_allocations_sb_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sb_model_applicability_allocations_sb_idx ON public.sb_model_applicability_allocations USING btree (service_bulletin_id);


--
-- Name: sb_model_applicability_allocations_source_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sb_model_applicability_allocations_source_unique ON public.sb_model_applicability_allocations USING btree (service_bulletin_id, source_hash);


--
-- Name: sb_model_applicability_allocations_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sb_model_applicability_allocations_status_idx ON public.sb_model_applicability_allocations USING btree (status);


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
-- Name: serialized_component_life_states_serialized_component_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX serialized_component_life_states_serialized_component_id_unique ON public.serialized_component_life_states USING btree (serialized_component_id);


--
-- Name: serialized_component_maintenance_events_component_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX serialized_component_maintenance_events_component_id_index ON public.serialized_component_maintenance_events USING btree (serialized_component_id);


--
-- Name: serialized_component_maintenance_events_occurred_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX serialized_component_maintenance_events_occurred_at_index ON public.serialized_component_maintenance_events USING btree (occurred_at);


--
-- Name: serialized_component_maintenance_events_recorded_by_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX serialized_component_maintenance_events_recorded_by_index ON public.serialized_component_maintenance_events USING btree (recorded_by);


--
-- Name: serialized_components_component_model_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX serialized_components_component_model_id_index ON public.serialized_components USING btree (component_model_id);


--
-- Name: serialized_components_serial_number_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX serialized_components_serial_number_index ON public.serialized_components USING btree (serial_number);


--
-- Name: serialized_components_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX serialized_components_status_index ON public.serialized_components USING btree (status);


--
-- Name: service_bulletins_applicability_make_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_bulletins_applicability_make_idx ON public.service_bulletins USING btree (applicability_make);


--
-- Name: service_bulletins_issue_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_bulletins_issue_date_idx ON public.service_bulletins USING btree (issue_date);


--
-- Name: service_bulletins_manufacturer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_bulletins_manufacturer_idx ON public.service_bulletins USING btree (manufacturer);


--
-- Name: service_bulletins_reference_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_bulletins_reference_idx ON public.service_bulletins USING btree (reference);


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
-- Name: service_bulletins_status_phase5_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_bulletins_status_phase5_idx ON public.service_bulletins USING btree (status);


--
-- Name: sessions_expire_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_expire_idx ON public.sessions USING btree (expire);


--
-- Name: sid_model_applicability_model_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sid_model_applicability_model_id_index ON public.sid_model_applicability USING btree (model_id);


--
-- Name: sid_model_applicability_sid_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sid_model_applicability_sid_id_index ON public.sid_model_applicability USING btree (sid_id);


--
-- Name: supplemental_inspection_documents_category_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplemental_inspection_documents_category_index ON public.supplemental_inspection_documents USING btree (category);


--
-- Name: supplemental_inspection_documents_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplemental_inspection_documents_is_active_index ON public.supplemental_inspection_documents USING btree (is_active);


--
-- Name: supplemental_inspection_documents_manufacturer_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplemental_inspection_documents_manufacturer_index ON public.supplemental_inspection_documents USING btree (manufacturer);


--
-- Name: supplemental_inspection_documents_reference_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX supplemental_inspection_documents_reference_index ON public.supplemental_inspection_documents USING btree (reference);


--
-- Name: task_cards_aircraft_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_cards_aircraft_id ON public.task_cards USING btree (aircraft_id);


--
-- Name: task_cards_compliance_item_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX task_cards_compliance_item_id_idx ON public.task_cards USING btree (compliance_item_id);


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
-- Name: workpack_compliance_compliance_item_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_compliance_compliance_item_id_index ON public.workpack_compliance USING btree (compliance_item_id);


--
-- Name: workpack_compliance_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_compliance_status_index ON public.workpack_compliance USING btree (status);


--
-- Name: workpack_compliance_task_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_compliance_task_id_index ON public.workpack_compliance USING btree (task_id);


--
-- Name: workpack_compliance_workpack_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_compliance_workpack_id_index ON public.workpack_compliance USING btree (workpack_id);


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
-- Name: workpack_snags_aircraft_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_snags_aircraft_id_index ON public.workpack_snags USING btree (aircraft_id);


--
-- Name: workpack_snags_completed_by_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_snags_completed_by_index ON public.workpack_snags USING btree (completed_by);


--
-- Name: workpack_snags_component_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpack_snags_component_id_index ON public.workpack_snags USING btree (component_id);


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
-- Name: workpacks_planning_session_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workpacks_planning_session_id_index ON public.workpacks USING btree (planning_session_id);


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
-- Name: ad_relationships ad_relationships_ad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_relationships
    ADD CONSTRAINT ad_relationships_ad_id_fkey FOREIGN KEY (ad_id) REFERENCES public.airworthiness_directives(id) ON DELETE CASCADE;


--
-- Name: aircraft aircraft_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft
    ADD CONSTRAINT aircraft_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.rf_aircraft_category(id);


--
-- Name: aircraft_compliance aircraft_compliance_aircraft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft_compliance
    ADD CONSTRAINT aircraft_compliance_aircraft_id_fkey FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(id) ON DELETE CASCADE;


--
-- Name: aircraft_compliance aircraft_compliance_compliance_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft_compliance
    ADD CONSTRAINT aircraft_compliance_compliance_item_id_fkey FOREIGN KEY (compliance_item_id) REFERENCES public.compliance_items(id) ON DELETE CASCADE;


--
-- Name: aircraft_compliance aircraft_compliance_complied_workpack_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft_compliance
    ADD CONSTRAINT aircraft_compliance_complied_workpack_id_fkey FOREIGN KEY (complied_workpack_id) REFERENCES public.workpacks(id) ON DELETE SET NULL;


--
-- Name: aircraft_component_installations aircraft_component_installations_aircraft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft_component_installations
    ADD CONSTRAINT aircraft_component_installations_aircraft_id_fkey FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(id) ON DELETE RESTRICT;


--
-- Name: aircraft_component_installations aircraft_component_installations_installed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft_component_installations
    ADD CONSTRAINT aircraft_component_installations_installed_by_fkey FOREIGN KEY (installed_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: aircraft_component_installations aircraft_component_installations_removed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft_component_installations
    ADD CONSTRAINT aircraft_component_installations_removed_by_fkey FOREIGN KEY (removed_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: aircraft_component_installations aircraft_component_installations_serialized_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft_component_installations
    ADD CONSTRAINT aircraft_component_installations_serialized_component_id_fkey FOREIGN KEY (serialized_component_id) REFERENCES public.serialized_components(id) ON DELETE RESTRICT;


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
-- Name: compliance_assignments compliance_assignments_aircraft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_assignments
    ADD CONSTRAINT compliance_assignments_aircraft_id_fkey FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(id) ON DELETE CASCADE;


--
-- Name: compliance_assignments compliance_assignments_compliance_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_assignments
    ADD CONSTRAINT compliance_assignments_compliance_item_id_fkey FOREIGN KEY (compliance_item_id) REFERENCES public.compliance_items(id) ON DELETE CASCADE;


--
-- Name: compliance_assignments compliance_assignments_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_assignments
    ADD CONSTRAINT compliance_assignments_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.component_models(id) ON DELETE CASCADE;


--
-- Name: component_life_limits component_life_limits_component_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.component_life_limits
    ADD CONSTRAINT component_life_limits_component_model_id_fkey FOREIGN KEY (component_model_id) REFERENCES public.component_models(id) ON DELETE RESTRICT;


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
-- Name: customer_aircraft_links customer_aircraft_links_aircraft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_aircraft_links
    ADD CONSTRAINT customer_aircraft_links_aircraft_id_fkey FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(id) ON DELETE RESTRICT;


--
-- Name: customer_aircraft_links customer_aircraft_links_aircraft_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_aircraft_links
    ADD CONSTRAINT customer_aircraft_links_aircraft_id_fkey1 FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(id) ON DELETE RESTRICT;


--
-- Name: customer_aircraft_links customer_aircraft_links_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_aircraft_links
    ADD CONSTRAINT customer_aircraft_links_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: customer_aircraft_links customer_aircraft_links_customer_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_aircraft_links
    ADD CONSTRAINT customer_aircraft_links_customer_id_fkey1 FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: customer_users customer_users_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_users
    ADD CONSTRAINT customer_users_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: maintenance_requirements maintenance_requirements_model_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_requirements
    ADD CONSTRAINT maintenance_requirements_model_id_fk FOREIGN KEY (model_id) REFERENCES public.component_models(id) ON DELETE RESTRICT;


--
-- Name: maintenance_template_items maintenance_template_items_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_template_items
    ADD CONSTRAINT maintenance_template_items_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.maintenance_templates(id) ON DELETE CASCADE;


--
-- Name: maintenance_templates maintenance_templates_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_templates
    ADD CONSTRAINT maintenance_templates_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.component_models(id) ON DELETE CASCADE;


--
-- Name: migration_batch_rows migration_batch_rows_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_batch_rows
    ADD CONSTRAINT migration_batch_rows_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.migration_batches(id) ON DELETE CASCADE;


--
-- Name: migration_batches migration_batches_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_batches
    ADD CONSTRAINT migration_batches_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: migration_batches migration_batches_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_batches
    ADD CONSTRAINT migration_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: migration_batches migration_batches_executed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_batches
    ADD CONSTRAINT migration_batches_executed_by_fkey FOREIGN KEY (executed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: migration_batches migration_batches_rolled_back_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_batches
    ADD CONSTRAINT migration_batches_rolled_back_by_fkey FOREIGN KEY (rolled_back_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: migration_created_targets migration_created_targets_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_created_targets
    ADD CONSTRAINT migration_created_targets_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.migration_batches(id) ON DELETE CASCADE;


--
-- Name: migration_created_targets migration_created_targets_batch_row_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migration_created_targets
    ADD CONSTRAINT migration_created_targets_batch_row_id_fkey FOREIGN KEY (batch_row_id) REFERENCES public.migration_batch_rows(id) ON DELETE CASCADE;


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
-- Name: planning_sessions planning_sessions_aircraft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_sessions
    ADD CONSTRAINT planning_sessions_aircraft_id_fkey FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(id) ON DELETE CASCADE;


--
-- Name: planning_sessions planning_sessions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_sessions
    ADD CONSTRAINT planning_sessions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: planning_sessions planning_sessions_finalized_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_sessions
    ADD CONSTRAINT planning_sessions_finalized_by_fkey FOREIGN KEY (finalized_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: planning_sessions planning_sessions_generated_workpack_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_sessions
    ADD CONSTRAINT planning_sessions_generated_workpack_id_fkey FOREIGN KEY (generated_workpack_id) REFERENCES public.workpacks(id) ON DELETE SET NULL;


--
-- Name: planning_sessions planning_sessions_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_sessions
    ADD CONSTRAINT planning_sessions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.maintenance_templates(id) ON DELETE CASCADE;


--
-- Name: planning_sessions planning_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planning_sessions
    ADD CONSTRAINT planning_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


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
-- Name: sb_model_applicability_allocations sb_model_applicability_allocations_allocated_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sb_model_applicability_allocations
    ADD CONSTRAINT sb_model_applicability_allocations_allocated_model_id_fkey FOREIGN KEY (allocated_model_id) REFERENCES public.component_models(id) ON DELETE SET NULL;


--
-- Name: sb_model_applicability_allocations sb_model_applicability_allocations_created_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sb_model_applicability_allocations
    ADD CONSTRAINT sb_model_applicability_allocations_created_model_id_fkey FOREIGN KEY (created_model_id) REFERENCES public.component_models(id) ON DELETE SET NULL;


--
-- Name: sb_model_applicability_allocations sb_model_applicability_allocations_matched_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sb_model_applicability_allocations
    ADD CONSTRAINT sb_model_applicability_allocations_matched_model_id_fkey FOREIGN KEY (matched_model_id) REFERENCES public.component_models(id) ON DELETE SET NULL;


--
-- Name: sb_model_applicability_allocations sb_model_applicability_allocations_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sb_model_applicability_allocations
    ADD CONSTRAINT sb_model_applicability_allocations_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: sb_model_applicability_allocations sb_model_applicability_allocations_service_bulletin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sb_model_applicability_allocations
    ADD CONSTRAINT sb_model_applicability_allocations_service_bulletin_id_fkey FOREIGN KEY (service_bulletin_id) REFERENCES public.service_bulletins(id) ON DELETE CASCADE;


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
-- Name: serialized_component_life_states serialized_component_life_states_serialized_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.serialized_component_life_states
    ADD CONSTRAINT serialized_component_life_states_serialized_component_id_fkey FOREIGN KEY (serialized_component_id) REFERENCES public.serialized_components(id) ON DELETE RESTRICT;


--
-- Name: serialized_component_maintenance_events serialized_component_maintenance_e_serialized_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.serialized_component_maintenance_events
    ADD CONSTRAINT serialized_component_maintenance_e_serialized_component_id_fkey FOREIGN KEY (serialized_component_id) REFERENCES public.serialized_components(id) ON DELETE RESTRICT;


--
-- Name: serialized_component_maintenance_events serialized_component_maintenance_events_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.serialized_component_maintenance_events
    ADD CONSTRAINT serialized_component_maintenance_events_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: serialized_components serialized_components_component_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.serialized_components
    ADD CONSTRAINT serialized_components_component_model_id_fkey FOREIGN KEY (component_model_id) REFERENCES public.component_models(id) ON DELETE RESTRICT;


--
-- Name: sid_model_applicability sid_model_applicability_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sid_model_applicability
    ADD CONSTRAINT sid_model_applicability_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.component_models(id) ON DELETE CASCADE;


--
-- Name: sid_model_applicability sid_model_applicability_model_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sid_model_applicability
    ADD CONSTRAINT sid_model_applicability_model_id_fkey1 FOREIGN KEY (model_id) REFERENCES public.component_models(id) ON DELETE CASCADE;


--
-- Name: sid_model_applicability sid_model_applicability_sid_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sid_model_applicability
    ADD CONSTRAINT sid_model_applicability_sid_id_fkey FOREIGN KEY (sid_id) REFERENCES public.supplemental_inspection_documents(id) ON DELETE CASCADE;


--
-- Name: sid_model_applicability sid_model_applicability_sid_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sid_model_applicability
    ADD CONSTRAINT sid_model_applicability_sid_id_fkey1 FOREIGN KEY (sid_id) REFERENCES public.supplemental_inspection_documents(id) ON DELETE CASCADE;


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
-- Name: task_cards task_cards_compliance_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_cards
    ADD CONSTRAINT task_cards_compliance_item_id_fkey FOREIGN KEY (compliance_item_id) REFERENCES public.compliance_items(id) ON DELETE SET NULL;


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
-- Name: workpack_compliance workpack_compliance_compliance_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_compliance
    ADD CONSTRAINT workpack_compliance_compliance_item_id_fkey FOREIGN KEY (compliance_item_id) REFERENCES public.compliance_items(id) ON DELETE CASCADE;


--
-- Name: workpack_compliance workpack_compliance_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_compliance
    ADD CONSTRAINT workpack_compliance_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.task_cards(id) ON DELETE SET NULL;


--
-- Name: workpack_compliance workpack_compliance_workpack_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_compliance
    ADD CONSTRAINT workpack_compliance_workpack_id_fkey FOREIGN KEY (workpack_id) REFERENCES public.workpacks(id) ON DELETE CASCADE;


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
-- Name: workpack_snags workpack_snags_aircraft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_snags
    ADD CONSTRAINT workpack_snags_aircraft_id_fkey FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(id) ON DELETE RESTRICT;


--
-- Name: workpack_snags workpack_snags_aircraft_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_snags
    ADD CONSTRAINT workpack_snags_aircraft_id_fkey1 FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(id) ON DELETE RESTRICT;


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
-- Name: workpack_snags workpack_snags_component_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_snags
    ADD CONSTRAINT workpack_snags_component_id_fkey FOREIGN KEY (component_id) REFERENCES public.aircraft_components(id) ON DELETE SET NULL;


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
-- Name: workpack_snags workpack_snags_workpack_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpack_snags
    ADD CONSTRAINT workpack_snags_workpack_id_fkey1 FOREIGN KEY (workpack_id) REFERENCES public.workpacks(id) ON DELETE CASCADE;


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
-- Name: workpacks workpacks_planning_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workpacks
    ADD CONSTRAINT workpacks_planning_session_id_fkey FOREIGN KEY (planning_session_id) REFERENCES public.planning_sessions(id) ON DELETE SET NULL;


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

