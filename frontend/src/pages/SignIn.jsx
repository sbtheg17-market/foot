import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { HeartHandshake, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setToken } from "@/lib/session";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const expired = new URLSearchParams(location.search).get("expired") === "1";
  const signedOut = new URLSearchParams(location.search).get("signedout") === "1";

  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const payload =
        mode === "login" ? { email, password } : { email, password, name };
      const res = await axios.post(`${API}${path}`, payload);
      setToken(res.data.token);
      toast.success(
        mode === "login" ? "Welcome back!" : "Account created — welcome!"
      );
      navigate("/portal");
    } catch (err) {
      const s = err.response?.status;
      if (s === 401) setError("Invalid email or password.");
      else if (s === 409) setError("An account with this email already exists.");
      else if (s === 400)
        setError(err.response?.data?.detail || "Please check your details.");
      else setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-left">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50">
            <HeartHandshake className="text-teal-600" size={22} />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Patient sign in</h1>
            <p className="text-sm text-slate-500">Manage your comfort profile</p>
          </div>
        </div>

        {expired && (
          <div
            data-testid="signin-session-expired"
            className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800"
          >
            Session expired — please sign in again.
          </div>
        )}
        {signedOut && (
          <div
            data-testid="signin-signed-out"
            className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm text-teal-800"
          >
            You’ve been signed out.
          </div>
        )}

        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-50 p-1">
            {[
              ["login", "Sign in"],
              ["register", "Create account"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                data-testid={`signin-mode-${value}`}
                onClick={() => {
                  setMode(value);
                  setError(null);
                }}
                className={
                  "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
                  (mode === value
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-500 hover:text-slate-800")
                }
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "register" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="name">
                Name
              </label>
              <Input
                id="name"
                data-testid="signin-name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border-slate-200 focus-visible:ring-teal-500"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              data-testid="signin-email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-slate-200 focus-visible:ring-teal-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              type="password"
              data-testid="signin-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-slate-200 focus-visible:ring-teal-500"
            />
          </div>

          {error && (
            <p data-testid="signin-error" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <Button
            type="submit"
            data-testid="signin-submit"
            disabled={busy}
            className="w-full bg-teal-600 text-white hover:bg-teal-700"
          >
            {busy && <Loader2 size={16} className="mr-1.5 animate-spin" />}
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>
      </div>
    </main>
  );
}
