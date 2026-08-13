--
-- PostgreSQL database dump
--

\restrict 7d8SP8fmVulCst53L6ECa8VORzciqB7jcvccJdFhCmLN8ozvql5eEVbcyBKkJkK

-- Dumped from database version 15.19 (Debian 15.19-0+deb12u1)
-- Dumped by pg_dump version 15.19 (Debian 15.19-0+deb12u1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: account_role; Type: TYPE; Schema: public; Owner: foot
--

CREATE TYPE public.account_role AS ENUM (
    'client',
    'provider',
    'admin'
);


ALTER TYPE public.account_role OWNER TO foot;

--
-- Name: booking_status; Type: TYPE; Schema: public; Owner: foot
--

CREATE TYPE public.booking_status AS ENUM (
    'requested',
    'confirmed',
    'completed',
    'cancelled',
    'rescheduled',
    'no_show'
);


ALTER TYPE public.booking_status OWNER TO foot;

--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: foot
--

CREATE TYPE public.invoice_status AS ENUM (
    'pending',
    'paid',
    'cancelled'
);


ALTER TYPE public.invoice_status OWNER TO foot;

--
-- Name: marketplace_event_reason_code; Type: TYPE; Schema: public; Owner: foot
--

CREATE TYPE public.marketplace_event_reason_code AS ENUM (
    'NOT_APPROVED',
    'PROFILE_INCOMPLETE',
    'NO_ACTIVE_SERVICE',
    'NO_AVAILABILITY',
    'NO_SERVICE_AREA',
    'NOT_ACCEPTING_CLIENTS',
    'DOCS_PENDING',
    'PROVIDER_NOT_BOOKABLE',
    'SERVICE_INACTIVE',
    'SLOT_OUTSIDE_AVAILABILITY',
    'SLOT_CONFLICT',
    'PROVIDER_NOT_ACCEPTING',
    'VALIDATION_ERROR',
    'CLIENT_ABANDONED'
);


ALTER TYPE public.marketplace_event_reason_code OWNER TO foot;

--
-- Name: marketplace_event_source; Type: TYPE; Schema: public; Owner: foot
--

CREATE TYPE public.marketplace_event_source AS ENUM (
    'web',
    'mobile',
    'system'
);


ALTER TYPE public.marketplace_event_source OWNER TO foot;

--
-- Name: marketplace_event_type; Type: TYPE; Schema: public; Owner: foot
--

CREATE TYPE public.marketplace_event_type AS ENUM (
    'provider_approved',
    'profile_completed',
    'first_service_published',
    'availability_set',
    'service_area_set',
    'provider_activated',
    'provider_deactivated',
    'provider_search',
    'provider_viewed',
    'service_viewed',
    'availability_slot_selected',
    'booking_started',
    'booking_submitted',
    'booking_confirmed',
    'booking_cancelled',
    'booking_no_show'
);


ALTER TYPE public.marketplace_event_type OWNER TO foot;

--
-- Name: prevented_booking_path; Type: TYPE; Schema: public; Owner: foot
--

CREATE TYPE public.prevented_booking_path AS ENUM (
    'preflight',
    'index_violation'
);


ALTER TYPE public.prevented_booking_path OWNER TO foot;

--
-- Name: provider_application_event_type; Type: TYPE; Schema: public; Owner: foot
--

CREATE TYPE public.provider_application_event_type AS ENUM (
    'submitted',
    'reset_to_draft',
    'approved',
    'rejected'
);


ALTER TYPE public.provider_application_event_type OWNER TO foot;

--
-- Name: provider_application_status; Type: TYPE; Schema: public; Owner: foot
--

CREATE TYPE public.provider_application_status AS ENUM (
    'draft',
    'under_review',
    'approved',
    'rejected',
    'suspended'
);


ALTER TYPE public.provider_application_status OWNER TO foot;

--
-- Name: provider_application_step; Type: TYPE; Schema: public; Owner: foot
--

CREATE TYPE public.provider_application_step AS ENUM (
    'profile',
    'services',
    'availability',
    'verification',
    'submitted'
);


ALTER TYPE public.provider_application_step OWNER TO foot;

--
-- Name: provider_application_submission_outcome; Type: TYPE; Schema: public; Owner: foot
--

CREATE TYPE public.provider_application_submission_outcome AS ENUM (
    'rejected'
);


ALTER TYPE public.provider_application_submission_outcome OWNER TO foot;

--
-- Name: ticket_status; Type: TYPE; Schema: public; Owner: foot
--

CREATE TYPE public.ticket_status AS ENUM (
    'open',
    'in_progress',
    'resolved'
);


ALTER TYPE public.ticket_status OWNER TO foot;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: foot
--

CREATE TYPE public.user_role AS ENUM (
    'client',
    'provider',
    'admin'
);


ALTER TYPE public.user_role OWNER TO foot;

--
-- Name: verification_doc_status; Type: TYPE; Schema: public; Owner: foot
--

CREATE TYPE public.verification_doc_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE public.verification_doc_status OWNER TO foot;

--
-- Name: verification_status; Type: TYPE; Schema: public; Owner: foot
--

CREATE TYPE public.verification_status AS ENUM (
    'pending',
    'under_review',
    'approved',
    'rejected'
);


ALTER TYPE public.verification_status OWNER TO foot;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_roles; Type: TABLE; Schema: public; Owner: foot
--

CREATE TABLE public.account_roles (
    id integer NOT NULL,
    user_id integer NOT NULL,
    role public.account_role NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.account_roles OWNER TO foot;

--
-- Name: account_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: foot
--

CREATE SEQUENCE public.account_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.account_roles_id_seq OWNER TO foot;

--
-- Name: account_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: foot
--

ALTER SEQUENCE public.account_roles_id_seq OWNED BY public.account_roles.id;


--
-- Name: availability; Type: TABLE; Schema: public; Owner: foot
--

CREATE TABLE public.availability (
    id integer NOT NULL,
    provider_id integer NOT NULL,
    day_of_week integer NOT NULL,
    start_time text NOT NULL,
    end_time text NOT NULL
);


ALTER TABLE public.availability OWNER TO foot;

--
-- Name: availability_id_seq; Type: SEQUENCE; Schema: public; Owner: foot
--

CREATE SEQUENCE public.availability_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.availability_id_seq OWNER TO foot;

--
-- Name: availability_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: foot
--

ALTER SEQUENCE public.availability_id_seq OWNED BY public.availability.id;


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: foot
--

CREATE TABLE public.bookings (
    id integer NOT NULL,
    client_id integer NOT NULL,
    provider_id integer NOT NULL,
    service_id integer NOT NULL,
    status public.booking_status DEFAULT 'requested'::public.booking_status NOT NULL,
    scheduled_at timestamp without time zone NOT NULL,
    address text NOT NULL,
    city text NOT NULL,
    postal_code text,
    care_notes text,
    client_notes text,
    cancelled_by integer,
    cancellation_reason text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.bookings OWNER TO foot;

--
-- Name: bookings_id_seq; Type: SEQUENCE; Schema: public; Owner: foot
--

CREATE SEQUENCE public.bookings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.bookings_id_seq OWNER TO foot;

--
-- Name: bookings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: foot
--

ALTER SEQUENCE public.bookings_id_seq OWNED BY public.bookings.id;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: foot
--

CREATE TABLE public.invoices (
    id integer NOT NULL,
    booking_id integer NOT NULL,
    client_id integer NOT NULL,
    provider_id integer NOT NULL,
    amount_cents integer NOT NULL,
    status public.invoice_status DEFAULT 'pending'::public.invoice_status NOT NULL,
    paid_at timestamp without time zone,
    stripe_payment_intent_id text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.invoices OWNER TO foot;

--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: foot
--

CREATE SEQUENCE public.invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.invoices_id_seq OWNER TO foot;

--
-- Name: invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: foot
--

ALTER SEQUENCE public.invoices_id_seq OWNED BY public.invoices.id;


--
-- Name: marketplace_events; Type: TABLE; Schema: public; Owner: foot
--

CREATE TABLE public.marketplace_events (
    id integer NOT NULL,
    event_type public.marketplace_event_type NOT NULL,
    occurred_at timestamp without time zone NOT NULL,
    recorded_at timestamp without time zone DEFAULT now() NOT NULL,
    actor_user_id integer,
    actor_role public.account_role,
    provider_profile_id integer,
    client_user_id integer,
    service_id integer,
    booking_id integer,
    correlation_id text,
    source public.marketplace_event_source NOT NULL,
    metadata jsonb,
    reason_code public.marketplace_event_reason_code
);


ALTER TABLE public.marketplace_events OWNER TO foot;

--
-- Name: marketplace_events_id_seq; Type: SEQUENCE; Schema: public; Owner: foot
--

CREATE SEQUENCE public.marketplace_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.marketplace_events_id_seq OWNER TO foot;

--
-- Name: marketplace_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: foot
--

ALTER SEQUENCE public.marketplace_events_id_seq OWNED BY public.marketplace_events.id;


--
-- Name: prevented_booking_records; Type: TABLE; Schema: public; Owner: foot
--

CREATE TABLE public.prevented_booking_records (
    id integer NOT NULL,
    marketplace_id integer NOT NULL,
    correlation_id text NOT NULL,
    occurred_at timestamp without time zone NOT NULL,
    recorded_at timestamp without time zone DEFAULT now() NOT NULL,
    actor_user_id integer,
    subject_booking_id integer,
    provider_id integer,
    service_id integer,
    scheduled_at timestamp without time zone NOT NULL,
    path public.prevented_booking_path NOT NULL
);


ALTER TABLE public.prevented_booking_records OWNER TO foot;

--
-- Name: prevented_booking_records_id_seq; Type: SEQUENCE; Schema: public; Owner: foot
--

CREATE SEQUENCE public.prevented_booking_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.prevented_booking_records_id_seq OWNER TO foot;

--
-- Name: prevented_booking_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: foot
--

ALTER SEQUENCE public.prevented_booking_records_id_seq OWNED BY public.prevented_booking_records.id;


--
-- Name: provider_application_events; Type: TABLE; Schema: public; Owner: foot
--

CREATE TABLE public.provider_application_events (
    id integer NOT NULL,
    provider_application_id integer NOT NULL,
    user_id integer NOT NULL,
    type public.provider_application_event_type NOT NULL,
    from_status public.provider_application_status NOT NULL,
    to_status public.provider_application_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.provider_application_events OWNER TO foot;

--
-- Name: provider_application_events_id_seq; Type: SEQUENCE; Schema: public; Owner: foot
--

CREATE SEQUENCE public.provider_application_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.provider_application_events_id_seq OWNER TO foot;

--
-- Name: provider_application_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: foot
--

ALTER SEQUENCE public.provider_application_events_id_seq OWNED BY public.provider_application_events.id;


--
-- Name: provider_application_submissions; Type: TABLE; Schema: public; Owner: foot
--

CREATE TABLE public.provider_application_submissions (
    id integer NOT NULL,
    provider_application_id integer NOT NULL,
    outcome public.provider_application_submission_outcome NOT NULL,
    submitted_at timestamp without time zone NOT NULL,
    reviewed_at timestamp without time zone,
    reviewed_by integer,
    reviewer_notes text,
    rejection_reason text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.provider_application_submissions OWNER TO foot;

--
-- Name: provider_application_submissions_id_seq; Type: SEQUENCE; Schema: public; Owner: foot
--

CREATE SEQUENCE public.provider_application_submissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.provider_application_submissions_id_seq OWNER TO foot;

--
-- Name: provider_application_submissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: foot
--

ALTER SEQUENCE public.provider_application_submissions_id_seq OWNED BY public.provider_application_submissions.id;


--
-- Name: provider_applications; Type: TABLE; Schema: public; Owner: foot
--

CREATE TABLE public.provider_applications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    provider_profile_id integer NOT NULL,
    status public.provider_application_status DEFAULT 'draft'::public.provider_application_status NOT NULL,
    current_step public.provider_application_step DEFAULT 'profile'::public.provider_application_step NOT NULL,
    submitted_at timestamp without time zone,
    reviewed_at timestamp without time zone,
    reviewed_by integer,
    reviewer_notes text,
    rejection_reason text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.provider_applications OWNER TO foot;

--
-- Name: provider_applications_id_seq; Type: SEQUENCE; Schema: public; Owner: foot
--

CREATE SEQUENCE public.provider_applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.provider_applications_id_seq OWNER TO foot;

--
-- Name: provider_applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: foot
--

ALTER SEQUENCE public.provider_applications_id_seq OWNED BY public.provider_applications.id;


--
-- Name: provider_notifications; Type: TABLE; Schema: public; Owner: foot
--

CREATE TABLE public.provider_notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    event_id integer NOT NULL,
    type public.provider_application_event_type NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    link text NOT NULL,
    read_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.provider_notifications OWNER TO foot;

--
-- Name: provider_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: foot
--

CREATE SEQUENCE public.provider_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.provider_notifications_id_seq OWNER TO foot;

--
-- Name: provider_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: foot
--

ALTER SEQUENCE public.provider_notifications_id_seq OWNED BY public.provider_notifications.id;


--
-- Name: provider_profiles; Type: TABLE; Schema: public; Owner: foot
--

CREATE TABLE public.provider_profiles (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    bio text,
    city text DEFAULT ''::text NOT NULL,
    service_area_notes text,
    verification_status public.verification_status DEFAULT 'pending'::public.verification_status NOT NULL,
    rating numeric(3,2) DEFAULT '0'::numeric NOT NULL,
    review_count integer DEFAULT 0 NOT NULL,
    profile_complete boolean DEFAULT false NOT NULL,
    years_experience integer,
    accepts_new_clients boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.provider_profiles OWNER TO foot;

--
-- Name: provider_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: foot
--

CREATE SEQUENCE public.provider_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.provider_profiles_id_seq OWNER TO foot;

--
-- Name: provider_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: foot
--

ALTER SEQUENCE public.provider_profiles_id_seq OWNED BY public.provider_profiles.id;


--
-- Name: push_tokens; Type: TABLE; Schema: public; Owner: foot
--

CREATE TABLE public.push_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token text NOT NULL,
    platform text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.push_tokens OWNER TO foot;

--
-- Name: push_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: foot
--

CREATE SEQUENCE public.push_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.push_tokens_id_seq OWNER TO foot;

--
-- Name: push_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: foot
--

ALTER SEQUENCE public.push_tokens_id_seq OWNED BY public.push_tokens.id;


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: foot
--

CREATE TABLE public.reviews (
    id integer NOT NULL,
    booking_id integer NOT NULL,
    client_id integer NOT NULL,
    provider_id integer NOT NULL,
    rating integer NOT NULL,
    comment text,
    is_visible boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.reviews OWNER TO foot;

--
-- Name: reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: foot
--

CREATE SEQUENCE public.reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.reviews_id_seq OWNER TO foot;

--
-- Name: reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: foot
--

ALTER SEQUENCE public.reviews_id_seq OWNED BY public.reviews.id;


--
-- Name: services; Type: TABLE; Schema: public; Owner: foot
--

CREATE TABLE public.services (
    id integer NOT NULL,
    provider_id integer NOT NULL,
    title text NOT NULL,
    description text,
    duration_minutes integer NOT NULL,
    price_cents integer NOT NULL,
    category text DEFAULT 'foot_care'::text NOT NULL,
    eligibility_notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.services OWNER TO foot;

--
-- Name: services_id_seq; Type: SEQUENCE; Schema: public; Owner: foot
--

CREATE SEQUENCE public.services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.services_id_seq OWNER TO foot;

--
-- Name: services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: foot
--

ALTER SEQUENCE public.services_id_seq OWNED BY public.services.id;


--
-- Name: support_messages; Type: TABLE; Schema: public; Owner: foot
--

CREATE TABLE public.support_messages (
    id integer NOT NULL,
    ticket_id integer NOT NULL,
    user_id integer NOT NULL,
    message text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.support_messages OWNER TO foot;

--
-- Name: support_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: foot
--

CREATE SEQUENCE public.support_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.support_messages_id_seq OWNER TO foot;

--
-- Name: support_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: foot
--

ALTER SEQUENCE public.support_messages_id_seq OWNED BY public.support_messages.id;


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: foot
--

CREATE TABLE public.support_tickets (
    id integer NOT NULL,
    user_id integer NOT NULL,
    subject text NOT NULL,
    status public.ticket_status DEFAULT 'open'::public.ticket_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.support_tickets OWNER TO foot;

--
-- Name: support_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: foot
--

CREATE SEQUENCE public.support_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.support_tickets_id_seq OWNER TO foot;

--
-- Name: support_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: foot
--

ALTER SEQUENCE public.support_tickets_id_seq OWNED BY public.support_tickets.id;


--
-- Name: travel_zones; Type: TABLE; Schema: public; Owner: foot
--

CREATE TABLE public.travel_zones (
    id integer NOT NULL,
    provider_id integer NOT NULL,
    zone_name text NOT NULL,
    city text NOT NULL,
    notes text
);


ALTER TABLE public.travel_zones OWNER TO foot;

--
-- Name: travel_zones_id_seq; Type: SEQUENCE; Schema: public; Owner: foot
--

CREATE SEQUENCE public.travel_zones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.travel_zones_id_seq OWNER TO foot;

--
-- Name: travel_zones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: foot
--

ALTER SEQUENCE public.travel_zones_id_seq OWNED BY public.travel_zones.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: foot
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role public.user_role DEFAULT 'client'::public.user_role NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    phone text,
    avatar_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO foot;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: foot
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO foot;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: foot
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: verification_docs; Type: TABLE; Schema: public; Owner: foot
--

CREATE TABLE public.verification_docs (
    id integer NOT NULL,
    provider_id integer NOT NULL,
    doc_type text NOT NULL,
    file_name text NOT NULL,
    status public.verification_doc_status DEFAULT 'pending'::public.verification_doc_status NOT NULL,
    reviewer_notes text,
    submitted_at timestamp without time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp without time zone
);


ALTER TABLE public.verification_docs OWNER TO foot;

--
-- Name: verification_docs_id_seq; Type: SEQUENCE; Schema: public; Owner: foot
--

CREATE SEQUENCE public.verification_docs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.verification_docs_id_seq OWNER TO foot;

--
-- Name: verification_docs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: foot
--

ALTER SEQUENCE public.verification_docs_id_seq OWNED BY public.verification_docs.id;


--
-- Name: account_roles id; Type: DEFAULT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.account_roles ALTER COLUMN id SET DEFAULT nextval('public.account_roles_id_seq'::regclass);


--
-- Name: availability id; Type: DEFAULT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.availability ALTER COLUMN id SET DEFAULT nextval('public.availability_id_seq'::regclass);


--
-- Name: bookings id; Type: DEFAULT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.bookings ALTER COLUMN id SET DEFAULT nextval('public.bookings_id_seq'::regclass);


--
-- Name: invoices id; Type: DEFAULT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.invoices ALTER COLUMN id SET DEFAULT nextval('public.invoices_id_seq'::regclass);


--
-- Name: marketplace_events id; Type: DEFAULT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.marketplace_events ALTER COLUMN id SET DEFAULT nextval('public.marketplace_events_id_seq'::regclass);


--
-- Name: prevented_booking_records id; Type: DEFAULT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.prevented_booking_records ALTER COLUMN id SET DEFAULT nextval('public.prevented_booking_records_id_seq'::regclass);


--
-- Name: provider_application_events id; Type: DEFAULT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_application_events ALTER COLUMN id SET DEFAULT nextval('public.provider_application_events_id_seq'::regclass);


--
-- Name: provider_application_submissions id; Type: DEFAULT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_application_submissions ALTER COLUMN id SET DEFAULT nextval('public.provider_application_submissions_id_seq'::regclass);


--
-- Name: provider_applications id; Type: DEFAULT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_applications ALTER COLUMN id SET DEFAULT nextval('public.provider_applications_id_seq'::regclass);


--
-- Name: provider_notifications id; Type: DEFAULT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_notifications ALTER COLUMN id SET DEFAULT nextval('public.provider_notifications_id_seq'::regclass);


--
-- Name: provider_profiles id; Type: DEFAULT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_profiles ALTER COLUMN id SET DEFAULT nextval('public.provider_profiles_id_seq'::regclass);


--
-- Name: push_tokens id; Type: DEFAULT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.push_tokens ALTER COLUMN id SET DEFAULT nextval('public.push_tokens_id_seq'::regclass);


--
-- Name: reviews id; Type: DEFAULT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.reviews ALTER COLUMN id SET DEFAULT nextval('public.reviews_id_seq'::regclass);


--
-- Name: services id; Type: DEFAULT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.services ALTER COLUMN id SET DEFAULT nextval('public.services_id_seq'::regclass);


--
-- Name: support_messages id; Type: DEFAULT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.support_messages ALTER COLUMN id SET DEFAULT nextval('public.support_messages_id_seq'::regclass);


--
-- Name: support_tickets id; Type: DEFAULT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.support_tickets ALTER COLUMN id SET DEFAULT nextval('public.support_tickets_id_seq'::regclass);


--
-- Name: travel_zones id; Type: DEFAULT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.travel_zones ALTER COLUMN id SET DEFAULT nextval('public.travel_zones_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: verification_docs id; Type: DEFAULT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.verification_docs ALTER COLUMN id SET DEFAULT nextval('public.verification_docs_id_seq'::regclass);


--
-- Name: account_roles account_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.account_roles
    ADD CONSTRAINT account_roles_pkey PRIMARY KEY (id);


--
-- Name: account_roles account_roles_user_role_unique; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.account_roles
    ADD CONSTRAINT account_roles_user_role_unique UNIQUE (user_id, role);


--
-- Name: availability availability_pkey; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.availability
    ADD CONSTRAINT availability_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_booking_id_unique; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_booking_id_unique UNIQUE (booking_id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: marketplace_events marketplace_events_pkey; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.marketplace_events
    ADD CONSTRAINT marketplace_events_pkey PRIMARY KEY (id);


--
-- Name: prevented_booking_records prevented_booking_records_pkey; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.prevented_booking_records
    ADD CONSTRAINT prevented_booking_records_pkey PRIMARY KEY (id);


--
-- Name: provider_application_events provider_application_events_pkey; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_application_events
    ADD CONSTRAINT provider_application_events_pkey PRIMARY KEY (id);


--
-- Name: provider_application_submissions provider_application_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_application_submissions
    ADD CONSTRAINT provider_application_submissions_pkey PRIMARY KEY (id);


--
-- Name: provider_applications provider_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_applications
    ADD CONSTRAINT provider_applications_pkey PRIMARY KEY (id);


--
-- Name: provider_applications provider_applications_profile_unique; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_applications
    ADD CONSTRAINT provider_applications_profile_unique UNIQUE (provider_profile_id);


--
-- Name: provider_applications provider_applications_user_unique; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_applications
    ADD CONSTRAINT provider_applications_user_unique UNIQUE (user_id);


--
-- Name: provider_notifications provider_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_notifications
    ADD CONSTRAINT provider_notifications_pkey PRIMARY KEY (id);


--
-- Name: provider_notifications provider_notifications_user_event_unique; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_notifications
    ADD CONSTRAINT provider_notifications_user_event_unique UNIQUE (user_id, event_id);


--
-- Name: provider_profiles provider_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_profiles
    ADD CONSTRAINT provider_profiles_pkey PRIMARY KEY (id);


--
-- Name: provider_profiles provider_profiles_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_profiles
    ADD CONSTRAINT provider_profiles_user_id_unique UNIQUE (user_id);


--
-- Name: push_tokens push_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_pkey PRIMARY KEY (id);


--
-- Name: push_tokens push_tokens_token_unique; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_token_unique UNIQUE (token);


--
-- Name: reviews reviews_booking_id_unique; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_booking_id_unique UNIQUE (booking_id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: support_messages support_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: travel_zones travel_zones_pkey; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.travel_zones
    ADD CONSTRAINT travel_zones_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verification_docs verification_docs_pkey; Type: CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.verification_docs
    ADD CONSTRAINT verification_docs_pkey PRIMARY KEY (id);


--
-- Name: account_roles_role_idx; Type: INDEX; Schema: public; Owner: foot
--

CREATE INDEX account_roles_role_idx ON public.account_roles USING btree (role);


--
-- Name: account_roles_user_id_idx; Type: INDEX; Schema: public; Owner: foot
--

CREATE INDEX account_roles_user_id_idx ON public.account_roles USING btree (user_id);


--
-- Name: bookings_active_booking_unique_idx; Type: INDEX; Schema: public; Owner: foot
--

CREATE UNIQUE INDEX bookings_active_booking_unique_idx ON public.bookings USING btree (client_id, provider_id, service_id, scheduled_at) WHERE (status = ANY (ARRAY['requested'::public.booking_status, 'confirmed'::public.booking_status, 'rescheduled'::public.booking_status]));


--
-- Name: marketplace_events_client_occurred_idx; Type: INDEX; Schema: public; Owner: foot
--

CREATE INDEX marketplace_events_client_occurred_idx ON public.marketplace_events USING btree (client_user_id, occurred_at DESC NULLS LAST);


--
-- Name: marketplace_events_correlation_idx; Type: INDEX; Schema: public; Owner: foot
--

CREATE INDEX marketplace_events_correlation_idx ON public.marketplace_events USING btree (correlation_id);


--
-- Name: marketplace_events_occurred_idx; Type: INDEX; Schema: public; Owner: foot
--

CREATE INDEX marketplace_events_occurred_idx ON public.marketplace_events USING btree (occurred_at DESC NULLS LAST);


--
-- Name: marketplace_events_provider_occurred_idx; Type: INDEX; Schema: public; Owner: foot
--

CREATE INDEX marketplace_events_provider_occurred_idx ON public.marketplace_events USING btree (provider_profile_id, occurred_at DESC NULLS LAST);


--
-- Name: marketplace_events_type_occurred_idx; Type: INDEX; Schema: public; Owner: foot
--

CREATE INDEX marketplace_events_type_occurred_idx ON public.marketplace_events USING btree (event_type, occurred_at DESC NULLS LAST);


--
-- Name: prevented_booking_records_correlation_unique_idx; Type: INDEX; Schema: public; Owner: foot
--

CREATE UNIQUE INDEX prevented_booking_records_correlation_unique_idx ON public.prevented_booking_records USING btree (correlation_id);


--
-- Name: prevented_booking_records_marketplace_provider_occurred_idx; Type: INDEX; Schema: public; Owner: foot
--

CREATE INDEX prevented_booking_records_marketplace_provider_occurred_idx ON public.prevented_booking_records USING btree (marketplace_id, provider_id, occurred_at DESC NULLS LAST);


--
-- Name: provider_application_events_app_created_idx; Type: INDEX; Schema: public; Owner: foot
--

CREATE INDEX provider_application_events_app_created_idx ON public.provider_application_events USING btree (provider_application_id, created_at);


--
-- Name: provider_application_submissions_app_created_id_idx; Type: INDEX; Schema: public; Owner: foot
--

CREATE INDEX provider_application_submissions_app_created_id_idx ON public.provider_application_submissions USING btree (provider_application_id, created_at DESC, id DESC);


--
-- Name: provider_applications_status_idx; Type: INDEX; Schema: public; Owner: foot
--

CREATE INDEX provider_applications_status_idx ON public.provider_applications USING btree (status);


--
-- Name: provider_applications_user_id_idx; Type: INDEX; Schema: public; Owner: foot
--

CREATE INDEX provider_applications_user_id_idx ON public.provider_applications USING btree (user_id);


--
-- Name: provider_notifications_user_created_id_idx; Type: INDEX; Schema: public; Owner: foot
--

CREATE INDEX provider_notifications_user_created_id_idx ON public.provider_notifications USING btree (user_id, created_at DESC, id DESC);


--
-- Name: account_roles account_roles_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.account_roles
    ADD CONSTRAINT account_roles_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: availability availability_provider_id_provider_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.availability
    ADD CONSTRAINT availability_provider_id_provider_profiles_id_fk FOREIGN KEY (provider_id) REFERENCES public.provider_profiles(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_cancelled_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_cancelled_by_users_id_fk FOREIGN KEY (cancelled_by) REFERENCES public.users(id);


--
-- Name: bookings bookings_client_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_client_id_users_id_fk FOREIGN KEY (client_id) REFERENCES public.users(id);


--
-- Name: bookings bookings_provider_id_provider_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_provider_id_provider_profiles_id_fk FOREIGN KEY (provider_id) REFERENCES public.provider_profiles(id);


--
-- Name: bookings bookings_service_id_services_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_service_id_services_id_fk FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- Name: invoices invoices_booking_id_bookings_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_booking_id_bookings_id_fk FOREIGN KEY (booking_id) REFERENCES public.bookings(id);


--
-- Name: invoices invoices_client_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_client_id_users_id_fk FOREIGN KEY (client_id) REFERENCES public.users(id);


--
-- Name: invoices invoices_provider_id_provider_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_provider_id_provider_profiles_id_fk FOREIGN KEY (provider_id) REFERENCES public.provider_profiles(id);


--
-- Name: marketplace_events marketplace_events_actor_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.marketplace_events
    ADD CONSTRAINT marketplace_events_actor_user_id_users_id_fk FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: marketplace_events marketplace_events_booking_id_bookings_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.marketplace_events
    ADD CONSTRAINT marketplace_events_booking_id_bookings_id_fk FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: marketplace_events marketplace_events_client_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.marketplace_events
    ADD CONSTRAINT marketplace_events_client_user_id_users_id_fk FOREIGN KEY (client_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: marketplace_events marketplace_events_provider_profile_id_provider_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.marketplace_events
    ADD CONSTRAINT marketplace_events_provider_profile_id_provider_profiles_id_fk FOREIGN KEY (provider_profile_id) REFERENCES public.provider_profiles(id) ON DELETE SET NULL;


--
-- Name: marketplace_events marketplace_events_service_id_services_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.marketplace_events
    ADD CONSTRAINT marketplace_events_service_id_services_id_fk FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: prevented_booking_records prevented_booking_records_actor_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.prevented_booking_records
    ADD CONSTRAINT prevented_booking_records_actor_user_id_users_id_fk FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: prevented_booking_records prevented_booking_records_provider_id_provider_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.prevented_booking_records
    ADD CONSTRAINT prevented_booking_records_provider_id_provider_profiles_id_fk FOREIGN KEY (provider_id) REFERENCES public.provider_profiles(id) ON DELETE SET NULL;


--
-- Name: prevented_booking_records prevented_booking_records_service_id_services_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.prevented_booking_records
    ADD CONSTRAINT prevented_booking_records_service_id_services_id_fk FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: prevented_booking_records prevented_booking_records_subject_booking_id_bookings_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.prevented_booking_records
    ADD CONSTRAINT prevented_booking_records_subject_booking_id_bookings_id_fk FOREIGN KEY (subject_booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: provider_application_events provider_application_events_provider_application_id_provider_ap; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_application_events
    ADD CONSTRAINT provider_application_events_provider_application_id_provider_ap FOREIGN KEY (provider_application_id) REFERENCES public.provider_applications(id) ON DELETE CASCADE;


--
-- Name: provider_application_events provider_application_events_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_application_events
    ADD CONSTRAINT provider_application_events_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: provider_application_submissions provider_application_submissions_provider_application_id_provid; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_application_submissions
    ADD CONSTRAINT provider_application_submissions_provider_application_id_provid FOREIGN KEY (provider_application_id) REFERENCES public.provider_applications(id) ON DELETE CASCADE;


--
-- Name: provider_application_submissions provider_application_submissions_reviewed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_application_submissions
    ADD CONSTRAINT provider_application_submissions_reviewed_by_users_id_fk FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: provider_applications provider_applications_provider_profile_id_provider_profiles_id_; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_applications
    ADD CONSTRAINT provider_applications_provider_profile_id_provider_profiles_id_ FOREIGN KEY (provider_profile_id) REFERENCES public.provider_profiles(id) ON DELETE CASCADE;


--
-- Name: provider_applications provider_applications_reviewed_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_applications
    ADD CONSTRAINT provider_applications_reviewed_by_users_id_fk FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: provider_applications provider_applications_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_applications
    ADD CONSTRAINT provider_applications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: provider_notifications provider_notifications_event_id_provider_application_events_id_; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_notifications
    ADD CONSTRAINT provider_notifications_event_id_provider_application_events_id_ FOREIGN KEY (event_id) REFERENCES public.provider_application_events(id) ON DELETE CASCADE;


--
-- Name: provider_notifications provider_notifications_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_notifications
    ADD CONSTRAINT provider_notifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: provider_profiles provider_profiles_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.provider_profiles
    ADD CONSTRAINT provider_profiles_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: push_tokens push_tokens_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.push_tokens
    ADD CONSTRAINT push_tokens_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_booking_id_bookings_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_booking_id_bookings_id_fk FOREIGN KEY (booking_id) REFERENCES public.bookings(id);


--
-- Name: reviews reviews_client_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_client_id_users_id_fk FOREIGN KEY (client_id) REFERENCES public.users(id);


--
-- Name: reviews reviews_provider_id_provider_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_provider_id_provider_profiles_id_fk FOREIGN KEY (provider_id) REFERENCES public.provider_profiles(id);


--
-- Name: services services_provider_id_provider_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_provider_id_provider_profiles_id_fk FOREIGN KEY (provider_id) REFERENCES public.provider_profiles(id) ON DELETE CASCADE;


--
-- Name: support_messages support_messages_ticket_id_support_tickets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_ticket_id_support_tickets_id_fk FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: support_messages support_messages_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.support_messages
    ADD CONSTRAINT support_messages_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: support_tickets support_tickets_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: travel_zones travel_zones_provider_id_provider_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.travel_zones
    ADD CONSTRAINT travel_zones_provider_id_provider_profiles_id_fk FOREIGN KEY (provider_id) REFERENCES public.provider_profiles(id) ON DELETE CASCADE;


--
-- Name: verification_docs verification_docs_provider_id_provider_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: foot
--

ALTER TABLE ONLY public.verification_docs
    ADD CONSTRAINT verification_docs_provider_id_provider_profiles_id_fk FOREIGN KEY (provider_id) REFERENCES public.provider_profiles(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 7d8SP8fmVulCst53L6ECa8VORzciqB7jcvccJdFhCmLN8ozvql5eEVbcyBKkJkK

