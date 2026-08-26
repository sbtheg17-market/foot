-- CANCELLATION_NO_SHOW_SUPPORT_V1.sql
-- Roadmap #13 — cancellation/no-show policy + minimal support workflow
-- (docs/cancellation-no-show-policy.md).
-- ADDITIVE ONLY: one new enum, one new append-only table, one index, three
-- nullable booking columns, one nullable support_tickets column. No existing
-- table, enum, index, or row is modified or removed. Existing bookings remain
-- safely unconfigured (all new columns NULL) until a cancellation/no-show
-- path touches them. No DOWN migration is provided by policy
-- (docs/managed-db-release-gate.md): rollback is restore-based.
-- Apply only per the managed database release gate. Tested against a
-- disposable local PostgreSQL only.

CREATE TYPE "public"."booking_outcome_action" AS ENUM
  ('cancelled', 'no_show', 'support_corrected');

CREATE TABLE "booking_outcome_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "booking_id" integer NOT NULL,
  "actor_user_id" integer NOT NULL,
  "actor_role" "account_role" NOT NULL,
  "action" "booking_outcome_action" NOT NULL,
  "category" text,
  "reason_category" text,
  "reason_snapshot" text,
  "previous_status" "booking_status" NOT NULL,
  "new_status" "booking_status" NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "bookings" ADD COLUMN "cancellation_category" text;
ALTER TABLE "bookings" ADD COLUMN "no_show_marked_by" integer;
ALTER TABLE "bookings" ADD COLUMN "no_show_marked_at" timestamp;

ALTER TABLE "support_tickets" ADD COLUMN "booking_id" integer;

ALTER TABLE "booking_outcome_history" ADD CONSTRAINT "booking_outcome_history_booking_id_bookings_id_fk"
  FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "booking_outcome_history" ADD CONSTRAINT "booking_outcome_history_actor_user_id_users_id_fk"
  FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_show_marked_by_users_id_fk"
  FOREIGN KEY ("no_show_marked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_booking_id_bookings_id_fk"
  FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "booking_outcome_history_booking_created_idx"
  ON "booking_outcome_history" ("booking_id", "created_at" DESC, "id" DESC);
