import React from 'react';
import { Link } from 'wouter';
import { useGetAdminSystemStatus } from '@workspace/api-client-react';
import { Activity, CheckCircle2, Database, KeyRound, Lock, RefreshCw, ShieldAlert, XCircle, HelpCircle } from 'lucide-react';
import { ROUTES } from '@/lib/routes';
import DemoDataSection from '@/components/admin-system/demo-data-section';

function errorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

function StateIcon({ ok }: { ok: boolean | null }) {
  if (ok === null) return <HelpCircle className="w-4 h-4 text-muted-foreground" aria-label="Unknown" />;
  return ok ? (
    <CheckCircle2 className="w-4 h-4 text-primary" aria-label="OK" />
  ) : (
    <XCircle className="w-4 h-4 text-destructive" aria-label="Problem" />
  );
}

/**
 * /admin/system — deployment configuration health for platform administrators.
 * Shows env var presence (never values), DB connectivity, and which frozen
 * migration artifacts are applied. Server-gated: requireAuth + requireRole("admin").
 */
export default function AdminSystem() {
  const { data, isLoading, error, refetch, isFetching } = useGetAdminSystemStatus();
  const status = errorStatus(error);

  const missingEnv = data?.env.filter((e) => e.required && !e.isSet) ?? [];
  const unapplied = data?.migrations.filter((m) => m.applied !== true) ?? [];

  return (
    <main data-testid="admin-system-page" className="min-h-screen bg-background p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-serif font-bold text-xl shadow-sm">O</div>
        <div className="min-w-0">
          <h1 className="text-2xl font-serif font-bold text-foreground">System Status</h1>
          <p className="text-sm text-muted-foreground">Platform administrator · Deployment configuration health</p>
        </div>
        <nav className="ml-auto flex items-center gap-2 text-sm">
          <Link href={ROUTES.admin.verification} data-testid="system-nav-verification" className="rounded-xl border border-border px-3 py-1.5 hover:bg-secondary">Verification</Link>
          <Link href={ROUTES.admin.pilot} data-testid="system-nav-pilot" className="rounded-xl border border-border px-3 py-1.5 hover:bg-secondary">Pilot</Link>
          <button type="button" onClick={() => refetch()} disabled={isFetching} data-testid="system-refresh-btn" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
          </button>
        </nav>
      </header>

      {isLoading ? (
        <div role="status" data-testid="system-loading" className="flex justify-center py-20">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      ) : error ? (
        <div role="alert" data-testid={status === 401 ? 'system-auth-required' : status === 403 ? 'system-access-denied' : 'system-error'} className="rounded-2xl border border-border bg-white p-8 text-center space-y-3 shadow-sm">
          {status === 403 ? <ShieldAlert className="w-8 h-8 mx-auto text-muted-foreground" /> : <Lock className="w-8 h-8 mx-auto text-muted-foreground" />}
          <p className="text-sm font-medium text-foreground">
            {status === 401 ? 'Sign in as a platform administrator to view system status.' : status === 403 ? 'This page is restricted to platform administrators.' : 'Could not load system status.'}
          </p>
          {status === 401 && <Link href={ROUTES.login} className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Go to sign in</Link>}
        </div>
      ) : data ? (
        <>
          <section data-testid="system-overall" className={`rounded-2xl border p-5 shadow-sm flex items-start gap-4 ${data.overall === 'healthy' ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5'}`}>
            <Activity className={`w-6 h-6 mt-0.5 ${data.overall === 'healthy' ? 'text-primary' : 'text-destructive'}`} aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground" data-testid="system-overall-label">
                {data.overall === 'healthy' ? 'All checks passing' : 'Configuration needs attention'}
              </p>
              <p className="text-sm text-muted-foreground">
                {missingEnv.length > 0 && <span data-testid="system-missing-env-count">{missingEnv.length} required env var{missingEnv.length === 1 ? '' : 's'} missing. </span>}
                {unapplied.length > 0 && <span data-testid="system-unapplied-count">{unapplied.length} migration artifact{unapplied.length === 1 ? '' : 's'} not applied. </span>}
                {!data.database.connected && <span>Database unreachable. </span>}
                {data.overall === 'healthy' && 'Environment, database and schema are all in the expected state.'}
              </p>
              <p className="text-xs text-muted-foreground">Checked {new Date(data.generatedAt).toLocaleString()} · Node {data.runtime.nodeVersion} · up {Math.floor(data.runtime.uptimeSeconds / 60)} min</p>
            </div>
          </section>

          <section data-testid="system-database" className="rounded-2xl border border-border bg-white p-5 shadow-sm space-y-3">
            <h2 className="flex items-center gap-2 font-serif font-bold text-lg text-foreground"><Database className="w-5 h-5 text-primary" aria-hidden="true" /> Database</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><dt className="text-muted-foreground">Connection</dt><dd className="flex items-center gap-1.5 font-medium" data-testid="system-db-connected"><StateIcon ok={data.database.connected} />{data.database.connected ? 'Connected' : 'Failed'}</dd></div>
              <div><dt className="text-muted-foreground">Host</dt><dd className="font-medium truncate" title={data.database.host ?? ''}>{data.database.host ?? '—'}</dd></div>
              <div><dt className="text-muted-foreground">Postgres</dt><dd className="font-medium">{data.database.serverVersion ?? '—'}</dd></div>
              <div><dt className="text-muted-foreground">Latency</dt><dd className="font-medium">{data.database.latencyMs != null ? `${data.database.latencyMs} ms` : '—'}</dd></div>
            </dl>
            {data.database.error && <p className="text-xs text-destructive" data-testid="system-db-error">{data.database.error}</p>}
          </section>

          <section data-testid="system-env" className="rounded-2xl border border-border bg-white p-5 shadow-sm space-y-3">
            <h2 className="flex items-center gap-2 font-serif font-bold text-lg text-foreground"><KeyRound className="w-5 h-5 text-primary" aria-hidden="true" /> Environment variables</h2>
            <p className="text-xs text-muted-foreground">Only presence is reported — values are never sent to the browser.</p>
            <ul className="divide-y divide-border">
              {data.env.map((e) => (
                <li key={e.name} data-testid={`env-${e.name}`} className="flex items-center gap-3 py-2 text-sm">
                  <StateIcon ok={e.isSet || !e.required ? (e.isSet ? true : null) : false} />
                  <code className="font-mono text-xs bg-secondary px-1.5 py-0.5 rounded">{e.name}</code>
                  {e.required && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">required</span>}
                  <span className="ml-auto text-muted-foreground text-right">{e.isSet ? 'Set' : e.required ? 'Missing' : 'Not set (optional)'} · {e.purpose}</span>
                </li>
              ))}
            </ul>
          </section>

          <section data-testid="system-migrations" className="rounded-2xl border border-border bg-white p-5 shadow-sm space-y-3">
            <h2 className="flex items-center gap-2 font-serif font-bold text-lg text-foreground"><Database className="w-5 h-5 text-primary" aria-hidden="true" /> Migration artifacts</h2>
            <p className="text-xs text-muted-foreground">Frozen SQL in <code>docs/migrations/</code>. Detected by probing the live catalog.</p>
            <ul className="divide-y divide-border">
              {data.migrations.map((m) => (
                <li key={m.artifact} data-testid={`migration-${m.artifact.replace(/\.sql$/, '')}`} className="flex items-start gap-3 py-2 text-sm">
                  <StateIcon ok={m.applied} />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{m.artifact}</p>
                    <p className="text-xs text-muted-foreground">{m.enables} · probe: {m.probe}</p>
                  </div>
                  <span className={`ml-auto text-xs font-medium ${m.applied ? 'text-primary' : 'text-destructive'}`}>{m.applied === null ? 'Unknown' : m.applied ? 'Applied' : 'Not applied'}</span>
                </li>
              ))}
            </ul>
          </section>

          <DemoDataSection />
        </>
      ) : null}
    </main>
  );
}
