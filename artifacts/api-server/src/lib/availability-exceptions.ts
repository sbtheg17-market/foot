/**
 * Loaders for date-specific availability exceptions (emergency openings).
 * Pure read helpers shared by the public slots endpoint and every booking /
 * reschedule enforcement path so all surfaces see the same openings.
 */
import { and, eq, gte } from "drizzle-orm";
import { db, providerEmergencyOpeningsTable } from "@workspace/db";
import type { EmergencyOpeningWindow } from "./availability.js";

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
