-- RESCHEDULE_PROPOSALS_HISTORY_V1.sql
-- Roadmap item 9 — consent-first provider rescheduling (docs/rescheduling-policy.md).
-- ADDITIVE ONLY: two new enums, two new tables, three indexes. No existing
-- table, enum, index, or row is modified. No DOWN migration is provided by
-- policy (docs/managed-db-release-gate.md): rollback is restore-based.
-- Apply only per the managed database release gate. Tested against a
-- disposable local PostgreSQL only.

CREATE TYPE "public"."reschedule_proposal_status" AS ENUM
  ('pending', 'accepted', 'declined', 'cancelled', 'expired', 'unresolved');

CREATE TYPE "public"."reschedule_notification_outcome" AS ENUM
  ('not_requested', 'sent', 'failed');

CREATE TABLE "booking_reschedule_proposals" (
  "id" serial PRIMARY KEY NOT NULL,
  "booking_id" integer NOT NULL,
  "requester_user_id" integer NOT NULL,
  "requester_role" "account_role" NOT NULL,
  "original_scheduled_at" timestamp NOT NULL,
  "proposed_scheduled_at" timestamp NOT NULL,
  "reason" text,
  "status" "reschedule_proposal_status" DEFAULT 'pending' NOT NULL,
  "deadline_at" timestamp NOT NULL,
  "responded_by_user_id" integer,
  "resolved_at" timestamp,
  "idempotency_key" text NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "notification_outcome" "reschedule_notification_outcome" DEFAULT 'not_requested' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "booking_reschedule_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "booking_id" integer NOT NULL,
  "proposal_id" integer,
  "original_scheduled_at" timestamp NOT NULL,
  "new_scheduled_at" timestamp NOT NULL,
  "requester_user_id" integer NOT NULL,
  "requester_role" "account_role" NOT NULL,
  "responded_by_user_id" integer,
  "reason" text,
  "previous_status" "booking_status" NOT NULL,
  "new_status" "booking_status" NOT NULL,
  "idempotency_key" text,
  "notification_outcome" "reschedule_notification_outcome" DEFAULT 'not_requested' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "booking_reschedule_proposals" ADD CONSTRAINT "booking_reschedule_proposals_booking_id_bookings_id_fk"
  FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "booking_reschedule_proposals" ADD CONSTRAINT "booking_reschedule_proposals_requester_user_id_users_id_fk"
  FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "booking_reschedule_proposals" ADD CONSTRAINT "booking_reschedule_proposals_responded_by_user_id_users_id_fk"
  FOREIGN KEY ("responded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "booking_reschedule_history" ADD CONSTRAINT "booking_reschedule_history_booking_id_bookings_id_fk"
  FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "booking_reschedule_history" ADD CONSTRAINT "booking_reschedule_history_proposal_id_booking_reschedule_proposals_id_fk"
  FOREIGN KEY ("proposal_id") REFERENCES "public"."booking_reschedule_proposals"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "booking_reschedule_history" ADD CONSTRAINT "booking_reschedule_history_requester_user_id_users_id_fk"
  FOREIGN KEY ("requester_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "booking_reschedule_history" ADD CONSTRAINT "booking_reschedule_history_responded_by_user_id_users_id_fk"
  FOREIGN KEY ("responded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

CREATE UNIQUE INDEX "reschedule_proposals_requester_idempotency_idx"
  ON "booking_reschedule_proposals" ("requester_user_id", "idempotency_key");
CREATE UNIQUE INDEX "reschedule_proposals_single_pending_idx"
  ON "booking_reschedule_proposals" ("booking_id") WHERE status = 'pending';
CREATE INDEX "reschedule_proposals_booking_created_idx"
  ON "booking_reschedule_proposals" ("booking_id", "created_at" DESC);
CREATE INDEX "reschedule_history_booking_created_idx"
  ON "booking_reschedule_history" ("booking_id", "created_at" DESC, "id" DESC);
