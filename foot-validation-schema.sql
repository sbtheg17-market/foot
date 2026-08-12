CREATE TYPE "public"."user_role" AS ENUM('client', 'provider', 'admin');
CREATE TYPE "public"."account_role" AS ENUM('client', 'provider', 'admin');
CREATE TYPE "public"."verification_doc_status" AS ENUM('pending', 'approved', 'rejected');
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'under_review', 'approved', 'rejected');
CREATE TYPE "public"."provider_application_status" AS ENUM('draft', 'under_review', 'approved', 'rejected', 'suspended');
CREATE TYPE "public"."provider_application_step" AS ENUM('profile', 'services', 'availability', 'verification', 'submitted');
CREATE TYPE "public"."provider_application_submission_outcome" AS ENUM('rejected');
CREATE TYPE "public"."provider_application_event_type" AS ENUM('submitted', 'reset_to_draft', 'approved', 'rejected');
CREATE TYPE "public"."booking_status" AS ENUM('requested', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'no_show');
CREATE TYPE "public"."invoice_status" AS ENUM('pending', 'paid', 'cancelled');
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'resolved');
CREATE TYPE "public"."marketplace_event_reason_code" AS ENUM('NOT_APPROVED', 'PROFILE_INCOMPLETE', 'NO_ACTIVE_SERVICE', 'NO_AVAILABILITY', 'NO_SERVICE_AREA', 'NOT_ACCEPTING_CLIENTS', 'DOCS_PENDING', 'PROVIDER_NOT_BOOKABLE', 'SERVICE_INACTIVE', 'SLOT_OUTSIDE_AVAILABILITY', 'SLOT_CONFLICT', 'PROVIDER_NOT_ACCEPTING', 'VALIDATION_ERROR', 'CLIENT_ABANDONED');
CREATE TYPE "public"."marketplace_event_source" AS ENUM('web', 'mobile', 'system');
CREATE TYPE "public"."marketplace_event_type" AS ENUM('provider_approved', 'profile_completed', 'first_service_published', 'availability_set', 'service_area_set', 'provider_activated', 'provider_deactivated', 'provider_search', 'provider_viewed', 'service_viewed', 'availability_slot_selected', 'booking_started', 'booking_submitted', 'booking_confirmed', 'booking_cancelled', 'booking_no_show');
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'client' NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"phone" text,
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE "account_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"role" "account_role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "account_roles_user_role_unique" UNIQUE("user_id","role")
);

CREATE TABLE "availability" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL
);

CREATE TABLE "provider_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"bio" text,
	"city" text DEFAULT '' NOT NULL,
	"service_area_notes" text,
	"verification_status" "verification_status" DEFAULT 'pending' NOT NULL,
	"rating" numeric(3, 2) DEFAULT '0' NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"profile_complete" boolean DEFAULT false NOT NULL,
	"years_experience" integer,
	"accepts_new_clients" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "provider_profiles_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE "travel_zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"zone_name" text NOT NULL,
	"city" text NOT NULL,
	"notes" text
);

CREATE TABLE "verification_docs" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"doc_type" text NOT NULL,
	"file_name" text NOT NULL,
	"status" "verification_doc_status" DEFAULT 'pending' NOT NULL,
	"reviewer_notes" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);

CREATE TABLE "provider_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider_profile_id" integer NOT NULL,
	"status" "provider_application_status" DEFAULT 'draft' NOT NULL,
	"current_step" "provider_application_step" DEFAULT 'profile' NOT NULL,
	"submitted_at" timestamp,
	"reviewed_at" timestamp,
	"reviewed_by" integer,
	"reviewer_notes" text,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "provider_applications_user_unique" UNIQUE("user_id"),
	CONSTRAINT "provider_applications_profile_unique" UNIQUE("provider_profile_id")
);

CREATE TABLE "provider_application_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_application_id" integer NOT NULL,
	"outcome" "provider_application_submission_outcome" NOT NULL,
	"submitted_at" timestamp NOT NULL,
	"reviewed_at" timestamp,
	"reviewed_by" integer,
	"reviewer_notes" text,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "provider_application_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_application_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"type" "provider_application_event_type" NOT NULL,
	"from_status" "provider_application_status" NOT NULL,
	"to_status" "provider_application_status" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "provider_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"type" "provider_application_event_type" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "provider_notifications_user_event_unique" UNIQUE("user_id","event_id")
);

CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"duration_minutes" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"category" text DEFAULT 'foot_care' NOT NULL,
	"eligibility_notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"provider_id" integer NOT NULL,
	"service_id" integer NOT NULL,
	"status" "booking_status" DEFAULT 'requested' NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"postal_code" text,
	"care_notes" text,
	"client_notes" text,
	"cancelled_by" integer,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"provider_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_booking_id_unique" UNIQUE("booking_id")
);

CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"provider_id" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" "invoice_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp,
	"stripe_payment_intent_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_booking_id_unique" UNIQUE("booking_id")
);

CREATE TABLE "support_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subject" text NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "push_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"platform" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "push_tokens_token_unique" UNIQUE("token")
);

CREATE TABLE "marketplace_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" "marketplace_event_type" NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"actor_user_id" integer,
	"actor_role" "account_role",
	"provider_profile_id" integer,
	"client_user_id" integer,
	"service_id" integer,
	"booking_id" integer,
	"correlation_id" text,
	"source" "marketplace_event_source" NOT NULL,
	"metadata" jsonb,
	"reason_code" "marketplace_event_reason_code"
);

ALTER TABLE "account_roles" ADD CONSTRAINT "account_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "availability" ADD CONSTRAINT "availability_provider_id_provider_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "travel_zones" ADD CONSTRAINT "travel_zones_provider_id_provider_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "verification_docs" ADD CONSTRAINT "verification_docs_provider_id_provider_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "provider_applications" ADD CONSTRAINT "provider_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "provider_applications" ADD CONSTRAINT "provider_applications_provider_profile_id_provider_profiles_id_fk" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."provider_profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "provider_applications" ADD CONSTRAINT "provider_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "provider_application_submissions" ADD CONSTRAINT "provider_application_submissions_provider_application_id_provider_applications_id_fk" FOREIGN KEY ("provider_application_id") REFERENCES "public"."provider_applications"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "provider_application_submissions" ADD CONSTRAINT "provider_application_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "provider_application_events" ADD CONSTRAINT "provider_application_events_provider_application_id_provider_applications_id_fk" FOREIGN KEY ("provider_application_id") REFERENCES "public"."provider_applications"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "provider_application_events" ADD CONSTRAINT "provider_application_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "provider_notifications" ADD CONSTRAINT "provider_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "provider_notifications" ADD CONSTRAINT "provider_notifications_event_id_provider_application_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."provider_application_events"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "services" ADD CONSTRAINT "services_provider_id_provider_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_provider_id_provider_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_provider_id_provider_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_provider_id_provider_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "marketplace_events" ADD CONSTRAINT "marketplace_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "marketplace_events" ADD CONSTRAINT "marketplace_events_provider_profile_id_provider_profiles_id_fk" FOREIGN KEY ("provider_profile_id") REFERENCES "public"."provider_profiles"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "marketplace_events" ADD CONSTRAINT "marketplace_events_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "marketplace_events" ADD CONSTRAINT "marketplace_events_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "marketplace_events" ADD CONSTRAINT "marketplace_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "account_roles_user_id_idx" ON "account_roles" USING btree ("user_id");
CREATE INDEX "account_roles_role_idx" ON "account_roles" USING btree ("role");
CREATE INDEX "provider_applications_user_id_idx" ON "provider_applications" USING btree ("user_id");
CREATE INDEX "provider_applications_status_idx" ON "provider_applications" USING btree ("status");
CREATE INDEX "provider_application_submissions_app_created_id_idx" ON "provider_application_submissions" USING btree ("provider_application_id","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);
CREATE INDEX "provider_application_events_app_created_idx" ON "provider_application_events" USING btree ("provider_application_id","created_at");
CREATE INDEX "provider_notifications_user_created_id_idx" ON "provider_notifications" USING btree ("user_id","created_at" DESC NULLS FIRST,"id" DESC NULLS FIRST);
CREATE UNIQUE INDEX "bookings_active_booking_unique_idx" ON "bookings" USING btree ("client_id","provider_id","service_id","scheduled_at") WHERE status IN ('requested','confirmed','rescheduled');
CREATE INDEX "marketplace_events_type_occurred_idx" ON "marketplace_events" USING btree ("event_type","occurred_at" DESC NULLS LAST);
CREATE INDEX "marketplace_events_provider_occurred_idx" ON "marketplace_events" USING btree ("provider_profile_id","occurred_at" DESC NULLS LAST);
CREATE INDEX "marketplace_events_client_occurred_idx" ON "marketplace_events" USING btree ("client_user_id","occurred_at" DESC NULLS LAST);
CREATE INDEX "marketplace_events_correlation_idx" ON "marketplace_events" USING btree ("correlation_id");
CREATE INDEX "marketplace_events_occurred_idx" ON "marketplace_events" USING btree ("occurred_at" DESC NULLS LAST);
