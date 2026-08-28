/**
 * Marketplace availability + slot generation (Timezone Option B).
 *
 * Approved policy:
 *  - Effective timezone comes from MARKETPLACE_TIMEZONE (default America/Toronto).
 *  - The value must be a valid IANA identifier; an invalid override throws
 *    InvalidMarketplaceTimezoneError (a clear failure — never a silent fallback).
 *  - Availability windows are wall-clock time in the effective marketplace
 *    timezone; conversion to UTC instants is DST-aware.
 *  - Nonexistent spring-forward local times are OMITTED.
 *  - Ambiguous fall-back local times are OMITTED (never silently duplicated).
 *
 * Known limitation (documented; do not deploy until accepted): naive timestamp
 * round-tripping relies on the Node process running in UTC. All conversions in
 * this module use explicit Intl-based offsets and never read the process TZ.
 */

export const SLOT_INCREMENT_MINUTES = 30;
export const DEFAULT_MARKETPLACE_TIMEZONE = "America/Toronto";

export class InvalidMarketplaceTimezoneError extends Error {
  constructor(value: string) {
    super(
      `MARKETPLACE_TIMEZONE "${value}" is not a valid IANA timezone identifier.`,
    );
    this.name = "InvalidMarketplaceTimezoneError";
  }
}

/** True when `tz` is a resolvable IANA timezone identifier. */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the effective marketplace timezone. Reads MARKETPLACE_TIMEZONE when
 * set (validated), otherwise the approved default. An invalid override throws.
 */
export function getMarketplaceTimezone(): string {
  const override = process.env["MARKETPLACE_TIMEZONE"];
  if (override === undefined || override.trim() === "") {
    return DEFAULT_MARKETPLACE_TIMEZONE;
  }
  const value = override.trim();
  if (!isValidTimeZone(value)) {
    throw new InvalidMarketplaceTimezoneError(value);
  }
  return value;
}

interface LocalFields {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
}

/** Wall-clock fields of a UTC instant, as seen in `tz`. */
function getLocalFields(utcMs: number, tz: string): LocalFields {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  let hour = get("hour");
  if (hour === 24) hour = 0; // some engines emit "24" for midnight
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
  };
}

/** Timezone offset (ms) applied in `tz` at the given UTC instant. */
function tzOffsetMs(utcMs: number, tz: string): number {
  const f = getLocalFields(utcMs, tz);
  const asIfUtc = Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute);
  // asIfUtc reflects seconds-truncation; align to the minute for stability.
  return asIfUtc - Math.floor(utcMs / 60000) * 60000;
}

function fieldsMatch(utcMs: number, target: LocalFields, tz: string): boolean {
  const f = getLocalFields(utcMs, tz);
  return (
    f.year === target.year &&
    f.month === target.month &&
    f.day === target.day &&
    f.hour === target.hour &&
    f.minute === target.minute
  );
}

/**
 * Convert a wall-clock time in `tz` to a UTC Date.
 *
 * Returns null when the local time does not exist exactly once:
 *  - 0 valid instants → nonexistent (spring-forward gap) → omit;
 *  - 2 valid instants → ambiguous (fall-back overlap) → omit.
 */
export function wallTimeToUtc(
  fields: LocalFields,
  tz: string,
): Date | null {
  const localAsUtc = Date.UTC(
    fields.year,
    fields.month - 1,
    fields.day,
    fields.hour,
    fields.minute,
  );
  const o1 = tzOffsetMs(localAsUtc, tz);
  const u1 = localAsUtc - o1;
  const o2 = tzOffsetMs(u1, tz);
  const u2 = localAsUtc - o2;

  const candidates = u1 === u2 ? [u1] : [u1, u2];
  const valid = candidates.filter((u) => fieldsMatch(u, fields, tz));

  if (valid.length === 1) return new Date(valid[0]!);
  return null; // 0 → nonexistent; 2 → ambiguous
}

/** Weekday (0=Sunday…6=Saturday) of a `YYYY-MM-DD` calendar date in `tz`. */
export function dayOfWeekForDate(dateStr: string, tz: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  // Anchor at local noon to avoid DST edges affecting the weekday.
  const utc = wallTimeToUtc(
    { year: y!, month: m!, day: d!, hour: 12, minute: 0 },
    tz,
  );
  const ms = utc ? utc.getTime() : Date.UTC(y!, m! - 1, d!, 12, 0);
  const weekdayName = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(new Date(ms));
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[
    weekdayName as "Sun"
  ] as number;
}

/** Format a UTC instant as an "HH:MM" wall-clock label in `tz`. */
export function localTimeLabel(utcMs: number, tz: string): string {
  const f = getLocalFields(utcMs, tz);
  return `${String(f.hour).padStart(2, "0")}:${String(f.minute).padStart(2, "0")}`;
}

function parseHHMM(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h! * 60 + m!;
}

export interface AvailabilityWindow {
  dayOfWeek: number;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

export interface GeneratedSlot {
  /** UTC ISO instant of the slot start. */
  start: string;
  /** UTC ISO instant of the slot end (start + service duration). */
  end: string;
}

/**
 * Generate candidate 30-minute-aligned slots for one calendar date.
 *
 * A slot is offered only when the whole service duration fits inside a single
 * availability window: [slotStart, slotStart + durationMinutes) must satisfy
 * slotStart >= windowStart AND slotStart + duration <= windowEnd. Booking end
 * exactly at the window end is valid. DST-invalid starts are omitted.
 */
export function generateSlotsForDate(params: {
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  windows: AvailabilityWindow[];
  tz: string;
}): GeneratedSlot[] {
  const { date, durationMinutes, windows, tz } = params;
  const [y, m, d] = date.split("-").map(Number);
  const weekday = dayOfWeekForDate(date, tz);
  const dayWindows = windows.filter((w) => w.dayOfWeek === weekday);

  const slots: GeneratedSlot[] = [];
  const seen = new Set<string>();

  for (const w of dayWindows) {
    const winStart = parseHHMM(w.startTime);
    const winEnd = parseHHMM(w.endTime);
    if (winStart >= winEnd) continue; // overnight/degenerate windows unsupported

    for (
      let startMin = winStart;
      startMin + durationMinutes <= winEnd;
      startMin += SLOT_INCREMENT_MINUTES
    ) {
      const hour = Math.floor(startMin / 60);
      const minute = startMin % 60;
      const startUtc = wallTimeToUtc(
        { year: y!, month: m!, day: d!, hour, minute },
        tz,
      );
      if (!startUtc) continue; // DST nonexistent/ambiguous → omit

      const startIso = startUtc.toISOString();
      if (seen.has(startIso)) continue;
      seen.add(startIso);

      const endUtc = new Date(startUtc.getTime() + durationMinutes * 60000);
      slots.push({ start: startIso, end: endUtc.toISOString() });
    }
  }

  slots.sort((a, b) => a.start.localeCompare(b.start));
  return slots;
}

/**
 * Availability enforcement for a concrete requested instant: the booking
 * interval [start, start + duration) must be fully contained within one
 * availability window on that instant's local weekday. Intervals that cross a
 * window boundary (including midnight) are rejected. Returns true when valid.
 */
export function isWithinAvailability(params: {
  scheduledAt: Date;
  durationMinutes: number;
  windows: AvailabilityWindow[];
  tz: string;
}): boolean {
  const { scheduledAt, durationMinutes, windows, tz } = params;
  const f = getLocalFields(scheduledAt.getTime(), tz);
  const weekdayName = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(scheduledAt);
  const weekday = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[
    weekdayName as "Sun"
  ] as number;

  const startMin = f.hour * 60 + f.minute;
  const endMin = startMin + durationMinutes;

  return windows.some(
    (w) =>
      w.dayOfWeek === weekday &&
      startMin >= parseHHMM(w.startTime) &&
      endMin <= parseHHMM(w.endTime),
  );
}

// ── Emergency openings (one-off extra slots) ──────────────────────────────────
//
// A provider can open EXTRA date-specific windows outside the weekly schedule
// (docs/emergency-openings-policy.md). Openings are a second SOURCE of
// bookable time for the SAME engine — never a second engine: slot stepping,
// DST handling, and duration-fit rules are identical to weekly windows, and
// the transactional overlap + travel-buffer guards apply unchanged.

export interface EmergencyOpeningWindow {
  /** Calendar date (YYYY-MM-DD) in the effective marketplace timezone. */
  date: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  /** Restrict to these service ids; null/empty = every active service. */
  serviceIds?: number[] | null;
  /** Client-facing label only — the booking flow is unchanged. */
  urgentOnly?: boolean;
}

/** Calendar date (YYYY-MM-DD) of a UTC instant as seen in `tz`. */
export function localDateOfInstant(utcMs: number, tz: string): string {
  const f = getLocalFields(utcMs, tz);
  return `${f.year}-${String(f.month).padStart(2, "0")}-${String(f.day).padStart(2, "0")}`;
}

function openingAppliesToService(
  opening: EmergencyOpeningWindow,
  serviceId?: number,
): boolean {
  if (!opening.serviceIds || opening.serviceIds.length === 0) return true;
  return serviceId !== undefined && opening.serviceIds.includes(serviceId);
}

export interface EffectiveSlot extends GeneratedSlot {
  /** True only when EVERY source offering this start is urgent-only. */
  urgentOnly: boolean;
}

/**
 * Candidate slots for one calendar date from BOTH sources: the weekly
 * windows (via generateSlotsForDate — behavior unchanged) plus any emergency
 * openings on that date that apply to the requested service. Duplicate
 * starts are offered once; a slot is labeled urgent-only ONLY when no
 * weekly window or non-urgent opening also offers it.
 */
export function generateEffectiveSlotsForDate(params: {
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  windows: AvailabilityWindow[];
  tz: string;
  serviceId?: number;
  emergencyOpenings?: EmergencyOpeningWindow[];
}): EffectiveSlot[] {
  const { date, durationMinutes, windows, tz, serviceId, emergencyOpenings } =
    params;

  const byStart = new Map<string, EffectiveSlot>();
  for (const s of generateSlotsForDate({ date, durationMinutes, windows, tz })) {
    byStart.set(s.start, { ...s, urgentOnly: false });
  }

  const [y, m, d] = date.split("-").map(Number);
  for (const opening of emergencyOpenings ?? []) {
    if (opening.date !== date) continue;
    if (!openingAppliesToService(opening, serviceId)) continue;
    const winStart = parseHHMM(opening.startTime);
    const winEnd = parseHHMM(opening.endTime);
    if (winStart >= winEnd) continue; // degenerate windows unsupported

    for (
      let startMin = winStart;
      startMin + durationMinutes <= winEnd;
      startMin += SLOT_INCREMENT_MINUTES
    ) {
      const startUtc = wallTimeToUtc(
        {
          year: y!,
          month: m!,
          day: d!,
          hour: Math.floor(startMin / 60),
          minute: startMin % 60,
        },
        tz,
      );
      if (!startUtc) continue; // DST nonexistent/ambiguous → omit

      const startIso = startUtc.toISOString();
      const existing = byStart.get(startIso);
      if (existing) {
        // A non-urgent source clears the urgent-only label.
        if (opening.urgentOnly !== true) existing.urgentOnly = false;
        continue;
      }
      byStart.set(startIso, {
        start: startIso,
        end: new Date(startUtc.getTime() + durationMinutes * 60000).toISOString(),
        urgentOnly: opening.urgentOnly === true,
      });
    }
  }

  return [...byStart.values()].sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * Enforcement for a concrete requested instant across BOTH sources: valid
 * when the interval fits a weekly window (isWithinAvailability — rule
 * unchanged) OR fits inside one emergency opening on that local calendar
 * date that applies to the requested service. Intervals crossing an opening
 * boundary are rejected exactly like window boundaries.
 */
export function isWithinEffectiveAvailability(params: {
  scheduledAt: Date;
  durationMinutes: number;
  windows: AvailabilityWindow[];
  tz: string;
  serviceId?: number;
  emergencyOpenings?: EmergencyOpeningWindow[];
}): boolean {
  const { scheduledAt, durationMinutes, windows, tz, serviceId } = params;

  if (isWithinAvailability({ scheduledAt, durationMinutes, windows, tz })) {
    return true;
  }

  const f = getLocalFields(scheduledAt.getTime(), tz);
  const dateStr = localDateOfInstant(scheduledAt.getTime(), tz);
  const startMin = f.hour * 60 + f.minute;
  const endMin = startMin + durationMinutes;

  return (params.emergencyOpenings ?? []).some(
    (o) =>
      o.date === dateStr &&
      openingAppliesToService(o, serviceId) &&
      startMin >= parseHHMM(o.startTime) &&
      endMin <= parseHHMM(o.endTime),
  );
}
