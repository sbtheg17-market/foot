import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Navigate } from "react-router-dom";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Onboarding from "@/pages/Onboarding";
import Home from "@/pages/Home";
import Profile from "@/pages/Profile";
import ComingSoon from "@/pages/ComingSoon";

const queryClient = new QueryClient();

const PublicOnly = ({ children }) => {
  const { user } = useAuth();
  if (user === null) return null;
  if (user) return <Navigate to={user.onboarding_complete ? "/" : "/onboarding"} replace />;
  return children;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
            <Route path="/onboarding" element={<ProtectedRoute requireOnboarding={false}><Onboarding /></ProtectedRoute>} />
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/bookings" element={<ProtectedRoute><ComingSoon title="Bookings" checkpoint={4} /></ProtectedRoute>} />
            <Route path="/services" element={<ProtectedRoute><ComingSoon title="Services" checkpoint={2} /></ProtectedRoute>} />
            <Route path="/earnings" element={<ProtectedRoute><ComingSoon title="Earnings" checkpoint={5} /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
