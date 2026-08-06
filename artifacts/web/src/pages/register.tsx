import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useRegister, RegisterRequestRoleIntent } from '@workspace/api-client-react';
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

  useEffect(() => {
    if (location === ROUTES.register) {
      setLocation(`${ROUTES.signup}${window.location.search}`, { replace: true });
    }
  }, [location, setLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    
    register.mutate(
       { data: { firstName, lastName, email: email.trim().toLowerCase(), password, roleIntent: role, role } },
      {
        onSuccess: (res) => {
          localStorage.setItem('oncallfoot_token', res.token);
          setLocation(nextRoute(res.user));
        },
        onError: (err) => {
          const response = err as { response?: { data?: { error?: string } } };
          setError(response.response?.data?.error ?? 'Could not create account. Please check your details.');
        }
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
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="flex gap-4">
            <div className="space-y-1.5 flex-1">
              <label className="text-sm font-medium text-foreground">First Name</label>
              <input
                required
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="Jane"
              />
            </div>
            <div className="space-y-1.5 flex-1">
              <label className="text-sm font-medium text-foreground">Last Name</label>
              <input
                required
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="Doe"
              />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              placeholder="name@example.com"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Password</label>
            <input
              type="password"
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
            className="w-full py-3.5 mt-6 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-70 flex justify-center"
          >
            {register.isPending ? (
              <div className="w-6 h-6 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
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
