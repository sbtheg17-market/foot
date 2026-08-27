import { asc, eq, sql } from "drizzle-orm";
import {
  db,
  availabilityTable,
  bookingsTable,
  pilotProviderRetentionTable,
  providerApplicationsTable,
  providerProfilesTable,
  servicesTable,
  supportTicketsTable,
  usersTable,
  verificationDocsTable,
} from "@workspace/db";
import { isCoverageConfigured, loadProviderCoverage } from "./service-area.js";

/**
 * Pilot Operations Dashboard — metric computation (Part 1).
 *
 * Vertical-neutral: measures provider readiness (activation milestones),
 * outcomes (completion/cancellation/no-show), source effectiveness, support
 * load, and retention intent. No foot-care specifics are encoded in metric
 * logic; the five-provider Southern Ontario framing is display context only.
 *
 * Privacy: the response never contains client identity, addresses/postal
 * codes, care notes, document references, reviewer/support notes, or raw
 * tracking parameters. Provider identity is limited to what admins already
 * see elsewhere (name + safe approval status).
 */

export type RetentionIntent = "yes" | "no" | "unknown";

export type ActivationStatus =
  | "not_started"
  | "in_progress"
  | "ready_to_publish"
  | "published"
  | "first_booking"
  | "active";

export type PilotWindow = {
  startDate: string;
  endDate: string;
  isProjected: boolean;
  /** Internal-safe indicator when env dates exist but are unusable. */
  configWarning: string | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(value: string | undefined): Date | null {
  if (!value || !ISO_DATE.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export const PILOT_WEEKS_FALLBACK = 5;

/**
 * Pilot window resolution (pure — unit-testable).
 *
 * If PILOT_START_DATE and PILOT_END_DATE are both valid ISO dates with
 * end > start, they are used (isProjected=false). Otherwise the window is
 * projected from the earliest booking date (or today when no bookings
 * exist) plus five weeks, and invalid configuration NEVER crashes the
 * dashboard — it falls back and reports an internal-safe configWarning.
 * Window days are UTC calendar days.
 */
export function resolvePilotWindow(
  startRaw: string | undefined,
  endRaw: string | undefined,
  earliestBookingAt: Date | null,
  now: Date = new Date(),
): PilotWindow {
  const start = parseIsoDate(startRaw);
  const end = parseIsoDate(endRaw);
  if (start && end && end.getTime() > start.getTime()) {
    return {
      startDate: dateKey(start),
      endDate: dateKey(end),
      isProjected: false,
      configWarning: null,
    };
  }
  const base = earliestBookingAt ?? now;
  const projectedStart = new Date(`${dateKey(base)}T00:00:00.000Z`);
  const projectedEnd = new Date(
    projectedStart.getTime() + PILOT_WEEKS_FALLBACK * 7 * 24 * 60 * 60 * 1000,
  );
  return {
    startDate: dateKey(projectedStart),
    endDate: dateKey(projectedEnd),
    isProjected: true,
    configWarning:
      startRaw !== undefined || endRaw !== undefined
        ? "PILOT_START_DATE/PILOT_END_DATE are missing, invalid, or end-before-start — using the projected window."
        : null,
  };
}

function roundRate(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function rateOrNull(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : roundRate(numerator / denominator);
}

export type PilotProviderMetrics = {
  providerId: string;
  providerName: string;
  approvalStatus: string;
  activationStatus: ActivationStatus;
  onboardingMilestones: {
    accountCreated: boolean;
    profileCompleted: boolean;
    verificationSubmitted: boolean;
    approved: boolean;
    serviceAreaConfigured: boolean;
    serviceConfigured: boolean;
    availabilityConfigured: boolean;
    bookingPagePublished: boolean;
    firstBookingReceived: boolean;
  };
  bookingPagePublished: boolean;
  firstBookingAt: string | null;
  bookings: number;
  completions: number;
  cancellations: number;
  noShows: number;
  completionRate: number | null;
  cancellationRate: number | null;
  noShowRate: number | null;
  repeatClientRate: number | null;
  attributedBookings: number;
  retentionIntent: RetentionIntent;
  retentionUpdatedAt: string | null;
  riskFlags: string[];
};

export type PilotMetricsResponse = {
  pilot: {
    startDate: string;
    endDate: string;
    isProjected: boolean;
    configWarning: string | null;
    providerTarget: number;
    generatedAt: string;
  };
  summary: {
    approvedProviders: number;
    activatedProviders: number;
    activationRate: number | null;
    providersWithPublishedBookingPage: number;
    providersWithAttributedBookings: number;
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    noShowBookings: number;
    completionRate: number | null;
    cancellationRate: number | null;
    noShowRate: number | null;
    supportEscalations: number;
    retentionYes: number;
    retentionNo: number;
    retentionUnknown: number;
  };
  providers: PilotProviderMetrics[];
  sourceAttribution: Array<{
    source: string;
    bookings: number;
    percentage: number | null;
  }>;
};

type WindowBookingRow = {
  providerId: number;
  clientId: number;
  status: string;
  source: string | null;
};

export async function computePilotMetrics(): Promise<PilotMetricsResponse> {
  const [earliest] = await db
    .select({ createdAt: bookingsTable.createdAt })
    .from(bookingsTable)
    .orderBy(asc(bookingsTable.createdAt))
    .limit(1);

  const window = resolvePilotWindow(
    process.env["PILOT_START_DATE"],
    process.env["PILOT_END_DATE"],
    earliest?.createdAt ?? null,
  );
  const windowStart = new Date(`${window.startDate}T00:00:00.000Z`);
  const windowEnd = new Date(`${window.endDate}T23:59:59.999Z`);

  // All provider profiles (funnel view). The APPROVED denominator below is
  // the subset with an approved application AND approved verification (the
  // same boundary as requireApprovedProvider).
  const profiles = await db
    .select({
      id: providerProfilesTable.id,
      title: providerProfilesTable.title,
      bio: providerProfilesTable.bio,
      city: providerProfilesTable.city,
      verificationStatus: providerProfilesTable.verificationStatus,
      bookingPagePublished: providerProfilesTable.bookingPagePublished,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      applicationStatus: providerApplicationsTable.status,
    })
    .from(providerProfilesTable)
    .innerJoin(usersTable, eq(usersTable.id, providerProfilesTable.userId))
    .leftJoin(
      providerApplicationsTable,
      eq(providerApplicationsTable.providerProfileId, providerProfilesTable.id),
    )
    .orderBy(asc(providerProfilesTable.id));

  // Bulk milestone probes (small pilot scale; grouped queries, no N+1 for
  // set membership).
  const [serviceRows, availabilityRows, verificationRows, firstBookingRows, retentionRows] =
    await Promise.all([
      db
        .selectDistinct({ providerId: servicesTable.providerId })
        .from(servicesTable)
        .where(eq(servicesTable.isActive, true)),
      db
        .selectDistinct({ providerId: availabilityTable.providerId })
        .from(availabilityTable),
      db
        .selectDistinct({ providerId: verificationDocsTable.providerId })
        .from(verificationDocsTable),
      db
        .select({
          providerId: bookingsTable.providerId,
          firstBookingAt: sql<Date>`min(${bookingsTable.createdAt})`,
        })
        .from(bookingsTable)
        .groupBy(bookingsTable.providerId),
      db
        .select({
          providerId: pilotProviderRetentionTable.providerId,
          retentionIntent: pilotProviderRetentionTable.retentionIntent,
          updatedAt: pilotProviderRetentionTable.updatedAt,
        })
        .from(pilotProviderRetentionTable),
    ]);

  const hasActiveService = new Set(serviceRows.map((r) => r.providerId));
  const hasAvailability = new Set(availabilityRows.map((r) => r.providerId));
  const hasVerificationDoc = new Set(verificationRows.map((r) => r.providerId));
  const firstBookingByProvider = new Map(
    firstBookingRows.map((r) => [r.providerId, new Date(r.firstBookingAt)]),
  );
  const retentionByProvider = new Map(
    retentionRows.map((r) => [r.providerId, r]),
  );

  // Service-area configuration uses the same authoritative check as the
  // booking-page publish eligibility (active config + >=1 active prefix).
  const serviceAreaConfigured = new Set<number>();
  for (const profile of profiles) {
    if (isCoverageConfigured(await loadProviderCoverage(db, profile.id))) {
      serviceAreaConfigured.add(profile.id);
    }
  }

  // Bookings are attributed to the pilot window by creation time (UTC days).
  const windowBookings: WindowBookingRow[] = await db
    .select({
      providerId: bookingsTable.providerId,
      clientId: bookingsTable.clientId,
      status: bookingsTable.status,
      source: bookingsTable.source,
    })
    .from(bookingsTable)
    .where(
      sql`${bookingsTable.createdAt} >= ${windowStart} and ${bookingsTable.createdAt} <= ${windowEnd}`,
    );

  const bookingsByProvider = new Map<number, WindowBookingRow[]>();
  for (const row of windowBookings) {
    const list = bookingsByProvider.get(row.providerId) ?? [];
    list.push(row);
    bookingsByProvider.set(row.providerId, list);
  }

  // Support escalations = tickets linked to a booking, created in the window.
  const [escalationCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(supportTicketsTable)
    .where(
      sql`${supportTicketsTable.bookingId} is not null and ${supportTicketsTable.createdAt} >= ${windowStart} and ${supportTicketsTable.createdAt} <= ${windowEnd}`,
    );

  const providers: PilotProviderMetrics[] = profiles.map((profile) => {
    const rows = bookingsByProvider.get(profile.id) ?? [];
    const completions = rows.filter((r) => r.status === "completed").length;
    const cancellations = rows.filter((r) => r.status === "cancelled").length;
    const noShows = rows.filter((r) => r.status === "no_show").length;
    const resolved = completions + cancellations + noShows;

    const clientCounts = new Map<number, number>();
    for (const row of rows) {
      clientCounts.set(row.clientId, (clientCounts.get(row.clientId) ?? 0) + 1);
    }
    const uniqueClients = clientCounts.size;
    const repeatClients = [...clientCounts.values()].filter((c) => c >= 2).length;

    const firstBookingAt = firstBookingByProvider.get(profile.id) ?? null;
    const approved =
      profile.applicationStatus === "approved" &&
      profile.verificationStatus === "approved";

    const milestones = {
      accountCreated: true,
      profileCompleted:
        profile.title.trim().length > 0 &&
        profile.city.trim().length > 0 &&
        (profile.bio ?? "").trim().length > 0,
      verificationSubmitted: hasVerificationDoc.has(profile.id),
      approved,
      serviceAreaConfigured: serviceAreaConfigured.has(profile.id),
      serviceConfigured: hasActiveService.has(profile.id),
      availabilityConfigured: hasAvailability.has(profile.id),
      bookingPagePublished: profile.bookingPagePublished,
      firstBookingReceived: firstBookingAt !== null,
    };

    const prePublishComplete =
      milestones.approved &&
      milestones.profileCompleted &&
      milestones.verificationSubmitted &&
      milestones.serviceAreaConfigured &&
      milestones.serviceConfigured &&
      milestones.availabilityConfigured;
    const activated = prePublishComplete && milestones.bookingPagePublished;
    const anyProgress =
      milestones.profileCompleted ||
      milestones.verificationSubmitted ||
      milestones.approved ||
      milestones.serviceAreaConfigured ||
      milestones.serviceConfigured ||
      milestones.availabilityConfigured ||
      milestones.bookingPagePublished;

    let activationStatus: ActivationStatus;
    if (rows.length > 0 && milestones.bookingPagePublished) {
      activationStatus = "active";
    } else if (milestones.firstBookingReceived) {
      activationStatus = "first_booking";
    } else if (milestones.bookingPagePublished) {
      activationStatus = "published";
    } else if (prePublishComplete) {
      activationStatus = "ready_to_publish";
    } else if (anyProgress) {
      activationStatus = "in_progress";
    } else {
      activationStatus = "not_started";
    }

    const completionRate = rateOrNull(completions, resolved);
    const cancellationRate = rateOrNull(cancellations, resolved);
    const noShowRate = rateOrNull(noShows, resolved);

    const retention = retentionByProvider.get(profile.id);
    const retentionIntent: RetentionIntent = retention?.retentionIntent ?? "unknown";

    const riskFlags: string[] = [];
    if (!activated) riskFlags.push("not_activated");
    if (prePublishComplete && !milestones.bookingPagePublished) {
      riskFlags.push("not_published");
    }
    if (milestones.bookingPagePublished && rows.length === 0 && !milestones.firstBookingReceived) {
      riskFlags.push("no_booking_yet");
    }
    if (cancellationRate !== null && cancellationRate > 0.2) {
      riskFlags.push("high_cancellation_rate");
    }
    if (noShowRate !== null && noShowRate > 0.1) {
      riskFlags.push("high_no_show_rate");
    }
    if (retentionIntent === "no") riskFlags.push("retention_risk");

    return {
      providerId: String(profile.id),
      providerName: `${profile.firstName} ${profile.lastName}`.trim(),
      approvalStatus: profile.applicationStatus ?? "unknown",
      activationStatus,
      onboardingMilestones: milestones,
      bookingPagePublished: profile.bookingPagePublished,
      firstBookingAt: firstBookingAt ? firstBookingAt.toISOString() : null,
      bookings: rows.length,
      completions,
      cancellations,
      noShows,
      completionRate,
      cancellationRate,
      noShowRate,
      repeatClientRate: rateOrNull(repeatClients, uniqueClients),
      attributedBookings: rows.filter((r) => r.source !== null && r.source.trim() !== "").length,
      retentionIntent,
      retentionUpdatedAt: retention ? retention.updatedAt.toISOString() : null,
      riskFlags,
    };
  });

  const approvedProviders = providers.filter(
    (p) => p.onboardingMilestones.approved,
  ).length;
  const activatedProviders = providers.filter(
    (p) =>
      p.onboardingMilestones.approved &&
      p.onboardingMilestones.profileCompleted &&
      p.onboardingMilestones.verificationSubmitted &&
      p.onboardingMilestones.serviceAreaConfigured &&
      p.onboardingMilestones.serviceConfigured &&
      p.onboardingMilestones.availabilityConfigured &&
      p.onboardingMilestones.bookingPagePublished,
  ).length;

  const totalBookings = windowBookings.length;
  const completedBookings = windowBookings.filter((r) => r.status === "completed").length;
  const cancelledBookings = windowBookings.filter((r) => r.status === "cancelled").length;
  const noShowBookings = windowBookings.filter((r) => r.status === "no_show").length;
  const resolvedBookings = completedBookings + cancelledBookings + noShowBookings;

  const sourceCounts = new Map<string, number>();
  for (const row of windowBookings) {
    const source = row.source && row.source.trim() !== "" ? row.source : "unknown";
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }
  const sourceAttribution = [...sourceCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([source, bookings]) => ({
      source,
      bookings,
      percentage: rateOrNull(bookings, totalBookings),
    }));

  const retentionYes = providers.filter((p) => p.retentionIntent === "yes").length;
  const retentionNo = providers.filter((p) => p.retentionIntent === "no").length;

  return {
    pilot: {
      startDate: window.startDate,
      endDate: window.endDate,
      isProjected: window.isProjected,
      configWarning: window.configWarning,
      providerTarget: PILOT_PROVIDER_TARGET,
      generatedAt: new Date().toISOString(),
    },
    summary: {
      approvedProviders,
      activatedProviders,
      activationRate: rateOrNull(activatedProviders, approvedProviders),
      providersWithPublishedBookingPage: providers.filter((p) => p.bookingPagePublished).length,
      providersWithAttributedBookings: providers.filter((p) => p.attributedBookings > 0).length,
      totalBookings,
      completedBookings,
      cancelledBookings,
      noShowBookings,
      completionRate: rateOrNull(completedBookings, resolvedBookings),
      cancellationRate: rateOrNull(cancelledBookings, resolvedBookings),
      noShowRate: rateOrNull(noShowBookings, resolvedBookings),
      supportEscalations: escalationCount?.count ?? 0,
      retentionYes,
      retentionNo,
      retentionUnknown: providers.length - retentionYes - retentionNo,
    },
    providers,
    sourceAttribution,
  };
}

/**
 * Pilot display target (context only, never a metric denominator). The
 * five-provider Southern Ontario target is presentation context; other
 * verticals/pilots can override via PILOT_PROVIDER_TARGET.
 */
export const PILOT_PROVIDER_TARGET = (() => {
  const raw = process.env["PILOT_PROVIDER_TARGET"];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 5;
})();
