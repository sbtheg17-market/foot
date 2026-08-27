/**
 * Provider Approval Status & Activation Hub — GET /providers/me/activation-status.
 *
 * Owner-scoped, read-only activation summary consumed by the
 * /provider/application-status hub. This suite proves (against live HTTP +
 * direct DB fixture writes):
 *   - authorization: 401 unauthenticated, 403 client, provider-member OK in
 *     every application state (no approval gate);
 *   - owner scoping: providers only ever see their own data;
 *   - truthful milestones across the journey (draft → verification submitted
 *     → approved → coverage → service → availability → published → first
 *     booking) — no fake progress;
 *   - journey-ordered nextAction derivation;
 *   - verification status mapping incl. needs_update/canResubmit recovery;
 *   - rejected/suspended application handling (provider-visible
 *     rejectionReason only);
 *   - privacy: no reviewer notes, raw document references, reviewer identity,
 *     platform pilot metrics, retention intent, or risk flags in the payload.
 *
 * Prerequisites: API server running against the test database.
 *
 * Run:
 *   pnpm --filter @workspace/api-server run test:activation-status
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import {
  availabilityTable,
  bookingsTable,
  db,
  providerApplicationsTable,
  providerProfilesTable,
  servicesTable,
  usersTable,
} from "@workspace/db";

const PORT = process.env["PORT"] ?? "8080";
const BASE = `http://localhost:${PORT}/api`;
const PASSWORD = "activation-status-password";
const suffix = `${process.pid}-${Date.now()}`;

const PROVIDER_EMAIL = `activation-provider-${suffix}@oncallfoot.test`;
const OTHER_EMAIL = `activation-other-${suffix}@oncallfoot.test`;
const CLIENT_EMAIL = `activation-client-${suffix}@oncallfoot.test`;

type JsonBody = Record<string, unknown>;

async function apiFetch(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: JsonBody }> {
  const { token, ...rest } = options;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((rest.headers as Record<string, string>) ?? {}),
    },
  });
  const text = await res.text();
  let body: JsonBody;
  try {
    body = JSON.parse(text) as JsonBody;
  } catch {
    body = { error: text.slice(0, 200) };
  }
  return { status: res.status, body };
}

async function register(
  email: string,
  role: "provider" | "client",
  firstName: string,
  lastName: string,
) {
  const r = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: PASSWORD,
      firstName,
      lastName,
      role,
      roleIntent: role,
    }),
  });
  assert.equal(r.status, 201, `register failed: ${JSON.stringify(r.body)}`);
  return {
    token: r.body["token"] as string,
    userId: (r.body["user"] as JsonBody)["id"] as number,
  };
}

async function profileIdFor(userId: number): Promise<number> {
  const [row] = await db
    .select({ id: providerProfilesTable.id })
    .from(providerProfilesTable)
    .where(eq(providerProfilesTable.userId, userId))
    .limit(1);
  assert.ok(row, "provider profile must exist after registration");
  return row.id;
}

/** Approve through raw source fields (mirrors the booking-page suite). */
async function approveProvider(userId: number, profileId: number) {
  await db
    .update(providerProfilesTable)
    .set({
      title: "Mobile foot-care specialist",
      city: "Toronto",
      bio: "Calm, client-first in-home foot care.",
      verificationStatus: "approved",
      acceptsNewClients: true,
    })
    .where(eq(providerProfilesTable.id, profileId));
  await db
    .update(providerApplicationsTable)
    .set({ status: "approved", currentStep: "submitted" })
    .where(eq(providerApplicationsTable.userId, userId));
}

function activationOf(body: JsonBody) {
  const activation = body["activation"] as JsonBody;
  assert.ok(activation, `missing activation envelope: ${JSON.stringify(body)}`);
  return activation as {
    applicationStatus: string;
    rejectionReason: string | null;
    canEdit: boolean;
    canReset: boolean;
    canResubmit: boolean;
    verification: {
      status: string;
      submittedAt: string | null;
      canResubmit: boolean;
    };
    milestones: Record<string, boolean>;
    milestonesCompleted: number;
    milestonesTotal: number;
    bookingPage: {
      slug: string | null;
      published: boolean;
      eligible: boolean;
      path: string | null;
    };
    nextAction: string;
  };
}

async function getActivation(token: string) {
  const r = await apiFetch("/providers/me/activation-status", { token });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return { activation: activationOf(r.body), raw: r.body };
}

describe("provider activation status (approval & activation hub)", () => {
  let providerToken = "";
  let providerUserId = 0;
  let providerProfileId = 0;
  let otherToken = "";
  let otherUserId = 0;
  let clientToken = "";
  let clientUserId = 0;
  let serviceId = 0;

  before(async () => {
    ({ token: providerToken, userId: providerUserId } = await register(
      PROVIDER_EMAIL,
      "provider",
      "Avery",
      "Activation",
    ));
    providerProfileId = await profileIdFor(providerUserId);
    ({ token: otherToken, userId: otherUserId } = await register(
      OTHER_EMAIL,
      "provider",
      "Blake",
      "Bystander",
    ));
    ({ token: clientToken, userId: clientUserId } = await register(
      CLIENT_EMAIL,
      "client",
      "Casey",
      "Client",
    ));
  });

  after(async () => {
    if (providerProfileId) {
      await db
        .delete(bookingsTable)
        .where(eq(bookingsTable.providerId, providerProfileId));
    }
    for (const userId of [providerUserId, otherUserId, clientUserId]) {
      if (userId) {
        await db.delete(usersTable).where(eq(usersTable.id, userId));
      }
    }
  });

  it("returns 401 when unauthenticated", async () => {
    const r = await apiFetch("/providers/me/activation-status");
    assert.equal(r.status, 401);
  });

  it("returns 403 for client accounts (provider members only)", async () => {
    const r = await apiFetch("/providers/me/activation-status", {
      token: clientToken,
    });
    assert.equal(r.status, 403);
  });

  it("reports a truthful fresh draft: only accountCreated is complete", async () => {
    const { activation } = await getActivation(providerToken);
    assert.equal(activation.applicationStatus, "draft");
    assert.equal(activation.nextAction, "continue_onboarding");
    assert.equal(activation.canEdit, true);
    assert.equal(activation.verification.status, "not_started");
    assert.equal(activation.verification.submittedAt, null);
    assert.deepEqual(activation.milestones, {
      accountCreated: true,
      profileCompleted: false,
      verificationSubmitted: false,
      approved: false,
      serviceAreaConfigured: false,
      activeServiceConfigured: false,
      availabilityConfigured: false,
      bookingPagePublished: false,
      firstBookingReceived: false,
    });
    assert.equal(activation.milestonesCompleted, 1);
    assert.equal(activation.milestonesTotal, 9);
    assert.equal(activation.bookingPage.published, false);
    assert.equal(activation.bookingPage.eligible, false);
  });

  it("marks verification submitted (under review) after a real credential submission", async () => {
    const submit = await apiFetch("/providers/me/verification", {
      method: "POST",
      token: providerToken,
      body: JSON.stringify({
        docType: "license",
        fileName: `activation-license-${suffix}`,
      }),
    });
    assert.equal(submit.status, 201, JSON.stringify(submit.body));

    const { activation } = await getActivation(providerToken);
    assert.equal(activation.milestones["verificationSubmitted"], true);
    assert.equal(activation.verification.status, "under_review");
    assert.ok(activation.verification.submittedAt);
    assert.equal(activation.verification.canResubmit, false);
  });

  it("keeps other providers' hubs isolated (owner scoping)", async () => {
    const { activation } = await getActivation(otherToken);
    assert.equal(activation.milestones["verificationSubmitted"], false);
    assert.equal(activation.verification.status, "not_started");
  });

  it("walks the approved booking-readiness journey in order, without fake progress", async () => {
    await approveProvider(providerUserId, providerProfileId);

    let { activation } = await getActivation(providerToken);
    assert.equal(activation.applicationStatus, "approved");
    assert.equal(activation.milestones["approved"], true);
    assert.equal(activation.milestones["profileCompleted"], true);
    assert.equal(activation.nextAction, "configure_service_area");
    assert.equal(activation.bookingPage.eligible, false);

    // Roadmap #12 coverage through the real API (approved-only routes).
    const config = await apiFetch("/providers/me/service-area", {
      method: "PUT",
      token: providerToken,
      body: JSON.stringify({ countryCode: "CA", provinceCode: "ON", city: "Toronto" }),
    });
    assert.equal(config.status, 200, JSON.stringify(config.body));
    const prefix = await apiFetch("/providers/me/service-area/prefixes", {
      method: "POST",
      token: providerToken,
      body: JSON.stringify({ prefix: "M5V" }),
    });
    assert.equal(prefix.status, 201, JSON.stringify(prefix.body));

    ({ activation } = await getActivation(providerToken));
    assert.equal(activation.milestones["serviceAreaConfigured"], true);
    assert.equal(activation.nextAction, "add_service");
    assert.equal(activation.bookingPage.eligible, true, "coverage + approval unlock publishing");

    const [service] = await db
      .insert(servicesTable)
      .values({
        providerId: providerProfileId,
        title: "Routine nail care",
        durationMinutes: 45,
        priceCents: 7000,
        isActive: true,
      })
      .returning({ id: servicesTable.id });
    serviceId = service!.id;

    ({ activation } = await getActivation(providerToken));
    assert.equal(activation.milestones["activeServiceConfigured"], true);
    assert.equal(activation.nextAction, "set_availability");

    await db.insert(availabilityTable).values({
      providerId: providerProfileId,
      dayOfWeek: 2,
      startTime: "09:00",
      endTime: "17:00",
    });

    ({ activation } = await getActivation(providerToken));
    assert.equal(activation.milestones["availabilityConfigured"], true);
    assert.equal(activation.nextAction, "publish_booking_page");
  });

  it("reflects real publishing and the first booking (first-value signal)", async () => {
    const publish = await apiFetch("/providers/me/booking-page/publish", {
      method: "POST",
      token: providerToken,
    });
    assert.equal(publish.status, 200, JSON.stringify(publish.body));

    let { activation } = await getActivation(providerToken);
    assert.equal(activation.milestones["bookingPagePublished"], true);
    assert.equal(activation.bookingPage.published, true);
    assert.ok(activation.bookingPage.slug);
    assert.equal(activation.nextAction, "share_booking_page");

    await db.insert(bookingsTable).values({
      clientId: clientUserId,
      providerId: providerProfileId,
      serviceId,
      status: "requested",
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      address: "12 Test Street",
      city: "Toronto",
    });

    ({ activation } = await getActivation(providerToken));
    assert.equal(activation.milestones["firstBookingReceived"], true);
    assert.equal(activation.nextAction, "all_set");
    assert.equal(activation.milestonesCompleted, 9);
  });

  it("maps a rejected verification to a friendly recovery state", async () => {
    await db
      .update(providerProfilesTable)
      .set({ verificationStatus: "rejected" })
      .where(eq(providerProfilesTable.id, providerProfileId));

    const { activation } = await getActivation(providerToken);
    assert.equal(activation.verification.status, "needs_update");
    assert.equal(activation.verification.canResubmit, true);
    // Approval milestone reflects the same boundary as requireApprovedProvider.
    assert.equal(activation.milestones["approved"], false);

    await db
      .update(providerProfilesTable)
      .set({ verificationStatus: "approved" })
      .where(eq(providerProfilesTable.id, providerProfileId));
  });

  it("surfaces rejected applications with the provider-visible reason only", async () => {
    await db
      .update(providerApplicationsTable)
      .set({ status: "rejected", rejectionReason: "Please confirm your license number." })
      .where(eq(providerApplicationsTable.userId, providerUserId));

    const { activation, raw } = await getActivation(providerToken);
    assert.equal(activation.applicationStatus, "rejected");
    assert.equal(activation.nextAction, "review_update_needed");
    assert.equal(activation.canReset, true);
    assert.equal(activation.rejectionReason, "Please confirm your license number.");
    assert.ok(!JSON.stringify(raw).includes("reviewerNotes"));
  });

  it("routes suspended applications to support", async () => {
    await db
      .update(providerApplicationsTable)
      .set({ status: "suspended" })
      .where(eq(providerApplicationsTable.userId, providerUserId));

    const { activation } = await getActivation(providerToken);
    assert.equal(activation.nextAction, "contact_support");

    await db
      .update(providerApplicationsTable)
      .set({ status: "approved", rejectionReason: null })
      .where(eq(providerApplicationsTable.userId, providerUserId));
  });

  it("never exposes private material (redaction contract)", async () => {
    const { raw } = await getActivation(providerToken);
    const serialized = JSON.stringify(raw);
    for (const forbidden of [
      "reviewerNotes",
      "reviewedBy",
      "fileName",
      "docRef",
      "retention",
      "riskFlags",
      "careNotes",
      "clientName",
      "email",
      "updatedBy",
    ]) {
      assert.ok(
        !serialized.includes(forbidden),
        `activation payload must not contain "${forbidden}"`,
      );
    }
  });
});
