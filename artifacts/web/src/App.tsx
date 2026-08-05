import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import Login from '@/pages/login';
import Register from '@/pages/register';
import Discover from '@/pages/discover';
import ProviderProfile from '@/pages/provider-profile';
import PortalDashboard from '@/pages/portal/dashboard';
import PortalBookings from '@/pages/portal/bookings';
import PortalServices from '@/pages/portal/services';
import PortalAvailability from '@/pages/portal/availability';
import PortalEarnings from '@/pages/portal/earnings';
import PortalProfile from '@/pages/portal/profile';
import ProviderLayout from '@/components/layout/provider-layout';
import ClientLayout from '@/components/layout/client-layout';
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

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* Public Discovery routes */}
      <Route path="/">
        {() => (
          <ClientLayout>
            <Discover />
          </ClientLayout>
        )}
      </Route>
      <Route path="/discover">
        {() => (
          <ClientLayout>
            <Discover />
          </ClientLayout>
        )}
      </Route>
      <Route path="/providers/:id">
        {() => (
          <ClientLayout>
            <ProviderProfile />
          </ClientLayout>
        )}
      </Route>

      {/* Provider Portal routes */}
      <Route path="/portal">
        {() => (
          <ProviderLayout>
            <PortalDashboard />
          </ProviderLayout>
        )}
      </Route>
      <Route path="/portal/bookings">
        {() => (
          <ProviderLayout>
            <PortalBookings />
          </ProviderLayout>
        )}
      </Route>
      <Route path="/portal/services">
        {() => (
          <ProviderLayout>
            <PortalServices />
          </ProviderLayout>
        )}
      </Route>
      <Route path="/portal/availability">
        {() => (
          <ProviderLayout>
            <PortalAvailability />
          </ProviderLayout>
        )}
      </Route>
      <Route path="/portal/earnings">
        {() => (
          <ProviderLayout>
            <PortalEarnings />
          </ProviderLayout>
        )}
      </Route>
      <Route path="/portal/profile">
        {() => (
          <ProviderLayout>
            <PortalProfile />
          </ProviderLayout>
        )}
      </Route>

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
