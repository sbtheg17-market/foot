import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  marketplaceEventsTable,
  providerProfilesTable,
} from "@workspace/db";
import { logger } from "./logger.js";
import {
  computeReadiness,
  loadReadinessSourceByProfileId,
} from "./provider-readiness.js";

// Drizzle transaction handle type, derived from db.transaction's callback.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Provider Activation & First Booking Conversion — Phase 3 (event emission
 * ONLY). Appends rows to the EXISTING `marketplace_events` table (Phase 1
 * schema; zero schema changes, no new enum values) at provider-activation
 * transitions and funnel milestones.
 *
 * Invariants (see the approved Phase 3 scope):
 *  - Activation state stays DERIVED — nothing is persisted besides the
 *    append-only event rows themselves; the log is the record of the prior
 *    state used for flip detection.
 *  - Emission happens INSIDE the caller's transaction, AFTER the state
 *    write: mutation and event commit or roll back atomically.
 *  - Append-only: this module only INSERTs into `marketplace_events`.
 *  - Privacy: `metadata` carries booleans / typed enum codes / IDs ONLY —
 *    never PII, free text, reviewer material, or rejection reasons.
 *  - `source` is always "system" in Phase 3 (server-derived transitions;
 *    client `web`/`mobile` attribution belongs to the client-funnel phase).
 *  - Out of scope here: discovery gating, booking enforcement, reporting,
 *    UI, client-conversion events, correlation stitching.
 */

export type MarketplaceActor = {
  userId: number;
  role: "client" | "provider" | "admin";
};

/**
 * Which funnel milestones the calling mutation could have affected. The
 * activation-flip transition check always runs; milestone checks run only
 * when flagged so unrelated mutations never write milestone events.
 */
export type ActivationEmissionContext = {
  /** Mutation wrote profile fields (C2). */
  checkProfileCompleted?: boolean;
  /** Mutation wrote services (C3). */
  checkFirstServicePublished?: boolean;
  /** Mutation wrote availability (C4). */
  checkAvailabilitySet?: boolean;
  /** Mutation wrote travel zones (C5). */
  checkServiceAreaSet?: boolean;
  /** Reviewer decision approved the application (emits provider_approved). */
  providerApproved?: boolean;
};

type ActivationEventType =
  | "provider_approved"
  | "profile_completed"
  | "first_service_published"
  | "availability_set"
  | "service_area_set"
  | "provider_activated"
  | "provider_deactivated";

const TRANSITION_EVENT_TYPES = [
  "provider_activated",
  "provider_deactivated",
] as const;

/** True when a `marketplace_events` row of this type already exists for the provider. */
async function milestoneExists(
  tx: Tx,
  providerProfileId: number,
  eventType: ActivationEventType,
): Promise<boolean> {
  const rows = await tx
    .select({ id: marketplaceEventsTable.id })
    .from(marketplaceEventsTable)
    .where(
      and(
        eq(marketplaceEventsTable.providerProfileId, providerProfileId),
        eq(marketplaceEventsTable.eventType, eventType),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

async function insertEvent(
  tx: Tx,
  row: {
    eventType: ActivationEventType;
    occurredAt: Date;
    providerProfileId: number;
    actor: MarketplaceActor;
    serviceId?: number | null;
    metadata?: Record<string, unknown>;
    reasonCode?:
      | "NOT_APPROVED"
      | "PROFILE_INCOMPLETE"
      | "NO_ACTIVE_SERVICE"
      | "NO_AVAILABILITY"
      | "NO_SERVICE_AREA"
      | "NOT_ACCEPTING_CLIENTS"
      | "DOCS_PENDING";
  },
): Promise<void> {
  await tx.insert(marketplaceEventsTable).values({
    eventType: row.eventType,
    occurredAt: row.occurredAt,
    actorUserId: row.actor.userId,
    actorRole: row.actor.role,
    providerProfileId: row.providerProfileId,
    serviceId: row.serviceId ?? null,
    source: "system",
    metadata: row.metadata ?? null,
    reasonCode: row.reasonCode ?? null,
  });
  // Observability: one structured line per emission — IDs and enum codes only.
  logger.info(
    {
      marketplaceEvent: row.eventType,
      providerProfileId: row.providerProfileId,
      ...(row.reasonCode ? { reasonCode: row.reasonCode } : {}),
    },
    "marketplace event emitted",
  );
}

/**
 * Emit activation-funnel marketplace events for a provider whose raw
 * readiness inputs may have just changed. MUST be called inside the same
 * transaction as the mutating write, after that write.
 *
 * Behavior:
 *  1. Locks the provider profile row (`FOR UPDATE`) so concurrent mutations
 *     for the same provider serialize their flip detection — duplicate
 *     transition events cannot be produced by interleaving.
 *  2. Recomputes C1–C7 live (Phase 2 `computeReadiness`) inside the tx.
 *  3. Emits `provider_approved` when the caller is an approval decision.
 *  4. Emits once-ever funnel milestones (`profile_completed`,
 *     `first_service_published`, `availability_set`, `service_area_set`)
 *     when the corresponding criterion is satisfied and no such event has
 *     ever been recorded for the provider.
 *  5. Compares derived activation against the most recent recorded
 *     transition event and emits `provider_activated` /
 *     `provider_deactivated` ONLY on an actual flip. Deactivation carries
 *     `reason_code` = the FIRST missing code in deterministic C1→C7 order.
 *
 * Recomputation without a flip emits nothing (idempotent).
 */
export async function emitProviderActivationEvents(
  tx: Tx,
  opts: {
    providerProfileId: number;
    actor: MarketplaceActor;
    context: ActivationEmissionContext;
    /** Service relevant to this mutation (attached to first_service_published). */
    serviceId?: number;
  },
): Promise<void> {
  const { providerProfileId, actor, context, serviceId } = opts;

  // Serialize per-provider emission: every wired mutation runs inside a
  // transaction, so locking the profile row makes flip detection atomic
  // across concurrent requests for the same provider.
  const locked = await tx
    .select({ id: providerProfilesTable.id })
    .from(providerProfilesTable)
    .where(eq(providerProfilesTable.id, providerProfileId))
    .limit(1)
    .for("update");
  if (locked.length === 0) return; // profile gone — nothing to record

  const source = await loadReadinessSourceByProfileId(tx, providerProfileId);
  if (!source) return;
  const readiness = await computeReadiness(tx, source);

  const occurredAt = new Date();

  // ── Approval decision event (one per real under_review → approved) ────────
  if (context.providerApproved) {
    await insertEvent(tx, {
      eventType: "provider_approved",
      occurredAt,
      providerProfileId,
      actor,
    });
  }

  // ── Once-ever funnel milestones ────────────────────────────────────────────
  if (
    context.checkProfileCompleted &&
    readiness.criteria.profileComplete &&
    !(await milestoneExists(tx, providerProfileId, "profile_completed"))
  ) {
    await insertEvent(tx, {
      eventType: "profile_completed",
      occurredAt,
      providerProfileId,
      actor,
    });
  }

  if (
    context.checkFirstServicePublished &&
    readiness.criteria.activeService &&
    !(await milestoneExists(tx, providerProfileId, "first_service_published"))
  ) {
    await insertEvent(tx, {
      eventType: "first_service_published",
      occurredAt,
      providerProfileId,
      actor,
      serviceId: serviceId ?? null,
    });
  }

  if (
    context.checkAvailabilitySet &&
    readiness.criteria.availability &&
    !(await milestoneExists(tx, providerProfileId, "availability_set"))
  ) {
    await insertEvent(tx, {
      eventType: "availability_set",
      occurredAt,
      providerProfileId,
      actor,
    });
  }

  if (
    context.checkServiceAreaSet &&
    readiness.criteria.serviceArea &&
    !(await milestoneExists(tx, providerProfileId, "service_area_set"))
  ) {
    await insertEvent(tx, {
      eventType: "service_area_set",
      occurredAt,
      providerProfileId,
      actor,
    });
  }

  // ── Activation transition (flip-only) ─────────────────────────────────────
  const lastTransition = await tx
    .select({ eventType: marketplaceEventsTable.eventType })
    .from(marketplaceEventsTable)
    .where(
      and(
        eq(marketplaceEventsTable.providerProfileId, providerProfileId),
        inArray(marketplaceEventsTable.eventType, [
          ...TRANSITION_EVENT_TYPES,
        ]),
      ),
    )
    .orderBy(
      desc(marketplaceEventsTable.occurredAt),
      desc(marketplaceEventsTable.id),
    )
    .limit(1);

  const previousActivated =
    lastTransition[0]?.eventType === "provider_activated";

  if (readiness.activated && !previousActivated) {
    await insertEvent(tx, {
      eventType: "provider_activated",
      occurredAt,
      providerProfileId,
      actor,
      // Booleans only — never raw field values.
      metadata: { criteria: readiness.criteria },
    });
  } else if (!readiness.activated && previousActivated) {
    await insertEvent(tx, {
      eventType: "provider_deactivated",
      occurredAt,
      providerProfileId,
      actor,
      // First missing code in deterministic C1→C7 order.
      reasonCode: readiness.missing[0],
      // Enum codes only — never raw field values.
      metadata: { missing: readiness.missing },
    });
  }
}
