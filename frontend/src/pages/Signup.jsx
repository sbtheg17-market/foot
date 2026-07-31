import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Footprints } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatApiErrorDetail } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password, name);
      navigate("/onboarding");
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
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Join OnCall Foot</h1>
          <p className="text-muted-foreground">Grow your mobile foot care practice with us.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Rivera"
              className="h-12 rounded-xl"
              data-testid="signup-name-input"
            />
          </div>
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
              data-testid="signup-email-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="h-12 rounded-xl"
              data-testid="signup-password-input"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" data-testid="signup-error">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-full text-base font-semibold active:scale-95 transition-transform duration-200"
            data-testid="signup-submit-btn"
          >
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-8 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-semibold" data-testid="go-to-login-link">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
