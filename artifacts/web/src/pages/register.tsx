import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useRegister, RegisterRequestRole } from '@workspace/api-client-react';
import { toast } from 'sonner';
import { ROUTES } from '@/lib/routes';

export default function Register() {
  const [, setLocation] = useLocation();
  const register = useRegister();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RegisterRequestRole>('client');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    register.mutate(
      { data: { firstName, lastName, email, password, role } },
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
          toast.error('Could not create account. Please check your details.');
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
        <h1 className="text-3xl font-serif font-bold text-foreground mb-2">Create Account</h1>
        <p className="text-muted-foreground text-center mb-8">Join OnCall Foot to book or provide care.</p>
        
        <form onSubmit={handleSubmit} className="w-full space-y-4">
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
            <label className="text-sm font-medium text-foreground">I am a...</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('client')}
                className={`py-3 rounded-xl border-2 font-medium transition-all ${
                  role === 'client' 
                    ? 'border-primary bg-primary/5 text-primary' 
                    : 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                Client
              </button>
              <button
                type="button"
                onClick={() => setRole('provider')}
                className={`py-3 rounded-xl border-2 font-medium transition-all ${
                  role === 'provider' 
                    ? 'border-primary bg-primary/5 text-primary' 
                    : 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                Care Provider
              </button>
            </div>
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
