/**
 * Seed script — creates demo accounts and sample data for OnCall Foot.
 * Run: pnpm --filter @workspace/api-server run seed
 *
 * Demo logins (password: demo1234 for all):
 *   admin@oncallfoot.com   — Admin
 *   sarah@oncallfoot.com   — Provider (Certified Foot Care Nurse)
 *   mike@oncallfoot.com    — Provider (Mobile Pedicure Specialist)
 *   jane@oncallfoot.com    — Client
 *   tom@oncallfoot.com     — Client
 */

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import {
  db,
  pool,
  usersTable,
  accountRolesTable,
  providerApplicationsTable,
  providerProfilesTable,
  servicesTable,
  bookingsTable,
  reviewsTable,
  availabilityTable,
  travelZonesTable,
} from "@workspace/db";

const DEMO_PASSWORD = "demo1234";

async function hash(pw: string) {
  return bcrypt.hash(pw, 12);
}

async function seed() {
  console.log("🌱  Seeding OnCall Foot demo data...\n");

  // ── Users ────────────────────────────────────────────────────────────────────

  const users = [
    {
      email: "admin@oncallfoot.com",
      firstName: "Alex",
      lastName: "Admin",
      role: "admin" as const,
    },
    {
      email: "sarah@oncallfoot.com",
      firstName: "Sarah",
      lastName: "Chen",
      role: "provider" as const,
      phone: "647-555-0101",
    },
    {
      email: "mike@oncallfoot.com",
      firstName: "Mike",
      lastName: "Okafor",
      role: "provider" as const,
      phone: "416-555-0182",
    },
    {
      email: "jane@oncallfoot.com",
      firstName: "Jane",
      lastName: "Morrison",
      role: "client" as const,
      phone: "905-555-0143",
    },
    {
      email: "tom@oncallfoot.com",
      firstName: "Tom",
      lastName: "Rivera",
      role: "client" as const,
      phone: "647-555-0199",
    },
  ];

  const createdUsers: Record<string, number> = {};

  for (const u of users) {
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, u.email))
      .limit(1);

    if (existing.length > 0) {
      createdUsers[u.email] = existing[0]!.id;
      console.log(`  ⏭  ${u.email} already exists — skipping`);
      continue;
    }

    const [created] = await db
      .insert(usersTable)
      .values({
        email: u.email,
        passwordHash: await hash(DEMO_PASSWORD),
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        phone: u.phone ?? null,
      })
      .returning({ id: usersTable.id });

    createdUsers[u.email] = created!.id;
    console.log(`  ✅  Created ${u.role}: ${u.email}`);
  }

  // ── Account Roles ─────────────────────────────────────────────────────────────
  //
  // Registration inserts an `account_roles` membership row transactionally
  // (auth.ts); database-backed authorization reads memberships from this
  // table, not from the JWT role claim. Demo users are inserted directly,
  // so their membership rows must be seeded too.

  for (const u of users) {
    const userId = createdUsers[u.email]!;
    const existingRole = await db
      .select({ id: accountRolesTable.id })
      .from(accountRolesTable)
      .where(
        and(
          eq(accountRolesTable.userId, userId),
          eq(accountRolesTable.role, u.role),
        ),
      )
      .limit(1);

    if (existingRole.length > 0) {
      console.log(`  ⏭  ${u.email} ${u.role} membership already exists — skipping`);
      continue;
    }

    await db.insert(accountRolesTable).values({ userId, role: u.role });
    console.log(`  ✅  Created ${u.role} membership: ${u.email}`);
  }

  // ── Provider Profiles ─────────────────────────────────────────────────────────

  const sarahUserId = createdUsers["sarah@oncallfoot.com"]!;
  const mikeUserId = createdUsers["mike@oncallfoot.com"]!;

  const existingSarah = await db
    .select({ id: providerProfilesTable.id })
    .from(providerProfilesTable)
    .where(eq(providerProfilesTable.userId, sarahUserId))
    .limit(1);

  let sarahProfileId: number;

  if (existingSarah.length > 0) {
    sarahProfileId = existingSarah[0]!.id;
    console.log("  ⏭  Sarah's provider profile already exists");
  } else {
    const [sarahProfile] = await db
      .insert(providerProfilesTable)
      .values({
        userId: sarahUserId,
        title: "Certified Foot Care Nurse",
        bio:
          "10 years bringing professional foot care directly to clients across the GTA. Specializing in senior care, diabetic foot health, and post-surgical recovery. I bring a fully equipped mobile clinic to your door.",
        city: "Toronto",
        serviceAreaNotes: "Serving Toronto, Mississauga, and Brampton.",
        verificationStatus: "approved",
        rating: "4.92",
        reviewCount: 47,
        profileComplete: true,
        yearsExperience: 10,
        acceptsNewClients: true,
      })
      .returning({ id: providerProfilesTable.id });

    sarahProfileId = sarahProfile!.id;
    console.log("  ✅  Created provider profile: Sarah Chen");
  }

  const existingMike = await db
    .select({ id: providerProfilesTable.id })
    .from(providerProfilesTable)
    .where(eq(providerProfilesTable.userId, mikeUserId))
    .limit(1);

  let mikeProfileId: number;

  if (existingMike.length > 0) {
    mikeProfileId = existingMike[0]!.id;
    console.log("  ⏭  Mike's provider profile already exists");
  } else {
    const [mikeProfile] = await db
      .insert(providerProfilesTable)
      .values({
        userId: mikeUserId,
        title: "Mobile Pedicure & Foot Wellness Specialist",
        bio:
          "Luxury pedicure and foot spa treatments delivered to your home. 6 years serving clients who want a premium wellness experience without leaving their space. Fully sanitized equipment, premium products.",
        city: "Mississauga",
        serviceAreaNotes: "Serving Mississauga, Oakville, and Burlington.",
        verificationStatus: "approved",
        rating: "4.85",
        reviewCount: 31,
        profileComplete: true,
        yearsExperience: 6,
        acceptsNewClients: true,
      })
      .returning({ id: providerProfilesTable.id });

    mikeProfileId = mikeProfile!.id;
    console.log("  ✅  Created provider profile: Mike Okafor");
  }

  // ── Provider Applications ─────────────────────────────────────────────────────
  //
  // Registration creates a provider application transactionally (auth.ts),
  // but the demo providers above are inserted directly, so their approved
  // application rows must be seeded too. Database-backed authorization and
  // `test:authorization` require every approved demo provider to have a
  // matching approved `provider_applications` row.

  const adminUserId = createdUsers["admin@oncallfoot.com"]!;

  const demoApplications = [
    { label: "Sarah", userId: sarahUserId, providerProfileId: sarahProfileId },
    { label: "Mike", userId: mikeUserId, providerProfileId: mikeProfileId },
  ];

  for (const app of demoApplications) {
    const existingApplication = await db
      .select({ id: providerApplicationsTable.id })
      .from(providerApplicationsTable)
      .where(eq(providerApplicationsTable.userId, app.userId))
      .limit(1);

    if (existingApplication.length > 0) {
      console.log(
        `  ⏭  ${app.label}'s provider application already exists — skipping`,
      );
      continue;
    }

    const dayMs = 24 * 60 * 60 * 1000;
    await db.insert(providerApplicationsTable).values({
      userId: app.userId,
      providerProfileId: app.providerProfileId,
      status: "approved",
      currentStep: "submitted",
      submittedAt: new Date(Date.now() - 30 * dayMs),
      reviewedAt: new Date(Date.now() - 29 * dayMs),
      reviewedBy: adminUserId,
    });
    console.log(`  ✅  Created approved provider application: ${app.label}`);
  }

  // ── Services ──────────────────────────────────────────────────────────────────

  const existingServices = await db
    .select({ id: servicesTable.id })
    .from(servicesTable)
    .where(eq(servicesTable.providerId, sarahProfileId));

  let sarahServiceId: number;

  if (existingServices.length > 0) {
    sarahServiceId = existingServices[0]!.id;
    console.log("  ⏭  Sarah's services already exist");
  } else {
    const [s1] = await db
      .insert(servicesTable)
      .values([
        {
          providerId: sarahProfileId,
          title: "Comprehensive Foot Care Assessment",
          description:
            "Full assessment including nail care, callus treatment, circulation check, and a personalised care plan. Ideal for first visits and clients with diabetes or circulation concerns.",
          durationMinutes: 60,
          priceCents: 12000,
          category: "foot_care",
          eligibilityNotes: "Suitable for all ages. Diabetic-care certified.",
        },
        {
          providerId: sarahProfileId,
          title: "Senior Foot Care & Nail Trim",
          description:
            "Gentle, professional nail trimming, moisturising treatment, and a pressure-point assessment. Safe for clients with limited mobility.",
          durationMinutes: 45,
          priceCents: 8500,
          category: "senior_care",
        },
        {
          providerId: sarahProfileId,
          title: "Diabetic Foot Care Visit",
          description:
            "Specialised visit for clients managing diabetes. Includes circulatory screening, pressure-point mapping, nail and skin care, and detailed care notes.",
          durationMinutes: 60,
          priceCents: 14000,
          category: "diabetic_care",
          eligibilityNotes: "For clients with Type 1 or Type 2 diabetes.",
        },
      ])
      .returning({ id: servicesTable.id });

    sarahServiceId = s1!.id;
    console.log("  ✅  Created 3 services for Sarah");
  }

  const existingMikeServices = await db
    .select({ id: servicesTable.id })
    .from(servicesTable)
    .where(eq(servicesTable.providerId, mikeProfileId));

  let mikeServiceId: number;

  if (existingMikeServices.length > 0) {
    mikeServiceId = existingMikeServices[0]!.id;
    console.log("  ⏭  Mike's services already exist");
  } else {
    const [m1] = await db
      .insert(servicesTable)
      .values([
        {
          providerId: mikeProfileId,
          title: "Luxury Spa Pedicure",
          description:
            "Full spa pedicure with soak, exfoliation, callus removal, nail shaping and polish, and a relaxing foot massage. Premium products included.",
          durationMinutes: 75,
          priceCents: 9500,
          category: "pedicure",
        },
        {
          providerId: mikeProfileId,
          title: "Express Pedicure & Polish",
          description:
            "Quick refresh: nail trim and shape, light exfoliation, and polish of your choice. Perfect for a top-up between full treatments.",
          durationMinutes: 45,
          priceCents: 6000,
          category: "pedicure",
        },
      ])
      .returning({ id: servicesTable.id });

    mikeServiceId = m1!.id;
    console.log("  ✅  Created 2 services for Mike");
  }

  // ── Availability ──────────────────────────────────────────────────────────────

  const existingAvail = await db
    .select({ id: availabilityTable.id })
    .from(availabilityTable)
    .where(eq(availabilityTable.providerId, sarahProfileId))
    .limit(1);

  if (existingAvail.length === 0) {
    // Sarah: Mon–Fri 9am–5pm
    await db.insert(availabilityTable).values([
      { providerId: sarahProfileId, dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
      { providerId: sarahProfileId, dayOfWeek: 2, startTime: "09:00", endTime: "17:00" },
      { providerId: sarahProfileId, dayOfWeek: 3, startTime: "09:00", endTime: "17:00" },
      { providerId: sarahProfileId, dayOfWeek: 4, startTime: "09:00", endTime: "17:00" },
      { providerId: sarahProfileId, dayOfWeek: 5, startTime: "09:00", endTime: "17:00" },
    ]);
    console.log("  ✅  Created availability for Sarah");
  }

  const existingMikeAvail = await db
    .select({ id: availabilityTable.id })
    .from(availabilityTable)
    .where(eq(availabilityTable.providerId, mikeProfileId))
    .limit(1);

  if (existingMikeAvail.length === 0) {
    // Mike: Tue–Sat 10am–7pm
    await db.insert(availabilityTable).values([
      { providerId: mikeProfileId, dayOfWeek: 2, startTime: "10:00", endTime: "19:00" },
      { providerId: mikeProfileId, dayOfWeek: 3, startTime: "10:00", endTime: "19:00" },
      { providerId: mikeProfileId, dayOfWeek: 4, startTime: "10:00", endTime: "19:00" },
      { providerId: mikeProfileId, dayOfWeek: 5, startTime: "10:00", endTime: "19:00" },
      { providerId: mikeProfileId, dayOfWeek: 6, startTime: "10:00", endTime: "19:00" },
    ]);
    console.log("  ✅  Created availability for Mike");
  }

  // ── Travel Zones ──────────────────────────────────────────────────────────────

  const existingZones = await db
    .select({ id: travelZonesTable.id })
    .from(travelZonesTable)
    .where(eq(travelZonesTable.providerId, sarahProfileId))
    .limit(1);

  if (existingZones.length === 0) {
    await db.insert(travelZonesTable).values([
      { providerId: sarahProfileId, zoneName: "Downtown Toronto", city: "Toronto" },
      { providerId: sarahProfileId, zoneName: "Mississauga", city: "Mississauga" },
      { providerId: mikeProfileId, zoneName: "Mississauga Central", city: "Mississauga" },
      { providerId: mikeProfileId, zoneName: "Oakville", city: "Oakville" },
    ]);
    console.log("  ✅  Created travel zones");
  }

  // ── Sample Bookings ───────────────────────────────────────────────────────────

  const janeId = createdUsers["jane@oncallfoot.com"]!;
  const tomId = createdUsers["tom@oncallfoot.com"]!;

  const existingBookings = await db
    .select({ id: bookingsTable.id })
    .from(bookingsTable)
    .where(eq(bookingsTable.clientId, janeId))
    .limit(1);

  if (existingBookings.length === 0) {
    const now = new Date();
    const future = (days: number) =>
      new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const past = (days: number) =>
      new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const [confirmedBooking] = await db
      .insert(bookingsTable)
      .values([
        {
          clientId: janeId,
          providerId: sarahProfileId,
          serviceId: sarahServiceId,
          status: "confirmed",
          scheduledAt: future(3),
          address: "22 Lakeshore Blvd W, Unit 4B",
          city: "Toronto",
          postalCode: "M6K 3C3",
          careNotes: "Client has Type 2 diabetes — please review circulation.",
        },
        {
          clientId: janeId,
          providerId: sarahProfileId,
          serviceId: sarahServiceId,
          status: "completed",
          scheduledAt: past(14),
          address: "22 Lakeshore Blvd W, Unit 4B",
          city: "Toronto",
          postalCode: "M6K 3C3",
        },
        {
          clientId: tomId,
          providerId: mikeProfileId,
          serviceId: mikeServiceId,
          status: "requested",
          scheduledAt: future(5),
          address: "88 Queen St E",
          city: "Mississauga",
          postalCode: "L5G 4A7",
        },
        {
          clientId: tomId,
          providerId: mikeProfileId,
          serviceId: mikeServiceId,
          status: "cancelled",
          scheduledAt: past(7),
          address: "88 Queen St E",
          city: "Mississauga",
          postalCode: "L5G 4A7",
          cancellationReason: "Scheduling conflict.",
        },
      ])
      .returning({ id: bookingsTable.id });

    console.log("  ✅  Created 4 sample bookings");

    // ── Review on completed booking ─────────────────────────────────────────────
    if (confirmedBooking) {
      const completedBookingId = confirmedBooking.id + 1; // second insert (index 1)
      const existingReview = await db
        .select({ id: reviewsTable.id })
        .from(reviewsTable)
        .where(eq(reviewsTable.bookingId, completedBookingId))
        .limit(1);

      if (existingReview.length === 0) {
        await db.insert(reviewsTable).values({
          bookingId: completedBookingId,
          clientId: janeId,
          providerId: sarahProfileId,
          rating: 5,
          comment:
            "Sarah was absolutely wonderful. She was thorough, gentle, and incredibly knowledgeable about diabetic foot care. My feet feel better than they have in years. Already booked my next visit.",
        });
        console.log("  ✅  Created sample review for Jane → Sarah");
      }
    }
  } else {
    console.log("  ⏭  Sample bookings already exist");
  }

  console.log("\n✨  Seed complete. Demo logins (password: demo1234):");
  console.log("    admin@oncallfoot.com  — Admin");
  console.log("    sarah@oncallfoot.com  — Provider");
  console.log("    mike@oncallfoot.com   — Provider");
  console.log("    jane@oncallfoot.com   — Client");
  console.log("    tom@oncallfoot.com    — Client");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
