import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Demo/sample data lifecycle. Scope is a FIXED allowlist of seed identities
 * (artifacts/api-server/src/seed.ts) — never a pattern, never admin users —
 * so a purge can only ever remove data that the seed script created.
 */
export const DEMO_EMAILS = [
  "sarah@oncallfoot.com",
  "mike@oncallfoot.com",
  "jane@oncallfoot.com",
  "tom@oncallfoot.com",
  "qa.provider@oncallfoot.test",
] as const;

export const PURGE_CONFIRMATION = "DELETE DEMO DATA";

export interface DemoDataSummary {
  users: Array<{ id: number; email: string; role: string }>;
  counts: {
    users: number;
    providerProfiles: number;
    services: number;
    bookings: number;
    reviews: number;
    invoices: number;
    supportTickets: number;
    marketplaceEvents: number;
  };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Exec = Pick<Tx, "execute">;

/** Postgres array literal from a JS array (drizzle would otherwise emit a tuple). */
const intArr = (ids: number[]) => sql`array[${sql.join(ids.map((n) => sql`${n}`), sql`, `)}]::int[]`;
const textArr = (v: readonly string[]) => sql`array[${sql.join(v.map((x) => sql`${x}`), sql`, `)}]::text[]`;

async function scope(exec: Exec) {
  const users = (
    await exec.execute(
      sql`select id, email, role from users where email = any(${textArr(DEMO_EMAILS)}) and role <> 'admin' order by id`,
    )
  ).rows as Array<{ id: number; email: string; role: string }>;
  const userIds = users.map((u) => u.id);
  const profileIds = userIds.length
    ? ((await exec.execute(sql`select id from provider_profiles where user_id = any(${intArr(userIds)})`)).rows as Array<{ id: number }>).map((r) => r.id)
    : [];
  const bookingIds =
    userIds.length || profileIds.length
      ? ((await exec.execute(
          sql`select id from bookings where client_id = any(${intArr(userIds)}) or provider_id = any(${intArr(profileIds)})`,
        )).rows as Array<{ id: number }>).map((r) => r.id)
      : [];
  return { users, userIds, profileIds, bookingIds };
}

async function count(exec: Exec, query: ReturnType<typeof sql>): Promise<number> {
  const row = (await exec.execute(query)).rows[0] as { n: string | number };
  return Number(row.n);
}

export async function summarizeDemoData(): Promise<DemoDataSummary> {
  const { users, userIds, profileIds, bookingIds } = await scope(db);
  const u = intArr(userIds);
  const p = intArr(profileIds);
  const b = intArr(bookingIds);
  return {
    users,
    counts: {
      users: users.length,
      providerProfiles: profileIds.length,
      services: await count(db, sql`select count(*) n from services where provider_id = any(${p})`),
      bookings: bookingIds.length,
      reviews: await count(db, sql`select count(*) n from reviews where booking_id = any(${b}) or client_id = any(${u}) or provider_id = any(${p})`),
      invoices: await count(db, sql`select count(*) n from invoices where booking_id = any(${b}) or client_id = any(${u}) or provider_id = any(${p})`),
      supportTickets: await count(db, sql`select count(*) n from support_tickets where booking_id = any(${b}) or user_id = any(${u})`),
      marketplaceEvents: await count(
        db,
        sql`select count(*) n from marketplace_events where provider_profile_id = any(${p}) or client_user_id = any(${u}) or actor_user_id = any(${u}) or booking_id = any(${b})`,
      ),
    },
  };
}

/** Deletes the demo scope in one transaction. Returns what was removed. */
export async function purgeDemoData(): Promise<DemoDataSummary> {
  return db.transaction(async (tx) => {
    const before = await summarizeDemoData();
    const { userIds, profileIds, bookingIds } = await scope(tx);
    if (userIds.length === 0) return before;

    const u = intArr(userIds);
    const p = intArr(profileIds);
    const b = intArr(bookingIds);

    await tx.execute(sql`delete from booking_reschedule_history where booking_id = any(${b}) or requester_user_id = any(${u}) or responded_by_user_id = any(${u})`);
    await tx.execute(sql`delete from booking_reschedule_proposals where booking_id = any(${b}) or requester_user_id = any(${u}) or responded_by_user_id = any(${u})`);
    await tx.execute(sql`delete from booking_outcome_history where booking_id = any(${b}) or actor_user_id = any(${u})`);
    await tx.execute(sql`delete from invoices where booking_id = any(${b}) or client_id = any(${u}) or provider_id = any(${p})`);
    await tx.execute(sql`delete from reviews where booking_id = any(${b}) or client_id = any(${u}) or provider_id = any(${p})`);
    await tx.execute(sql`delete from support_messages where user_id = any(${u}) or ticket_id in (select id from support_tickets where booking_id = any(${b}) or user_id = any(${u}))`);
    await tx.execute(sql`delete from support_tickets where booking_id = any(${b}) or user_id = any(${u})`);
    await tx.execute(sql`delete from marketplace_events where provider_profile_id = any(${p}) or client_user_id = any(${u}) or actor_user_id = any(${u}) or booking_id = any(${b})`);
    await tx.execute(sql`delete from prevented_booking_records where provider_id = any(${p}) or actor_user_id = any(${u}) or subject_booking_id = any(${b})`);
    await tx.execute(sql`delete from pilot_provider_retention where provider_id = any(${p}) or updated_by = any(${u})`);
    await tx.execute(sql`delete from bookings where id = any(${b}) or cancelled_by = any(${u}) or no_show_marked_by = any(${u})`);
    // Cascades: availability, services, travel_zones, verification_docs,
    // provider_applications (+ events, submissions, notifications), blocked
    // ranges, emergency openings, service/coverage areas.
    await tx.execute(sql`delete from provider_profiles where id = any(${p})`);
    // Cascades: account_roles, push_tokens, provider_notifications.
    await tx.execute(sql`delete from users where id = any(${u})`);

    return before;
  });
}
