import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Redirect, Router as WouterRouter } from 'wouter';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import Login from '@/pages/login';
import Register from '@/pages/register';
import Discover from '@/pages/discover';
import ProviderProfile from '@/pages/provider-profile';
import ClientBookings from '@/pages/bookings';
import PortalDashboard from '@/pages/portal/dashboard';
import PortalBookings from '@/pages/portal/bookings';
import PortalServices from '@/pages/portal/services';
import PortalAvailability from '@/pages/portal/availability';
import PortalEarnings from '@/pages/portal/earnings';
import PortalEarningsStatement from '@/pages/portal/earnings-statement';
import PortalProfile from '@/pages/portal/profile';
import PortalCredentials from '@/pages/portal/credentials';
import AdminVerification from '@/pages/admin/verification';
import ProviderLayout from '@/components/layout/provider-layout';
import ClientLayout from '@/components/layout/client-layout';
import { ROUTES, LEGACY_PORTAL_REDIRECTS } from '@/lib/routes';
import { Toaster } from 'sonner';

// Attach auth token to API calls
setAuthTokenGetter(() => localStorage.getItem('oncallfoot_token'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

/** Wraps a provider-portal page in the provider shell (nested layout). */
function providerRoute(Page: React.ComponentType) {
  return () => (
    <ProviderLayout>
      <Page />
    </ProviderLayout>
  );
}

/** Wraps a public client-facing page in the client shell. */
function clientRoute(Page: React.ComponentType, requireClient = false) {
  return () => (
    <ClientLayout requireClient={requireClient}>
      <Page />
    </ClientLayout>
  );
}

function Router() {
  return (
    <Switch>
      {/* Auth */}
      <Route path={ROUTES.login} component={Login} />
      <Route path={ROUTES.register} component={Register} />

      {/* Provider-first: root redirects to the provider home */}
      <Route path={ROUTES.home}>
        <Redirect to={ROUTES.provider.root} />
      </Route>

      {/* ── Provider portal (canonical /provider/*) ─────────────────────── */}
      <Route path={ROUTES.provider.dashboard}>{providerRoute(PortalDashboard)}</Route>
      <Route path={ROUTES.provider.bookings}>{providerRoute(PortalBookings)}</Route>
      <Route path={ROUTES.provider.services}>{providerRoute(PortalServices)}</Route>
      <Route path={ROUTES.provider.availability}>{providerRoute(PortalAvailability)}</Route>
      <Route path={ROUTES.provider.earningsStatement}>{providerRoute(PortalEarningsStatement)}</Route>
      <Route path={ROUTES.provider.earnings}>{providerRoute(PortalEarnings)}</Route>
      <Route path={ROUTES.provider.profile}>{providerRoute(PortalProfile)}</Route>
      <Route path={ROUTES.provider.credentials}>{providerRoute(PortalCredentials)}</Route>

      {/* ── Legacy /portal/* → /provider/* redirects (backward compat) ──── */}
      {LEGACY_PORTAL_REDIRECTS.map(({ from, to }) => (
        <Route key={from} path={from}>
          <Redirect to={to} />
        </Route>
      ))}

      {/* ── Client marketplace ──────────────────────────────────────────── */}
      <Route path={ROUTES.client.discover}>{clientRoute(Discover)}</Route>
      <Route path="/providers/:id">{clientRoute(ProviderProfile)}</Route>
      <Route path={ROUTES.client.bookings}>{clientRoute(ClientBookings, true)}</Route>

      {/* ── Admin ────────────────────────────────────────────────────────── */}
      <Route path={ROUTES.admin.verification} component={AdminVerification} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Router />
      </WouterRouter>
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}

export default App;
