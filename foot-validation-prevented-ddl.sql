CREATE TYPE "public"."prevented_booking_path" AS ENUM('preflight', 'index_violation');
CREATE TABLE "prevented_booking_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"marketplace_id" integer NOT NULL,
	"correlation_id" text NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"actor_user_id" integer,
	"subject_booking_id" integer,
	"provider_id" integer,
	"service_id" integer,
	"scheduled_at" timestamp NOT NULL,
	"path" "prevented_booking_path" NOT NULL
);
ALTER TABLE "prevented_booking_records" ADD CONSTRAINT "prevented_booking_records_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "prevented_booking_records" ADD CONSTRAINT "prevented_booking_records_subject_booking_id_bookings_id_fk" FOREIGN KEY ("subject_booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "prevented_booking_records" ADD CONSTRAINT "prevented_booking_records_provider_id_provider_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "prevented_booking_records" ADD CONSTRAINT "prevented_booking_records_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;
CREATE UNIQUE INDEX "prevented_booking_records_correlation_unique_idx" ON "prevented_booking_records" USING btree ("correlation_id");
CREATE INDEX "prevented_booking_records_marketplace_provider_occurred_idx" ON "prevented_booking_records" USING btree ("marketplace_id","provider_id","occurred_at" DESC NULLS LAST);