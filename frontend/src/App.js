import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ProviderLayout } from "@/layouts/ProviderLayout";
import { ROUTES } from "@/lib/routes";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Onboarding from "@/pages/Onboarding";
import Home from "@/pages/Home";
import Profile from "@/pages/Profile";
import ComingSoon from "@/pages/ComingSoon";
import ServicesPage from "@/features/services/ServicesPage";
import AvailabilityPage from "@/features/availability/AvailabilityPage";
import BookingsPage from "@/features/bookings/BookingsPage";
import BookingDetailPage from "@/features/bookings/BookingDetailPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

const PublicOnly = ({ children }) => {
  const { user } = useAuth();
  if (user === null) return null;
  if (user) return <Navigate to={user.onboarding_complete ? ROUTES.provider.home : ROUTES.auth.onboarding} replace />;
  return children;
};

const ProviderRoutes = () => (
  <ProtectedRoute>
    <ProviderLayout />
  </ProtectedRoute>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public / auth flow */}
            <Route path={ROUTES.auth.login} element={<PublicOnly><Login /></PublicOnly>} />
            <Route path={ROUTES.auth.signup} element={<PublicOnly><Signup /></PublicOnly>} />
            <Route
              path={ROUTES.auth.onboarding}
              element={<ProtectedRoute requireOnboarding={false}><Onboarding /></ProtectedRoute>}
            />

            {/* Provider portal (nested layout) */}
            <Route element={<ProviderRoutes />}>
              <Route path={ROUTES.provider.home} element={<Home />} />
              <Route path={ROUTES.provider.services} element={<ServicesPage />} />
              <Route path={ROUTES.provider.availability} element={<AvailabilityPage />} />
              <Route path={ROUTES.provider.bookings} element={<BookingsPage />} />
              <Route path="/provider/bookings/:id" element={<BookingDetailPage />} />
              <Route path={ROUTES.provider.earnings} element={<ComingSoon title="Earnings" checkpoint={5} />} />
              <Route path={ROUTES.provider.profile} element={<Profile />} />
            </Route>

            {/* Root -> canonical provider home for now */}
            <Route path="/" element={<Navigate to={ROUTES.provider.home} replace />} />
            <Route path="*" element={<Navigate to={ROUTES.provider.home} replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
