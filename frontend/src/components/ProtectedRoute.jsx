import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const ProtectedRoute = ({ children, requireOnboarding = true }) => {
  const { user } = useAuth();

  if (user === null)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" data-testid="auth-loading">
        <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );

  if (user === false) return <Navigate to="/login" replace />;
  if (requireOnboarding && !user.onboarding_complete) return <Navigate to="/onboarding" replace />;
  if (!requireOnboarding && user.onboarding_complete) return <Navigate to="/" replace />;

  return children;
};
