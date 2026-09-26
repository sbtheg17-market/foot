import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

/**
 * Admin-only operational status: which env vars are set (never their values)
 * and which frozen migration artifacts (docs/migrations/*.sql) have been
 * applied, detected by probing the catalog for one object each creates.
 */

const ENV_VARS: ReadonlyArray<{ name: string; required: boolean; purpose: string }> = [
  { name: "DATABASE_URL", required: true, purpose: "Postgres connection (Supabase)" },
  { name: "JWT_SECRET", required: true, purpose: "Signs login session tokens — logins fail with 500 without it" },
  { name: "PORT", required: true, purpose: "HTTP port (injected by the host)" },
  { name: "JWT_EXPIRES_IN", required: false, purpose: "Token lifetime (default 7d)" },
  { name: "NODE_ENV", required: false, purpose: "Runtime mode" },
  { name: "LOG_LEVEL", required: false, purpose: "Pino log level" },
  { name: "MARKETPLACE_TIMEZONE", required: false, purpose: "Marketplace wall-clock timezone" },
  { name: "SUPPORT_CONTACT_EMAIL", required: false, purpose: "Support link shown to providers" },
  { name: "SUPPORT_CONTACT_URL", required: false, purpose: "Support link shown to providers" },
  { name: "PILOT_START_DATE", required: false, purpose: "Pilot window start" },
  { name: "PILOT_END_DATE", required: false, purpose: "Pilot window end" },
  { name: "PILOT_PROVIDER_TARGET", required: false, purpose: "Pilot provider target" },
  { name: "WEB_DIST_PATH", required: false, purpose: "Override for the built web app path" },
];

type Probe =
  | { kind: "table"; table: string }
  | { kind: "column"; table: string; column: string };

const MIGRATIONS: ReadonlyArray<{ artifact: string; enables: string; probe: Probe }> = [
  { artifact: "PREVENTED_BOOKING_RECORDS_V1.sql", enables: "Prevented duplicate-booking analytics", probe: { kind: "table", table: "prevented_booking_records" } },
  { artifact: "PREVENTED_BOOKINGS_DAILY_V1.sql", enables: "Daily prevented-booking projection", probe: { kind: "table", table: "prevented_bookings_daily" } },
  { artifact: "PROVIDER_APPLICATION_REJECTION_REASON_V1.sql", enables: "Provider-visible rejection reasons", probe: { kind: "column", table: "provider_applications", column: "rejection_reason" } },
  { artifact: "PROVIDER_PUBLIC_BOOKING_PAGES_V1.sql", enables: "Public booking pages, share links, source attribution", probe: { kind: "column", table: "provider_profiles", column: "public_slug" } },
  { artifact: "CANCELLATION_NO_SHOW_SUPPORT_V1.sql", enables: "Cancellation / no-show policy and support tickets", probe: { kind: "column", table: "bookings", column: "cancellation_category" } },
  { artifact: "PROVIDER_BLOCKED_RANGES_V1.sql", enables: "Vacation / blocked date ranges", probe: { kind: "table", table: "provider_blocked_ranges" } },
  { artifact: "PROVIDER_EMERGENCY_OPENINGS_V1.sql", enables: "Emergency openings", probe: { kind: "table", table: "provider_emergency_openings" } },
  { artifact: "PROVIDER_SERVICE_AREAS_V1.sql", enables: "Service areas and travel eligibility", probe: { kind: "table", table: "provider_service_areas" } },
  { artifact: "RESCHEDULE_PROPOSALS_HISTORY_V1.sql", enables: "Reschedule proposals and history", probe: { kind: "table", table: "booking_reschedule_proposals" } },
  { artifact: "PILOT_PROVIDER_RETENTION_V1.sql", enables: "Pilot retention tracking (admin)", probe: { kind: "table", table: "pilot_provider_retention" } },
];

export interface SystemStatus {
  generatedAt: string;
  overall: "healthy" | "degraded";
  runtime: { nodeVersion: string; uptimeSeconds: number; nodeEnv: string | null };
  database: {
    connected: boolean;
    serverVersion: string | null;
    latencyMs: number | null;
    host: string | null;
    error: string | null;
  };
  env: Array<{ name: string; required: boolean; isSet: boolean; purpose: string }>;
  migrations: Array<{ artifact: string; applied: boolean | null; enables: string; probe: string }>;
}

function safeHost(): string | null {
  const url = process.env["DATABASE_URL"];
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export async function computeSystemStatus(): Promise<SystemStatus> {
  const env = ENV_VARS.map((v) => ({
    name: v.name,
    required: v.required,
    isSet: Boolean(process.env[v.name]),
    purpose: v.purpose,
  }));

  const database: SystemStatus["database"] = {
    connected: false,
    serverVersion: null,
    latencyMs: null,
    host: safeHost(),
    error: null,
  };

  let tables = new Set<string>();
  let columns = new Set<string>();

  const started = Date.now();
  try {
    const version = await db.execute(sql`select current_setting('server_version') as v`);
    database.latencyMs = Date.now() - started;
    database.connected = true;
    database.serverVersion = String((version.rows[0] as { v: string }).v);

    const cols = await db.execute(
      sql`select table_name, column_name from information_schema.columns where table_schema = 'public'`,
    );
    for (const row of cols.rows as Array<{ table_name: string; column_name: string }>) {
      tables.add(row.table_name);
      columns.add(`${row.table_name}.${row.column_name}`);
    }
  } catch (err) {
    database.error = err instanceof Error ? err.message : "Database check failed";
  }

  const migrations = MIGRATIONS.map((m) => {
    const probe =
      m.probe.kind === "table" ? `table ${m.probe.table}` : `column ${m.probe.table}.${m.probe.column}`;
    const applied = !database.connected
      ? null
      : m.probe.kind === "table"
        ? tables.has(m.probe.table)
        : columns.has(`${m.probe.table}.${m.probe.column}`);
    return { artifact: m.artifact, applied, enables: m.enables, probe };
  });

  const missingRequired = env.some((e) => e.required && !e.isSet);
  const unapplied = migrations.some((m) => m.applied !== true);
  const overall = !database.connected || missingRequired || unapplied ? "degraded" : "healthy";

  return {
    generatedAt: new Date().toISOString(),
    overall,
    runtime: {
      nodeVersion: process.version,
      uptimeSeconds: Math.round(process.uptime()),
      nodeEnv: process.env["NODE_ENV"] ?? null,
    },
    database,
    env,
    migrations,
  };
}
