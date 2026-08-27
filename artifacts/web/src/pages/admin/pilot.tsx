import React from 'react';
import { Link } from 'wouter';
import { useGetAdminPilotMetrics } from '@workspace/api-client-react';
import { Download, Lock, RefreshCw, ShieldAlert } from 'lucide-react';
import { ROUTES } from '@/lib/routes';
import { downloadPilotMetricsCsv } from '@/lib/pilot-csv';
import PilotContextCard from '@/components/admin-pilot/pilot-context-card';
import SummaryCards from '@/components/admin-pilot/summary-cards';
import ActivationOverview from '@/components/admin-pilot/activation-overview';
import ProviderHealthTable from '@/components/admin-pilot/provider-health-table';
import PilotSourceChart from '@/components/admin-pilot/pilot-source-chart';
import ReviewPrompts from '@/components/admin-pilot/review-prompts';

function errorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

/**
 * /admin/pilot — Pilot Operations Dashboard (Part 2 UI).
 *
 * PLATFORM-ADMINISTRATOR ONLY: an internal Foot operator surface, never a
 * provider dashboard, organization-administrator dashboard, or client page.
 * The server (requireAuth + requireRole("admin"), Part 1) is authoritative;
 * this page renders no metric data until the authorized fetch succeeds, so
 * nothing sensitive flashes while authorization resolves.
 */
export default function AdminPilot() {
  const { data, isLoading, error, refetch } = useGetAdminPilotMetrics();
  const status = errorStatus(error);

  return (
    <main
      data-testid="admin-pilot-page"
      className="min-h-screen bg-background p-4 sm:p-6 max-w-6xl mx-auto space-y-6"
    >
      <header className="flex flex-wrap items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-serif font-bold text-xl shadow-sm">
          O
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-serif font-bold text-foreground">Pilot Operations</h1>
          <p className="text-sm text-muted-foreground">
            Platform administrator · Internal pilot dashboard — never shown to providers or clients
          </p>
        </div>
        {data && (
          <button
            type="button"
            data-testid="pilot-csv-export-btn"
            onClick={() => downloadPilotMetricsCsv(data)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Export CSV
          </button>
        )}
      </header>

      {isLoading ? (
        <div
          role="status"
          aria-label="Loading pilot metrics"
          data-testid="pilot-loading"
          className="flex justify-center py-20"
        >
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <span className="sr-only">Loading pilot metrics</span>
        </div>
      ) : error ? (
        status === 401 ? (
          <div
            data-testid="pilot-auth-required"
            className="rounded-2xl border border-border bg-white p-8 text-center space-y-3 shadow-sm"
          >
            <Lock className="w-8 h-8 mx-auto text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">
              Sign in as a platform administrator to view pilot operations.
            </p>
            <Link
              href={ROUTES.login}
              data-testid="pilot-login-link"
              className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go to sign in
            </Link>
          </div>
        ) : status === 403 ? (
          <div
            data-testid="pilot-access-denied"
            className="rounded-2xl border border-border bg-white p-8 text-center space-y-3 shadow-sm"
          >
            <ShieldAlert className="w-8 h-8 mx-auto text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">
              This internal dashboard is restricted to platform administrators.
            </p>
            <p className="text-xs text-muted-foreground">
              Provider and client accounts can't view pilot operations data.
            </p>
          </div>
        ) : (
          <div
            role="alert"
            data-testid="pilot-error"
            className="rounded-2xl border border-border bg-white p-8 text-center space-y-3 shadow-sm"
          >
            <p className="text-sm font-medium text-foreground">
              We couldn't load pilot metrics right now. Nothing is lost — please try again.
            </p>
            <button
              type="button"
              data-testid="pilot-error-retry"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        )
      ) : data ? (
        <>
          <PilotContextCard pilot={data.pilot} />
          <SummaryCards
            summary={data.summary}
            providerTarget={data.pilot.providerTarget}
            providersWithFirstBooking={
              data.providers.filter((p) => p.firstBookingAt !== null).length
            }
          />
          <ActivationOverview providers={data.providers} />
          <ProviderHealthTable providers={data.providers} />
          <PilotSourceChart items={data.sourceAttribution} />
          <ReviewPrompts summary={data.summary} />
        </>
      ) : null}
    </main>
  );
}
