/**
 * Loaders for date-specific availability exceptions (emergency openings and
 * blocked ranges / time off). Pure read helpers shared by the public slots
 * endpoint and every booking / reschedule enforcement path so all surfaces
 * see the same exceptions.
 */
import { and, eq, gte, lte } from "drizzle-orm";
import {
  db,
  providerBlockedRangesTable,
  providerEmergencyOpeningsTable,
} from "@workspace/db";
import type {
  BlockedRangeWindow,
  EmergencyOpeningWindow,
} from "./availability.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbExecutor = typeof db | Tx;

export interface EmergencyOpeningRow extends EmergencyOpeningWindow {
  id: number;
}

/**
 * Emergency openings for one provider, optionally narrowed to one calendar
 * date (enforcement paths) or to dates >= fromDate (upcoming lists).
 */
export async function loadEmergencyOpenings(
  executor: DbExecutor,
  providerId: number,
  opts: { date?: string; fromDate?: string } = {},
): Promise<EmergencyOpeningRow[]> {
  const conditions = [
    eq(providerEmergencyOpeningsTable.providerId, providerId),
  ];
  if (opts.date !== undefined) {
    conditions.push(eq(providerEmergencyOpeningsTable.date, opts.date));
  }
  if (opts.fromDate !== undefined) {
    conditions.push(gte(providerEmergencyOpeningsTable.date, opts.fromDate));
  }

  return executor
    .select({
      id: providerEmergencyOpeningsTable.id,
      date: providerEmergencyOpeningsTable.date,
      startTime: providerEmergencyOpeningsTable.startTime,
      endTime: providerEmergencyOpeningsTable.endTime,
      serviceIds: providerEmergencyOpeningsTable.serviceIds,
      urgentOnly: providerEmergencyOpeningsTable.urgentOnly,
    })
    .from(providerEmergencyOpeningsTable)
    .where(and(...conditions))
    .orderBy(
      providerEmergencyOpeningsTable.date,
      providerEmergencyOpeningsTable.startTime,
    );
}

export interface BlockedRangeRow extends BlockedRangeWindow {
  id: number;
  reason: string | null;
}

/**
 * Blocked ranges (vacation / time off) for one provider, optionally narrowed
 * to ranges covering one calendar date (enforcement paths) or to ranges
 * ending on/after fromDate (upcoming lists). Dates are inclusive.
 */
export async function loadBlockedRanges(
  executor: DbExecutor,
  providerId: number,
  opts: { date?: string; fromDate?: string } = {},
): Promise<BlockedRangeRow[]> {
  const conditions = [eq(providerBlockedRangesTable.providerId, providerId)];
  if (opts.date !== undefined) {
    conditions.push(lte(providerBlockedRangesTable.startDate, opts.date));
    conditions.push(gte(providerBlockedRangesTable.endDate, opts.date));
  }
  if (opts.fromDate !== undefined) {
    conditions.push(gte(providerBlockedRangesTable.endDate, opts.fromDate));
  }

  return executor
    .select({
      id: providerBlockedRangesTable.id,
      startDate: providerBlockedRangesTable.startDate,
      endDate: providerBlockedRangesTable.endDate,
      reason: providerBlockedRangesTable.reason,
    })
    .from(providerBlockedRangesTable)
    .where(and(...conditions))
    .orderBy(
      providerBlockedRangesTable.startDate,
      providerBlockedRangesTable.id,
    );
}
