import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScorecard, countBookings, suggest, type ScorecardBookingRow } from "../lib/provider-scorecard.js";

const NOW = new Date("2026-09-27T12:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000);
const b = (status: ScorecardBookingRow["status"], days: number, clientId = 1): ScorecardBookingRow => ({ status, scheduledAt: daysAgo(days), clientId });

test("counts are exact and rates stay null below the minimum", () => {
  const c = countBookings([b("completed", 1), b("completed", 2), b("cancelled", 3), b("requested", 4)], []);
  assert.equal(c.total, 4);
  assert.equal(c.completed, 2);
  assert.equal(c.cancelled, 1);
  assert.equal(c.awaitingOutcome, 1);
  assert.equal(c.resolved, 3);
  assert.equal(c.rates, null);
  assert.deepEqual(c.reviews, { count: 0, averageRating: null });
});

test("rates appear at the minimum; repeat clients need two completed visits", () => {
  const rows = [b("completed", 1, 1), b("completed", 2, 1), b("completed", 3, 2), b("no_show", 4, 3), b("cancelled", 5, 4)];
  const c = countBookings(rows, [{ rating: 5, createdAt: NOW }, { rating: 4, createdAt: NOW }]);
  assert.equal(c.resolved, 5);
  assert.deepEqual(c.rates, { completion: 0.6, cancellation: 0.2, noShow: 0.2 });
  assert.equal(c.distinctClients, 2);
  assert.equal(c.repeatClients, 1);
  assert.deepEqual(c.reviews, { count: 2, averageRating: 4.5 });
});

test("the 30-day window is by scheduled time and excludes future visits", () => {
  const s = computeScorecard([b("completed", 10), b("completed", 40), b("confirmed", -3)], [{ rating: 5, createdAt: daysAgo(45) }], NOW);
  assert.equal(s.last30.total, 1);
  assert.equal(s.last30.awaitingOutcome, 0, "a visit 3 days in the future is not a past visit without outcome");
  assert.equal(s.last30.reviews.count, 0);
  assert.equal(s.allTime.total, 3);
  assert.equal(s.allTime.awaitingOutcome, 1);
  assert.equal(s.allTime.reviews.count, 1);
  assert.equal(s.windowDays, 30);
  assert.equal(s.windowEnd, NOW.toISOString());
});

test("suggestions: at most one per gap, only from own data", () => {
  const rows = [b("requested", 2, 1), b("no_show", 3, 2), b("completed", 4, 3), b("completed", 5, 4), b("completed", 6, 5)];
  const s = computeScorecard(rows, [], NOW);
  const gaps = s.suggestions.map((x) => x.gap);
  assert.deepEqual(gaps, ["unresolved_past_visits", "no_shows", "no_repeat_clients", "no_reviews"]);
  assert.match(s.suggestions[0]!.message, /^1 past visit in the last 30 days has no recorded outcome/);
  assert.equal(new Set(gaps).size, gaps.length);
  for (const x of s.suggestions) assert.doesNotMatch(x.message, /revenue|earn|guarantee|will increase/i);
});

test("suggestions: quiet month and high cancellations", () => {
  const quiet = suggest(countBookings([], []), countBookings([b("completed", 50)], []));
  assert.deepEqual(quiet.map((x) => x.gap), ["no_recent_visits"]);

  const busy = countBookings([b("completed", 1), b("completed", 2), b("completed", 3), b("cancelled", 4), b("cancelled", 5)], [{ rating: 5, createdAt: NOW }]);
  const s = suggest(busy, busy);
  assert.deepEqual(s.map((x) => x.gap), ["cancellations"]);
  assert.match(s[0]!.message, /2 cancellations out of 5 resolved visits/);
});

test("a brand-new provider gets no suggestions and no rates", () => {
  const s = computeScorecard([], [], NOW);
  assert.deepEqual(s.suggestions, []);
  assert.equal(s.allTime.rates, null);
});
