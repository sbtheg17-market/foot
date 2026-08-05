import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useLogin } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { ROUTES } from '@/lib/routes';

export default function Login() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(
      { data: { email, password } },
      {
        onSuccess: (res) => {
          localStorage.setItem('oncallfoot_token', res.token);
          if (res.user.role === 'provider') {
            setLocation(ROUTES.provider.root);
          } else {
            setLocation(ROUTES.client.discover);
          }
        },
        onError: () => {
          toast.error('Invalid email or password');
        }
      }
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6 max-w-[500px] mx-auto">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-serif font-bold text-3xl shadow-lg mb-8">
          O
        </div>
        <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Welcome back</h1>
        <p className="text-muted-foreground text-center mb-8">Sign in to manage your appointments and services.</p>
        
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              placeholder="name@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={login.isPending}
            className="w-full py-3.5 mt-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-70 flex justify-center"
          >
            {login.isPending ? (
              <div className="w-6 h-6 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : 'Sign In'}
          </button>
        </form>

        <p className="mt-8 text-sm text-muted-foreground">
          Don't have an account?{' '}
          <Link href="/register" className="font-semibold text-primary hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
