import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";

import Shell from "@/components/Shell";
import { AuthProvider } from "@/context/AuthContext";
import ClientHome from "@/pages/ClientHome";
import ProviderProfile from "@/pages/ProviderProfile";
import ClientBookings from "@/pages/ClientBookings";
import ProviderDashboard from "@/pages/ProviderDashboard";
import AdminPortal from "@/pages/AdminPortal";
import LoginPage from "@/pages/LoginPage";
import AuthCallback from "@/pages/AuthCallback";
import BecomeProvider from "@/pages/BecomeProvider";
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentCancel from "@/pages/PaymentCancel";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function AppRouter() {
  const location = useLocation();
  // Detect session_id fragment during render (before ProtectedRoute logic).
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<ClientHome />} />
        <Route path="/providers/:providerId" element={<ProviderProfile />} />
        <Route path="/bookings" element={<ClientBookings />} />
        <Route path="/provider" element={<ProviderDashboard />} />
        <Route path="/admin" element={<AdminPortal />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/become-provider" element={<BecomeProvider />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/payment/success" element={<PaymentSuccess />} />
        <Route path="/payment/cancel" element={<PaymentCancel />} />
      </Routes>
    </Shell>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
