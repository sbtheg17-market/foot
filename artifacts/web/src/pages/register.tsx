import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useRegister, RegisterRequestRoleIntent } from '@workspace/api-client-react';
import SupportContactLink from '@/components/support-contact-link';
import { ROUTES } from '@/lib/routes';

function nextRoute(user: {
  role: 'client' | 'provider' | 'admin';
  providerApplication?: { status: string } | null;
}) {
  if (user.role === 'admin') return ROUTES.admin.verification;
  if (user.role === 'client') return ROUTES.client.discover;
  const status = user.providerApplication?.status;
  if (status === 'approved') return ROUTES.provider.root;
  if (status === 'under_review' || status === 'rejected' || status === 'suspended') {
    return ROUTES.provider.applicationStatus;
  }
  return ROUTES.onboarding.provider;
}

const FIELD_LABELS: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email',
  password: 'Password',
};

/** Field-specific guidance from the server's 400 validation payload. */
function serverFieldError(data: unknown): string | undefined {
  const fieldErrors = (
    data as { details?: { fieldErrors?: Record<string, string[]> } } | null
  )?.details?.fieldErrors;
  if (!fieldErrors) return undefined;
  const parts = Object.entries(fieldErrors)
    .filter(([, messages]) => messages && messages.length > 0)
    .map(([field, messages]) => `${FIELD_LABELS[field] ?? field}: ${messages[0]}`);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

export default function Register() {
  const [location, setLocation] = useLocation();
  const register = useRegister();
  const initialRole = useMemo<RegisterRequestRoleIntent>(() => {
    const requested = new URLSearchParams(window.location.search).get('role');
    return requested === 'provider' ? 'provider' : 'client';
  }, []);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RegisterRequestRoleIntent>(initialRole);
  const [error, setError] = useState('');
  const [showSupport, setShowSupport] = useState(false);
  // Synchronous in-flight guard: react-query's isPending updates on the next
  // render, so a fast double-tap (common on mobile) could fire two identical
  // requests before the button disables. The losing request used to surface
  // as "Internal server error".
  const submittingRef = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (location === ROUTES.register) {
      setLocation(`${ROUTES.signup}${window.location.search}`, { replace: true });
    }
  }, [location, setLocation]);

  // Move focus to the error summary so keyboard/screen-reader users land on it.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || register.isPending) return;
    setError('');
    setShowSupport(false);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    submittingRef.current = true;
    register.mutate(
      { data: { firstName, lastName, email: email.trim().toLowerCase(), password, roleIntent: role, role } },
      {
        onSuccess: (res) => {
          localStorage.setItem('oncallfoot_token', res.token);
          setLocation(nextRoute(res.user));
        },
        onError: (err) => {
          const apiError = err as { status?: number; data?: { error?: string } | null };
          if (apiError.status === 409) {
            setError(
              `${apiError.data?.error ?? 'An account with that email already exists.'} You can sign in below instead.`,
            );
          } else if (apiError.status === 400) {
            setError(
              serverFieldError(apiError.data) ??
                apiError.data?.error ??
                'Please check your details and try again.',
            );
          } else {
            // 5xx / network: never surface "Internal server error" to users.
            setError("We couldn't create your account right now. Please try again.");
            setShowSupport(true);
          }
        },
        onSettled: () => {
          submittingRef.current = false;
        },
      }
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6 py-12 max-w-[500px] mx-auto">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-serif font-bold text-3xl shadow-lg mb-6">
          O
        </div>
        <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Create your care account</h1>
        <p className="text-muted-foreground text-center mb-8">One account to find trusted care or build your mobile practice.</p>
        
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {error && (
            <div
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              data-testid="register-error"
              className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive focus:outline-none"
            >
              <p>{error}</p>
              {showSupport && (
                <SupportContactLink
                  testId="register-support-link"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-destructive underline underline-offset-4"
                />
              )}
            </div>
          )}
          <div className="flex gap-4">
            <div className="space-y-1.5 flex-1">
              <label htmlFor="register-first-name" className="text-sm font-medium text-foreground">First Name</label>
              <input
                id="register-first-name"
                name="firstName"
                autoComplete="given-name"
                data-testid="register-first-name-input"
                required
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="Jane"
              />
            </div>
            <div className="space-y-1.5 flex-1">
              <label htmlFor="register-last-name" className="text-sm font-medium text-foreground">Last Name</label>
              <input
                id="register-last-name"
                name="lastName"
                autoComplete="family-name"
                data-testid="register-last-name-input"
                required
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="Doe"
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label htmlFor="register-email" className="text-sm font-medium text-foreground">Email</label>
            <input
              id="register-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              data-testid="register-email-input"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              placeholder="name@example.com"
            />
          </div>
          
          <div className="space-y-1.5">
            <label htmlFor="register-password" className="text-sm font-medium text-foreground">Password</label>
            <input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              data-testid="register-password-input"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2 pt-2">
            <fieldset>
            <legend className="text-sm font-medium text-foreground mb-2">What brings you to OnCall Foot?</legend>
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => setRole('client')}
                aria-pressed={role === 'client'}
                data-testid="register-role-client"
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  role === 'client' 
                    ? 'border-primary bg-primary/5 text-primary' 
                    : 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                <span className="block font-semibold">I’m looking for care</span>
                <span className="block text-sm opacity-75 mt-1">Find a provider, request a visit, and manage appointments.</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('provider')}
                aria-pressed={role === 'provider'}
                data-testid="register-role-provider"
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  role === 'provider' 
                    ? 'border-primary bg-primary/5 text-primary' 
                    : 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                <span className="block font-semibold">I’m providing care</span>
                <span className="block text-sm opacity-75 mt-1">Offer services, manage availability, and receive bookings.</span>
              </button>
            </div>
            </fieldset>
          </div>

          <button
            type="submit"
            disabled={register.isPending}
            data-testid="register-submit-button"
            className="w-full py-3.5 mt-6 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-70 flex justify-center"
          >
            {register.isPending ? (
              <div
                aria-label="Creating your account"
                role="status"
                className="w-6 h-6 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"
              />
            ) : 'Create Account'}
          </button>
        </form>

        <p className="mt-8 text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
