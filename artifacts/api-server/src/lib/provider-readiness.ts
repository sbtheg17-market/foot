import { and, eq } from "drizzle-orm";
import {
  db,
  availabilityTable,
  providerApplicationsTable,
  providerProfilesTable,
  servicesTable,
  travelZonesTable,
  verificationDocsTable,
} from "@workspace/db";

// Drizzle transaction handle type, derived from db.transaction's callback.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Query executor: the shared pool client or an open transaction. */
export type DbExecutor = typeof db | Tx;

/**
 * Provider Activation & First Booking Conversion — readiness computation
 * (Phase 2). Extracted into a lib module in Phase 3 so event emission can
 * compute readiness INSIDE the same transaction as the mutating write; the
 * behavior of the Phase 2 readiness view is unchanged.
 *
 * The C1–C7 criteria are computed live from raw source fields on every
 * call; stored roll-up flags (profileComplete) are never trusted. Reason
 * codes are the stable readiness subset of `marketplace_event_reason_code`
 * and are reported in deterministic C1→C7 order.
 */

/**
 * Platform-mandated verification document types. Empty today — the product
 * does not currently mandate any document type, so C7 is auto-satisfied.
 * When a document type becomes mandated (a later, separately-approved
 * change), C7 requires an approved verification document for every listed
 * type and reports `DOCS_PENDING` otherwise.
 */
export const MANDATED_DOC_TYPES: readonly string[] = [];

export type ReadinessMissingCode =
  | "NOT_APPROVED"
  | "PROFILE_INCOMPLETE"
  | "NO_ACTIVE_SERVICE"
  | "NO_AVAILABILITY"
  | "NO_SERVICE_AREA"
  | "NOT_ACCEPTING_CLIENTS"
  | "DOCS_PENDING";

export type ReadinessSource = {
  providerProfileId: number;
  title: string;
  bio: string | null;
  city: string;
  acceptsNewClients: boolean;
  verificationStatus: "pending" | "under_review" | "approved" | "rejected";
  applicationStatus:
    | "draft"
    | "under_review"
    | "approved"
    | "rejected"
    | "suspended"
    | null;
};

export type ProviderReadiness = {
  activated: boolean;
  missing: ReadinessMissingCode[];
  criteria: {
    approved: boolean;
    profileComplete: boolean;
    activeService: boolean;
    availability: boolean;
    serviceArea: boolean;
    acceptingClients: boolean;
    documents: boolean;
  };
};

const readinessSourceColumns = {
  providerProfileId: providerProfilesTable.id,
  title: providerProfilesTable.title,
  bio: providerProfilesTable.bio,
  city: providerProfilesTable.city,
  acceptsNewClients: providerProfilesTable.acceptsNewClients,
  verificationStatus: providerProfilesTable.verificationStatus,
  applicationStatus: providerApplicationsTable.status,
};

/** Owner-scoped raw-source load by the authenticated user id. */
export async function loadReadinessSourceByUserId(
  executor: DbExecutor,
  userId: number,
): Promise<ReadinessSource | null> {
  const rows = await executor
    .select(readinessSourceColumns)
    .from(providerProfilesTable)
    .leftJoin(
      providerApplicationsTable,
      eq(
        providerApplicationsTable.providerProfileId,
        providerProfilesTable.id,
      ),
    )
    .where(eq(providerProfilesTable.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** Raw-source load by provider profile id (server-internal callers only). */
export async function loadReadinessSourceByProfileId(
  executor: DbExecutor,
  providerProfileId: number,
): Promise<ReadinessSource | null> {
  const rows = await executor
    .select(readinessSourceColumns)
    .from(providerProfilesTable)
    .leftJoin(
      providerApplicationsTable,
      eq(
        providerApplicationsTable.providerProfileId,
        providerProfilesTable.id,
      ),
    )
    .where(eq(providerProfilesTable.id, providerProfileId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Compute the C1–C7 activation criteria live from raw source fields.
 *
 *  C1 approved         — application approved AND profile verification
 *                        approved (same boundary as requireApprovedProvider)
 *  C2 profileComplete  — non-empty title, city, and bio ONLY (trimmed;
 *                        the stored profileComplete flag is never read)
 *  C3 activeService    — at least one active service
 *  C4 availability     — at least one availability slot
 *  C5 serviceArea      — at least one travel zone
 *  C6 acceptingClients — acceptsNewClients is true
 *  C7 documents        — every mandated doc type has an approved
 *                        verification document; auto-satisfied while no
 *                        document type is mandated
 */
export async function computeReadiness(
  executor: DbExecutor,
  source: ReadinessSource,
): Promise<ProviderReadiness> {
  const profileId = source.providerProfileId;

  // Sequential on purpose: this may run on a transaction client, where
  // parallel queries on the single underlying connection are deprecated
  // (pg@9 removes the implicit queueing). All four probes are LIMIT 1.
  const serviceRows = await executor
    .select({ id: servicesTable.id })
    .from(servicesTable)
    .where(
      and(
        eq(servicesTable.providerId, profileId),
        eq(servicesTable.isActive, true),
      ),
    )
    .limit(1);
  const slotRows = await executor
    .select({ id: availabilityTable.id })
    .from(availabilityTable)
    .where(eq(availabilityTable.providerId, profileId))
    .limit(1);
  const zoneRows = await executor
    .select({ id: travelZonesTable.id })
    .from(travelZonesTable)
    .where(eq(travelZonesTable.providerId, profileId))
    .limit(1);
  const approvedDocRows: Array<{ docType: string }> =
    MANDATED_DOC_TYPES.length > 0
      ? await executor
          .select({ docType: verificationDocsTable.docType })
          .from(verificationDocsTable)
          .where(
            and(
              eq(verificationDocsTable.providerId, profileId),
              eq(verificationDocsTable.status, "approved"),
            ),
          )
      : [];

  const approvedDocTypes = new Set(approvedDocRows.map((row) => row.docType));

  const criteria = {
    // C1
    approved:
      source.applicationStatus === "approved" &&
      source.verificationStatus === "approved",
    // C2 — ONLY title, city, and bio; computed live from the raw columns.
    profileComplete:
      source.title.trim().length > 0 &&
      source.city.trim().length > 0 &&
      (source.bio ?? "").trim().length > 0,
    // C3
    activeService: serviceRows.length > 0,
    // C4
    availability: slotRows.length > 0,
    // C5
    serviceArea: zoneRows.length > 0,
    // C6
    acceptingClients: source.acceptsNewClients === true,
    // C7 — auto-satisfied while MANDATED_DOC_TYPES is empty.
    documents: MANDATED_DOC_TYPES.every((docType) =>
      approvedDocTypes.has(docType),
    ),
  };

  // Deterministic C1→C7 order — matches the stable reason-code enum order.
  const missing: ReadinessMissingCode[] = [];
  if (!criteria.approved) missing.push("NOT_APPROVED");
  if (!criteria.profileComplete) missing.push("PROFILE_INCOMPLETE");
  if (!criteria.activeService) missing.push("NO_ACTIVE_SERVICE");
  if (!criteria.availability) missing.push("NO_AVAILABILITY");
  if (!criteria.serviceArea) missing.push("NO_SERVICE_AREA");
  if (!criteria.acceptingClients) missing.push("NOT_ACCEPTING_CLIENTS");
  if (!criteria.documents) missing.push("DOCS_PENDING");

  const activated =
    criteria.approved &&
    criteria.profileComplete &&
    criteria.activeService &&
    criteria.availability &&
    criteria.serviceArea &&
    criteria.acceptingClients &&
    criteria.documents;

  return { activated, missing, criteria };
}
