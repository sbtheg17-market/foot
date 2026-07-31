import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Footprints } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatApiErrorDetail } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(email, password);
      navigate(u.onboarding_complete ? "/" : "/onboarding");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-md mx-auto w-full">
        <div className="mb-10">
          <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mb-6">
            <Footprints className="text-primary-foreground" size={28} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Welcome back</h1>
          <p className="text-muted-foreground">Sign in to manage your foot care practice.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-12 rounded-xl"
              data-testid="login-email-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-12 rounded-xl"
              data-testid="login-password-input"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" data-testid="login-error">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-full text-base font-semibold active:scale-95 transition-transform duration-200"
            data-testid="login-submit-btn"
          >
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="mt-8 text-sm text-muted-foreground">
          New to OnCall Foot?{" "}
          <Link to="/signup" className="text-primary font-semibold" data-testid="go-to-signup-link">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
