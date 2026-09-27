import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  useGetAdminVerificationQueue,
  useListAdminProviderApplications,
  useListAdminProviderApplicationEvents,
  useListAdminVerificationEvents,
  useListAdminSupportEscalations,
  useGetAdminSystemStatus,
  useGetAdminDemoData,
  getGetAdminVerificationQueueQueryKey,
  getListAdminProviderApplicationsQueryKey,
  getListAdminProviderApplicationEventsQueryKey,
  getListAdminVerificationEventsQueryKey,
  getListAdminSupportEscalationsQueryKey,
  getGetAdminSystemStatusQueryKey,
  getGetAdminDemoDataQueryKey,
  type AdminProviderApplicationListItem,
  type AdminVerificationQueueItem,
  type AdminSupportEscalation,
} from '@workspace/api-client-react';
import {
  Activity,
  ClipboardList,
  FileCheck2,
  FlaskConical,
  History,
  LifeBuoy,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  Send,
  Undo2,
  ChevronRight,
} from 'lucide-react';
import { ROUTES } from '@/lib/routes';
import { timeAgo, daysSince } from '@/lib/time-ago';
import QueueCard from '@/components/admin-home/queue-card';
import ApplicationDecisionDialog from '@/components/admin-home/application-decision-dialog';
import CredentialDecisionDialog from '@/components/admin-home/credential-decision-dialog';
import EscalationResolveDialog from '@/components/admin-home/escalation-resolve-dialog';

function errorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

const REFRESH_MS = 60_000;
const QUEUE_PREVIEW = 5;
/** Waiting longer than this is flagged; a definition, not a promise. */
const SLOW_DAYS = 3;

const EVENT_META: Record<string, { label: string; icon: React.ReactNode; tone: string }> = {
  approved: { label: 'Approved', icon: <UserCheck className="w-4 h-4" aria-hidden="true" />, tone: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', icon: <UserX className="w-4 h-4" aria-hidden="true" />, tone: 'bg-red-100 text-red-700' },
  submitted: { label: 'Submitted for review', icon: <Send className="w-4 h-4" aria-hidden="true" />, tone: 'bg-amber-100 text-amber-700' },
  reset_to_draft: { label: 'Reset to draft', icon: <Undo2 className="w-4 h-4" aria-hidden="true" />, tone: 'bg-secondary text-foreground' },
};

/**
 * /admin — the command-center landing page. Answers "what needs an
 * administrator now?" from existing read-only admin APIs. No decisions are
 * taken here; every card links to the surface where the action happens.
 * Server-gated: requireAuth + requireRole("admin") on every feed.
 */
export default function AdminHome() {
  const verificationParams = { status: 'pending', limit: 200 } as const;
  const applicationParams = { status: 'under_review', limit: 200 } as const;
  const eventParams = { limit: 8 } as const;

  const verification = useGetAdminVerificationQueue(verificationParams, {
    query: { queryKey: getGetAdminVerificationQueueQueryKey(verificationParams), refetchInterval: REFRESH_MS },
  });
  const applications = useListAdminProviderApplications(applicationParams, {
    query: { queryKey: getListAdminProviderApplicationsQueryKey(applicationParams), refetchInterval: REFRESH_MS },
  });
  const events = useListAdminProviderApplicationEvents(eventParams, {
    query: { queryKey: getListAdminProviderApplicationEventsQueryKey(eventParams), refetchInterval: REFRESH_MS },
  });
  const credentialEvents = useListAdminVerificationEvents(eventParams, {
    query: { queryKey: getListAdminVerificationEventsQueryKey(eventParams), refetchInterval: REFRESH_MS },
  });
  const escalationParams = { status: 'unresolved', limit: 200 } as const;
  const escalations = useListAdminSupportEscalations(escalationParams, {
    query: { queryKey: getListAdminSupportEscalationsQueryKey(escalationParams), refetchInterval: REFRESH_MS },
  });
  const system = useGetAdminSystemStatus({
    query: { queryKey: getGetAdminSystemStatusQueryKey(), refetchInterval: REFRESH_MS },
  });
  const demo = useGetAdminDemoData({
    query: { queryKey: getGetAdminDemoDataQueryKey(), refetchInterval: REFRESH_MS },
  });

  const feeds = [verification, applications, events, credentialEvents, escalations, system, demo];
  const gateStatus = feeds.map((f) => errorStatus(f.error)).find((s) => s === 401 || s === 403);
  const anyFetching = feeds.some((f) => f.isFetching);
  const refreshAll = () => feeds.forEach((f) => void f.refetch());

  const demoUserIds = useMemo(() => new Set((demo.data?.users ?? []).map((u) => u.id)), [demo.data]);

  // ── Decide-in-browser (Phase 2 slice) ───────────────────────────────────
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<AdminProviderApplicationListItem | null>(null);
  const [showAllApplications, setShowAllApplications] = useState(false);
  const pendingDocsByProfile = useMemo(() => {
    const m = new Map<number, number>();
    for (const { provider } of verification.data?.items ?? []) m.set(provider.id, (m.get(provider.id) ?? 0) + 1);
    return m;
  }, [verification.data]);
  const onDecided = () => {
    // Refresh every feed the decision can change: the under_review queue, the
    // events list and (via activation events) pilot/system are unaffected here.
    void queryClient.invalidateQueries({ queryKey: getListAdminProviderApplicationsQueryKey(applicationParams) });
    void queryClient.invalidateQueries({ queryKey: getListAdminProviderApplicationEventsQueryKey(eventParams) });
    void queryClient.invalidateQueries({ queryKey: getGetAdminVerificationQueueQueryKey(verificationParams) });
  };

  // ── Credential decisions (Phase 2 slice 2) ──────────────────────────────
  const [selectedDoc, setSelectedDoc] = useState<AdminVerificationQueueItem | null>(null);
  const [showAllDocs, setShowAllDocs] = useState(false);
  const onCredentialDecided = () => {
    void queryClient.invalidateQueries({ queryKey: getGetAdminVerificationQueueQueryKey(verificationParams) });
    void queryClient.invalidateQueries({ queryKey: getListAdminVerificationEventsQueryKey(eventParams) });
    void queryClient.invalidateQueries({ queryKey: getListAdminProviderApplicationsQueryKey(applicationParams) });
  };

  // ── Support escalations (Phase 2 slice 2) ───────────────────────────────
  const [selectedTicket, setSelectedTicket] = useState<AdminSupportEscalation | null>(null);
  const [showAllTickets, setShowAllTickets] = useState(false);
  const onEscalationDecided = () => {
    void queryClient.invalidateQueries({ queryKey: getListAdminSupportEscalationsQueryKey(escalationParams) });
  };
  const openTickets = escalations.data?.total ?? null;
  const oldestTicket = escalations.data?.items[0]?.createdAt ?? null;
  const oldestTicketDays = daysSince(oldestTicket);

  // ── Derived queue facts ────────────────────────────────────────────────
  const pendingDocs = verification.data?.total ?? null;
  const oldestDoc = verification.data?.items[0]?.doc.submittedAt ?? null; // server orders submittedAt asc
  const oldestDocDays = daysSince(oldestDoc);

  const underReview = applications.data?.total ?? null;
  const oldestApp = applications.data?.items[0]?.application.submittedAt ?? null;
  const oldestAppDays = daysSince(oldestApp);

  const sys = system.data;
  const missingEnv = sys?.env.filter((e) => e.required && !e.isSet).length ?? 0;
  const unapplied = sys?.migrations.filter((m) => m.applied !== true).length ?? 0;
  const sysProblems = (sys ? (sys.database.connected ? 0 : 1) : 0) + missingEnv + unapplied;

  const demoCounts = demo.data?.counts;
  const demoUsers = demoCounts?.users ?? null;

  const feedError = (f: { error: unknown }, what: string) =>
    f.error && !gateStatus ? `Couldn't load ${what}. Refresh to try again.` : null;

  return (
    <main data-testid="admin-home-page" className="min-h-screen bg-background p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-serif font-bold text-xl shadow-sm">O</div>
        <div className="min-w-0">
          <h1 className="text-2xl font-serif font-bold text-foreground">Admin Command Center</h1>
          <p className="text-sm text-muted-foreground">Platform administrator · What needs you now</p>
        </div>
        <nav aria-label="Admin sections" className="ml-auto flex flex-wrap items-center gap-2 text-sm">
          <Link href={ROUTES.admin.verification} data-testid="home-nav-verification" className="rounded-xl border border-border px-3 py-1.5 hover:bg-secondary">Verification</Link>
          <Link href={ROUTES.admin.pilot} data-testid="home-nav-pilot" className="rounded-xl border border-border px-3 py-1.5 hover:bg-secondary">Pilot</Link>
          <Link href={ROUTES.admin.system} data-testid="home-nav-system" className="rounded-xl border border-border px-3 py-1.5 hover:bg-secondary">System</Link>
          <button type="button" onClick={refreshAll} disabled={anyFetching} data-testid="home-refresh-btn" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${anyFetching ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
          </button>
        </nav>
      </header>

      {gateStatus ? (
        <div role="alert" data-testid={gateStatus === 401 ? 'home-auth-required' : 'home-access-denied'} className="rounded-2xl border border-border bg-white p-8 text-center space-y-3 shadow-sm">
          {gateStatus === 403 ? <ShieldAlert className="w-8 h-8 mx-auto text-muted-foreground" aria-hidden="true" /> : <Lock className="w-8 h-8 mx-auto text-muted-foreground" aria-hidden="true" />}
          <p className="text-sm font-medium text-foreground">
            {gateStatus === 401 ? 'Sign in as a platform administrator to open the command center.' : 'This area is restricted to platform administrators.'}
          </p>
          {gateStatus === 401 ? (
            <Link href={ROUTES.login} data-testid="home-login-link" className="inline-block rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Go to sign in</Link>
          ) : (
            <p className="text-xs text-muted-foreground">Provider and client accounts can't view platform operations.</p>
          )}
        </div>
      ) : (
        <>
          {/* ── Action queue ─────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <QueueCard
              testId="card-credentials"
              icon={<FileCheck2 className="w-5 h-5" />}
              title="Credentials awaiting review"
              headline={pendingDocs}
              headlineLabel={oldestDoc ? `Oldest waiting ${timeAgo(oldestDoc)}` : 'No documents waiting'}
              tone={pendingDocs === null ? 'neutral' : pendingDocs === 0 ? 'ok' : oldestDocDays >= SLOW_DAYS ? 'attention' : 'neutral'}
              what={pendingDocs === 0 ? 'Every submitted credential has a decision.' : `${pendingDocs ?? '…'} document${pendingDocs === 1 ? '' : 's'} submitted by providers still need${pendingDocs === 1 ? 's' : ''} a reviewer.`}
              why="A provider cannot take bookings until their profile verification is approved, so each waiting document is a provider (and their clients) on hold."
              next={{ href: ROUTES.admin.verification, label: 'Open verification queue', testId: 'card-credentials-next' }}
              success={`Queue at 0 and nothing waiting more than ${SLOW_DAYS} days. Tap a document below to decide.`}
              loading={verification.isLoading}
              error={feedError(verification, 'the verification queue')}
            >
              {verification.data && verification.data.items.length > 0 && (
                <ul data-testid="credentials-preview" aria-label="Credentials awaiting review — tap to decide" className="divide-y divide-border rounded-xl border border-border bg-white/70">
                  {(showAllDocs ? verification.data.items : verification.data.items.slice(0, QUEUE_PREVIEW)).map((row) => {
                    const { doc, provider } = row;
                    const waited = daysSince(doc.submittedAt);
                    const isDemo = demoUserIds.has(provider.userId);
                    return (
                      <li key={doc.id} data-testid={`credential-row-${doc.id}`}>
                        <button type="button" data-testid={`credential-open-${doc.id}`} onClick={() => setSelectedDoc(row)}
                          aria-label={`Review credential ${doc.id} from ${provider.firstName} ${provider.lastName}`}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground truncate">
                              {provider.firstName} {provider.lastName}
                              {isDemo && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Demo</span>}
                            </p>
                            <p className="text-xs text-muted-foreground truncate"><span className="capitalize">{doc.docType}</span> · profile {provider.verificationStatus.replace('_', ' ')}</p>
                          </div>
                          <span className={`text-xs font-medium tabular-nums ${waited >= SLOW_DAYS ? 'text-amber-700' : 'text-muted-foreground'}`}>{waited}d</span>
                          <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                  {verification.data.items.length > QUEUE_PREVIEW && (
                    <li className="px-3 py-2 text-xs">
                      <button type="button" data-testid="credentials-toggle-all" onClick={() => setShowAllDocs((v) => !v)} className="text-primary hover:underline">
                        {showAllDocs ? 'Show fewer' : `Show all ${verification.data.items.length}`}
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </QueueCard>

            <QueueCard
              testId="card-applications"
              icon={<ClipboardList className="w-5 h-5" />}
              title="Applications under review"
              headline={underReview}
              headlineLabel={oldestApp ? `Oldest submitted ${timeAgo(oldestApp)}` : 'No applications waiting'}
              tone={underReview === null ? 'neutral' : underReview === 0 ? 'ok' : oldestAppDays >= SLOW_DAYS ? 'attention' : 'neutral'}
              what={underReview === 0 ? 'No provider application is waiting for a decision.' : `${underReview ?? '…'} provider application${underReview === 1 ? '' : 's'} ${underReview === 1 ? 'is' : 'are'} submitted and waiting for approve/reject.`}
              why="Approval needs two steps: the application decision and the credential verification. Until both are approved the provider stays in review."
              next={{ href: ROUTES.admin.verification, label: 'Open verification queue', testId: 'card-applications-next' }}
              success="Every submitted application has a recorded approve or reject event. Tap an applicant below to decide."
              loading={applications.isLoading}
              error={feedError(applications, 'applications under review')}
            >
              {applications.data && applications.data.items.length > 0 && (
                <ul data-testid="applications-preview" aria-label="Applications under review — tap to decide" className="divide-y divide-border rounded-xl border border-border bg-white/70">
                  {(showAllApplications ? applications.data.items : applications.data.items.slice(0, QUEUE_PREVIEW)).map((row) => {
                    const { application, applicant } = row;
                    const waited = daysSince(application.submittedAt);
                    const isDemo = demoUserIds.has(applicant.userId);
                    const docs = pendingDocsByProfile.get(applicant.providerProfileId) ?? 0;
                    return (
                      <li key={application.id} data-testid={`application-row-${application.id}`}>
                        <button
                          type="button"
                          data-testid={`application-open-${application.id}`}
                          onClick={() => setSelected(row)}
                          aria-label={`Decide application ${application.id} from ${applicant.firstName} ${applicant.lastName}`}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground truncate">
                              {applicant.firstName} {applicant.lastName}
                              {isDemo && <span data-testid={`application-demo-badge-${application.id}`} className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Demo</span>}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{applicant.city || 'City not set'} · profile {applicant.verificationStatus.replace('_', ' ')} · {docs} doc{docs === 1 ? '' : 's'} pending</p>
                          </div>
                          <span className={`text-xs font-medium tabular-nums ${waited >= SLOW_DAYS ? 'text-amber-700' : 'text-muted-foreground'}`}>{application.submittedAt ? `${waited}d` : '—'}</span>
                          <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                  {applications.data.items.length > QUEUE_PREVIEW && (
                    <li className="px-3 py-2 text-xs">
                      <button type="button" data-testid="applications-toggle-all" onClick={() => setShowAllApplications((v) => !v)} className="text-primary hover:underline">
                        {showAllApplications ? 'Show fewer' : `Show all ${applications.data.items.length}`}
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </QueueCard>

            <QueueCard
              testId="card-support"
              icon={<LifeBuoy className="w-5 h-5" />}
              title="Support requests open"
              headline={openTickets}
              headlineLabel={oldestTicket ? `Oldest opened ${timeAgo(oldestTicket)}` : 'No open requests'}
              tone={openTickets === null ? 'neutral' : openTickets === 0 ? 'ok' : oldestTicketDays >= SLOW_DAYS ? 'attention' : 'neutral'}
              what={openTickets === 0 ? 'Every support request has been resolved.' : `${openTickets ?? '…'} request${openTickets === 1 ? '' : 's'} from providers or clients ${openTickets === 1 ? 'is' : 'are'} open or in progress.`}
              why="An unanswered dispute or question is the fastest way to lose a provider or client during the pilot."
              next={{ href: ROUTES.admin.root, label: 'Tap a request below to work it', testId: 'card-support-next' }}
              success="Open count reads 0 and nothing waits more than a day."
              loading={escalations.isLoading}
              error={feedError(escalations, 'support requests')}
            >
              {escalations.data && escalations.data.items.length > 0 && (
                <ul data-testid="escalations-preview" aria-label="Open support requests — tap to work" className="divide-y divide-border rounded-xl border border-border bg-white/70">
                  {(showAllTickets ? escalations.data.items : escalations.data.items.slice(0, QUEUE_PREVIEW)).map((t) => {
                    const waited = daysSince(t.createdAt);
                    return (
                      <li key={t.id} data-testid={`escalation-row-${t.id}`}>
                        <button type="button" data-testid={`escalation-open-${t.id}`} onClick={() => setSelectedTicket(t)}
                          aria-label={`Work support request ${t.id} from ${t.requester.firstName} ${t.requester.lastName}`}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-secondary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground truncate">{t.subject}</p>
                            <p className="text-xs text-muted-foreground truncate">{t.requester.firstName} {t.requester.lastName} · <span className="capitalize">{t.requester.role}</span> · {t.status.replace('_', ' ')}{t.latestMessage ? ` · “${t.latestMessage.message}”` : ''}</p>
                          </div>
                          <span className={`text-xs font-medium tabular-nums ${waited >= 1 ? 'text-amber-700' : 'text-muted-foreground'}`}>{waited}d</span>
                          <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                  {escalations.data.items.length > QUEUE_PREVIEW && (
                    <li className="px-3 py-2 text-xs">
                      <button type="button" data-testid="escalations-toggle-all" onClick={() => setShowAllTickets((v) => !v)} className="text-primary hover:underline">
                        {showAllTickets ? 'Show fewer' : `Show all ${escalations.data.items.length}`}
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </QueueCard>

            <QueueCard
              testId="card-system"
              icon={<Activity className="w-5 h-5" />}
              title="System health"
              headline={sys ? (sys.overall === 'healthy' ? 'Healthy' : `${sysProblems} issue${sysProblems === 1 ? '' : 's'}`) : null}
              headlineLabel={sys ? `Checked ${timeAgo(sys.generatedAt) ?? 'just now'}` : 'Deployment configuration'}
              tone={sys ? (sys.overall === 'healthy' ? 'ok' : 'warn') : 'neutral'}
              what={sys ? (sys.overall === 'healthy' ? 'Database reachable, required environment set, all migration artifacts applied.' : [!sys.database.connected && 'database unreachable', missingEnv > 0 && `${missingEnv} required env var${missingEnv === 1 ? '' : 's'} missing`, unapplied > 0 && `${unapplied} migration artifact${unapplied === 1 ? '' : 's'} not applied`].filter(Boolean).join(' · ') + '.') : 'Loading configuration checks…'}
              why="A degraded configuration breaks logins or booking features for everyone before any single ticket shows it."
              next={{ href: ROUTES.admin.system, label: 'Open system status', testId: 'card-system-next' }}
              success="Overall status reads Healthy after a fresh check."
              loading={system.isLoading}
              error={feedError(system, 'system status')}
            />

            <QueueCard
              testId="card-demo"
              icon={<FlaskConical className="w-5 h-5" />}
              title="Demo data present"
              headline={demoUsers}
              headlineLabel={demoCounts ? `${demoCounts.providerProfiles} profiles · ${demoCounts.bookings} bookings · ${demoCounts.reviews} reviews` : 'Seed accounts and sample records'}
              tone={demoUsers === null ? 'neutral' : demoUsers === 0 ? 'ok' : 'attention'}
              what={demoUsers === 0 ? 'No seed accounts remain in the database.' : `${demoUsers ?? '…'} seed account${demoUsers === 1 ? '' : 's'} and their sample data are still in the live database.`}
              why="Demo records inflate every count on this page and in pilot metrics; items from these accounts are tagged Demo above."
              next={{ href: ROUTES.admin.system, label: 'Manage on System page', testId: 'card-demo-next' }}
              success="Demo count reads 0 (purge is a deliberate, typed-confirmation action — never automatic)."
              loading={demo.isLoading}
              error={feedError(demo, 'demo data summary')}
            />
          </div>

          {/* ── Recent decisions ─────────────────────────────────────── */}
          <section data-testid="recent-decisions" className="rounded-2xl border border-border bg-white p-5 shadow-sm space-y-3">
            <header className="flex flex-wrap items-center gap-2">
              <History className="w-5 h-5 text-primary" aria-hidden="true" />
              <h2 className="font-serif font-bold text-lg text-foreground">Recent application activity</h2>
              <span className="basis-full sm:basis-auto sm:ml-auto text-xs text-muted-foreground">Records only: submitted · approved · rejected · reset</span>
            </header>
            {events.isLoading ? (
              <div role="status" data-testid="recent-decisions-loading" className="flex justify-center py-8"><div className="w-6 h-6 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>
            ) : events.error ? (
              <p role="alert" data-testid="recent-decisions-error" className="text-sm text-destructive">Couldn't load recent activity. Refresh to try again.</p>
            ) : (events.data?.items.length ?? 0) === 0 ? (
              <div data-testid="recent-decisions-empty" className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
                <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30" aria-hidden="true" />
                <p className="text-sm font-medium">No application events recorded yet</p>
              </div>
            ) : (
              <ol className="divide-y divide-border">
                {events.data!.items.map((ev) => {
                  const meta = EVENT_META[ev.type] ?? { label: ev.type, icon: null, tone: 'bg-secondary text-foreground' };
                  const isDemo = demoUserIds.has(ev.applicant.userId);
                  return (
                    <li key={ev.id} data-testid={`event-row-${ev.id}`} className="flex flex-col gap-1 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${meta.tone}`}>{meta.icon}{meta.label}</span>
                        <time dateTime={ev.createdAt} className="ml-auto text-xs text-muted-foreground whitespace-nowrap sm:hidden">{timeAgo(ev.createdAt)}</time>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-foreground">
                          {ev.applicant.firstName} {ev.applicant.lastName}
                          {isDemo && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Demo</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">Application #{ev.providerApplicationId} · {ev.fromStatus.replace('_', ' ')} → {ev.toStatus.replace('_', ' ')}</p>
                      </div>
                      <time dateTime={ev.createdAt} className="hidden text-xs text-muted-foreground whitespace-nowrap sm:block">{timeAgo(ev.createdAt)}</time>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* ── Recent credential decisions ──────────────────────────── */}
          <section data-testid="recent-credential-decisions" className="rounded-2xl border border-border bg-white p-5 shadow-sm space-y-3">
            <header className="flex flex-wrap items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-primary" aria-hidden="true" />
              <h2 className="font-serif font-bold text-lg text-foreground">Recent credential decisions</h2>
              <span className="basis-full sm:basis-auto sm:ml-auto text-xs text-muted-foreground">Document review records: approved · rejected</span>
            </header>
            {credentialEvents.isLoading ? (
              <div role="status" data-testid="recent-credential-decisions-loading" className="flex justify-center py-8"><div className="w-6 h-6 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>
            ) : credentialEvents.error ? (
              <p role="alert" data-testid="recent-credential-decisions-error" className="text-sm text-destructive">Couldn't load credential decisions. Refresh to try again.</p>
            ) : (credentialEvents.data?.items.length ?? 0) === 0 ? (
              <div data-testid="recent-credential-decisions-empty" className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
                <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30" aria-hidden="true" />
                <p className="text-sm font-medium">No credential has been decided yet</p>
              </div>
            ) : (
              <ol className="divide-y divide-border">
                {credentialEvents.data!.items.map((ev) => {
                  const meta = EVENT_META[ev.status] ?? { label: ev.status, icon: null, tone: 'bg-secondary text-foreground' };
                  const isDemo = demoUserIds.has(ev.provider.userId);
                  return (
                    <li key={ev.id} data-testid={`credential-event-row-${ev.id}`} className="flex flex-col gap-1 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${meta.tone}`}>{meta.icon}{meta.label}</span>
                        <time dateTime={ev.reviewedAt ?? undefined} className="ml-auto text-xs text-muted-foreground whitespace-nowrap sm:hidden">{timeAgo(ev.reviewedAt)}</time>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-foreground">
                          {ev.provider.firstName} {ev.provider.lastName}
                          {isDemo && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Demo</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">Document #{ev.id} · <span className="capitalize">{ev.docType}</span> · profile now {ev.provider.verificationStatus.replace('_', ' ')}</p>
                      </div>
                      <time dateTime={ev.reviewedAt ?? undefined} className="hidden text-xs text-muted-foreground whitespace-nowrap sm:block">{timeAgo(ev.reviewedAt)}</time>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <ApplicationDecisionDialog
            item={selected}
            open={selected !== null}
            onOpenChange={(open) => { if (!open) setSelected(null); }}
            pendingDocs={selected ? (pendingDocsByProfile.get(selected.applicant.providerProfileId) ?? 0) : 0}
            isDemo={selected ? demoUserIds.has(selected.applicant.userId) : false}
            onDecided={onDecided}
          />

          <CredentialDecisionDialog
            item={selectedDoc}
            open={selectedDoc !== null}
            onOpenChange={(open) => { if (!open) setSelectedDoc(null); }}
            otherPendingDocs={selectedDoc ? Math.max(0, (pendingDocsByProfile.get(selectedDoc.provider.id) ?? 1) - 1) : 0}
            isDemo={selectedDoc ? demoUserIds.has(selectedDoc.provider.userId) : false}
            onDecided={onCredentialDecided}
          />

          <EscalationResolveDialog
            item={selectedTicket}
            open={selectedTicket !== null}
            onOpenChange={(open) => { if (!open) setSelectedTicket(null); }}
            onDecided={onEscalationDecided}
          />

          <p className="text-xs text-muted-foreground text-center" data-testid="home-footnote">
            Counts are exact reads of the live database (auto-refresh every minute). No funnel, revenue or forecast figures are shown here because those events are not yet recorded.
          </p>
        </>
      )}
    </main>
  );
}
