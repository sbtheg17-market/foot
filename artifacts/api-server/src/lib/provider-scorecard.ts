/**
 * Provider scorecard — exact counts over the provider's OWN bookings and
 * reviews, two windows (last 30 days by scheduled time, all time), rates only
 * past a minimum, and at most one practical suggestion per gap. Pure: no DB,
 * no clock reads (the caller passes `now`) so every rule is unit-testable.
 * Copy makes no causal or revenue claims.
 */

export const SCORECARD_WINDOW_DAYS = 30;
export const SCORECARD_MIN_FOR_RATES = 5;

export type ScorecardBookingRow = {
  status: "requested" | "confirmed" | "completed" | "cancelled" | "rescheduled" | "no_show";
  scheduledAt: Date;
  clientId: number;
};

export type ScorecardReviewRow = { rating: number; createdAt: Date };

export type ScorecardCounts = {
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  awaitingOutcome: number;
  resolved: number;
  distinctClients: number;
  repeatClients: number;
  reviews: { count: number; averageRating: number | null };
  rates: { completion: number; cancellation: number; noShow: number } | null;
};

export type ScorecardGap =
  | "unresolved_past_visits"
  | "no_recent_visits"
  | "no_shows"
  | "cancellations"
  | "no_repeat_clients"
  | "no_reviews";

export type ScorecardSuggestion = { gap: ScorecardGap; message: string };

export type Scorecard = {
  windowDays: number;
  windowStart: string;
  windowEnd: string;
  minimumForRates: number;
  last30: ScorecardCounts;
  allTime: ScorecardCounts;
  suggestions: ScorecardSuggestion[];
};

const round = (n: number) => Math.round(n * 1000) / 1000;

export function countBookings(rows: ScorecardBookingRow[], reviews: ScorecardReviewRow[]): ScorecardCounts {
  const completedRows = rows.filter((r) => r.status === "completed");
  const cancelled = rows.filter((r) => r.status === "cancelled").length;
  const noShow = rows.filter((r) => r.status === "no_show").length;
  const awaitingOutcome = rows.filter((r) => r.status === "requested" || r.status === "confirmed" || r.status === "rescheduled").length;
  const resolved = completedRows.length + cancelled + noShow;

  const perClient = new Map<number, number>();
  for (const r of completedRows) perClient.set(r.clientId, (perClient.get(r.clientId) ?? 0) + 1);
  const repeatClients = [...perClient.values()].filter((c) => c >= 2).length;

  const averageRating = reviews.length === 0
    ? null
    : Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10;

  return {
    total: rows.length,
    completed: completedRows.length,
    cancelled,
    noShow,
    awaitingOutcome,
    resolved,
    distinctClients: perClient.size,
    repeatClients,
    reviews: { count: reviews.length, averageRating },
    rates: resolved < SCORECARD_MIN_FOR_RATES
      ? null
      : { completion: round(completedRows.length / resolved), cancellation: round(cancelled / resolved), noShow: round(noShow / resolved) },
  };
}

export function suggest(last30: ScorecardCounts, allTime: ScorecardCounts): ScorecardSuggestion[] {
  const out: ScorecardSuggestion[] = [];
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  if (last30.awaitingOutcome > 0) {
    out.push({
      gap: "unresolved_past_visits",
      message: `${plural(last30.awaitingOutcome, "past visit")} in the last 30 days ${last30.awaitingOutcome === 1 ? "has" : "have"} no recorded outcome. Mark each as completed, cancelled or no-show so these numbers stay accurate.`,
    });
  }
  if (last30.total === 0 && allTime.total > 0) {
    out.push({ gap: "no_recent_visits", message: "No visits were scheduled in the last 30 days. Share your booking link with past clients to fill the calendar." });
  }
  if (last30.noShow > 0) {
    out.push({ gap: "no_shows", message: `${plural(last30.noShow, "no-show")} in the last 30 days. Try a short confirmation message the day before each visit.` });
  }
  if (last30.rates && last30.rates.cancellation >= 0.2) {
    out.push({ gap: "cancellations", message: `${plural(last30.cancelled, "cancellation")} out of ${last30.resolved} resolved visits in the last 30 days. Check whether your availability and travel area match when clients actually want visits.` });
  }
  if (allTime.distinctClients >= 3 && allTime.repeatClients === 0) {
    out.push({ gap: "no_repeat_clients", message: `${allTime.distinctClients} clients have completed a visit and none has booked a second one yet. Offer a follow-up date before you leave each appointment.` });
  }
  if (allTime.completed >= 3 && allTime.reviews.count === 0) {
    out.push({ gap: "no_reviews", message: `${allTime.completed} completed visits and no reviews yet. Ask clients for a review after their visit — new clients read them.` });
  }
  return out;
}

export function computeScorecard(rows: ScorecardBookingRow[], reviews: ScorecardReviewRow[], now: Date): Scorecard {
  const windowStart = new Date(now.getTime() - SCORECARD_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const inWindow = (d: Date) => d >= windowStart && d <= now;
  const last30 = countBookings(rows.filter((r) => inWindow(r.scheduledAt)), reviews.filter((r) => inWindow(r.createdAt)));
  const allTime = countBookings(rows, reviews);
  return {
    windowDays: SCORECARD_WINDOW_DAYS,
    windowStart: windowStart.toISOString(),
    windowEnd: now.toISOString(),
    minimumForRates: SCORECARD_MIN_FOR_RATES,
    last30,
    allTime,
    suggestions: suggest(last30, allTime),
  };
}
