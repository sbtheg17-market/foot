import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { accountRoleEnum } from "./account-roles";
import { providerProfilesTable } from "./providers";
import { servicesTable } from "./services";
import { bookingsTable } from "./bookings";

/**
 * Generic, append-only marketplace event log (Provider Activation & First
 * Booking Conversion — Phase 1, additive migration ONLY).
 *
 * Scope of THIS phase: table + indexes only. No readiness logic, no event
 * emission, no booking enforcement, no discovery gating, no reporting API, no
 * UI. Nothing writes to or reads from this table yet.
 *
 * Design (see CHECKPOINT_PROVIDER_ACTIVATION_FIRST_BOOKING_SPEC.md):
 *  - Append-only: rows are inserted at a transition and never updated/deleted
 *    by application code (retention/erasure handled operationally, below).
 *  - Vendor-neutral: no coupling to email/push/external-analytics vendors.
 *  - Tenancy: `provider_profile_id` is the business/tenant key. Today one user
 *    maps to one provider profile (one-person business); this column is
 *    forward-compatible with a future org/business entity without reworking
 *    the event model.
 *  - Privacy/retention: store IDs + small typed metadata ONLY. Never store PII
 *    (names, addresses, contact info, care notes) or secrets in `metadata`.
 *    Raw events are retained ~13 months (operational policy). User references
 *    use ON DELETE SET NULL so an erasure request anonymizes events (keeps the
 *    aggregate, drops the identity) rather than destroying the funnel history.
 *
 * Event types and reason codes are stable and additive-only (new values may be
 * appended in later, separately-approved phases; existing values are not
 * renamed or removed).
 */

/** Stable marketplace event types (activation funnel + client conversion funnel). */
export const marketplaceEventTypeEnum = pgEnum("marketplace_event_type", [
  // ── Provider activation funnel ────────────────────────────────────────────
  "provider_approved",
  "profile_completed",
  "first_service_published",
  "availability_set",
  "service_area_set",
  "provider_activated",
  "provider_deactivated",
  // ── Client conversion funnel ──────────────────────────────────────────────
  "provider_search",
  "provider_viewed",
  "service_viewed",
  "availability_slot_selected",
  "booking_started",
  "booking_submitted",
  "booking_confirmed",
  "booking_cancelled",
  "booking_no_show",
]);

/** Stable reason codes for drop-off / deactivation / booking-rejection events. */
export const marketplaceEventReasonCodeEnum = pgEnum(
  "marketplace_event_reason_code",
  [
    // Readiness / deactivation
    "NOT_APPROVED",
    "PROFILE_INCOMPLETE",
    "NO_ACTIVE_SERVICE",
    "NO_AVAILABILITY",
    "NO_SERVICE_AREA",
    "NOT_ACCEPTING_CLIENTS",
    "DOCS_PENDING",
    // Booking rejection / conversion drop-off
    "PROVIDER_NOT_BOOKABLE",
    "SERVICE_INACTIVE",
    "SLOT_OUTSIDE_AVAILABILITY",
    "SLOT_CONFLICT",
    "PROVIDER_NOT_ACCEPTING",
    "VALIDATION_ERROR",
    "CLIENT_ABANDONED",
  ],
);

/** Origin of the event. */
export const marketplaceEventSourceEnum = pgEnum("marketplace_event_source", [
  "web",
  "mobile",
  "system",
]);

export const marketplaceEventsTable = pgTable(
  "marketplace_events",
  {
    id: serial("id").primaryKey(),

    // What happened + when
    eventType: marketplaceEventTypeEnum("event_type").notNull(),
    occurredAt: timestamp("occurred_at").notNull(),
    recordedAt: timestamp("recorded_at").notNull().defaultNow(),

    // Actor context (nullable: anonymous browse has no user/role).
    // SET NULL on user delete → erasure anonymizes without dropping the event.
    actorUserId: integer("actor_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    actorRole: accountRoleEnum("actor_role"),

    // Business/tenant context (the provider "business" key).
    providerProfileId: integer("provider_profile_id").references(
      () => providerProfilesTable.id,
      { onDelete: "set null" },
    ),

    // Subject references (nullable; present when relevant to the event).
    clientUserId: integer("client_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    serviceId: integer("service_id").references(() => servicesTable.id, {
      onDelete: "set null",
    }),
    bookingId: integer("booking_id").references(() => bookingsTable.id, {
      onDelete: "set null",
    }),

    // Journey stitching + origin
    correlationId: text("correlation_id"),
    source: marketplaceEventSourceEnum("source").notNull(),

    // Small typed metadata bag — IDs / enums / counts only. NEVER PII or secrets.
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    // Required on drop-off / deactivation / rejection events.
    reasonCode: marketplaceEventReasonCodeEnum("reason_code"),
  },
  (table) => [
    // Type + time range scans (e.g. all `booking_confirmed` in a window).
    index("marketplace_events_type_occurred_idx").on(
      table.eventType,
      table.occurredAt.desc(),
    ),
    // Per-provider (business) funnels, newest-first.
    index("marketplace_events_provider_occurred_idx").on(
      table.providerProfileId,
      table.occurredAt.desc(),
    ),
    // Per-client journeys, newest-first.
    index("marketplace_events_client_occurred_idx").on(
      table.clientUserId,
      table.occurredAt.desc(),
    ),
    // Stitch a single browse/booking session.
    index("marketplace_events_correlation_idx").on(table.correlationId),
    // General time-range reporting.
    index("marketplace_events_occurred_idx").on(table.occurredAt.desc()),
  ],
);

export type MarketplaceEvent = typeof marketplaceEventsTable.$inferSelect;
export type InsertMarketplaceEvent = typeof marketplaceEventsTable.$inferInsert;
