import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getProviderLeadActivity,
  getAdminLeadActivity,
  NO_SOURCE,
  type LeadActivityItem,
  type LeadSource,
} from "../lib/lead-activity.js";

/**
 * Fixture-based CONTRACT test for the Today's Leads adapter boundary.
 *
 * NOTE: this proves the adapter's ownership-filtering and empty-reason
 * CONTRACT against test-only fixtures. It is NOT evidence of production lead
 * isolation — no live lead source is connected in this slice.
 */

const item = (
  id: string,
  assignedProviderId: number | null,
  ownerRole: "provider" | "admin",
): LeadActivityItem => ({
  id,
  source: { name: "fixture", type: "test" },
  attribution: "unknown",
  vertical: "foot_care",
  needSummary: "fixture need",
  assignedProviderId,
  ownerRole,
  status: "new",
  lastUpdate: { summary: "created", at: "2026-09-27T00:00:00.000Z" },
  nextAction: { label: "review" },
  origin: "fixture",
});

function fixtureSource(items: LeadActivityItem[]): LeadSource {
  return { connected: true, list: async () => items };
}

test("unconnected: provider read returns connected:false, not_connected, empty", async () => {
  const r = await getProviderLeadActivity(7, NO_SOURCE);
  assert.equal(r.connected, false);
  assert.equal(r.emptyReason, "not_connected");
  assert.deepEqual(r.items, []);
});

test("unconnected: admin read returns connected:false, not_connected, empty", async () => {
  const r = await getAdminLeadActivity(NO_SOURCE);
  assert.equal(r.connected, false);
  assert.equal(r.emptyReason, "not_connected");
  assert.deepEqual(r.items, []);
});

test("default (no source argument) is the unconnected shell for both reads", async () => {
  assert.equal((await getProviderLeadActivity(1)).emptyReason, "not_connected");
  assert.equal((await getAdminLeadActivity()).emptyReason, "not_connected");
});

test("not_connected is DISTINCT from no_active_source (admin: connected but empty)", async () => {
  const r = await getAdminLeadActivity(fixtureSource([]));
  assert.equal(r.connected, true);
  assert.equal(r.emptyReason, "no_active_source");
  assert.notEqual(r.emptyReason, "not_connected");
});

test("provider scope returns ONLY leads assigned to that provider profile", async () => {
  const items = [
    item("a", 7, "provider"),
    item("b", 9, "provider"),
    item("c", 7, "provider"),
    item("d", null, "admin"),
  ];
  const r = await getProviderLeadActivity(7, fixtureSource(items));
  assert.equal(r.connected, true);
  assert.deepEqual(
    r.items.map((i) => i.id).sort(),
    ["a", "c"],
  );
  assert.equal(r.emptyReason, null);
});

test("provider scope with no matching leads → no_tracked_inquiry (connected, empty)", async () => {
  const r = await getProviderLeadActivity(7, fixtureSource([item("b", 9, "provider")]));
  assert.equal(r.connected, true);
  assert.deepEqual(r.items, []);
  assert.equal(r.emptyReason, "no_tracked_inquiry");
});

test("admin scope returns all authorized + unassigned leads", async () => {
  const items = [item("a", 7, "provider"), item("d", null, "admin")];
  const r = await getAdminLeadActivity(fixtureSource(items));
  assert.deepEqual(
    r.items.map((i) => i.id).sort(),
    ["a", "d"],
  );
});
